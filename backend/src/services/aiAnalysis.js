import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAIBackendForFeature } from './settingsService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUMMARY_DIR = path.join(__dirname, '../../storage/summaries');
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

// Prompt template for meeting analysis
/**
 * Check for API quota/billing errors (OpenAI and Anthropic)
 * @param {Error} error - Error object from API call
 * @param {string} provider - 'openai' or 'anthropic'
 * @returns {string|null} User-friendly error message or null
 */
function checkAPIQuotaError(error, provider = 'openai') {
  if (provider === 'openai') {
    // OpenAI error codes
    if (error.status === 429) {
      return 'OpenAI API rate limit exceeded. Please wait and try "Reprocess Meeting"';
    }
    if (error.status === 401) {
      return 'OpenAI API key is invalid or expired. Check your .env file';
    }
    if (error.status === 402 || error.code === 'insufficient_quota') {
      return 'OpenAI account has insufficient credits. Add credits at platform.openai.com/account/billing';
    }
    if (error.message && error.message.includes('quota')) {
      return 'OpenAI API quota exceeded. Check usage at platform.openai.com/account/usage';
    }
  } else if (provider === 'anthropic') {
    // Anthropic error codes
    if (error.status === 429) {
      return 'Anthropic API rate limit exceeded. Please wait and try "Reprocess Meeting"';
    }
    if (error.status === 401) {
      return 'Anthropic API key is invalid or expired. Check your .env file';
    }
    if (error.status === 402 || error.message?.includes('credit')) {
      return 'Anthropic account has insufficient credits. Check console.anthropic.com/account/billing';
    }
    if (error.message && error.message.includes('quota')) {
      return 'Anthropic API quota exceeded. Check console.anthropic.com/account/usage';
    }
  }

  // Generic billing/quota check
  if (error.message && (error.message.includes('billing') || error.message.includes('payment'))) {
    return `${provider === 'openai' ? 'OpenAI' : 'Anthropic'} billing issue detected. Please check your account`;
  }

  return null;
}

const ANALYSIS_PROMPT = `You are an AI assistant that captures detailed meeting discussions for long-term memory and reference.

Your goal is to preserve what was discussed in detail, not just extract action items. This is a conversation journal that should capture nuances, options discussed, and trade-offs considered.

Analyze the following meeting transcript and provide a structured summary in JSON format with these fields:

1. "overview": A 2-3 sentence high-level summary of what the meeting covered (string)
2. "discussion_topics": An array of topic strings (e.g., ["Feature planning", "Technical architecture", "User feedback"]). Each item should be a simple string, not an object.
3. "detailed_discussion": An array of paragraph strings, each being 2-4 sentences explaining what was talked about, the context, different viewpoints mentioned, and conclusions reached. Be thorough - capture the conversation flow and reasoning. INCLUDE OPTIONS THAT WERE DISCUSSED (even if not chosen), TRADE-OFFS CONSIDERED, and CONCERNS RAISED. Each entry must be a complete paragraph string, NOT an object.
4. "key_decisions": An array of decision strings describing concrete decisions made during the meeting (include empty array if none). For each decision, include WHY it was made if discussed. Each item should be a simple string, not an object.
5. "action_items": An array of objects with "task" and "owner" fields for specific follow-up actions (include empty array if none). This is the ONLY field that should contain objects.
6. "technical_details": An array of technical detail strings - implementations, technologies, APIs, approaches, code details, etc. Include both what was discussed and WHY in each string. INCLUDE ALTERNATIVES THAT WERE CONSIDERED and reasons they were/weren't chosen. Each item should be a simple string, not an object.
7. "context": A paragraph string providing background context - why this meeting happened, what led to these discussions, relevant prior decisions or history mentioned

IMPORTANT: All fields should contain simple strings in their arrays, EXCEPT action_items which contains objects with task/owner. Do not use objects for discussion_topics, detailed_discussion, key_decisions, or technical_details.

IMPORTANT: Focus on capturing WHAT WAS SAID and the reasoning/thought process, not on identifying gaps or problems. This is for future reference to remember what was discussed.

CAPTURE NUANCE: Include options discussed, alternatives considered, trade-offs mentioned, concerns raised, and reasoning behind decisions - not just final conclusions.

Transcript:
---
{transcript}
---

Provide ONLY the JSON response, no additional text.`;

/**
 * Analyze meeting transcript using AI with automatic fallback
 * @param {string} transcript - Meeting transcript text
 * @param {string} backend - AI backend to use ('openai' or 'anthropic') - defaults to user setting
 * @returns {Promise<Object>} Structured analysis with metadata about which model was used
 */
