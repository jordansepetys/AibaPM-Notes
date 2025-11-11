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
} from '../db/database.js';
import { saveAudioFile, validateAudioFile } from '../services/audioProcessor.js';
import { transcribeWithRetry, saveTranscript } from '../services/transcription.js';
import { analyzeMeeting, saveSummary } from '../services/aiAnalysis.js';
import { buildSearchIndex } from '../services/searchIndex.js';

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
router.get('/:id', (req, res, next) => {
  try {
    const { id } = req.params;

    const meeting = getMeetingById.get(parseInt(id, 10));

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Get metadata if exists
    const metadata = getMeetingMetadata.get(parseInt(id, 10));

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
 * POST /api/meetings/:id/reprocess
 * Re-transcribe and analyze a meeting
 */
router.post('/:id/reprocess', async (req, res, next) => {
  try {
    const { id } = req.params;

    const meeting = getMeetingById.get(parseInt(id, 10));

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
    const clearedMeeting = getMeetingById.get(parseInt(id, 10));

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
 * DELETE /api/meetings/:id
 * Delete a meeting
 */
router.delete('/:id', (req, res, next) => {
  try {
    const { id } = req.params;

    const meeting = getMeetingById.get(parseInt(id, 10));

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Delete from database (cascade will handle metadata and search index)
    deleteMeeting.run(parseInt(id, 10));

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
    // - Small files (<10MB): 5 minutes
    // - Medium files (10-30MB): 10 minutes
    // - Large files (30-50MB): 15 minutes
    // - Very large files (50-80MB): 30 minutes (with retries + smaller chunks)
    // - Huge files (>80MB): 45 minutes
    if (fileSizeMB < 10) {
      return 5 * 60 * 1000; // 5 minutes
    } else if (fileSizeMB < 30) {
      return 10 * 60 * 1000; // 10 minutes
    } else if (fileSizeMB < 50) {
      return 15 * 60 * 1000; // 15 minutes
    } else if (fileSizeMB < 80) {
      return 30 * 60 * 1000; // 30 minutes (50MB+ files use 5-min chunks + 5 retries)
    } else {
      return 45 * 60 * 1000; // 45 minutes for huge files
    }
  } catch (error) {
    console.warn('Could not determine file size, using default timeout:', error.message);
    return 10 * 60 * 1000; // Default 10 minutes
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

    // Wrap the entire processing in a timeout
    await withTimeout(
      (async () => {
        // Step 1: Transcribe audio (with automatic chunking for large files)
        console.log('Step 1: Transcribing audio...');
        const transcription = await transcribeWithRetry(audioPath, meetingId);

        // Step 2: Save transcript
        console.log('Step 2: Saving transcript...');
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
        const analysis = await analyzeMeeting(transcription.text);

        // Step 4: Save summary
        console.log('Step 4: Saving summary...');
        const summaryPath = await saveSummary(analysis, meetingId);

        // Step 5: Update meeting record
        console.log('Step 5: Updating meeting record...');
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

        // Step 6: Save metadata
        console.log('Step 6: Saving metadata...');
        const existingMetadata = getMeetingMetadata.get(meetingId);

        // Extract AI model metadata
        const aiModelInfo = analysis._metadata ? JSON.stringify(analysis._metadata) : null;

        // New format: discussion_topics, context, detailed_discussion
        // Old format for backwards compatibility: risks, open_questions (empty arrays)
        if (existingMetadata) {
          updateMeetingMetadata.run(
            JSON.stringify(analysis.key_decisions || []),
            JSON.stringify(analysis.action_items || []),
            JSON.stringify([]), // risks - deprecated
            JSON.stringify([]), // open_questions - deprecated
            aiModelInfo, // AI model metadata
            meetingId
          );
        } else {
          createMeetingMetadata.run(
            meetingId,
            JSON.stringify(analysis.key_decisions || []),
            JSON.stringify(analysis.action_items || []),
            JSON.stringify([]), // risks - deprecated
            JSON.stringify([]),  // open_questions - deprecated
            aiModelInfo // AI model metadata
          );
        }

        // Step 7: Build search index
        console.log('Step 7: Building search index...');
        await buildSearchIndex(meetingId, transcription.text, analysis);

        console.log(`=== Meeting ${meetingId} processing complete ===\n`);
      })(),
      PROCESSING_TIMEOUT,
      `Meeting ${meetingId} processing`
    );
  } catch (error) {
    console.error(`Failed to process meeting ${meetingId}:`, error);

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

export default router;
