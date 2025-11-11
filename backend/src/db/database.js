import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../..', 'aiba.db');

// Initialize database
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

function initializeDatabase() {
  // Projects table
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Meetings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      audio_path TEXT,
      transcript_path TEXT,
      summary_path TEXT,
      duration INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // Meeting metadata table
  db.exec(`
    CREATE TABLE IF NOT EXISTS meeting_metadata (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id INTEGER NOT NULL,
      decisions TEXT,
      action_items TEXT,
      risks TEXT,
      questions TEXT,
      ai_model_info TEXT,
      FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
    )
  `);

  // Search index table
  db.exec(`
    CREATE TABLE IF NOT EXISTS search_index (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      content_type TEXT,
      rank INTEGER DEFAULT 0,
      FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
    )
  `);

  // Chat messages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      context_snapshot TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // Skills table
  db.exec(`
    CREATE TABLE IF NOT EXISTS skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      content TEXT NOT NULL,
      is_global BOOLEAN DEFAULT 0,
      project_id INTEGER,
      trigger_keywords TEXT,
      auto_activate BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // Composite unique constraint: prevents slug conflicts within same scope
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_slug_scope
      ON skills(slug, COALESCE(project_id, 0))
  `);

  // Skill usage tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS skill_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      skill_id INTEGER NOT NULL,
      chat_message_id INTEGER NOT NULL,
      used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE,
      FOREIGN KEY (chat_message_id) REFERENCES chat_messages(id) ON DELETE CASCADE
    )
  `);

  // Settings table - stores user preferences for AI model selection
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('Database initialized successfully');
}

// Initialize on import
initializeDatabase();

// Helper functions for database operations

// Projects
export const createProject = db.prepare(`
  INSERT INTO projects (name) VALUES (?)
`);

export const getAllProjects = db.prepare(`
  SELECT * FROM projects ORDER BY created_at DESC
`);

export const getProjectById = db.prepare(`
  SELECT * FROM projects WHERE id = ?
`);

export const updateProject = db.prepare(`
  UPDATE projects SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
`);

export const deleteProject = db.prepare(`
  DELETE FROM projects WHERE id = ?
`);

// Meetings
export const createMeeting = db.prepare(`
  INSERT INTO meetings (project_id, title, date, duration, audio_path, transcript_path, summary_path)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

export const getAllMeetings = db.prepare(`
  SELECT * FROM meetings ORDER BY date DESC
`);

export const getMeetingById = db.prepare(`
  SELECT * FROM meetings WHERE id = ?
`);

export const getMeetingsByProject = db.prepare(`
  SELECT * FROM meetings WHERE project_id = ? ORDER BY date DESC
`);

export const updateMeeting = db.prepare(`
  UPDATE meetings
  SET title = ?, date = ?, duration = ?, audio_path = ?, transcript_path = ?, summary_path = ?, updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`);

export const deleteMeeting = db.prepare(`
  DELETE FROM meetings WHERE id = ?
`);

// Meeting metadata
export const createMeetingMetadata = db.prepare(`
  INSERT INTO meeting_metadata (meeting_id, decisions, action_items, risks, questions, ai_model_info)
  VALUES (?, ?, ?, ?, ?, ?)
`);

export const getMeetingMetadata = db.prepare(`
  SELECT * FROM meeting_metadata WHERE meeting_id = ?
`);

export const updateMeetingMetadata = db.prepare(`
  UPDATE meeting_metadata
  SET decisions = ?, action_items = ?, risks = ?, questions = ?, ai_model_info = ?
  WHERE meeting_id = ?
`);

// Search index
export const addToSearchIndex = db.prepare(`
  INSERT INTO search_index (meeting_id, content, content_type, rank)
  VALUES (?, ?, ?, ?)
`);

export const searchMeetings = db.prepare(`
  SELECT DISTINCT m.*, si.rank
  FROM meetings m
  JOIN search_index si ON m.id = si.meeting_id
  WHERE si.content LIKE ?
  ORDER BY si.rank DESC, m.date DESC
`);

export const clearSearchIndexForMeeting = db.prepare(`
  DELETE FROM search_index WHERE meeting_id = ?
`);

