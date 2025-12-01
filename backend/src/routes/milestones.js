import express from 'express';
import {
  createMilestone,
  getAllMilestones,
  getMilestoneById,
  getMilestonesByProject,
  updateMilestone,
  deleteMilestone,
} from '../db/database.js';
import {
  validate,
  idParamSchema,
  createMilestoneSchema,
  updateMilestoneSchema,
  milestoneQuerySchema,
} from '../middleware/validation.js';

const router = express.Router();

/**
 * GET /api/milestones
 * Get all milestones, optionally filtered by project
 */
router.get('/', validate(milestoneQuerySchema, 'query'), (req, res, next) => {
  try {
    const { projectId } = req.query;

    let milestones;
    if (projectId) {
      milestones = getMilestonesByProject.all(projectId);
    } else {
      milestones = getAllMilestones.all();
    }

    res.json({ milestones });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/milestones
 * Create a new milestone
 */
router.post('/', validate(createMilestoneSchema), (req, res, next) => {
  try {
    const { projectId, title, description, milestoneDate, milestoneType, status } = req.body;

    const result = createMilestone.run(
      projectId,
      title,
      description || null,
      milestoneDate,
      milestoneType,
      status
    );

    const milestone = getMilestoneById.get(result.lastInsertRowid);

    res.status(201).json({
      message: 'Milestone created successfully',
      milestone,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/milestones/:id
 * Get a specific milestone by ID
 */
router.get('/:id', validate(idParamSchema, 'params'), (req, res, next) => {
  try {
    const { id } = req.params;

    const milestone = getMilestoneById.get(id);

    if (!milestone) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    res.json({ milestone });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/milestones/:id
 * Update a milestone
 */
router.put('/:id', validate(idParamSchema, 'params'), validate(updateMilestoneSchema), (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, milestoneDate, milestoneType, status } = req.body;

    const milestone = getMilestoneById.get(id);

    if (!milestone) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    updateMilestone.run(
      title ?? milestone.title,
      description !== undefined ? description : milestone.description,
      milestoneDate ?? milestone.milestone_date,
      milestoneType ?? milestone.milestone_type,
      status ?? milestone.status,
      id
    );

    const updatedMilestone = getMilestoneById.get(id);

    res.json({
      message: 'Milestone updated successfully',
      milestone: updatedMilestone,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/milestones/:id
 * Delete a milestone
 */
router.delete('/:id', validate(idParamSchema, 'params'), (req, res, next) => {
  try {
    const { id } = req.params;

    const milestone = getMilestoneById.get(id);

    if (!milestone) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    deleteMilestone.run(id);

    res.json({
      message: 'Milestone deleted successfully',
      milestone,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
