import { getSetting } from '../db/database.js';

/**
 * Get AI backend preference for a specific feature
 * @param {string} feature - Feature name ('meeting_analysis', 'chat', 'wiki_updates', 'mentor_feedback')
 * @returns {string} Backend preference ('openai' or 'anthropic')
 */
export function getAIBackendForFeature(feature) {
  try {
    const settingKey = `ai.${feature}`;
    const setting = getSetting.get(settingKey);

    if (setting && setting.value) {
      return setting.value;
    }

    // Fallback to environment variable or default
    return process.env.AI_BACKEND || 'anthropic';
  } catch (error) {
    console.error(`Error getting AI backend for ${feature}:`, error);
    return process.env.AI_BACKEND || 'anthropic';
  }
}

/**
 * Get the model name for a backend
 * @param {string} backend - Backend name ('openai' or 'anthropic')
 * @returns {string} Model name
 */
export function getModelNameForBackend(backend) {
  return backend === 'anthropic' ? 'Claude Sonnet 4.5' : 'GPT-4o';
}
