import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env FIRST before importing anything else
const envPath = path.join(__dirname, '../.env');
console.log('Loading .env from:', envPath);
dotenv.config({ path: envPath });

// Azure OpenAI configuration check
console.log('AZURE_OPENAI_ENDPOINT loaded:', process.env.AZURE_OPENAI_ENDPOINT ? 'Yes' : 'No');
console.log('AZURE_OPENAI_API_KEY loaded:', process.env.AZURE_OPENAI_API_KEY ? 'Yes' : 'No');
console.log('AZURE_OPENAI_DEPLOYMENT:', process.env.AZURE_OPENAI_DEPLOYMENT || 'Not set');

import express from 'express';
import cors from 'cors';
import http from 'http';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { initializeSocketIO } from './services/socketService.js';

// Import database to initialize it
import './db/database.js';

// Import routes (placeholder for now)
import projectsRouter from './routes/projects.js';
import meetingsRouter from './routes/meetings.js';
import wikiRouter from './routes/wiki.js';
import searchRouter from './routes/search.js';
import chatRouter from './routes/chat.js';
import { setupAudioCleanupCron, cleanupOldAudioFiles } from './services/audioProcessor.js';
import skillsRouter from './routes/skills.js';
import settingsRouter from './routes/settings.js';
import dataRouter from './routes/data.js';
import milestonesRouter from './routes/milestones.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Rate limiting configuration - only in production
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 500 : 10000, // Much higher limit, skip in dev
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== 'production', // Skip rate limiting in development
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 uploads per hour
  message: { error: 'Upload limit reached, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// CORS configuration - tighten in production
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];

const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? allowedOrigins
    : true, // Allow all origins in development
  credentials: true,
  optionsSuccessStatus: 200,
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../storage/audio'));
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    cb(null, `${timestamp}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// Simple password protection (HTTP Basic Auth)
// Set APP_PASSWORD env var to enable
const basicAuth = (req, res, next) => {
  const password = process.env.APP_PASSWORD;

  // Skip auth if no password set (local development)
  if (!password) {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Aiba PM"');
    return res.status(401).send('Authentication required');
  }

  const credentials = Buffer.from(authHeader.slice(6), 'base64').toString();
  const [user, pass] = credentials.split(':');

  // Username can be anything, just check password
  if (pass === password) {
    return next();
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="Aiba PM"');
  return res.status(401).send('Invalid password');
};

// Middleware
app.use(cors(corsOptions));
app.use(basicAuth); // Password protection before everything else
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Apply rate limiting to API routes
app.use('/api', generalLimiter);

// Make upload middleware available to routes
app.set('upload', upload);

// Static files - audio storage
app.use('/storage', express.static(path.join(__dirname, '../storage')));

// Serve frontend build in production
const frontendPath = path.join(__dirname, '../../frontend/dist');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(frontendPath));
}

// Health check
app.get('/api/health', (req, res) => {
  const azureConfigured = !!(
    process.env.AZURE_OPENAI_ENDPOINT &&
    process.env.AZURE_OPENAI_API_KEY &&
    process.env.AZURE_OPENAI_DEPLOYMENT
  );

  res.json({
    status: 'ok',
    message: 'Server is running',
    aiBackend: 'azure-openai',
    aiConfigured: azureConfigured,
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT || 'not configured',
    modelName: process.env.AZURE_OPENAI_DEPLOYMENT || 'Azure OpenAI',
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
app.use('/api/data', dataRouter);
app.use('/api/milestones', milestonesRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler - serve frontend for non-API routes (SPA client-side routing)
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Route not found' });
  }

  // In production, serve the React app for all non-API routes
  if (process.env.NODE_ENV === 'production') {
    return res.sendFile(path.join(frontendPath, 'index.html'));
  }

  res.status(404).json({ error: 'Route not found' });
});

// Create HTTP server for Socket.IO integration
const httpServer = http.createServer(app);

// Initialize Socket.IO with the same CORS options
initializeSocketIO(httpServer, corsOptions);

// Start server
httpServer.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`WebSocket support enabled`);

  // Setup audio cleanup cron job and run initial cleanup
  setupAudioCleanupCron();
  const deleted = await cleanupOldAudioFiles();
  if (deleted > 0) {
    console.log(`Initial cleanup removed ${deleted} old audio file(s)`);
  }
});
