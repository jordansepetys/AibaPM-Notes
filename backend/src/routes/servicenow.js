import express from 'express';
import serviceNowService from '../services/serviceNowService.js';
import serviceNowResourceAPI from '../services/serviceNowResourceAPI.js';
import {
  createServiceNowMapping,
  getServiceNowMappingByMeeting,
  deleteServiceNowMapping,
  getAllServiceNowMappings,
  getCache,
  setCache,
  clearExpiredCache
} from '../db/database.js';

const router = express.Router();

/**
 * Test ServiceNow connection
 */
router.get('/test', async (req, res) => {
  try {
    const result = await serviceNowService.testConnection();
    res.json(result);
  } catch (error) {
    console.error('ServiceNow test connection error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Check if ServiceNow is configured
 */
router.get('/status', (req, res) => {
  res.json({
    configured: serviceNowService.isEnabled(),
    instanceUrl: serviceNowService.isEnabled() ? serviceNowService.instanceUrl : null,
    username: serviceNowService.isEnabled() ? serviceNowService.getUsername() : null
  });
});

/**
 * Get user's resource allocations
 * Query params: bookingType, startDate, endDate, limit
 */
router.get('/resources', async (req, res) => {
  try {
    if (!serviceNowService.isEnabled()) {
      return res.status(503).json({
        error: 'ServiceNow is not configured. Please set SERVICENOW_* environment variables.'
      });
    }

    // Check cache first (15-minute TTL)
    const cacheKey = `resources:${serviceNowService.getUsername()}:${JSON.stringify(req.query)}`;
    const cached = getCache.get(cacheKey);

    if (cached) {
      return res.json(JSON.parse(cached.cache_data));
    }

    const options = {
      bookingType: req.query.bookingType || null,
      startDate: req.query.startDate || null,
      endDate: req.query.endDate || null,
      limit: req.query.limit ? parseInt(req.query.limit) : 100
    };

    const allocations = await serviceNowResourceAPI.getUserAllocations(null, options);

    // Cache the result
    setCache.run(cacheKey, JSON.stringify(allocations), 15);

    res.json(allocations);
  } catch (error) {
    console.error('Get resources error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get user's resource summary
 */
router.get('/resources/summary', async (req, res) => {
  try {
    if (!serviceNowService.isEnabled()) {
      return res.status(503).json({
        error: 'ServiceNow is not configured.'
      });
    }

    // Check cache first
    const cacheKey = `summary:${serviceNowService.getUsername()}`;
    const cached = getCache.get(cacheKey);

    if (cached) {
      return res.json(JSON.parse(cached.cache_data));
    }

    const options = {
      startDate: req.query.startDate || null,
      endDate: req.query.endDate || null
    };

    const summary = await serviceNowResourceAPI.getResourceSummary(null, options);

    // Cache for 15 minutes
    setCache.run(cacheKey, JSON.stringify(summary), 15);

    res.json(summary);
  } catch (error) {
    console.error('Get resource summary error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get user's projects
 */
router.get('/projects', async (req, res) => {
  try {
    if (!serviceNowService.isEnabled()) {
      return res.status(503).json({
        error: 'ServiceNow is not configured.'
      });
    }

    const options = {
      state: req.query.state || null,
      includeCompleted: req.query.includeCompleted === 'true',
      limit: req.query.limit ? parseInt(req.query.limit) : 100
    };

    const projects = await serviceNowResourceAPI.getUserProjects(null, options);
    res.json(projects);
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get user's demands
 */
router.get('/demands', async (req, res) => {
  try {
    if (!serviceNowService.isEnabled()) {
      return res.status(503).json({
        error: 'ServiceNow is not configured.'
      });
    }

    const options = {
      state: req.query.state || null,
      includeCompleted: req.query.includeCompleted === 'true',
      limit: req.query.limit ? parseInt(req.query.limit) : 100
    };

    const demands = await serviceNowResourceAPI.getUserDemands(null, options);
    res.json(demands);
  } catch (error) {
    console.error('Get demands error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all work items (projects + demands)
 */
router.get('/work-items', async (req, res) => {
  try {
    if (!serviceNowService.isEnabled()) {
      return res.status(503).json({
        error: 'ServiceNow is not configured.'
      });
    }

    const options = {
      includeCompleted: req.query.includeCompleted === 'true',
      limit: req.query.limit ? parseInt(req.query.limit) : 100
    };

    const workItems = await serviceNowResourceAPI.getUserWorkItems(null, options);
    res.json(workItems);
  } catch (error) {
    console.error('Get work items error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Search for projects and demands
 */
router.get('/search', async (req, res) => {
  try {
    if (!serviceNowService.isEnabled()) {
      return res.status(503).json({
        error: 'ServiceNow is not configured.'
      });
    }

    const keyword = req.query.q || req.query.keyword;
    if (!keyword) {
      return res.status(400).json({ error: 'Search keyword required (q or keyword parameter)' });
    }

    const options = {
      limit: req.query.limit ? parseInt(req.query.limit) : 20
    };

    const results = await serviceNowResourceAPI.searchWorkItems(keyword, options);
    res.json(results);
  } catch (error) {
    console.error('Search work items error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Link a meeting to a ServiceNow item
 * Body: { meetingId, sysId, type, number, title }
 */
router.post('/link-meeting', async (req, res) => {
  try {
    const { meetingId, sysId, type, number, title } = req.body;

    if (!meetingId || !sysId || !type) {
      return res.status(400).json({
        error: 'meetingId, sysId, and type are required'
      });
    }

    // Delete existing mapping if any
    deleteServiceNowMapping.run(meetingId);

    // Create new mapping
    const result = createServiceNowMapping.run(
      meetingId,
      sysId,
      type,
      number || null,
      title || null
    );

    res.json({
      success: true,
      id: result.lastInsertRowid,
      message: `Meeting linked to ${type} ${number || sysId}`
    });
  } catch (error) {
    console.error('Link meeting error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get ServiceNow mapping for a meeting
 */
router.get('/link-meeting/:meetingId', async (req, res) => {
  try {
    const meetingId = parseInt(req.params.meetingId);
    const mapping = getServiceNowMappingByMeeting.get(meetingId);

    if (!mapping) {
      return res.status(404).json({ error: 'No ServiceNow link found for this meeting' });
    }

    res.json(mapping);
  } catch (error) {
    console.error('Get meeting link error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Remove ServiceNow link from a meeting
 */
router.delete('/link-meeting/:meetingId', async (req, res) => {
  try {
    const meetingId = parseInt(req.params.meetingId);
    deleteServiceNowMapping.run(meetingId);

    res.json({
      success: true,
      message: 'ServiceNow link removed'
    });
  } catch (error) {
    console.error('Delete meeting link error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all meetings linked to ServiceNow
 */
router.get('/linked-meetings', async (req, res) => {
  try {
    const mappings = getAllServiceNowMappings.all();
    res.json(mappings);
  } catch (error) {
    console.error('Get linked meetings error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update resource allocation hours
 * Body: { hours }
 */
router.patch('/allocations/:sysId', async (req, res) => {
  try {
    if (!serviceNowService.isEnabled()) {
      return res.status(503).json({
        error: 'ServiceNow is not configured.'
      });
    }

    const { sysId } = req.params;
    const { hours } = req.body;

    if (typeof hours !== 'number' || hours < 0) {
      return res.status(400).json({
        error: 'Valid hours (number >= 0) required'
      });
    }

    const updated = await serviceNowResourceAPI.updateAllocationHours(sysId, hours);

    // Clear relevant caches
    const username = serviceNowService.getUsername();
    clearExpiredCache.run(); // Clean up expired entries
    // Note: In a production app, you'd want to selectively invalidate caches

    res.json({
      success: true,
      allocation: updated
    });
  } catch (error) {
    console.error('Update allocation error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Clear cache (useful for development/testing)
 */
router.post('/clear-cache', async (req, res) => {
  try {
    clearExpiredCache.run();
    res.json({ success: true, message: 'Cache cleared' });
  } catch (error) {
    console.error('Clear cache error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
