import OpenAI from 'openai';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  processLargeAudio,
  cleanupChunks,
  rechunkWithSmallerSize
} from './audioChunker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TRANSCRIPT_DIR = path.join(__dirname, '../../storage/transcripts');
const SIZE_THRESHOLD_MB = 24; // Trigger chunking if over 24MB

// Initialize OpenAI client (lazy initialization)
let openai = null;

function getOpenAIClient() {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

/**
 * Check for API quota/billing errors
 * @param {Error} error - Error object from API call
 * @returns {string|null} User-friendly error message or null
 */
function checkAPIQuotaError(error) {
  // OpenAI error codes
  if (error.status === 429) {
    return 'OpenAI API rate limit exceeded. Please wait a few minutes and try "Reprocess Meeting"';
  }
  if (error.status === 401) {
    return 'OpenAI API key is invalid or expired. Please check your .env file';
  }
  if (error.status === 402 || error.code === 'insufficient_quota') {
    return 'OpenAI account has insufficient credits. Please add credits at platform.openai.com/account/billing';
  }
  if (error.message && error.message.includes('quota')) {
    return 'OpenAI API quota exceeded. Check your usage at platform.openai.com/account/usage';
  }
  if (error.message && error.message.includes('billing')) {
    return 'OpenAI billing issue detected. Please check platform.openai.com/account/billing';
  }
  return null;
}

/**
 * Transcribe a single audio file (must be under 25MB)
 * @param {string} audioPath - Path to audio file
 * @param {string} language - Language code (optional)
 * @returns {Promise<Object>} Transcription result
 */
const transcribeSingleFile = async (audioPath, language = 'en') => {
  const client = getOpenAIClient();
  if (!client) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    console.log(`Transcribing: ${audioPath}`);

    // Get full path
    const fullAudioPath = path.isAbsolute(audioPath)
      ? audioPath
      : path.join(__dirname, '../..', audioPath);

    // Check file exists
    await fs.access(fullAudioPath);

    // Get file stats
    const stats = await fs.stat(fullAudioPath);
    const fileSizeMB = stats.size / (1024 * 1024);
    console.log(`File size: ${fileSizeMB.toFixed(2)}MB`);

    // Use read stream
    const audioStream = fsSync.createReadStream(fullAudioPath);

    // Call Whisper API
    const transcription = await client.audio.transcriptions.create({
      file: audioStream,
      model: 'whisper-1',
      language: language,
      response_format: 'verbose_json', // Get timestamps
    });

    console.log(`Transcription completed: ${transcription.text.length} characters`);

    return {
      text: transcription.text,
      language: transcription.language,
      duration: transcription.duration,
      segments: transcription.segments || [],
    };
  } catch (error) {
    // Check for API quota/billing issues first
    const quotaError = checkAPIQuotaError(error);
    if (quotaError) {
      console.error('❌ API Quota Error:', quotaError);
      throw new Error(quotaError);
    }

    // Check if it's a 413 error (payload too large)
    if (error.status === 413 || error.message.includes('413')) {
      throw new Error('PAYLOAD_TOO_LARGE');
    }

    console.error('Transcription error:', error);
    throw new Error(`Failed to transcribe audio: ${error.message}`);
  }
};

/**
 * Merge transcripts from multiple chunks
 * @param {Array<Object>} chunkResults - Array of transcription results with chunk info
 * @returns {Object} Merged transcription result
 */
const mergeTranscripts = (chunkResults) => {
  console.log(`\nMerging ${chunkResults.length} transcripts...`);

  let fullText = '';
  let allSegments = [];
  let totalDuration = 0;
  const language = chunkResults[0]?.transcription.language || 'en';

  for (const { chunk, transcription } of chunkResults) {
    // Add text
    fullText += transcription.text + ' ';

    // Adjust segment timestamps based on chunk start time
    if (transcription.segments && transcription.segments.length > 0) {
      const adjustedSegments = transcription.segments.map(segment => ({
        ...segment,
        start: segment.start + chunk.startTime,
        end: segment.end + chunk.startTime,
      }));
      allSegments.push(...adjustedSegments);
    }

    // Track total duration
    totalDuration = Math.max(totalDuration, chunk.endTime);
  }

  // Clean up text (remove extra spaces)
  fullText = fullText.trim().replace(/\s+/g, ' ');

  console.log(`Merged transcript: ${fullText.length} characters, ${allSegments.length} segments`);

  return {
    text: fullText,
    language,
    duration: totalDuration,
    segments: allSegments,
  };
};

/**
 * Transcribe audio chunks with retry logic
 * @param {Array<Object>} chunks - Array of chunk information
 * @param {Function} progressCallback - Progress callback (optional)
 * @returns {Promise<Array<Object>>} Array of transcription results
 */
