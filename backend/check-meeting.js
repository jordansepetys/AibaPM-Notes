import Database from 'better-sqlite3';

const db = new Database('./aiba.db');

console.log('\n=== Meeting 10 Details ===');
const meeting = db.prepare('SELECT * FROM meetings WHERE id = 10').get();
console.log(JSON.stringify(meeting, null, 2));

console.log('\n=== Meeting 10 Metadata ===');
const metadata = db.prepare('SELECT * FROM meeting_metadata WHERE meeting_id = 10').get();
console.log(JSON.stringify(metadata, null, 2));

db.close();
