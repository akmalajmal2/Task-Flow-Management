import { z } from 'zod';

export const boardCreateSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).default('#2563eb'),
  visibility: z.enum(['public', 'private']).default('private'),
  // For private boards — workspace members to invite at creation time.
  initial_member_ids: z.array(z.string().uuid()).default([]),
  initial_admin_ids: z.array(z.string().uuid()).default([]),
});

export const boardUpdateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  visibility: z.enum(['public', 'private']).optional(),
});

export type BoardCreateInput = z.infer<typeof boardCreateSchema>;
export type BoardUpdateInput = z.infer<typeof boardUpdateSchema>;
