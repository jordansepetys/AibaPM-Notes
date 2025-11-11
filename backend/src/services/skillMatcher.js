import * as db from '../db/database.js';

/**
 * Skill Matcher Service - Production-Ready (Option B+)
 *
 * Features:
 * - Scored keyword matching (phrase=4, word=2, partial=1)
 * - Strict precedence (project > global, regardless of score)
 * - Token budgeting with compression
 * - Observable output (scores, matches, reasons)
 *
 * Architecture: Deterministic, scalable, operationally sound
 */

const MAX_SKILL_TOKENS = 2000; // Reserve space for conversation context

/**
 * Find relevant skills with scoring, precedence, and token budgeting
 * @param {string} userMessage - User's chat message
 * @param {number|null} projectId - Optional project ID
 * @param {number} tokenBudget - Max tokens for skills (default: 2000)
 * @returns {Promise<Array>} Scored and ranked skills with metadata
 */
export async function findRelevantSkills(userMessage, projectId, tokenBudget = MAX_SKILL_TOKENS) {
  if (!userMessage || !userMessage.trim()) {
    return [];
  }

  try {
    // Normalize message for matching
    const normalizedMessage = userMessage.toLowerCase().trim();
    const messageWords = normalizedMessage.split(/\s+/).filter(w => w.length > 0);

    // Get all active skills (global + project-specific)
    const globalSkills = db.getGlobalSkills.all();
    const projectSkills = projectId ? db.getProjectSkills.all(projectId) : [];
    const allSkills = [...projectSkills, ...globalSkills];

    if (allSkills.length === 0) {
      return [];
    }

    // Step 1: Score each skill based on keyword matches
    const scoredSkills = allSkills
      .map(skill => {
        const { score, matches } = scoreSkill(skill, normalizedMessage, messageWords);
        return {
          ...skill,
          score,
          matches,
          scope: skill.is_global ? 'global' : 'project',
        };
      })
      .filter(skill => skill.score > 0); // Only keep skills with matches

    if (scoredSkills.length === 0) {
      return [];
    }

    // Step 2: Apply strict precedence sorting (scope > score > timestamp)
    const sortedSkills = applySortPrecedence(scoredSkills);

    // Step 3: Apply token budgeting
    const budgetedSkills = applyTokenBudget(sortedSkills, tokenBudget);

    // Add observable metadata
    return budgetedSkills.map(skill => ({
      id: skill.id,
      name: skill.name,
      slug: skill.slug,
      scope: skill.scope,
      score: skill.score,
      matches: skill.matches,
      estimatedTokens: skill.estimatedTokens,
      compressed: skill.compressed || false,
      reason: `Matched ${skill.matches.length} keyword(s) with score ${skill.score}`,
    }));
  } catch (error) {
    console.error('Error finding relevant skills:', error);
    return []; // Fail gracefully
  }
}

/**
 * Score a skill based on keyword matches
 * @param {Object} skill - Skill object with trigger_keywords
 * @param {string} normalizedMessage - Lowercased user message
 * @param {Array<string>} messageWords - Tokenized message words
 * @returns {Object} {score, matches: Array<string>}
 */
function scoreSkill(skill, normalizedMessage, messageWords) {
  let score = 0;
  const matches = [];

  try {
    // Parse trigger keywords (stored as JSON string)
    const keywords = skill.trigger_keywords
      ? JSON.parse(skill.trigger_keywords)
      : [];

    if (!Array.isArray(keywords) || keywords.length === 0) {
      return { score: 0, matches: [] };
    }

    for (const keyword of keywords) {
      const normalizedKeyword = keyword.toLowerCase().trim();

      // Phrase match (contains space) = 4 points
      if (normalizedKeyword.includes(' ')) {
        if (normalizedMessage.includes(normalizedKeyword)) {
          score += 4;
          matches.push(`phrase:'${keyword}'`);
        }
      }
      // Single word keyword
      else {
        // Exact word match = 2 points
        if (messageWords.includes(normalizedKeyword)) {
          score += 2;
          matches.push(`word:'${keyword}'`);
        }
        // Partial match (substring) = 1 point
        else if (normalizedMessage.includes(normalizedKeyword)) {
          score += 1;
          matches.push(`partial:'${keyword}'`);
        }
      }
    }

    return { score, matches };
  } catch (error) {
    console.error(`Error scoring skill "${skill.name}":`, error);
    return { score: 0, matches: [] };
  }
}