// Chat messages
export const createChatMessage = db.prepare(`
  INSERT INTO chat_messages (project_id, role, content, context_snapshot)
  VALUES (?, ?, ?, ?)
`);

export const getChatMessages = db.prepare(`
  SELECT * FROM chat_messages
  WHERE project_id IS ? OR project_id = ?
  ORDER BY created_at ASC
`);

export const getRecentChatMessages = db.prepare(`
  SELECT * FROM chat_messages
  WHERE project_id IS ? OR project_id = ?
  ORDER BY created_at DESC
  LIMIT ?
`);

export const clearChatHistory = db.prepare(`
  DELETE FROM chat_messages WHERE project_id IS ? OR project_id = ?
`);

// Skills
export const createSkill = db.prepare(`
  INSERT INTO skills (name, slug, description, content, is_global, project_id, trigger_keywords, auto_activate)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

export const getAllSkills = db.prepare(`
  SELECT * FROM skills ORDER BY created_at DESC
`);

export const getSkillById = db.prepare(`
  SELECT * FROM skills WHERE id = ?
`);

export const getSkillBySlug = db.prepare(`
  SELECT * FROM skills WHERE slug = ? AND (project_id IS ? OR project_id = ?)
`);

export const getGlobalSkills = db.prepare(`
  SELECT * FROM skills WHERE is_global = 1 AND auto_activate = 1 ORDER BY updated_at DESC
`);

export const getProjectSkills = db.prepare(`
  SELECT * FROM skills WHERE project_id = ? AND auto_activate = 1 ORDER BY updated_at DESC
`);

export const getSkillsByProject = db.prepare(`
  SELECT * FROM skills WHERE project_id = ? ORDER BY created_at DESC
`);

export const updateSkill = db.prepare(`
  UPDATE skills
  SET name = ?, slug = ?, description = ?, content = ?, trigger_keywords = ?, auto_activate = ?, updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`);

export const deleteSkill = db.prepare(`
  DELETE FROM skills WHERE id = ?
`);

// Skill usage tracking
export const trackSkillUsage = db.prepare(`
  INSERT INTO skill_usage (skill_id, chat_message_id)
  VALUES (?, ?)
`);

export const getSkillUsageStats = db.prepare(`
  SELECT skill_id, COUNT(*) as usage_count, MAX(used_at) as last_used
  FROM skill_usage
  WHERE skill_id = ?
  GROUP BY skill_id
`);

// Settings
export const getSetting = db.prepare(`
  SELECT * FROM settings WHERE key = ?
`);

export const getAllSettings = db.prepare(`
  SELECT * FROM settings
`);

export const upsertSetting = db.prepare(`
  INSERT INTO settings (key, value, updated_at)
  VALUES (?, ?, CURRENT_TIMESTAMP)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
`);

export const deleteSetting = db.prepare(`
  DELETE FROM settings WHERE key = ?
`);

// Run migrations for existing databases
function runMigrations() {
  try {
    // Migration: Add ai_model_info column to meeting_metadata table if it doesn't exist
    const columns = db.pragma('table_info(meeting_metadata)');
    const hasAiModelInfo = columns.some(col => col.name === 'ai_model_info');

    if (!hasAiModelInfo) {
      console.log('Running migration: Adding ai_model_info column to meeting_metadata table...');
      db.exec('ALTER TABLE meeting_metadata ADD COLUMN ai_model_info TEXT');
      console.log('Migration completed successfully');
    }

    // Initialize default settings if they don't exist
    const defaultSettings = {
      'ai.meeting_analysis': process.env.AI_BACKEND || 'anthropic',
      'ai.chat': process.env.AI_BACKEND || 'anthropic',
      'ai.wiki_updates': process.env.AI_BACKEND || 'anthropic',
      'ai.mentor_feedback': process.env.AI_BACKEND || 'anthropic',
    };

    const existingSettings = getAllSettings.all();
    const existingKeys = new Set(existingSettings.map(s => s.key));

    for (const [key, value] of Object.entries(defaultSettings)) {
      if (!existingKeys.has(key)) {
        console.log(`Initializing default setting: ${key} = ${value}`);
        upsertSetting.run(key, value);
      }
    }
  } catch (error) {
    console.error('Migration error:', error);
  }
}

runMigrations();

export default db;