export const analyzeMeeting = async (transcript, backend = null) => {
  if (!transcript || transcript.trim().length === 0) {
    throw new Error('Transcript is empty');
  }

  // Get backend from settings if not specified
  if (!backend) {
    backend = getAIBackendForFeature('meeting_analysis');
  }

  let analysis;
  let usedBackend = backend;
  let usedModel = '';
  let fallbackOccurred = false;

  // Try primary backend first
  if (backend === 'anthropic') {
    console.log(`Analyzing meeting with Anthropic (Claude Sonnet 4.5)...`);
    try {
      analysis = await analyzeWithClaude(transcript);
      usedModel = 'Claude Sonnet 4.5';
    } catch (error) {
      const quotaError = checkAPIQuotaError(error, 'anthropic');

      // If it's a quota/auth error and OpenAI is available, fall back
      if (quotaError && process.env.OPENAI_API_KEY) {
        console.warn(`⚠️  Anthropic API failed: ${quotaError}`);
        console.log(`🔄 Falling back to OpenAI (GPT-4o)...`);

        try {
          analysis = await analyzeWithGPT(transcript);
          usedBackend = 'openai';
          usedModel = 'GPT-4o';
          fallbackOccurred = true;
        } catch (fallbackError) {
          console.error('❌ Fallback to OpenAI also failed:', fallbackError);
          throw new Error(`Both APIs failed. Anthropic: ${quotaError}. OpenAI: ${fallbackError.message}`);
        }
      } else {
        // No fallback available or non-quota error
        throw error;
      }
    }
  } else {
    // Primary is OpenAI
    console.log(`Analyzing meeting with OpenAI (GPT-4o)...`);
    try {
      analysis = await analyzeWithGPT(transcript);
      usedModel = 'GPT-4o';
    } catch (error) {
      const quotaError = checkAPIQuotaError(error, 'openai');

      // If it's a quota/auth error and Anthropic is available, fall back
      if (quotaError && process.env.ANTHROPIC_API_KEY) {
        console.warn(`⚠️  OpenAI API failed: ${quotaError}`);
        console.log(`🔄 Falling back to Anthropic (Claude Sonnet 4.5)...`);

        try {
          analysis = await analyzeWithClaude(transcript);
          usedBackend = 'anthropic';
          usedModel = 'Claude Sonnet 4.5';
          fallbackOccurred = true;
        } catch (fallbackError) {
          console.error('❌ Fallback to Anthropic also failed:', fallbackError);
          throw new Error(`Both APIs failed. OpenAI: ${quotaError}. Anthropic: ${fallbackError.message}`);
        }
      } else {
        // No fallback available or non-quota error
        throw error;
      }
    }
  }

  try {
    // Validate and parse the analysis
    const parsed = typeof analysis === 'string' ? JSON.parse(analysis) : analysis;

    // Ensure all required fields exist and add metadata
    return {
      overview: parsed.overview || 'No overview available',
      discussion_topics: Array.isArray(parsed.discussion_topics) ? parsed.discussion_topics : [],
      detailed_discussion: Array.isArray(parsed.detailed_discussion) ? parsed.detailed_discussion : [],
      key_decisions: Array.isArray(parsed.key_decisions) ? parsed.key_decisions : [],
      action_items: Array.isArray(parsed.action_items) ? parsed.action_items : [],
      technical_details: Array.isArray(parsed.technical_details) ? parsed.technical_details : [],
      context: parsed.context || '',
      // Metadata about which model was used
      _metadata: {
        usedBackend,
        usedModel,
        fallbackOccurred,
        analyzedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('Analysis parsing error:', error);
    throw new Error(`Failed to parse analysis: ${error.message}`);
  }
};

/**
 * Analyze using Claude (Anthropic)
 * @param {string} transcript - Meeting transcript
 * @returns {Promise<string>} JSON analysis
 */
const analyzeWithClaude = async (transcript) => {
  const client = getAnthropicClient();
  if (!client) {
    throw new Error('Anthropic API key not configured');
  }

  try {
    const prompt = ANALYSIS_PROMPT.replace('{transcript}', transcript);

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const response = message.content[0].text;
    console.log('Claude analysis completed');

    return response;
  } catch (error) {
    // Check for API quota/billing issues
    const quotaError = checkAPIQuotaError(error, 'anthropic');
    if (quotaError) {
      console.error('❌ Anthropic API Error:', quotaError);
      throw new Error(quotaError);
    }
    throw error;
  }
};

/**
 * Analyze using GPT-4o (OpenAI)
 * @param {string} transcript - Meeting transcript
 * @returns {Promise<string>} JSON analysis
 */
const analyzeWithGPT = async (transcript) => {
  const client = getOpenAIClient();
  if (!client) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    const prompt = ANALYSIS_PROMPT.replace('{transcript}', transcript);

    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a meeting documentation assistant that captures detailed discussions for long-term reference. Return structured JSON responses with thorough detail.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 4096,
    });

    const response = completion.choices[0].message.content;
    console.log('GPT-4o analysis completed');

    return response;
  } catch (error) {
    // Check for API quota/billing issues
    const quotaError = checkAPIQuotaError(error, 'openai');
    if (quotaError) {
      console.error('❌ OpenAI API Error:', quotaError);
      throw new Error(quotaError);
    }
    throw error;
  }
};

