import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env FIRST before importing anything else
const envPath = path.join(__dirname, '../.env');
console.log('Loading .env from:', envPath);
dotenv.config({ path: envPath });
console.log('OPENAI_API_KEY loaded:', process.env.OPENAI_API_KEY ? 'Yes (length: ' + process.env.OPENAI_API_KEY.length + ')' : 'No');

import express from 'express';
import cors from 'cors';
import multer from 'multer';

// Import database to initialize it
import './db/database.js';

// Import routes (placeholder for now)
import projectsRouter from './routes/projects.js';
import meetingsRouter from './routes/meetings.js';
import wikiRouter from './routes/wiki.js';
import searchRouter from './routes/search.js';
import chatRouter from './routes/chat.js';
import skillsRouter from './routes/skills.js';
import settingsRouter from './routes/settings.js';
import serviceNowRouter from './routes/servicenow.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Configure multer for voice chat uploads (temp files)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../storage/audio'));
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    cb(null, `chat-voice-${timestamp}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit for voice messages
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Make upload middleware available to routes
app.set('upload', upload);

// Static files
app.use('/storage', express.static(path.join(__dirname, '../storage')));

// Health check
app.get('/api/health', (req, res) => {
  const aiBackend = process.env.AI_BACKEND || 'openai';
  const modelName = aiBackend === 'anthropic' ? 'Claude Sonnet 4.5' : 'GPT-4o';
  res.json({
    status: 'ok',
    message: 'Server is running',
    aiBackend: aiBackend,
    modelName: modelName,
  });
});

// API Routes
app.use('/api/projects', projectsRouter);
app.use('/api/meetings', meetingsRouter);
app.use('/api/wiki', wikiRouter);
app.use('/api/search', searchRouter);
app.use('/api/chat', chatRouter);
app.use('/api/skills', skillsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/servicenow', serviceNowRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
