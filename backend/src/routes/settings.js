import express from 'express';
import { getSetting, getAllSettings, upsertSetting } from '../db/database.js';

const router = express.Router();

/**
 * GET /api/settings
 * Get all settings
 */
router.get('/', (req, res, next) => {
  try {
    const settings = getAllSettings.all();

    // Convert to key-value object for easier frontend consumption
    const settingsObj = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});

    res.json({ settings: settingsObj });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/settings/:key
 * Get a specific setting by key
 */
router.get('/:key', (req, res, next) => {
  try {
    const { key } = req.params;
    const setting = getSetting.get(key);

    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    res.json({ key: setting.key, value: setting.value });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/settings
 * Update multiple settings at once
 */
router.put('/', (req, res, next) => {
  try {
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings object is required' });
    }

    // Validate allowed settings keys
    const allowedKeys = [
      'ai.meeting_analysis',
      'ai.chat',
      'ai.wiki_updates',
      'ai.mentor_feedback',
    ];

    const allowedValues = ['openai', 'anthropic'];

    for (const [key, value] of Object.entries(settings)) {
      if (!allowedKeys.includes(key)) {
        return res.status(400).json({ error: `Invalid setting key: ${key}` });
      }
      if (!allowedValues.includes(value)) {
        return res.status(400).json({ error: `Invalid value for ${key}: ${value}. Must be 'openai' or 'anthropic'` });
      }
    }

    // Update all settings
    for (const [key, value] of Object.entries(settings)) {
      upsertSetting.run(key, value);
    }

    // Return updated settings
    const updatedSettings = getAllSettings.all();
    const settingsObj = updatedSettings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});

    res.json({
      message: 'Settings updated successfully',
      settings: settingsObj
    });
  } catch (error) {
    next(error);
  }
});

export default router;
