import express from 'express';
import { searchMeetings, rebuildSearchIndex } from '../services/searchIndex.js';
import { getAllMeetings } from '../db/database.js';
import { readTranscript } from '../services/transcription.js';
import { readSummary } from '../services/aiAnalysis.js';

const router = express.Router();

/**
 * GET /api/search
 * Search for meetings
 * Query params:
 *   - q: search query (required)
 *   - project: project ID filter (optional)
 */
router.get('/', async (req, res, next) => {
  try {
    const { q, project } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: 'Search query (q) is required' });
    }

    const projectId = project ? parseInt(project, 10) : null;

    const results = await searchMeetings(q, projectId);

    res.json({
      query: q,
      projectFilter: projectId,
      count: results.length,
      results,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/search/rebuild
 * Rebuild the entire search index
 */
router.post('/rebuild', async (req, res, next) => {
  try {
    console.log('Rebuilding search index...');

    const indexedCount = await rebuildSearchIndex(
      () => getAllMeetings.all(),
      readTranscript,
      readSummary
    );

    res.json({
      message: 'Search index rebuilt successfully',
      indexedCount,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
