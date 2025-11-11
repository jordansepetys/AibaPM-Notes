import express from 'express';
import * as db from '../db/database.js';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { transcribeAudio } from '../services/transcription.js';
import { findRelevantSkills, buildSkillsContext } from '../services/skillMatcher.js';
import { getAIBackendForFeature } from '../services/settingsService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const AI_BACKEND = process.env.AI_BACKEND || 'openai';

// Initialize AI clients (lazy initialization)
let anthropic = null;
let openai = null;

function getAnthropicClient() {
  if (!anthropic && process.env.ANTHROPIC_API_KEY) {
    anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropic;
}

function getOpenAIClient() {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

// System prompt for the AI mentor
const SYSTEM_PROMPT = `You're talking to someone who needs genuine help thinking through their work and projects. Have a real conversation with them - like you're their smart friend who gets it.

Your style:
Talk naturally. Use "you" and "I" like a normal person. React authentically - if something sounds exciting, say "oh damn that's cool" or "wait that's actually genius." If something seems tricky, acknowledge it: "yeah that's gonna be tough" or "oof, I see why that's challenging."

Don't be formal or corporate. Don't give generic advice. Actually engage with what they're saying.

When they share context about their projects or meetings:
You have access to their meeting notes, project docs, and past conversations. Reference specific things they mentioned. Connect dots they might not see. Point out patterns. If something they're saying contradicts earlier decisions, bring it up - "wait, didn't you say in the Dec 15 meeting that you wanted to use PostgreSQL?"

If they ask for feedback or analysis:
Give them your actual take, not a sanitized breakdown. Structure your thoughts however makes sense - sometimes that's bullet points, sometimes it's just paragraphs. Use markdown when it helps (headers, lists, code blocks) but don't force it.

Keep it real:
- You can use emojis if it fits the vibe
- You can start with "Ohhh okay" or "Wait wait wait" or "Yo" if that's the natural reaction
- You can say "that's actually sick" or "bruh" or "honestly" - talk like a person
- Break things down when they're complex, but don't over-explain simple stuff
- If you're not sure, say so. If they need more info, ask.

The goal: Be the person they want to talk to when they're thinking through something. Not a formal advisor, not a chatbot - a smart friend who pays attention and actually helps.

You have access to the user's project context (meetings, wikis, summaries) which will be provided below when relevant.`;

/**
 * Build context for AI from project data
 */
async function buildProjectContext(projectId) {
  if (!projectId) {
    return { hasContext: false, context: '' };
  }

  try {
    const project = db.getProjectById.get(projectId);
    if (!project) {
      return { hasContext: false, context: '' };
    }

    let contextParts = [];
    contextParts.push(`# Project: ${project.name}\n`);

    // Get project wiki
    try {
      const wikiPath = path.join(__dirname, '../../storage/wikis', `project-${projectId}.md`);
      const wikiContent = await fs.readFile(wikiPath, 'utf-8');
      if (wikiContent && wikiContent.trim()) {
        contextParts.push(`## Current Wiki Documentation:\n${wikiContent}\n`);
      }
    } catch (error) {
      // Wiki might not exist yet
      contextParts.push(`## Wiki: Not yet created\n`);
    }

    // Get recent meetings (last 5)
    const meetings = db.getMeetingsByProject.all(projectId);
    const recentMeetings = meetings.slice(0, 5);

    if (recentMeetings.length > 0) {
      contextParts.push(`## Recent Meetings:\n`);

      for (const meeting of recentMeetings) {
        contextParts.push(`\n### ${meeting.title} (${new Date(meeting.date).toLocaleDateString()})\n`);

        // Load summary if available
        if (meeting.summary_path) {
          try {
            const summaryPath = path.join(__dirname, '../..', meeting.summary_path);
            const summaryContent = await fs.readFile(summaryPath, 'utf-8');
            const summary = JSON.parse(summaryContent);

            contextParts.push(`**Overview:** ${summary.overview}\n`);

            if (summary.context) {
              contextParts.push(`**Context:** ${summary.context}\n`);
            }

            if (summary.key_decisions && summary.key_decisions.length > 0) {
              contextParts.push(`**Decisions:**\n${summary.key_decisions.map(d => `- ${d}`).join('\n')}\n`);
            }

            if (summary.technical_details && summary.technical_details.length > 0) {
              contextParts.push(`**Technical:**\n${summary.technical_details.slice(0, 3).map(d => `- ${d}`).join('\n')}\n`);
            }
          } catch (error) {
            // Summary not available
          }
        }
      }
    } else {
      contextParts.push(`## Meetings: No meetings recorded yet\n`);
    }

    const context = contextParts.join('\n');
    return {
      hasContext: true,
      context: context,
      projectName: project.name,
    };
  } catch (error) {
    console.error('Error building project context:', error);
    return { hasContext: false, context: '', error: error.message };
  }
}

/**
 * Get AI response using Claude or GPT
 */
async function getAIResponse(messages, systemPrompt, backend = null) {
  try {
    // Get backend from settings if not specified
    if (!backend) {
      backend = getAIBackendForFeature('chat');
    }

    if (backend === 'anthropic') {
      const client = getAnthropicClient();
      if (!client) {
        throw new Error('Anthropic API key not configured');
      }

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        temperature: 1.0, // More creative and natural (default is 1.0, but explicit is better)
        system: systemPrompt,
        messages: messages,
      });

      return response.content[0].text;
    } else {
      const client = getOpenAIClient();
      if (!client) {
        throw new Error('OpenAI API key not configured');
      }

      const chatMessages = [
        { role: 'system', content: systemPrompt },
        ...messages,
      ];

      const completion = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: chatMessages,
        max_tokens: 4096,
        temperature: 1.0, // More creative and natural
      });

      return completion.choices[0].message.content;
    }
  } catch (error) {
    console.error('AI response error:', error);
    throw new Error(`Failed to get AI response: ${error.message}`);
  }
}