const transcribeChunks = async (chunks, progressCallback = null) => {
  const results = [];
  let attemptedChunks = [...chunks];
  let retryWithSmallerChunks = false;

  for (let i = 0; i < attemptedChunks.length; i++) {
    const chunk = attemptedChunks[i];
    console.log(`\nTranscribing chunk ${i + 1}/${attemptedChunks.length}...`);
    console.log(`Chunk ${chunk.index}: ${chunk.startTime}s - ${chunk.endTime}s (${chunk.sizeMB}MB)`);

    // Report progress
    if (progressCallback) {
      progressCallback({
        current: i + 1,
        total: attemptedChunks.length,
        chunkIndex: chunk.index,
        status: 'transcribing'
      });
    }

    try {
      // Try to transcribe the chunk
      const transcription = await transcribeSingleFile(chunk.path);

      results.push({
        chunk,
        transcription
      });

      console.log(`Chunk ${chunk.index} transcribed successfully`);

    } catch (error) {
      console.error(`Chunk ${chunk.index} failed:`, error.message);

      // Check if it's a 413 error
      if (error.message === 'PAYLOAD_TOO_LARGE') {
        console.warn(`Chunk ${chunk.index} too large - will retry with smaller chunks`);
        retryWithSmallerChunks = true;
        break; // Exit loop to re-chunk
      }

      // For other errors, retry with exponential backoff
      // Network errors (ECONNRESET, timeouts) need more retries with longer delays
      let retried = false;
      const MAX_RETRIES = 5; // Increased from 2 for better reliability

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        // Exponential backoff: 5s, 10s, 20s, 40s, 80s
        const delay = Math.pow(2, attempt) * 2500;
        console.log(`Retrying chunk ${chunk.index} in ${delay / 1000}s (attempt ${attempt}/${MAX_RETRIES})...`);
        await new Promise(resolve => setTimeout(resolve, delay));

        try {
          const transcription = await transcribeSingleFile(chunk.path);
          results.push({ chunk, transcription });
          console.log(`✅ Chunk ${chunk.index} transcribed successfully on retry ${attempt}`);
          retried = true;
          break;
        } catch (retryError) {
          const isNetworkError = retryError.message.includes('Connection error') ||
                                  retryError.message.includes('ECONNRESET') ||
                                  retryError.message.includes('timeout');

          console.error(`❌ Retry ${attempt} failed:`, retryError.message);

          if (isNetworkError) {
            console.warn(`⚠️  Network error detected - will retry with longer delay`);
          }

          if (retryError.message === 'PAYLOAD_TOO_LARGE') {
            retryWithSmallerChunks = true;
            break;
          }
        }
      }

      if (!retried && !retryWithSmallerChunks) {
        throw new Error(`Failed to transcribe chunk ${chunk.index} after ${MAX_RETRIES} retries. This may be due to network instability or OpenAI API issues. Try again later or check your internet connection.`);
      }

      if (retryWithSmallerChunks) {
        break;
      }
    }
  }

  // If we need to re-chunk, throw special error
  if (retryWithSmallerChunks) {
    throw new Error('RECHUNK_NEEDED');
  }

  return results;
};

/**
 * Main transcription function with automatic chunking
 * @param {string} audioPath - Path to audio file
 * @param {number} meetingId - Meeting ID
 * @param {Function} progressCallback - Progress callback (optional)
 * @returns {Promise<Object>} Transcription result
 */