/**
 * Save meeting analysis to file
 * @param {Object} analysis - Analysis object
 * @param {number} meetingId - Meeting ID
 * @returns {Promise<string>} Path to saved file
 */
export const saveSummary = async (analysis, meetingId) => {
  try {
    // Ensure summary directory exists
    await fs.mkdir(SUMMARY_DIR, { recursive: true });

    const timestamp = Date.now();
    const filename = `meeting-${meetingId}-${timestamp}.json`;
    const filePath = path.join(SUMMARY_DIR, filename);

    // Add metadata
    const summaryData = {
      ...analysis,
      generatedAt: new Date().toISOString(),
      aiBackend: AI_BACKEND,
    };

    await fs.writeFile(filePath, JSON.stringify(summaryData, null, 2));

    console.log(`Summary saved: ${filename}`);

    return `/storage/summaries/${filename}`;
  } catch (error) {
    console.error('Error saving summary:', error);
    throw new Error('Failed to save summary');
  }
};

/**
 * Read summary from file
 * @param {string} summaryPath - Path to summary file
 * @returns {Promise<Object>} Summary data
 */
export const readSummary = async (summaryPath) => {
  try {
    const fullPath = path.join(__dirname, '../..', summaryPath);
    const content = await fs.readFile(fullPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error reading summary:', error);
    throw new Error('Failed to read summary');
  }
};

/**
 * Generate mentor feedback on meeting
 * @param {string} transcript - Meeting transcript
 * @param {Object} summary - Meeting summary
 * @returns {Promise<Object>} Mentor feedback
 */
export const generateMentorFeedback = async (transcript, summary) => {
  const backend = getAIBackendForFeature('mentor_feedback');

  const prompt = `You are an experienced technical mentor reviewing a meeting transcript.

Based on this meeting summary and transcript, provide constructive feedback in JSON format:

Summary:
${JSON.stringify(summary, null, 2)}

Provide feedback in this structure:
{
  "strengths": ["list of things done well"],
  "improvements": ["list of areas for improvement"],
  "recommendations": ["specific actionable recommendations"],
  "overall_assessment": "brief overall assessment"
}

Provide ONLY the JSON response, no additional text.`;

  try {
    let feedback;

    if (backend === 'anthropic') {
      const client = getAnthropicClient();
      if (!client) {
        throw new Error('Anthropic API key not configured');
      }
      const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });
      feedback = message.content[0].text;
    } else {
      const client = getOpenAIClient();
      if (!client) {
        throw new Error('OpenAI API key not configured');
      }
      const completion = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a technical mentor providing feedback.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1024,
      });
      feedback = completion.choices[0].message.content;
    }

    return typeof feedback === 'string' ? JSON.parse(feedback) : feedback;
  } catch (error) {
    console.error('Mentor feedback error:', error);
    throw new Error('Failed to generate mentor feedback');
  }
};

/**
 * Generate wiki update suggestions based on meeting content
 * @param {string} currentWiki - Current wiki markdown content
 * @param {string} transcript - Meeting transcript
 * @param {Object} summary - Meeting summary
 * @param {string} projectName - Project name
 * @returns {Promise<Object>} Wiki update suggestions
 */