/**
 * POST /api/chat
 * Send a message to the AI mentor
 */
router.post('/', async (req, res, next) => {
  try {
    const { message, projectId, disableSkills = false } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Build project context if projectId provided
    const contextData = projectId ? await buildProjectContext(projectId) : { hasContext: false };

    // Get recent conversation history (last 10 messages)
    const recentMessages = db.getRecentChatMessages.all(
      projectId || null,
      projectId || null,
      10
    ).reverse(); // Reverse to get chronological order

    // Build message history for AI
    const aiMessages = recentMessages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    // Add current user message
    aiMessages.push({
      role: 'user',
      content: message,
    });

    // Build system prompt with context
    let fullSystemPrompt = SYSTEM_PROMPT;
    if (contextData.hasContext) {
      fullSystemPrompt += `\n\n---\n\n# Project Context\n\n${contextData.context}`;
    } else if (projectId) {
      fullSystemPrompt += `\n\nNote: User has selected a project, but no context is available yet. Acknowledge this if relevant.`;
    }

    // Find and apply relevant skills (unless manually disabled)
    let relevantSkills = [];
    if (!disableSkills) {
      relevantSkills = await findRelevantSkills(message, projectId);
      const skillsContext = buildSkillsContext(relevantSkills);
      if (skillsContext) {
        fullSystemPrompt += skillsContext;
      }
    }

    // Log skills status
    if (disableSkills) {
      console.log('⏸️  Skills manually disabled for this message');
    } else if (relevantSkills.length > 0) {
      console.log(`🎯 Applied ${relevantSkills.length} skill(s):`,
        relevantSkills.map(s => `${s.name} (${s.scope}, score=${s.score})`).join(', ')
      );
    } else {
      console.log('ℹ️  No matching skills found');
    }

    // Get AI response
    console.log(`💬 Chat request ${projectId ? `for project ${projectId}` : '(general)'}`);
    const aiResponse = await getAIResponse(aiMessages, fullSystemPrompt);

    // Save user message to database
    const userMessageResult = db.createChatMessage.run(
      projectId || null,
      'user',
      message,
      contextData.hasContext ? JSON.stringify({ projectName: contextData.projectName }) : null
    );

    // Save AI response to database
    const aiMessageResult = db.createChatMessage.run(
      projectId || null,
      'assistant',
      aiResponse,
      null
    );

    // Track skill usage (only if skills were actually used)
    if (!disableSkills && relevantSkills.length > 0) {
      for (const skill of relevantSkills) {
        try {
          db.trackSkillUsage.run(skill.id, aiMessageResult.lastInsertRowid);
        } catch (error) {
          console.warn(`Warning: Could not track skill usage for skill ${skill.id}:`, error.message);
        }
      }
    }

    console.log(`✅ Chat response generated`);

    res.json({
      success: true,
      message: aiResponse,
      messageId: aiMessageResult.lastInsertRowid,
      context: contextData.hasContext ? {
        projectName: contextData.projectName,
      } : null,
      activeSkills: relevantSkills.map(s => ({
        id: s.id,
        name: s.name,
        scope: s.scope,
        score: s.score,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/chat
 * Get chat history
 */
router.get('/', async (req, res, next) => {
  try {
    const { projectId } = req.query;

    const messages = db.getChatMessages.all(
      projectId || null,
      projectId || null
    );

    res.json({
      success: true,
      messages: messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: msg.created_at,
        projectId: msg.project_id,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/chat
 * Clear chat history
 */
router.delete('/', async (req, res, next) => {
  try {
    const { projectId } = req.query;

    db.clearChatHistory.run(
      projectId || null,
      projectId || null
    );

    console.log(`🗑️ Chat history cleared ${projectId ? `for project ${projectId}` : '(all)'}`);

    res.json({
      success: true,
      message: 'Chat history cleared',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/chat/transcribe
 * Transcribe voice input for chat
 */
router.post('/transcribe', async (req, res, next) => {
  try {
    const upload = req.app.get('upload');

    // Use multer middleware for this specific route
    upload.single('audio')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: 'File upload failed: ' + err.message });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No audio file provided' });
      }

      console.log('🎤 Transcribing voice input for chat...');

      try {
        // Transcribe the audio file
        const result = await transcribeAudio(req.file.path);

        console.log(`✅ Voice transcribed: ${result.text.length} characters`);

        // Clean up the temporary audio file
        await fs.unlink(req.file.path).catch(err =>
          console.warn('Failed to cleanup temp audio:', err.message)
        );

        res.json({
          success: true,
          text: result.text,
          language: result.language,
          duration: result.duration,
        });
      } catch (transcribeError) {
        // Clean up the file even if transcription fails
        await fs.unlink(req.file.path).catch(() => {});
        throw transcribeError;
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