export const transcribeWithRetry = async (audioPath, meetingId = null, progressCallback = null) => {
  const client = getOpenAIClient();
  if (!client) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    console.log(`\n=== Starting transcription for: ${audioPath} ===`);

    // Get full path
    const fullAudioPath = path.isAbsolute(audioPath)
      ? audioPath
      : path.join(__dirname, '../..', audioPath);

    // Check file size
    const stats = await fs.stat(fullAudioPath);
    const fileSizeMB = stats.size / (1024 * 1024);
    console.log(`Audio file size: ${fileSizeMB.toFixed(2)}MB`);

    // If file is small enough, transcribe directly
    if (fileSizeMB <= SIZE_THRESHOLD_MB) {
      console.log('File is under 24MB - transcribing directly');

      try {
        return await transcribeSingleFile(fullAudioPath);
      } catch (error) {
        // If direct transcription fails with 413, fall through to chunking
        if (error.message !== 'PAYLOAD_TOO_LARGE') {
          throw error;
        }
        console.warn('Direct transcription failed with 413 - falling back to chunking');
      }
    }

    // File is large or direct transcription failed - use chunking
    console.log('File requires chunking...');

    if (progressCallback) {
      progressCallback({
        status: 'processing',
        message: 'Converting and splitting audio...'
      });
    }

    // Process audio: convert to WAV and split into chunks
    const processed = await processLargeAudio(fullAudioPath, meetingId || Date.now());

    // If no chunking needed (file is small after conversion)
    if (!processed.needsChunking) {
      console.log('After conversion, file is under 24MB - transcribing directly');
      const result = await transcribeSingleFile(processed.wavPath);

      // Cleanup converted WAV
      await fs.unlink(processed.wavPath).catch(err =>
        console.warn('Failed to cleanup WAV:', err.message)
      );

      return result;
    }

    // Transcribe chunks
    console.log(`\n=== Transcribing ${processed.chunks.length} chunks ===`);

    let chunkResults;
    try {
      chunkResults = await transcribeChunks(processed.chunks, progressCallback);
    } catch (error) {
      // If chunks are still too large, re-chunk with smaller duration
      if (error.message === 'RECHUNK_NEEDED') {
        console.log('\n=== Chunks too large - re-chunking with 5-minute segments ===');

        if (progressCallback) {
          progressCallback({
            status: 'processing',
            message: 'Re-chunking with smaller segments...'
          });
        }

        // Cleanup old chunks
        await cleanupChunks(processed.chunks.map(c => c.path));

        // Create smaller chunks (5 minutes instead of 10)
        const smallerChunks = await rechunkWithSmallerSize(
          processed.wavPath,
          processed.duration,
          300 // 5 minutes
        );

        console.log(`Created ${smallerChunks.length} smaller chunks`);
        processed.chunks = smallerChunks;

        // Retry transcription
        chunkResults = await transcribeChunks(processed.chunks, progressCallback);
      } else {
        throw error;
      }
    }

    // Merge transcripts
    if (progressCallback) {
      progressCallback({
        status: 'merging',
        message: 'Merging transcripts...'
      });
    }

    const mergedResult = mergeTranscripts(chunkResults);

    // Cleanup temporary files
    console.log('\n=== Cleaning up temporary files ===');
    await cleanupChunks(processed.chunks.map(c => c.path));
    await fs.unlink(processed.wavPath).catch(err =>
      console.warn('Failed to cleanup WAV:', err.message)
    );

    console.log('=== Transcription complete ===\n');

    return mergedResult;

  } catch (error) {
    console.error('Transcription failed:', error);
    throw error;
  }
};

/**
 * Legacy function for backward compatibility
 */
export const transcribeAudio = async (audioPath, language = 'en') => {
  return await transcribeWithRetry(audioPath);
};

/**
 * Save transcript to file system
 * @param {string} transcript - Transcript text
 * @param {number} meetingId - Meeting ID
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Saved file paths
 */
export const saveTranscript = async (transcript, meetingId, metadata = {}) => {
  try {
    // Ensure transcript directory exists
    await fs.mkdir(TRANSCRIPT_DIR, { recursive: true });

    const timestamp = Date.now();
    const baseFilename = `meeting-${meetingId}-${timestamp}`;

    // Save as plain text
    const txtPath = path.join(TRANSCRIPT_DIR, `${baseFilename}.txt`);
    await fs.writeFile(txtPath, transcript);

    // Save as markdown with metadata
    const mdContent = generateMarkdownTranscript(transcript, metadata);
    const mdPath = path.join(TRANSCRIPT_DIR, `${baseFilename}.md`);
    await fs.writeFile(mdPath, mdContent);

    console.log(`Transcript saved: ${baseFilename}`);

    return {
      txtPath: `/storage/transcripts/${baseFilename}.txt`,
      mdPath: `/storage/transcripts/${baseFilename}.md`,
    };
  } catch (error) {
    console.error('Error saving transcript:', error);
    throw new Error('Failed to save transcript');
  }
};

/**
 * Generate formatted markdown transcript
 * @param {string} transcript - Transcript text
 * @param {Object} metadata - Meeting metadata
 * @returns {string} Formatted markdown
 */
const generateMarkdownTranscript = (transcript, metadata) => {
  const { title, date, duration, segments } = metadata;

  let markdown = `# ${title || 'Meeting Transcript'}\n\n`;
  markdown += `**Date:** ${date ? new Date(date).toLocaleString() : 'N/A'}\n`;
  markdown += `**Duration:** ${duration ? formatDuration(duration) : 'N/A'}\n\n`;
  markdown += `---\n\n`;

  // Add segments with timestamps if available
  if (segments && segments.length > 0) {
    markdown += `## Transcript with Timestamps\n\n`;
    for (const segment of segments) {
      const timestamp = formatTimestamp(segment.start);
      markdown += `**[${timestamp}]** ${segment.text}\n\n`;
    }
  } else {
    markdown += `## Transcript\n\n${transcript}\n`;
  }

  return markdown;
};

/**
 * Format duration in seconds to readable string
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
};

/**
 * Format timestamp in seconds to MM:SS
 * @param {number} seconds - Timestamp in seconds
 * @returns {string} Formatted timestamp
 */
const formatTimestamp = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Read transcript from file
 * @param {string} transcriptPath - Path to transcript file
 * @returns {Promise<string>} Transcript content
 */
export const readTranscript = async (transcriptPath) => {
  try {
    const fullPath = path.join(__dirname, '../..', transcriptPath);
    const content = await fs.readFile(fullPath, 'utf-8');
    return content;
  } catch (error) {
    console.error('Error reading transcript:', error);
    throw new Error('Failed to read transcript');
  }
};
