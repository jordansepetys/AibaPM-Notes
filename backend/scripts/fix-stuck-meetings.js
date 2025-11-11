/**
 * Cleanup script to mark stuck meetings with error status
 * Run this with: node backend/scripts/fix-stuck-meetings.js
 */

import db from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../aiba.db');

console.log('🔧 Fixing stuck meetings...\n');

// Open database
const database = new db(DB_PATH);

try {
  // Find meetings without transcript_path or summary_path
  const stuckMeetings = database.prepare(`
    SELECT id, title, audio_path, created_at
    FROM meetings
    WHERE (transcript_path IS NULL OR summary_path IS NULL)
    AND transcript_path NOT LIKE 'ERROR:%'
    ORDER BY id DESC
  `).all();

  console.log(`Found ${stuckMeetings.length} stuck meetings\n`);

  if (stuckMeetings.length === 0) {
    console.log('✅ No stuck meetings found. All good!');
    database.close();
    process.exit(0);
  }

  const updateMeeting = database.prepare(`
    UPDATE meetings
    SET transcript_path = ?,
        summary_path = NULL,
        duration = 0
    WHERE id = ?
  `);

  for (const meeting of stuckMeetings) {
    console.log(`Processing meeting ${meeting.id}: "${meeting.title}"`);
    console.log(`  Created: ${meeting.created_at}`);
    console.log(`  Audio: ${meeting.audio_path}`);

    // Check if audio file exists and has content
    let errorReason = 'Processing failed or timed out';

    if (meeting.audio_path) {
      try {
        const stats = fs.statSync(meeting.audio_path);
        if (stats.size === 0) {
          errorReason = 'Audio file is empty (0 bytes)';
        } else {
          errorReason = 'Processing failed - try "Reprocess Meeting" button';
        }
      } catch (err) {
        errorReason = 'Audio file not found';
      }
    } else {
      errorReason = 'No audio file associated with meeting';
    }

    // Mark meeting with error
    updateMeeting.run(`ERROR: ${errorReason}`, meeting.id);
    console.log(`  ❌ Marked as ERROR: ${errorReason}\n`);
  }

  console.log(`\n✅ Processed ${stuckMeetings.length} stuck meetings`);
  console.log('\n💡 These meetings now show error status in the UI');
  console.log('💡 You can use the "Reprocess Meeting" button to retry valid meetings');

} catch (error) {
  console.error('❌ Error fixing stuck meetings:', error);
  process.exit(1);
} finally {
  database.close();
}