export const generateWikiUpdateSuggestions = async (currentWiki, transcript, summary, projectName) => {
  const backend = getAIBackendForFeature('wiki_updates');

  // Use full transcript for better context (modern LLMs handle 100k+ tokens)
  const fullTranscript = transcript;

  const prompt = `You are a technical documentation assistant. Analyze a meeting transcript and suggest detailed wiki updates that capture nuances, options discussed, and trade-offs.

Current Wiki Content:
---
${currentWiki}
---

Meeting Summary:
${JSON.stringify(summary, null, 2)}

Full Meeting Transcript:
---
${fullTranscript}
---

Your task:
1. Identify NEW information that should be added to the wiki
2. Identify CHANGES to existing information (e.g., switching from one technology to another)
3. **CAPTURE NUANCES**: Include options discussed, trade-offs considered, reasons for decisions
4. **CAPTURE CONTEXT**: Include "why" decisions were made, alternative approaches considered
5. Structure suggestions into:
   - Project Overview (purpose, goals, what the project does, main features)
   - User Guide sections (how-to, basic usage, getting started)
   - Technical Documentation sections (architecture decisions, implementation details, APIs)
6. Generate a changelog entry if there are significant changes

Respond in JSON format:
{
  "has_updates": true/false,
  "overview_updates": [
    {
      "action": "add" or "update" or "replace",
      "content": "Detailed description including nuances, context, and reasoning from the discussion",
      "reason": "why this update is needed, referencing specific parts of the meeting"
    }
  ],
  "user_guide_updates": [
    {
      "section": "section name (e.g., 'Getting Started', 'How to Use Feature X')",
      "action": "add" or "update" or "replace",
      "content": "Detailed markdown content capturing discussion nuances, options considered, and rationale",
      "reason": "why this update is needed"
    }
  ],
  "technical_updates": [
    {
      "section": "section name (e.g., 'Architecture', 'API Design', 'Technology Stack', 'Design Decisions')",
      "action": "add" or "update" or "replace",
      "content": "Detailed markdown content including:\n- What was decided\n- Options that were discussed\n- Trade-offs considered\n- Reasons for the decision\n- Any concerns or caveats mentioned",
      "reason": "why this update is needed",
      "is_change": true/false (if replacing old technology/approach)
    }
  ],
  "changes_detected": [
    {
      "from": "old value (e.g., 'SignalR')",
      "to": "new value (e.g., 'PostMessage')",
      "context": "what changed and why (include reasoning from discussion)"
    }
  ],
  "changelog_entry": "Detailed changelog note capturing key decisions and context"
}

IMPORTANT - CAPTURE NUANCE:
- DO NOT oversimplify - capture the richness of the discussion
- Include options that were considered but NOT chosen (with reasons)
- Include trade-offs, concerns, and caveats discussed
- Include "why" and "how" context, not just "what"
- If multiple approaches were discussed, document all of them with pros/cons
- Include specific technical details, examples, and reasoning mentioned
- Be thorough and detailed - this is a knowledge base, not a summary
- Only suggest updates for information actually discussed in the meeting
- Update the Overview if the meeting discusses project purpose, goals, scope, or high-level objectives

Provide ONLY the JSON response, no additional text.`;

  try {
    let suggestions;

    if (backend === 'anthropic') {
      const client = getAnthropicClient();
      if (!client) {
        throw new Error('Anthropic API key not configured');
      }
      const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000, // Increased from 3000 to capture detailed nuances and multiple updates
        messages: [{ role: 'user', content: prompt }],
      });
      suggestions = message.content[0].text;
    } else {
      const client = getOpenAIClient();
      if (!client) {
        throw new Error('OpenAI API key not configured');
      }
      const completion = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a technical documentation assistant that analyzes meetings and suggests detailed wiki updates with nuances, trade-offs, and context.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 8000, // Increased from 3000 to capture detailed nuances and multiple updates
      });
      suggestions = completion.choices[0].message.content;
    }

    const parsed = typeof suggestions === 'string' ? JSON.parse(suggestions) : suggestions;

    // Validate and normalize the response
    return {
      has_updates: parsed.has_updates || false,
      overview_updates: Array.isArray(parsed.overview_updates) ? parsed.overview_updates : [],
      user_guide_updates: Array.isArray(parsed.user_guide_updates) ? parsed.user_guide_updates : [],
      technical_updates: Array.isArray(parsed.technical_updates) ? parsed.technical_updates : [],
      changes_detected: Array.isArray(parsed.changes_detected) ? parsed.changes_detected : [],
      changelog_entry: parsed.changelog_entry || null,
    };
  } catch (error) {
    console.error('Wiki suggestion error:', error);
    throw new Error('Failed to generate wiki suggestions');
  }
};

/**
 * Get structured wiki template
 * @param {string} projectName - Project name
 * @returns {string} Markdown template for new wikis
 */
export const getWikiTemplate = (projectName) => {
  return `# ${projectName}

## Overview
Brief description of the project, its purpose, and main features.

---

## 🚀 Getting Started

### Prerequisites
List any required tools, dependencies, or knowledge needed.

### Installation
Step-by-step installation instructions.

### Quick Start
How to get up and running quickly.

---

## 📖 User Guide

### Core Features
Describe main features and how to use them.

### Common Tasks
Step-by-step guides for common user tasks.

### Configuration
How to configure the application.

---

## 🔧 Technical Documentation

### Architecture
High-level architecture overview and design decisions.

### Technology Stack
List of technologies used and why they were chosen.

### API Documentation
Key APIs and their usage.

### Implementation Details
Important technical implementation notes.

---

## 📝 Changelog

Updates and changes to the project will be tracked here.

`;
};
