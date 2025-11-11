import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHUNK_DIR = path.join(__dirname, '../../storage/chunks');

// Configure FFmpeg path
try {
  // Try to find ffmpeg in PATH
  const ffmpegPath = execSync('where ffmpeg', { encoding: 'utf-8' }).trim().split('\n')[0];
  const ffprobePath = execSync('where ffprobe', { encoding: 'utf-8' }).trim().split('\n')[0];

  console.log(`FFmpeg path: ${ffmpegPath}`);
  console.log(`FFprobe path: ${ffprobePath}`);

  ffmpeg.setFfmpegPath(ffmpegPath);
  ffmpeg.setFfprobePath(ffprobePath);
} catch (error) {
  console.error('Warning: Could not locate FFmpeg/FFprobe in PATH');
  console.error('Please ensure FFmpeg is installed and in your system PATH');
}

// Configuration
const CHUNK_DURATION_SECONDS = 600; // 10 minutes
const CHUNK_OVERLAP_SECONDS = 2; // 2 seconds overlap between chunks
const TARGET_SIZE_MB = 24; // Target 24MB to stay under 25MB limit

/**
 * Get audio file metadata using ffprobe
 * @param {string} audioPath - Path to audio file
 * @returns {Promise<Object>} Audio metadata
 */
export const getAudioMetadata = (audioPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err) {
        reject(new Error(`Failed to probe audio file: ${err.message}`));
      } else {
        resolve(metadata);
      }
    });
  });
};

/**
 * Convert audio file to mono 16kHz WAV format
 * @param {string} inputPath - Path to input audio file
 * @param {string} outputPath - Path for output WAV file
 * @returns {Promise<string>} Path to converted file
 */
