import express from 'express';
import path from 'path';
import fs from 'fs/promises';
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
 * Create a new meeting with typed notes
 */
router.post('/', async (req, res, next) => {
  try {
    const { projectId, title, notes } = req.body;

    // Validate required fields
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    if (!notes || !notes.trim()) {
      return res.status(400).json({ error: 'Notes are required' });
    }

    // Create meeting record with current date
    const date = new Date().toISOString();
    const result = createMeeting.run(
      projectId ? parseInt(projectId, 10) : null,
      title.trim(),
      date,
      null, // duration (not applicable for notes)
      null, // audio_path (no audio in notes version)
      null, // transcript_path (will be set after saving notes)
      null  // summary_path (will be set after analysis)
    );

    const meetingId = result.lastInsertRowid;

    // Start async processing (save notes + analysis)
    // In production, this should be a background job
    processNotesMeeting(meetingId, notes.trim(), title.trim(), date).catch(error => {
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
 * Save notes to a text file
 * @param {string} notes - The meeting notes
 * @param {number} meetingId - Meeting ID for filename
 * @param {object} metadata - Meeting metadata (title, date)
 * @returns {Promise<string>} Path to saved notes file
 */
async function saveNotes(notes, meetingId, metadata) {
  const transcriptsDir = path.join(process.cwd(), 'backend', 'storage', 'transcripts');

  // Ensure directory exists
  await fs.mkdir(transcriptsDir, { recursive: true });

  // Save as .txt file
  const txtPath = path.join(transcriptsDir, `meeting-${meetingId}.txt`);
  const content = `Meeting: ${metadata.title}\nDate: ${metadata.date}\n\n${notes}`;
  await fs.writeFile(txtPath, content, 'utf8');

  return txtPath.replace(/\\/g, '/');
}

/**
 * Background processing function for notes
 * Handles saving notes, analysis, and indexing (no transcription needed)
 */
async function processNotesMeeting(meetingId, notes, title, date) {
  const PROCESSING_TIMEOUT = 5 * 60 * 1000; // 5 minutes timeout

  try {
    console.log(`\n=== Processing meeting notes ${meetingId} ===`);

    // Step 1: Save notes as transcript
    console.log('Step 1: Saving notes...');
    const notesPath = await saveNotes(notes, meetingId, { title, date });

    // Step 2: Analyze notes
    console.log('Step 2: Analyzing meeting notes...');
    const analysis = await analyzeMeeting(notes);

    // Step 3: Save summary
    console.log('Step 3: Saving summary...');
    const summaryPath = await saveSummary(analysis, meetingId);

    // Step 4: Update meeting record
    console.log('Step 4: Updating meeting record...');
    const meeting = getMeetingById.get(meetingId);
    updateMeeting.run(
      meeting.title,
      meeting.date,
      null, // duration (not applicable for notes)
      null, // audio_path (no audio)
      notesPath,
      summaryPath,
      meetingId
    );

    // Step 5: Save metadata
    console.log('Step 5: Saving metadata...');
    const existingMetadata = getMeetingMetadata.get(meetingId);

    // Extract AI model metadata
    const aiModelInfo = analysis._metadata ? JSON.stringify(analysis._metadata) : null;

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

    // Step 6: Build search index
    console.log('Step 6: Building search index...');
    await buildSearchIndex(meetingId, notes, analysis);

    console.log(`=== Meeting ${meetingId} processing complete ===\n`);
  } catch (error) {
    console.error(`Failed to process meeting ${meetingId}:`, error);

    // Mark the meeting with an error by setting transcript_path to an error marker
    try {
      const meeting = getMeetingById.get(meetingId);
      updateMeeting.run(
        meeting.title,
        meeting.date,
        null,
        null,
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
