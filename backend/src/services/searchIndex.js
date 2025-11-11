import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  addToSearchIndex,
  searchMeetings as searchDB,
  clearSearchIndexForMeeting,
} from '../db/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Tokenize text for indexing
 * @param {string} text - Text to tokenize
 * @returns {Array<string>} Array of tokens
 */
const tokenize = (text) => {
  if (!text) return [];

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .split(/\s+/) // Split on whitespace
    .filter(token => token.length > 2) // Remove short tokens
    .filter(token => !isStopWord(token)); // Remove stop words
};

/**
 * Check if word is a stop word
 * @param {string} word - Word to check
 * @returns {boolean} True if stop word
 */
const isStopWord = (word) => {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has',
    'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may',
    'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he',
    'she', 'it', 'we', 'they', 'what', 'which', 'who', 'when', 'where',
    'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most',
    'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
    'so', 'than', 'too', 'very', 's', 't', 'just', 'don', 'now'
  ]);

  return stopWords.has(word);
};

/**
 * Calculate TF-IDF ranking for a term
 * @param {number} termFreq - Term frequency in document
 * @param {number} docFreq - Number of documents containing term
 * @param {number} totalDocs - Total number of documents
 * @returns {number} TF-IDF score
 */
const calculateTFIDF = (termFreq, docFreq, totalDocs) => {
  const tf = Math.log(1 + termFreq);
  const idf = Math.log(totalDocs / (1 + docFreq));
  return tf * idf;
};

/**
 * Build search index for a meeting
 * @param {number} meetingId - Meeting ID
 * @param {string} transcript - Meeting transcript
 * @param {Object} summary - Meeting summary
 * @returns {Promise<number>} Number of index entries created
 */
export const buildSearchIndex = async (meetingId, transcript, summary) => {
  try {
    console.log(`Building search index for meeting ${meetingId}...`);

    // Clear existing index for this meeting
    clearSearchIndexForMeeting.run(meetingId);

    let indexCount = 0;

    // Index transcript
    if (transcript) {
      const tokens = tokenize(transcript);
      const tokenFreq = {};

      // Count token frequencies
      for (const token of tokens) {
        tokenFreq[token] = (tokenFreq[token] || 0) + 1;
      }

      // Add to index with TF-IDF ranking (simplified - using term frequency as rank)
      for (const [token, freq] of Object.entries(tokenFreq)) {
        addToSearchIndex.run(meetingId, token, 'transcript', freq);
        indexCount++;
      }
    }

    // Index summary fields
    if (summary) {
      // Index overview
      if (summary.overview) {
        const overviewTokens = tokenize(summary.overview);
        for (const token of overviewTokens) {
          addToSearchIndex.run(meetingId, token, 'overview', 10); // Higher rank for overview
          indexCount++;
        }
      }

      // Index decisions
      if (Array.isArray(summary.key_decisions)) {
        for (const decision of summary.key_decisions) {
          if (typeof decision === 'string') {
            const tokens = tokenize(decision);
            for (const token of tokens) {
              addToSearchIndex.run(meetingId, token, 'decision', 8);
              indexCount++;
            }
          }
        }
      }

      // Index action items
      if (Array.isArray(summary.action_items)) {
        for (const item of summary.action_items) {
          const itemText = typeof item === 'string' ? item : (item.task || '');
          const tokens = tokenize(itemText);
          for (const token of tokens) {
            addToSearchIndex.run(meetingId, token, 'action', 7);
            indexCount++;
          }
        }
      }

      // Index technical details
      if (Array.isArray(summary.technical_details)) {
        for (const detail of summary.technical_details) {
          if (typeof detail === 'string') {
            const tokens = tokenize(detail);
            for (const token of tokens) {
              addToSearchIndex.run(meetingId, token, 'technical', 6);
              indexCount++;
            }
          }
        }
      }
    }

    console.log(`Search index built: ${indexCount} entries for meeting ${meetingId}`);
    return indexCount;
  } catch (error) {
    console.error('Error building search index:', error);
    throw new Error('Failed to build search index');
  }
};

/**
 * Search for meetings by query
 * @param {string} query - Search query
 * @param {number|null} projectId - Optional project ID filter
 * @returns {Promise<Array>} Search results
 */
export const searchMeetings = async (query, projectId = null) => {
  try {
    if (!query || query.trim().length === 0) {
      return [];
    }

    console.log(`Searching for: "${query}"`);

    // Tokenize query
    const queryTokens = tokenize(query);

    if (queryTokens.length === 0) {
      return [];
    }

    // Build SQL LIKE pattern for each token
    const results = new Map();

    for (const token of queryTokens) {
      const pattern = `%${token}%`;
      const matches = searchDB.all(pattern);

      for (const match of matches) {
        // Filter by project if specified
        if (projectId && match.project_id !== projectId) {
          continue;
        }

        if (results.has(match.id)) {
          // Accumulate rank for multiple matching tokens
          results.get(match).rank += match.rank;
        } else {
          results.set(match.id, {
            ...match,
            matchedTokens: [token],
          });
        }
      }
    }

    // Convert to array and sort by rank
    const sortedResults = Array.from(results.values())
      .sort((a, b) => b.rank - a.rank);

    console.log(`Found ${sortedResults.length} result(s)`);

    return sortedResults;
  } catch (error) {
    console.error('Search error:', error);
    throw new Error('Failed to search meetings');
  }
};

/**
 * Rebuild search index for all meetings
 * @param {Function} getMeetings - Function to get all meetings from DB
 * @param {Function} getTranscript - Function to get transcript for meeting
 * @param {Function} getSummary - Function to get summary for meeting
 * @returns {Promise<number>} Number of meetings indexed
 */
export const rebuildSearchIndex = async (getMeetings, getTranscript, getSummary) => {
  try {
    console.log('Rebuilding entire search index...');

    const meetings = getMeetings();
    let indexedCount = 0;

    for (const meeting of meetings) {
      try {
        const transcript = meeting.transcript_path
          ? await getTranscript(meeting.transcript_path)
          : null;

        const summary = meeting.summary_path
          ? await getSummary(meeting.summary_path)
          : null;

        await buildSearchIndex(meeting.id, transcript, summary);
        indexedCount++;
      } catch (error) {
        console.error(`Failed to index meeting ${meeting.id}:`, error.message);
      }
    }

    console.log(`Search index rebuilt: ${indexedCount} meetings indexed`);
    return indexedCount;
  } catch (error) {
    console.error('Error rebuilding search index:', error);
    throw new Error('Failed to rebuild search index');
  }
};

/**
 * Get search suggestions based on query
 * @param {string} query - Partial query
 * @param {number} limit - Maximum number of suggestions
 * @returns {Promise<Array<string>>} Suggested search terms
 */
export const getSearchSuggestions = async (query, limit = 5) => {
  try {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const pattern = `${query.toLowerCase()}%`;
    const suggestions = searchDB.all(pattern);

    // Get unique content values
    const uniqueSuggestions = [...new Set(suggestions.map(s => s.content))]
      .slice(0, limit);

    return uniqueSuggestions;
  } catch (error) {
    console.error('Error getting search suggestions:', error);
    return [];
  }
};
