import { z } from 'zod';

export const taskCreateSchema = z.object({
  board_id: z.string().uuid(),
  column_id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(10000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  due_date: z.string().optional(),
  assignee_ids: z.array(z.string().uuid()).optional(),
  label_ids: z.array(z.string().uuid()).optional(),
});

export const taskUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(10000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  due_date: z.string().nullable().optional(),
  weight_stars: z.number().int().min(0).max(5).optional(),
});

export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
