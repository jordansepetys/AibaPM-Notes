import express from 'express';
import * as db from '../db/database.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Storage paths
const SKILLS_DIR = path.join(__dirname, '../../storage/skills');
const GLOBAL_SKILLS_DIR = path.join(SKILLS_DIR, 'global');

/**
 * Generate URL-safe slug from skill name
 * @param {string} name - Skill name (e.g., "Marketing Status Format")
 * @returns {string} Slug (e.g., "marketing-status-format")
 */
function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')  // Remove special chars
    .replace(/\s+/g, '-')      // Spaces to hyphens
    .replace(/-+/g, '-')       // Collapse multiple hyphens
    .substring(0, 50);         // Max 50 chars
}

/**
 * Ensure slug is unique within scope (global vs project)
 * @param {string} baseSlug - Generated slug
 * @param {number|null} projectId - Project ID or null for global
 * @returns {string} Unique slug (may append -2, -3, etc.)
 */
function ensureUniqueSlug(baseSlug, projectId) {
  let slug = baseSlug;
  let counter = 2;

  // Check if slug exists in same scope
  const scopeParam = projectId || 0;
  while (db.getSkillBySlug.get(slug, scopeParam, scopeParam)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}

/**
 * Get file path for skill markdown file
 * @param {string} slug - Skill slug
 * @param {boolean} isGlobal - Is global skill
 * @param {number|null} projectId - Project ID
 * @returns {string} File path
 */
function getSkillFilePath(slug, isGlobal, projectId) {
  if (isGlobal) {
    return path.join(GLOBAL_SKILLS_DIR, `${slug}.md`);
  } else {
    const projectDir = path.join(SKILLS_DIR, `project-${projectId}`);
    return path.join(projectDir, `${slug}.md`);
  }
}

/**
 * Ensure directory exists
 * @param {string} dirPath - Directory path
 */
async function ensureDirectory(dirPath) {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

// GET /api/skills - List all skills with optional filters
router.get('/', async (req, res) => {
  try {
    const { projectId, global } = req.query;

    let skills;

    if (global === 'true') {
      // Get only global skills
      skills = db.getGlobalSkills.all();
    } else if (projectId) {
      // Get skills for specific project
      skills = db.getSkillsByProject.all(parseInt(projectId));
    } else {
      // Get all skills
      skills = db.getAllSkills.all();
    }

    // Parse trigger_keywords JSON for each skill
    const skillsWithParsedKeywords = skills.map(skill => ({
      ...skill,
      triggerKeywords: skill.trigger_keywords ? JSON.parse(skill.trigger_keywords) : [],
      isGlobal: Boolean(skill.is_global),
      autoActivate: Boolean(skill.auto_activate),
    }));

    res.json({
      success: true,
      skills: skillsWithParsedKeywords,
      count: skillsWithParsedKeywords.length,
    });
  } catch (error) {
    console.error('Error fetching skills:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch skills',
      error: error.message,
    });
  }
});

// GET /api/skills/:id - Get single skill by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const skill = db.getSkillById.get(parseInt(id));

    if (!skill) {
      return res.status(404).json({
        success: false,
        message: 'Skill not found',
      });
    }

    // Read markdown content from file
    const filePath = getSkillFilePath(skill.slug, skill.is_global, skill.project_id);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      skill.content = content;
    } catch (error) {
      console.warn(`Warning: Could not read skill file ${filePath}:`, error.message);
      skill.content = skill.content || ''; // Use DB content as fallback
    }

    // Parse trigger_keywords JSON
    const skillWithParsedData = {
      ...skill,
      triggerKeywords: skill.trigger_keywords ? JSON.parse(skill.trigger_keywords) : [],
      isGlobal: Boolean(skill.is_global),
      autoActivate: Boolean(skill.auto_activate),
    };

    res.json({
      success: true,
      skill: skillWithParsedData,
    });
  } catch (error) {
    console.error('Error fetching skill:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch skill',
      error: error.message,
    });
  }
});

