import { z } from 'zod';

// Common schemas
export const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID must be a number').transform(Number),
});

// Project schemas
export const createProjectSchema = z.object({
  name: z.string()
    .min(1, 'Project name is required')
    .max(200, 'Project name must be less than 200 characters')
    .trim(),
});

export const updateProjectSchema = createProjectSchema;

// Meeting schemas
export const createMeetingSchema = z.object({
  projectId: z.string().regex(/^\d+$/).transform(Number).optional(),
  title: z.string()
    .min(1, 'Title is required')
    .max(500, 'Title must be less than 500 characters')
    .trim(),
  date: z.string()
    .min(1, 'Date is required'),
});

// Chat schemas
export const chatMessageSchema = z.object({
  projectId: z.union([
    z.number().int().positive(),
    z.string().regex(/^\d+$/).transform(Number),
  ]).optional(),
  message: z.string()
    .min(1, 'Message is required')
    .max(10000, 'Message must be less than 10,000 characters'),
});

// Wiki schemas
export const updateWikiSchema = z.object({
  content: z.string()
    .max(500000, 'Wiki content must be less than 500,000 characters'),
});

// Skill schemas
export const createSkillSchema = z.object({
  name: z.string()
    .min(1, 'Skill name is required')
    .max(100, 'Skill name must be less than 100 characters')
    .trim(),
  content: z.string()
    .min(1, 'Skill content is required')
    .max(50000, 'Skill content must be less than 50,000 characters'),
  triggerKeywords: z.array(z.string()).optional().default([]),
  isGlobal: z.boolean().optional().default(false),
  projectId: z.union([
    z.number().int().positive(),
    z.string().regex(/^\d+$/).transform(Number),
  ]).optional(),
});

export const updateSkillSchema = createSkillSchema.partial();

// Settings schemas
export const updateSettingsSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean()])
);

// Search schemas
export const searchQuerySchema = z.object({
  q: z.string()
    .min(1, 'Search query is required')
    .max(500, 'Search query must be less than 500 characters'),
  projectId: z.string().regex(/^\d+$/).transform(Number).optional(),
});

// Milestone schemas
export const createMilestoneSchema = z.object({
  projectId: z.union([
    z.number().int().positive(),
    z.string().regex(/^\d+$/).transform(Number),
  ]),
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title must be less than 200 characters')
    .trim(),
  description: z.string()
    .max(2000, 'Description must be less than 2000 characters')
    .optional()
    .nullable(),
  milestoneDate: z.string()
    .min(1, 'Date is required'),
  milestoneType: z.enum(['demo', 'deadline', 'launch', 'meeting', 'checkpoint'])
    .default('deadline'),
  status: z.enum(['upcoming', 'completed'])
    .default('upcoming'),
});

export const updateMilestoneSchema = createMilestoneSchema.partial().omit({ projectId: true });

export const milestoneQuerySchema = z.object({
  projectId: z.string().regex(/^\d+$/).transform(Number).optional(),
});

// Validation middleware factory
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    try {
      const data = source === 'body' ? req.body :
                   source === 'query' ? req.query :
                   source === 'params' ? req.params : req.body;

      const result = schema.safeParse(data);

      if (!result.success) {
        const errors = result.error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        return res.status(400).json({
          error: 'Validation failed',
          details: errors,
        });
      }

      // Replace source data with validated/transformed data
      if (source === 'body') req.body = result.data;
      else if (source === 'query') req.query = result.data;
      else if (source === 'params') req.params = result.data;

      next();
    } catch (error) {
      next(error);
    }
  };
}