export const convertToWav = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioChannels(1) // Mono
      .audioFrequency(16000) // 16kHz
      .audioCodec('pcm_s16le') // 16-bit PCM
      .format('wav')
      .on('start', (cmd) => {
        console.log(`FFmpeg command: ${cmd}`);
      })
      .on('progress', (progress) => {
        console.log(`Converting: ${progress.percent ? progress.percent.toFixed(1) : '?'}%`);
      })
      .on('end', () => {
        console.log(`Conversion complete: ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        reject(new Error(`FFmpeg conversion failed: ${err.message}`));
      })
      .save(outputPath);
  });
};

/**
 * Split audio file into chunks with overlap
 * @param {string} wavPath - Path to WAV audio file
 * @param {number} durationSeconds - Total duration in seconds
 * @param {number} chunkDuration - Chunk duration in seconds (default: 600)
 * @returns {Promise<Array<Object>>} Array of chunk information
 */
export const splitIntoChunks = async (wavPath, durationSeconds, chunkDuration = CHUNK_DURATION_SECONDS) => {
  try {
    // Ensure chunks directory exists
    await fs.mkdir(CHUNK_DIR, { recursive: true });

    const chunks = [];
    const baseFilename = path.basename(wavPath, path.extname(wavPath));
    let startTime = 0;

    while (startTime < durationSeconds) {
      const chunkIndex = chunks.length;
      const endTime = Math.min(startTime + chunkDuration, durationSeconds);
      const actualDuration = endTime - startTime;

      // Add overlap to previous chunk (except first chunk)
      const seekStart = chunkIndex > 0 ? Math.max(0, startTime - CHUNK_OVERLAP_SECONDS) : startTime;
      const seekDuration = actualDuration + (chunkIndex > 0 ? CHUNK_OVERLAP_SECONDS : 0);

      const chunkFilename = `${baseFilename}_chunk${chunkIndex}.wav`;
      const chunkPath = path.join(CHUNK_DIR, chunkFilename);

      console.log(`Creating chunk ${chunkIndex}: ${seekStart}s to ${endTime}s`);

      // Extract chunk using ffmpeg
      await new Promise((resolve, reject) => {
        ffmpeg(wavPath)
          .setStartTime(seekStart)
          .setDuration(seekDuration)
          .audioChannels(1)
          .audioFrequency(16000)
          .audioCodec('pcm_s16le')
          .format('wav')
          .on('end', resolve)
          .on('error', reject)
          .save(chunkPath);
      });

      // Get chunk file size
      const stats = await fs.stat(chunkPath);
      const sizeMB = stats.size / (1024 * 1024);

      chunks.push({
        index: chunkIndex,
        path: chunkPath,
        startTime,
        endTime,
        duration: actualDuration,
        sizeMB: sizeMB.toFixed(2),
        filename: chunkFilename
      });

      console.log(`Chunk ${chunkIndex} created: ${sizeMB.toFixed(2)}MB`);

      // Move to next chunk
      startTime += chunkDuration;
    }

    return chunks;
  } catch (error) {
    console.error('Error splitting audio into chunks:', error);
    throw new Error(`Failed to split audio: ${error.message}`);
  }
};

/**
 * Process large audio file: convert to WAV and split into chunks
 * @param {string} audioPath - Path to original audio file
 * @param {number} meetingId - Meeting ID for file naming
 * @returns {Promise<Object>} Processing result with chunks
 */
export const processLargeAudio = async (audioPath, meetingId) => {
  try {
    console.log(`\n=== Processing large audio file for meeting ${meetingId} ===`);

    // Get audio metadata
    console.log('Step 1: Getting audio metadata...');
    const metadata = await getAudioMetadata(audioPath);
    let durationSeconds = parseFloat(metadata.format.duration) || 0;
    const fileSizeMB = metadata.format.size / (1024 * 1024);

    console.log(`Duration from source: ${durationSeconds.toFixed(2)}s (${(durationSeconds / 60).toFixed(2)} minutes)`);
    console.log(`File size: ${fileSizeMB.toFixed(2)}MB`);

    // Convert to WAV (mono 16kHz)
    console.log('Step 2: Converting to mono 16kHz WAV...');
    await fs.mkdir(CHUNK_DIR, { recursive: true });
    const wavPath = path.join(CHUNK_DIR, `meeting-${meetingId}-converted.wav`);
    await convertToWav(audioPath, wavPath);

    // Check converted file size
    const wavStats = await fs.stat(wavPath);
    const wavSizeMB = wavStats.size / (1024 * 1024);
    console.log(`Converted WAV size: ${wavSizeMB.toFixed(2)}MB`);

    // If duration wasn't available from source, get it from converted WAV
    if (durationSeconds === 0) {
      console.log('Duration unavailable from source, probing converted WAV...');
      const wavMetadata = await getAudioMetadata(wavPath);
      durationSeconds = parseFloat(wavMetadata.format.duration) || 0;
      console.log(`Duration from WAV: ${durationSeconds.toFixed(2)}s (${(durationSeconds / 60).toFixed(2)} minutes)`);

      if (durationSeconds === 0) {
        throw new Error('Could not determine audio duration from either source or converted file');
      }
    }

    // Determine if chunking is needed
    if (wavSizeMB <= TARGET_SIZE_MB) {
      console.log('File is under 24MB - no chunking needed');
      return {
        needsChunking: false,
        wavPath,
        duration: durationSeconds,
        sizeMB: wavSizeMB
      };
    }

    // Split into chunks
    console.log('Step 3: Splitting into chunks...');

    // For very large files (50MB+), use smaller chunks (5 min instead of 10 min)
    // to improve reliability and reduce chance of network timeouts
    const chunkDuration = fileSizeMB >= 50 ? 300 : CHUNK_DURATION_SECONDS; // 5 min or 10 min
    if (fileSizeMB >= 50) {
      console.log(`⚠️  Very large file (${fileSizeMB.toFixed(2)}MB) - using ${chunkDuration / 60} minute chunks for better reliability`);
    }

    const chunks = await splitIntoChunks(wavPath, durationSeconds, chunkDuration);

    console.log(`\n=== Created ${chunks.length} chunks ===`);

    return {
      needsChunking: true,
      wavPath,
      duration: durationSeconds,
      sizeMB: wavSizeMB,
      chunks
    };
  } catch (error) {
    console.error('Error processing large audio:', error);
    throw error;
  }
};

/**
 * Clean up temporary chunk files
 * @param {Array<string>} chunkPaths - Array of chunk file paths
 * @returns {Promise<void>}
 */
export const cleanupChunks = async (chunkPaths) => {
  try {
    for (const chunkPath of chunkPaths) {
      try {
        await fs.unlink(chunkPath);
        console.log(`Cleaned up chunk: ${chunkPath}`);
      } catch (error) {
        console.warn(`Failed to delete chunk ${chunkPath}:`, error.message);
      }
    }
  } catch (error) {
    console.error('Error during chunk cleanup:', error);
  }
};

/**
 * Adaptive chunk size - reduce chunk duration if transcription fails
 * @param {string} wavPath - Path to WAV file
 * @param {number} durationSeconds - Total duration
 * @param {number} reducedChunkDuration - Reduced chunk duration (e.g., 300 seconds for 5 minutes)
 * @returns {Promise<Array<Object>>} New chunks with reduced duration
 */
export const rechunkWithSmallerSize = async (wavPath, durationSeconds, reducedChunkDuration = 300) => {
  console.log(`\nRe-chunking with smaller size: ${reducedChunkDuration}s per chunk`);
  return await splitIntoChunks(wavPath, durationSeconds, reducedChunkDuration);
};
