import { z } from 'zod';

export const workspaceCreateSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
});

export const workspaceUpdateSchema = workspaceCreateSchema.partial();

export type WorkspaceCreateInput = z.infer<typeof workspaceCreateSchema>;
export type WorkspaceUpdateInput = z.infer<typeof workspaceUpdateSchema>;
