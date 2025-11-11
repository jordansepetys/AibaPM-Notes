// Test database operations
import {
  createProject,
  getAllProjects,
  getProjectById,
  createMeeting,
  getAllMeetings,
  getMeetingById
} from './src/db/database.js';

console.log('Testing database operations...\n');

// Test 1: Create a project
console.log('1. Creating test project...');
const projectResult = createProject.run('Test Project');
console.log(`   ✓ Project created with ID: ${projectResult.lastInsertRowid}`);

// Test 2: Get all projects
console.log('2. Fetching all projects...');
const projects = getAllProjects.all();
console.log(`   ✓ Found ${projects.length} project(s):`, projects);

// Test 3: Get project by ID
console.log('3. Fetching project by ID...');
const project = getProjectById.get(projectResult.lastInsertRowid);
console.log(`   ✓ Project:`, project);

// Test 4: Create a meeting
console.log('4. Creating test meeting...');
const meetingResult = createMeeting.run(
  projectResult.lastInsertRowid,
  'Test Meeting',
  new Date().toISOString(),
  60,
  '/storage/audio/test.wav',
  '/storage/transcripts/test.txt',
  '/storage/summaries/test.json'
);
console.log(`   ✓ Meeting created with ID: ${meetingResult.lastInsertRowid}`);

// Test 5: Get all meetings
console.log('5. Fetching all meetings...');
const meetings = getAllMeetings.all();
console.log(`   ✓ Found ${meetings.length} meeting(s):`, meetings);

// Test 6: Get meeting by ID
console.log('6. Fetching meeting by ID...');
const meeting = getMeetingById.get(meetingResult.lastInsertRowid);
console.log(`   ✓ Meeting:`, meeting);

console.log('\n✅ All database tests passed!');
