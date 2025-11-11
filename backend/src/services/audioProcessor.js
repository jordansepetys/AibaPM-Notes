import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUDIO_DIR = path.join(__dirname, '../../storage/audio');
const RETENTION_DAYS = parseInt(process.env.AUDIO_RETENTION_DAYS || '30', 10);

/**
 * Save audio file to storage
 * @param {Buffer} audioBuffer - Audio file buffer
 * @param {string} filename - Original filename
 * @param {number} projectId - Project ID for organizing files
 * @returns {Promise<Object>} File metadata
 */
export const saveAudioFile = async (audioBuffer, filename, projectId = null) => {
  try {
    // Ensure audio directory exists
    await fs.mkdir(AUDIO_DIR, { recursive: true });

    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const ext = path.extname(filename) || '.webm';
    const safeFilename = `${timestamp}-${projectId || 'default'}${ext}`;
    const filePath = path.join(AUDIO_DIR, safeFilename);

    // Save file
    await fs.writeFile(filePath, audioBuffer);

    // Get file stats
    const stats = await fs.stat(filePath);

    return {
      path: `/storage/audio/${safeFilename}`,
      filename: safeFilename,
      size: stats.size,
      savedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error saving audio file:', error);
    throw new Error('Failed to save audio file');
  }
};

/**
 * Get audio file duration (placeholder - would use ffmpeg in production)
 * @param {string} filePath - Path to audio file
 * @returns {Promise<number>} Duration in seconds
 */
export const getAudioDuration = async (filePath) => {
  // Placeholder: In production, use fluent-ffmpeg to get actual duration
  // For now, return null - will be calculated during transcription
  return null;
};

/**
 * Delete audio file
 * @param {string} filePath - Relative path to audio file
 * @returns {Promise<boolean>} Success status
 */
export const deleteAudioFile = async (filePath) => {
  try {
    const fullPath = path.join(__dirname, '../..', filePath);
    await fs.unlink(fullPath);
    console.log(`Deleted audio file: ${filePath}`);
    return true;
  } catch (error) {
    console.error('Error deleting audio file:', error);
    return false;
  }
};

/**
 * Cleanup old audio files based on retention policy
 * @returns {Promise<number>} Number of files deleted
 */
export const cleanupOldAudioFiles = async () => {
  try {
    const files = await fs.readdir(AUDIO_DIR);
    const now = Date.now();
    const retentionMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const file of files) {
      if (file === '.gitkeep') continue;

      const filePath = path.join(AUDIO_DIR, file);
      const stats = await fs.stat(filePath);
      const age = now - stats.mtimeMs;

      if (age > retentionMs) {
        await fs.unlink(filePath);
        console.log(`Cleaned up old audio file: ${file} (${Math.floor(age / (24 * 60 * 60 * 1000))} days old)`);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log(`Audio cleanup completed: ${deletedCount} file(s) deleted`);
    }

    return deletedCount;
  } catch (error) {
    console.error('Error during audio cleanup:', error);
    return 0;
  }
};

/**
 * Setup cron job for automatic audio cleanup
 * Runs daily at 2 AM
 */
export const setupAudioCleanupCron = () => {
  // Run every day at 2 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('Running scheduled audio cleanup...');
    await cleanupOldAudioFiles();
  });

  console.log(`Audio cleanup cron job scheduled (${RETENTION_DAYS} day retention)`);
};

/**
 * Validate audio file
 * @param {string} mimetype - File mimetype
 * @param {number} size - File size in bytes
 * @returns {Object} Validation result
 */
export const validateAudioFile = (mimetype, size) => {
  const allowedTypes = [
    'audio/webm',
    'audio/wav',
    'audio/mp3',
    'audio/mpeg',
    'audio/mp4',
    'audio/m4a',
    'audio/ogg'
  ];

  // Allow large files - chunking will handle files over 25MB
  const maxSize = 100 * 1024 * 1024; // 100MB

  if (!allowedTypes.includes(mimetype)) {
    return {
      valid: false,
      error: 'Invalid file type. Allowed: webm, wav, mp3, mp4, m4a, ogg'
    };
  }

  if (size > maxSize) {
    return {
      valid: false,
      error: 'File too large. Maximum size: 100MB'
    };
  }

  return { valid: true };
};
