import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getProjectById, getMeetingById } from '../db/database.js';
import { readSummary, generateWikiUpdateSuggestions, getWikiTemplate } from '../services/aiAnalysis.js';
import { readTranscript } from '../services/transcription.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WIKI_DIR = path.join(__dirname, '../../storage/wikis');

const router = express.Router();

/**
 * GET /api/wiki/:projectId
 * Get wiki content for a project
 */
router.get('/:projectId', async (req, res, next) => {
  try {
    const { projectId } = req.params;

    // Verify project exists
    const project = getProjectById.get(parseInt(projectId, 10));
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const wikiPath = path.join(WIKI_DIR, `project-${projectId}.md`);

    try {
      const content = await fs.readFile(wikiPath, 'utf-8');
      res.json({
        projectId: parseInt(projectId, 10),
        content,
        lastUpdated: (await fs.stat(wikiPath)).mtime,
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Wiki doesn't exist yet, return empty
        res.json({
          projectId: parseInt(projectId, 10),
          content: `# ${project.name} Wiki\n\nStart documenting your project here...\n`,
          lastUpdated: null,
        });
      } else {
        throw error;
      }
    }
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/wiki/:projectId
 * Update wiki content for a project
 */
router.put('/:projectId', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { content } = req.body;

    if (content === undefined) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Verify project exists
    const project = getProjectById.get(parseInt(projectId, 10));
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Ensure wiki directory exists
    await fs.mkdir(WIKI_DIR, { recursive: true });

    const wikiPath = path.join(WIKI_DIR, `project-${projectId}.md`);

    // Save wiki content
    await fs.writeFile(wikiPath, content, 'utf-8');

    const stats = await fs.stat(wikiPath);

    res.json({
      message: 'Wiki updated successfully',
      projectId: parseInt(projectId, 10),
      lastUpdated: stats.mtime,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/wiki/:projectId/auto-update
 * Auto-update wiki with meeting summary
 */
router.post('/:projectId/auto-update', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { meetingId, summaryPath } = req.body;

    if (!meetingId || !summaryPath) {
      return res.status(400).json({ error: 'Meeting ID and summary path are required' });
    }

    // Verify project exists
    const project = getProjectById.get(parseInt(projectId, 10));
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Read meeting summary
    const summary = await readSummary(summaryPath);

    // Get current wiki content
    const wikiPath = path.join(WIKI_DIR, `project-${projectId}.md`);
    let currentContent = '';

    try {
      currentContent = await fs.readFile(wikiPath, 'utf-8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        currentContent = `# ${project.name} Wiki\n\n`;
      } else {
        throw error;
      }
    }

    // Generate meeting section
    const meetingSection = generateMeetingSection(summary, meetingId);

    // Append to wiki
    const updatedContent = currentContent + '\n\n' + meetingSection;

    // Ensure wiki directory exists
    await fs.mkdir(WIKI_DIR, { recursive: true });

    // Save updated wiki
    await fs.writeFile(wikiPath, updatedContent, 'utf-8');

    const stats = await fs.stat(wikiPath);

    res.json({
      message: 'Wiki auto-updated with meeting summary',
      projectId: parseInt(projectId, 10),
      lastUpdated: stats.mtime,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Generate markdown section for a meeting
 */
/**
 * POST /api/wiki/:projectId/suggestions
 * Get AI-generated suggestions for updating wiki based on meeting
 */
router.post('/:projectId/suggestions', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { meetingId } = req.body;

    if (!meetingId) {
      return res.status(400).json({ error: 'Meeting ID is required' });
    }

    // Verify project exists
    const project = getProjectById.get(parseInt(projectId, 10));
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get meeting
    const meeting = getMeetingById.get(parseInt(meetingId, 10));
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Get current wiki content
    const wikiPath = path.join(WIKI_DIR, `project-${projectId}.md`);
    let currentWiki = '';

    try {
      currentWiki = await fs.readFile(wikiPath, 'utf-8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        currentWiki = getWikiTemplate(project.name);
      } else {
        throw error;
      }
    }

    // Read meeting transcript and summary
    const transcript = meeting.transcript_path
      ? await readTranscript(meeting.transcript_path)
      : '';

    const summary = meeting.summary_path
      ? await readSummary(meeting.summary_path)
      : {};

    if (!transcript) {
      return res.status(400).json({ error: 'Meeting transcript not available' });
    }

    // Generate suggestions
    const suggestions = await generateWikiUpdateSuggestions(
      currentWiki,
      transcript,
      summary,
      project.name
    );

    res.json({
      projectId: parseInt(projectId, 10),
      meetingId: parseInt(meetingId, 10),
      suggestions,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/wiki/:projectId/apply-suggestions
 * Apply wiki update suggestions and save
 */
router.post('/:projectId/apply-suggestions', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { suggestions, meetingId } = req.body;

    console.log(`📝 Applying wiki suggestions for project ${projectId}, meeting ${meetingId}`);
    console.log(`   Overview updates: ${suggestions?.overview_updates?.length || 0}`);
    console.log(`   User guide updates: ${suggestions?.user_guide_updates?.length || 0}`);
    console.log(`   Technical updates: ${suggestions?.technical_updates?.length || 0}`);

    if (!suggestions || !meetingId) {
      return res.status(400).json({ error: 'Suggestions and meeting ID are required' });
    }

    // Verify project exists
    const project = getProjectById.get(parseInt(projectId, 10));
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get current wiki content
    const wikiPath = path.join(WIKI_DIR, `project-${projectId}.md`);
    let currentWiki = '';
    let isNewWiki = false;

    try {
      currentWiki = await fs.readFile(wikiPath, 'utf-8');
      console.log(`   Found existing wiki (${currentWiki.length} chars)`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        currentWiki = getWikiTemplate(project.name);
        isNewWiki = true;
        console.log(`   Creating new wiki from template`);
      } else {
        throw error;
      }
    }

    // Apply updates
    let updatedWiki = applyWikiSuggestions(currentWiki, suggestions);

    // Add changelog entry if provided
    if (suggestions.changelog_entry) {
      updatedWiki = addChangelogEntry(updatedWiki, suggestions.changelog_entry, meetingId);
      console.log(`   Added changelog entry: ${suggestions.changelog_entry}`);
    }

    // Ensure wiki directory exists
    await fs.mkdir(WIKI_DIR, { recursive: true });

    // Save updated wiki
    await fs.writeFile(wikiPath, updatedWiki, 'utf-8');

    const stats = await fs.stat(wikiPath);
    const totalUpdates = (suggestions.user_guide_updates?.length || 0) + (suggestions.technical_updates?.length || 0);

    console.log(`✅ Wiki updated successfully (${updatedWiki.length} chars, ${totalUpdates} updates applied)`);

    res.json({
      message: 'Wiki updated successfully with suggestions',
      projectId: parseInt(projectId, 10),
      lastUpdated: stats.mtime,
      changesApplied: suggestions.changes_detected?.length || 0,
      updatesApplied: totalUpdates,
      isNewWiki,
    });
  } catch (error) {
    console.error('❌ Error applying wiki suggestions:', error);
    next(error);
  }
});

/**
 * Generate markdown section for a meeting
 */
function generateMeetingSection(summary, meetingId) {
  const date = new Date().toLocaleDateString();

  let markdown = `## Meeting Summary - ${date}\n\n`;
  markdown += `**Meeting ID:** ${meetingId}\n\n`;

  if (summary.overview) {
    markdown += `### Overview\n${summary.overview}\n\n`;
  }

  if (summary.context) {
    markdown += `### Context\n${summary.context}\n\n`;
  }

  if (summary.discussion_topics && summary.discussion_topics.length > 0) {
    markdown += `### Discussion Topics\n`;
    summary.discussion_topics.forEach(topic => {
      markdown += `- ${topic}\n`;
    });
    markdown += `\n`;
  }

  if (summary.detailed_discussion && summary.detailed_discussion.length > 0) {
    markdown += `### Detailed Discussion\n`;
    summary.detailed_discussion.forEach((point, idx) => {
      markdown += `${idx + 1}. ${point}\n\n`;
    });
  }

  if (summary.key_decisions && summary.key_decisions.length > 0) {
    markdown += `### Key Decisions\n`;
    summary.key_decisions.forEach(decision => {
      markdown += `- ${decision}\n`;
    });
    markdown += `\n`;
  }

  if (summary.action_items && summary.action_items.length > 0) {
    markdown += `### Action Items\n`;
    summary.action_items.forEach(item => {
      const task = typeof item === 'string' ? item : item.task;
      const owner = typeof item === 'object' && item.owner ? ` (${item.owner})` : '';
      markdown += `- [ ] ${task}${owner}\n`;
    });
    markdown += `\n`;
  }

  if (summary.technical_details && summary.technical_details.length > 0) {
    markdown += `### Technical Details\n`;
    summary.technical_details.forEach(detail => {
      markdown += `- ${detail}\n`;
    });
    markdown += `\n`;
  }

  markdown += `---\n`;

  return markdown;
}

/**
 * Apply wiki suggestions to current wiki content
 */
function applyWikiSuggestions(currentWiki, suggestions) {
  let updatedWiki = currentWiki;

  // Apply overview updates
  if (suggestions.overview_updates && suggestions.overview_updates.length > 0) {
    for (const update of suggestions.overview_updates) {
      updatedWiki = applyOverviewUpdate(updatedWiki, update);
    }
  }

  // Apply user guide updates
  if (suggestions.user_guide_updates && suggestions.user_guide_updates.length > 0) {
    for (const update of suggestions.user_guide_updates) {
      updatedWiki = applySectionUpdate(updatedWiki, update, '## 📖 User Guide');
    }
  }

  // Apply technical updates
  if (suggestions.technical_updates && suggestions.technical_updates.length > 0) {
    for (const update of suggestions.technical_updates) {
      updatedWiki = applySectionUpdate(updatedWiki, update, '## 🔧 Technical Documentation');
    }
  }

  return updatedWiki;
}

/**
 * Apply overview update to wiki
 * Overview section is always at the top (## Overview)
 */
function applyOverviewUpdate(wiki, update) {
  const overviewHeader = '## Overview';
  const overviewIndex = wiki.indexOf(overviewHeader);

  if (overviewIndex !== -1) {
    // Find the end of the overview section (next ## heading or ---)
    let sectionEnd = wiki.indexOf('\n## ', overviewIndex + 1);
    if (sectionEnd === -1) {
      sectionEnd = wiki.indexOf('\n---', overviewIndex + 1);
    }
    if (sectionEnd === -1) {
      sectionEnd = wiki.length;
    }

    // Replace the overview content
    const newOverview = `${overviewHeader}\n${update.content}\n`;
    wiki = wiki.slice(0, overviewIndex) + newOverview + wiki.slice(sectionEnd);
    console.log(`Updated project overview (action: ${update.action})`);
  } else {
    // Overview section doesn't exist, add it at the top after the title
    const titleEnd = wiki.indexOf('\n', wiki.indexOf('# '));
    if (titleEnd !== -1) {
      const newOverview = `\n${overviewHeader}\n${update.content}\n`;
      wiki = wiki.slice(0, titleEnd + 1) + newOverview + wiki.slice(titleEnd + 1);
      console.log(`Created new overview section`);
    }
  }

  return wiki;
}

/**
 * Apply a single section update to wiki
 */
function applySectionUpdate(wiki, update, parentSection) {
  const sectionHeader = `### ${update.section}`;

  if (update.action === 'add') {
    // Add new subsection under parent
    let parentIndex = wiki.indexOf(parentSection);

    // If parent section not found, create it at the end before Changelog
    if (parentIndex === -1) {
      const changelogIndex = wiki.indexOf('## 📝 Changelog');
      const insertPos = changelogIndex !== -1 ? changelogIndex : wiki.length;

      // Add parent section with content
      const newParentSection = `\n${parentSection}\n\n${sectionHeader}\n${update.content}\n\n`;
      wiki = wiki.slice(0, insertPos) + newParentSection + wiki.slice(insertPos);
      console.log(`Created new parent section: ${parentSection} with subsection: ${update.section}`);
    } else {
      // Find the end of this parent section (next ## heading or end of document)
      let insertIndex = wiki.indexOf('\n## ', parentIndex + 1);
      if (insertIndex === -1) insertIndex = wiki.length;

      const newContent = `\n${sectionHeader}\n${update.content}\n`;
      wiki = wiki.slice(0, insertIndex) + newContent + wiki.slice(insertIndex);
      console.log(`Added subsection: ${update.section} to existing parent: ${parentSection}`);
    }
  } else if (update.action === 'update' || update.action === 'replace') {
    // Find and update existing section
    const sectionIndex = wiki.indexOf(sectionHeader);
    if (sectionIndex !== -1) {
      // Find the end of this section
      const sectionEnd = wiki.indexOf('\n### ', sectionIndex + 1);
      const realEnd = sectionEnd !== -1 ? sectionEnd : wiki.indexOf('\n## ', sectionIndex + 1);

      if (realEnd !== -1) {
        const replacement = `${sectionHeader}\n${update.content}\n`;
        wiki = wiki.slice(0, sectionIndex) + replacement + wiki.slice(realEnd);
        console.log(`Updated subsection: ${update.section}`);
      }
    } else {
      // Section doesn't exist, add it as new
      console.log(`Subsection not found, adding as new: ${update.section}`);
      wiki = applySectionUpdate(wiki, { ...update, action: 'add' }, parentSection);
    }
  }

  return wiki;
}

/**
 * Add changelog entry to wiki
 */
function addChangelogEntry(wiki, changelogText, meetingId) {
  const changelogSection = '## 📝 Changelog';
  const changelogIndex = wiki.indexOf(changelogSection);

  if (changelogIndex !== -1) {
    const date = new Date().toLocaleDateString();
    const entry = `\n**${date}** (Meeting #${meetingId}): ${changelogText}\n`;

    // Insert after the changelog header
    const insertIndex = wiki.indexOf('\n', changelogIndex + changelogSection.length);
    if (insertIndex !== -1) {
      wiki = wiki.slice(0, insertIndex) + entry + wiki.slice(insertIndex);
    }
  }

  return wiki;
}

export default router;
