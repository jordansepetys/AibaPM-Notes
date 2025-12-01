import express from 'express';
import {
  createMeeting,
  getAllMeetings,
  getMeetingById,
  getMeetingsByProject,
  updateMeeting,
  deleteMeeting,
  createMeetingMetadata,
  getMeetingMetadata,
  updateMeetingMetadata,
  runTransaction,
} from '../db/database.js';
import { saveAudioFile, validateAudioFile } from '../services/audioProcessor.js';
import { transcribeWithRetry, saveTranscript } from '../services/transcription.js';
import { analyzeMeeting, saveSummary } from '../services/aiAnalysis.js';
import { buildSearchIndex } from '../services/searchIndex.js';
import { validate, idParamSchema, createMeetingSchema } from '../middleware/validation.js';
import { emitMeetingStatus, MeetingStatus } from '../services/socketService.js';

const router = express.Router();

/**
 * GET /api/meetings
 * Get all meetings or filter by project
 */
router.get('/', (req, res, next) => {
  try {
    const { projectId } = req.query;

    let meetings;
    if (projectId) {
      meetings = getMeetingsByProject.all(parseInt(projectId, 10));
    } else {
      meetings = getAllMeetings.all();
    }

    res.json({ meetings });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/meetings/:id
 * Get meeting details with metadata
 */
router.get('/:id', validate(idParamSchema, 'params'), (req, res, next) => {
  try {
    const { id } = req.params;

    const meeting = getMeetingById.get(id);

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Get metadata if exists
    const metadata = getMeetingMetadata.get(id);

    res.json({
      meeting,
      metadata: metadata || null,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/meetings
 * Create a new meeting with audio upload
 */
router.post('/', async (req, res, next) => {
  const upload = req.app.get('upload');

  upload.single('audio')(req, res, async (err) => {
    if (err) {
      return next(err);
    }

    try {
      const { projectId, title, date } = req.body;
      const audioFile = req.file;

      // Validate required fields
      if (!title || !date) {
        return res.status(400).json({ error: 'Title and date are required' });
      }

      if (!audioFile) {
        return res.status(400).json({ error: 'Audio file is required' });
      }

      // Validate audio file
      const validation = validateAudioFile(audioFile.mimetype, audioFile.size);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      // Create meeting record
      const result = createMeeting.run(
        projectId ? parseInt(projectId, 10) : null,
        title,
        date,
        null, // duration (will be set after transcription)
        audioFile.path.replace(/\\/g, '/'), // audio_path
        null, // transcript_path
        null  // summary_path
      );

      const meetingId = result.lastInsertRowid;

      // Start async processing (transcription + analysis)
      // In production, this should be a background job
      processMeeting(meetingId, audioFile.path, title, date).catch(error => {
        console.error(`Error processing meeting ${meetingId}:`, error);
      });

      const meeting = getMeetingById.get(meetingId);

      res.status(201).json({
        message: 'Meeting created successfully. Processing in background.',
        meeting,
      });
    } catch (error) {
      next(error);
    }
  });
});

/**
 * POST /api/meetings/transcript
 * Create a new meeting from uploaded transcript text (no audio recording)
 */
router.post('/transcript', async (req, res, next) => {
  try {
    const { projectId, title, date, transcript } = req.body;

    // Validate required fields
    if (!title || !date || !transcript) {
      return res.status(400).json({ error: 'Title, date, and transcript are required' });
    }

    if (transcript.length < 50) {
      return res.status(400).json({ error: 'Transcript too short. Please provide at least 50 characters.' });
    }

    // Create meeting record (no audio file)
    const result = createMeeting.run(
      projectId ? parseInt(projectId, 10) : null,
      title,
      date,
      null, // duration (will estimate from text length)
      null, // audio_path - no audio for transcript uploads
      null, // transcript_path
      null  // summary_path
    );

    const meetingId = result.lastInsertRowid;
    console.log(`[Meeting ${meetingId}] Created from transcript upload (${transcript.length} chars)`);

    const meeting = getMeetingById.get(meetingId);

    // Return immediately, process in background
    res.status(201).json({
      id: meetingId,
      message: 'Transcript received, processing...',
      meeting,
      status: 'processing'
    });

    // Process transcript in background
    processTranscriptOnly(meetingId, transcript, title, date).catch(error => {
      console.error(`[Meeting ${meetingId}] Processing failed:`, error);
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/meetings/:id/reprocess
 * Re-transcribe and analyze a meeting
 */
router.post('/:id/reprocess', validate(idParamSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const meeting = getMeetingById.get(id);

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    if (!meeting.audio_path) {
      return res.status(400).json({ error: 'No audio file associated with this meeting' });
    }

    // Clear old error status and paths so frontend shows processing state
    console.log(`Clearing error status for meeting ${meeting.id} before reprocessing...`);
    updateMeeting.run(
      meeting.title,
      meeting.date,
      0, // duration
      meeting.audio_path,
      null, // Clear transcript_path (removes ERROR status)
      null, // Clear summary_path
      meeting.id
    );

    // Get updated meeting to return
    const clearedMeeting = getMeetingById.get(id);

    // Start reprocessing
    processMeeting(meeting.id, meeting.audio_path, meeting.title, meeting.date).catch(error => {
      console.error(`Error reprocessing meeting ${meeting.id}:`, error);
    });

    res.json({
      message: 'Meeting reprocessing started',
      meeting: clearedMeeting, // Return meeting with cleared status
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/meetings/:id/cancel
 * Cancel/stop processing for a meeting (resets to allow reprocessing)
 */
router.post('/:id/cancel', validate(idParamSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const meeting = getMeetingById.get(id);

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Mark as cancelled - this won't stop the running process but will reset the state
    console.log(`Cancelling processing for meeting ${meeting.id}...`);
    updateMeeting.run(
      meeting.title,
      meeting.date,
      0, // duration
      meeting.audio_path,
      'CANCELLED', // Mark as cancelled so frontend knows
      null, // Clear summary_path
      meeting.id
    );

    // Emit cancelled status via socket
    emitMeetingStatus(id, 'CANCELLED', { message: 'Processing cancelled by user' });

    // Get updated meeting to return
    const cancelledMeeting = getMeetingById.get(id);

    res.json({
      message: 'Processing cancelled. Click "Reprocess Meeting" to try again.',
      meeting: cancelledMeeting,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/meetings/:id
 * Delete a meeting
 */
router.delete('/:id', validate(idParamSchema, 'params'), (req, res, next) => {
  try {
    const { id } = req.params;

    const meeting = getMeetingById.get(id);

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Delete from database (cascade will handle metadata and search index)
    deleteMeeting.run(id);

    // Note: Audio/transcript files are kept until cleanup cron runs

    res.json({
      message: 'Meeting deleted successfully',
      meeting,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Wrap async function with timeout
 * @param {Promise} promise - Promise to wrap
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} operationName - Name of operation for error message
 * @returns {Promise} Promise that rejects if timeout is exceeded
 */
function withTimeout(promise, timeoutMs, operationName) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${operationName} timed out after ${timeoutMs / 1000}s`)), timeoutMs)
    ),
  ]);
}

/**
 * Calculate adaptive timeout based on file size
 * @param {string} audioPath - Path to audio file
 * @returns {number} Timeout in milliseconds
 */
async function calculateTimeout(audioPath) {
  try {
    const fs = await import('fs/promises');
    const stats = await fs.stat(audioPath);
    const fileSizeMB = stats.size / (1024 * 1024);

    // Adaptive timeout based on file size:
    // Timeouts account for: chunking, transcription, network retries (up to 155s/chunk), and AI analysis
    // - Small files (<10MB): 8 minutes (single chunk + retries + AI)
    // - Medium files (10-30MB): 15 minutes (2-3 chunks + retries + AI)
    // - Large files (30-50MB): 40 minutes (4-5 chunks + retries + AI)
    // - Very large files (50-80MB): 50 minutes (6-8 chunks with 5-min segments + retries)
    // - Huge files (>80MB): 75 minutes (many chunks + retries)
    if (fileSizeMB < 10) {
      return 8 * 60 * 1000; // 8 minutes
    } else if (fileSizeMB < 30) {
      return 15 * 60 * 1000; // 15 minutes
    } else if (fileSizeMB < 50) {
      return 40 * 60 * 1000; // 40 minutes - increased for long recordings with chunking
    } else if (fileSizeMB < 80) {
      return 50 * 60 * 1000; // 50 minutes - increased for better reliability
    } else {
      return 75 * 60 * 1000; // 75 minutes for huge files - increased for safety
    }
  } catch (error) {
    console.warn('Could not determine file size, using default timeout:', error.message);
    return 15 * 60 * 1000; // Default 15 minutes
  }
}

/**
 * Background processing function
 * Handles transcription, analysis, and indexing
 */
async function processMeeting(meetingId, audioPath, title, date) {
  // Calculate adaptive timeout based on file size
  const PROCESSING_TIMEOUT = await calculateTimeout(audioPath);

  try {
    console.log(`\n=== Processing meeting ${meetingId} (timeout: ${PROCESSING_TIMEOUT / 1000}s) ===`);

    // Emit processing started status
    emitMeetingStatus(meetingId, MeetingStatus.PROCESSING_STARTED);

    // Wrap the entire processing in a timeout
    await withTimeout(
      (async () => {
        // Step 1: Transcribe audio (with automatic chunking for large files)
        console.log('Step 1: Transcribing audio...');
        emitMeetingStatus(meetingId, MeetingStatus.TRANSCRIBING, { message: 'Transcribing audio with OpenAI Whisper...' });
        const transcription = await transcribeWithRetry(audioPath, meetingId);

        // Step 2: Save transcript
        console.log('Step 2: Saving transcript...');
        emitMeetingStatus(meetingId, MeetingStatus.SAVING, { message: 'Saving transcript...' });
        const transcriptPaths = await saveTranscript(
          transcription.text,
          meetingId,
          {
            title,
            date,
            duration: transcription.duration,
            segments: transcription.segments,
          }
        );

        // Step 3: Analyze transcript
        console.log('Step 3: Analyzing meeting...');
        emitMeetingStatus(meetingId, MeetingStatus.ANALYZING, { message: 'Generating AI summary...' });
        const analysis = await analyzeMeeting(transcription.text);

        // Step 4: Save summary
        console.log('Step 4: Saving summary...');
        const summaryPath = await saveSummary(analysis, meetingId);

        // Step 5 & 6: Update meeting record and metadata in a transaction
        console.log('Step 5 & 6: Updating meeting record and metadata (transaction)...');
        runTransaction(() => {
          const meeting = getMeetingById.get(meetingId);
          updateMeeting.run(
            meeting.title,
            meeting.date,
            Math.floor(transcription.duration || 0),
            meeting.audio_path,
            transcriptPaths.txtPath,
            summaryPath,
            meetingId
          );

          // Extract AI model metadata
          const aiModelInfo = analysis._metadata ? JSON.stringify(analysis._metadata) : null;
          const existingMetadata = getMeetingMetadata.get(meetingId);

          if (existingMetadata) {
            updateMeetingMetadata.run(
              JSON.stringify(analysis.key_decisions || []),
              JSON.stringify(analysis.action_items || []),
              JSON.stringify([]), // risks - deprecated
              JSON.stringify([]), // open_questions - deprecated
              aiModelInfo,
              meetingId
            );
          } else {
            createMeetingMetadata.run(
              meetingId,
              JSON.stringify(analysis.key_decisions || []),
              JSON.stringify(analysis.action_items || []),
              JSON.stringify([]), // risks - deprecated
              JSON.stringify([]), // open_questions - deprecated
              aiModelInfo
            );
          }
        });

        // Step 7: Build search index
        console.log('Step 7: Building search index...');
        await buildSearchIndex(meetingId, transcription.text, analysis);

        console.log(`=== Meeting ${meetingId} processing complete ===\n`);

        // Emit completion status
        const completedMeeting = getMeetingById.get(meetingId);
        emitMeetingStatus(meetingId, MeetingStatus.COMPLETED, { meeting: completedMeeting });
      })(),
      PROCESSING_TIMEOUT,
      `Meeting ${meetingId} processing`
    );
  } catch (error) {
    console.error(`Failed to process meeting ${meetingId}:`, error);

    // Emit error status
    emitMeetingStatus(meetingId, MeetingStatus.ERROR, { error: error.message });

    // Mark the meeting with an error by setting transcript_path to an error marker
    // This prevents infinite polling on the frontend
    try {
      const meeting = getMeetingById.get(meetingId);
      updateMeeting.run(
        meeting.title,
        meeting.date,
        0, // duration
        meeting.audio_path,
        `ERROR: ${error.message}`, // transcript_path used as error marker
        null, // summary_path
        meetingId
      );
      console.error(`Marked meeting ${meetingId} with error status`);
    } catch (updateError) {
      console.error(`Failed to mark meeting ${meetingId} with error:`, updateError);
    }

    throw error;
  }
}

/**
 * Background processing function for transcript-only uploads
 * Skips transcription step since text is already provided
 */
async function processTranscriptOnly(meetingId, transcriptText, title, date) {
  const fs = await import('fs/promises');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  try {
    console.log(`\n=== Processing transcript for meeting ${meetingId} ===`);

    // Emit processing started status
    emitMeetingStatus(meetingId, MeetingStatus.PROCESSING_STARTED);

    // Step 1: Save transcript to file
    console.log('Step 1: Saving transcript...');
    emitMeetingStatus(meetingId, MeetingStatus.SAVING, { message: 'Saving transcript...' });

    const timestamp = Date.now();
    const transcriptDir = path.join(__dirname, '../../storage/transcripts');
    const txtPath = path.join(transcriptDir, `meeting-${meetingId}-${timestamp}.txt`);
    const mdPath = path.join(transcriptDir, `meeting-${meetingId}-${timestamp}.md`);

    await fs.mkdir(transcriptDir, { recursive: true });
    await fs.writeFile(txtPath, transcriptText);
    await fs.writeFile(mdPath, `# Meeting Transcript: ${title}\n\nDate: ${date}\n\n---\n\n${transcriptText}`);

    // Estimate duration from text length (rough: 150 words/minute, 5 chars/word)
    const estimatedMinutes = Math.ceil(transcriptText.length / (150 * 5));
    const estimatedDuration = estimatedMinutes * 60;

    // Step 2: Analyze transcript with AI
    console.log('Step 2: Analyzing meeting...');
    emitMeetingStatus(meetingId, MeetingStatus.ANALYZING, { message: 'Generating AI summary...' });
    const analysis = await analyzeMeeting(transcriptText);

    // Step 3: Save summary
    console.log('Step 3: Saving summary...');
    const summaryPath = await saveSummary(analysis, meetingId);

    // Step 4 & 5: Update meeting record and metadata in a transaction
    console.log('Step 4 & 5: Updating meeting record and metadata...');
    runTransaction(() => {
      const meeting = getMeetingById.get(meetingId);
      updateMeeting.run(
        meeting.title,
        meeting.date,
        estimatedDuration,
        null, // No audio path for transcript uploads
        txtPath.replace(/\\/g, '/'),
        summaryPath,
        meetingId
      );

      // Extract AI model metadata
      const aiModelInfo = analysis._metadata ? JSON.stringify(analysis._metadata) : null;
      const existingMetadata = getMeetingMetadata.get(meetingId);

      if (existingMetadata) {
        updateMeetingMetadata.run(
          JSON.stringify(analysis.key_decisions || []),
          JSON.stringify(analysis.action_items || []),
          JSON.stringify([]), // risks - deprecated
          JSON.stringify([]), // open_questions - deprecated
          aiModelInfo,
          meetingId
        );
      } else {
        createMeetingMetadata.run(
          meetingId,
          JSON.stringify(analysis.key_decisions || []),
          JSON.stringify(analysis.action_items || []),
          JSON.stringify([]), // risks - deprecated
          JSON.stringify([]), // open_questions - deprecated
          aiModelInfo
        );
      }
    });

    // Step 6: Build search index
    console.log('Step 6: Building search index...');
    await buildSearchIndex(meetingId, transcriptText, analysis);

    console.log(`=== Meeting ${meetingId} transcript processing complete ===\n`);

    // Emit completion status
    const completedMeeting = getMeetingById.get(meetingId);
    emitMeetingStatus(meetingId, MeetingStatus.COMPLETED, { meeting: completedMeeting });

  } catch (error) {
    console.error(`Failed to process transcript for meeting ${meetingId}:`, error);

    // Emit error status
    emitMeetingStatus(meetingId, MeetingStatus.ERROR, { error: error.message });

    // Mark the meeting with an error
    try {
      const meeting = getMeetingById.get(meetingId);
      updateMeeting.run(
        meeting.title,
        meeting.date,
        0,
        null,
        `ERROR: ${error.message}`,
        null,
        meetingId
      );
    } catch (updateError) {
      console.error(`Failed to mark meeting ${meetingId} with error:`, updateError);
    }

    throw error;
  }
}

export default router;
