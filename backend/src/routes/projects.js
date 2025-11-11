import express from 'express';
import {
  createProject,
  getAllProjects,
  getProjectById,
  updateProject,
  deleteProject,
} from '../db/database.js';

const router = express.Router();

/**
 * GET /api/projects
 * Get all projects
 */
router.get('/', (req, res, next) => {
  try {
    const projects = getAllProjects.all();
    res.json({ projects });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/projects
 * Create a new project
 */
router.post('/', (req, res, next) => {
  try {
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const result = createProject.run(name.trim());

    const project = getProjectById.get(result.lastInsertRowid);

    res.status(201).json({
      message: 'Project created successfully',
      project,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/projects/:id
 * Get a specific project by ID
 */
router.get('/:id', (req, res, next) => {
  try {
    const { id } = req.params;

    const project = getProjectById.get(parseInt(id, 10));

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ project });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/projects/:id
 * Update a project
 */
router.put('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const project = getProjectById.get(parseInt(id, 10));

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    updateProject.run(name.trim(), parseInt(id, 10));

    const updatedProject = getProjectById.get(parseInt(id, 10));

    res.json({
      message: 'Project updated successfully',
      project: updatedProject,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/projects/:id
 * Delete a project
 */
router.delete('/:id', (req, res, next) => {
  try {
    const { id } = req.params;

    const project = getProjectById.get(parseInt(id, 10));

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    deleteProject.run(parseInt(id, 10));

    res.json({
      message: 'Project deleted successfully',
      project,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