/**
 * Apply strict precedence sorting
 * Sort order: scope (project > global) > score (desc) > timestamp (newer first)
 *
 * CRITICAL: Project skills ALWAYS beat globals, regardless of score!
 *
 * @param {Array} skills - Skills with scores
 * @returns {Array} Sorted by precedence
 */
function applySortPrecedence(skills) {
  return skills.sort((a, b) => {
    // 1. Scope (project > global) - DETERMINISTIC
    const scopeA = a.scope === 'project' ? 1 : 0;
    const scopeB = b.scope === 'project' ? 1 : 0;
    if (scopeA !== scopeB) {
      return scopeB - scopeA; // Project first
    }

    // 2. Score (descending)
    if (a.score !== b.score) {
      return b.score - a.score;
    }

    // 3. Timestamp (newer first)
    const dateA = new Date(a.updated_at);
    const dateB = new Date(b.updated_at);
    return dateB - dateA;
  });
}

/**
 * Apply token budget to skills list
 * @param {Array} skills - Sorted skills
 * @param {number} tokenBudget - Maximum tokens allowed
 * @returns {Array} Skills within budget (with compression if needed)
 */
function applyTokenBudget(skills, tokenBudget) {
  const result = [];
  let currentTokens = 0;

  for (const skill of skills) {
    const estimatedTokens = estimateTokens(skill.content);

    // Check if skill fits in budget
    if (currentTokens + estimatedTokens <= tokenBudget) {
      // Fits! Add it
      result.push({
        ...skill,
        estimatedTokens,
        compressed: false,
      });
      currentTokens += estimatedTokens;
    } else {
      // Doesn't fit. Try compression
      const compressedTokens = Math.floor(estimatedTokens / 2);

      if (currentTokens + compressedTokens <= tokenBudget) {
        // Compression helps! Use compressed version
        result.push({
          ...skill,
          estimatedTokens: compressedTokens,
          compressed: true,
        });
        currentTokens += compressedTokens;
      } else {
        // Even compressed doesn't fit. Drop remaining skills
        console.log(`⚠️ Token budget exceeded. Dropped skill: ${skill.name} (estimated ${estimatedTokens} tokens)`);
        break;
      }
    }
  }

  return result;
}

/**
 * Estimate token count for skill content
 * Rough heuristic: ~4 characters per token
 * @param {string} content - Markdown content
 * @returns {number} Estimated tokens
 */
function estimateTokens(content) {
  if (!content) return 0;
  return Math.ceil(content.length / 4);
}

/**
 * Compress skill content (extract key sections only)
 * Simplified: Takes first half of content
 * Future: Could extract headers, lists, code blocks
 *
 * @param {string} content - Full markdown content
 * @returns {string} Compressed version
 */
function compressSkillContent(content) {
  if (!content) return '';

  // Simple compression: take first half
  const halfPoint = Math.floor(content.length / 2);
  const compressed = content.substring(0, halfPoint);

  return compressed + '\n\n[...content compressed...]';
}

/**
 * Build context string for system prompt with token awareness
 * @param {Array} skills - Ranked skills with token metadata
 * @returns {string} Formatted markdown for prompt
 */
export function buildSkillsContext(skills) {
  if (!skills || skills.length === 0) {
    return '';
  }

  const lines = [
    '',
    '---',
    '',
    '# Active Skills',
    '',
    'The following skills are active for this conversation. Follow their guidance when responding:',
    '',
  ];

  for (const skill of skills) {
    const scopeLabel = skill.scope === 'project' ? 'Project-Specific' : 'Global';
    lines.push(`## ${skill.name} (${scopeLabel})`);
    lines.push('');

    // Get skill content (compressed if needed)
    if (skill.compressed) {
      const fullContent = skill.content || '';
      const compressedContent = compressSkillContent(fullContent);
      lines.push(compressedContent);
    } else {
      lines.push(skill.content || '');
    }

    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Get all global skills (auto_activate = true)
 * Wrapper around database query for future enhancement
 * @returns {Array} Global skills from database
 */
export function getGlobalSkills() {
  return db.getGlobalSkills.all();
}

/**
 * Get project-specific skills (auto_activate = true)
 * Wrapper around database query for future enhancement
 * @param {number} projectId - Project ID
 * @returns {Array} Project skills from database
 */
export function getProjectSkills(projectId) {
  return db.getProjectSkills.all(projectId);
}