// POST /api/skills - Create new skill
router.post('/', async (req, res) => {
  try {
    const {
      name,
      description,
      content,
      isGlobal,
      projectId,
      triggerKeywords,
      autoActivate,
    } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Skill name is required',
      });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Skill content is required',
      });
    }

    if (!Array.isArray(triggerKeywords)) {
      return res.status(400).json({
        success: false,
        message: 'Trigger keywords must be an array',
      });
    }

    if (!isGlobal && !projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID is required for project-specific skills',
      });
    }

    // Generate unique slug
    const baseSlug = generateSlug(name);
    const slug = ensureUniqueSlug(baseSlug, isGlobal ? null : projectId);

    // Insert into database
    const result = db.createSkill.run(
      name.trim(),
      slug,
      description?.trim() || null,
      content.trim(),
      isGlobal ? 1 : 0,
      isGlobal ? null : parseInt(projectId),
      JSON.stringify(triggerKeywords),
      autoActivate !== false ? 1 : 0
    );

    // Write markdown file
    const filePath = getSkillFilePath(slug, isGlobal, projectId);
    const fileDir = path.dirname(filePath);
    await ensureDirectory(fileDir);
    await fs.writeFile(filePath, content.trim(), 'utf-8');

    // Fetch the created skill
    const skill = db.getSkillById.get(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      message: 'Skill created successfully',
      skill: {
        ...skill,
        triggerKeywords: JSON.parse(skill.trigger_keywords),
        isGlobal: Boolean(skill.is_global),
        autoActivate: Boolean(skill.auto_activate),
      },
    });
  } catch (error) {
    console.error('Error creating skill:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create skill',
      error: error.message,
    });
  }
});

// PUT /api/skills/:id - Update existing skill
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      content,
      triggerKeywords,
      autoActivate,
    } = req.body;

    // Check if skill exists
    const existingSkill = db.getSkillById.get(parseInt(id));
    if (!existingSkill) {
      return res.status(404).json({
        success: false,
        message: 'Skill not found',
      });
    }

    // Validation
    if (name && !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Skill name cannot be empty',
      });
    }

    if (content && !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Skill content cannot be empty',
      });
    }

    if (triggerKeywords && !Array.isArray(triggerKeywords)) {
      return res.status(400).json({
        success: false,
        message: 'Trigger keywords must be an array',
      });
    }

    // Determine new slug if name changed
    let newSlug = existingSkill.slug;
    if (name && name.trim() !== existingSkill.name) {
      const baseSlug = generateSlug(name.trim());
      newSlug = ensureUniqueSlug(baseSlug, existingSkill.project_id);
    }

    // Update database
    db.updateSkill.run(
      name?.trim() || existingSkill.name,
      newSlug,
      description !== undefined ? (description?.trim() || null) : existingSkill.description,
      content?.trim() || existingSkill.content,
      JSON.stringify(triggerKeywords || JSON.parse(existingSkill.trigger_keywords)),
      autoActivate !== undefined ? (autoActivate ? 1 : 0) : existingSkill.auto_activate,
      parseInt(id)
    );

    // Handle file operations
    const oldFilePath = getSkillFilePath(existingSkill.slug, existingSkill.is_global, existingSkill.project_id);
    const newFilePath = getSkillFilePath(newSlug, existingSkill.is_global, existingSkill.project_id);

    // If slug changed, rename file
    if (oldFilePath !== newFilePath) {
      try {
        await fs.rename(oldFilePath, newFilePath);
      } catch (error) {
        console.warn(`Warning: Could not rename skill file from ${oldFilePath} to ${newFilePath}:`, error.message);
      }
    }

    // Update file content if provided
    if (content) {
      await fs.writeFile(newFilePath, content.trim(), 'utf-8');
    }

    // Fetch updated skill
    const updatedSkill = db.getSkillById.get(parseInt(id));

    res.json({
      success: true,
      message: 'Skill updated successfully',
      skill: {
        ...updatedSkill,
        triggerKeywords: JSON.parse(updatedSkill.trigger_keywords),
        isGlobal: Boolean(updatedSkill.is_global),
        autoActivate: Boolean(updatedSkill.auto_activate),
      },
    });
  } catch (error) {
    console.error('Error updating skill:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update skill',
      error: error.message,
    });
  }
});

// DELETE /api/skills/:id - Delete skill
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if skill exists
    const skill = db.getSkillById.get(parseInt(id));
    if (!skill) {
      return res.status(404).json({
        success: false,
        message: 'Skill not found',
      });
    }

    // Delete markdown file
    const filePath = getSkillFilePath(skill.slug, skill.is_global, skill.project_id);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.warn(`Warning: Could not delete skill file ${filePath}:`, error.message);
    }

    // Delete from database (cascade will delete usage records)
    db.deleteSkill.run(parseInt(id));

    res.json({
      success: true,
      message: 'Skill deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting skill:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete skill',
      error: error.message,
    });
  }
});

export default router;
