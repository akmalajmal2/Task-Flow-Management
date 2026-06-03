import { z } from 'zod';

export const invitationSendSchema = z
  .object({
    workspaceId: z.string().uuid().optional(),
    boardId: z.string().uuid().optional(),
    email: z.string().email(),
    role: z.enum(['owner', 'admin', 'member', 'viewer']).default('member'),
  })
  .refine((d) => d.workspaceId || d.boardId, {
    message: 'Must specify workspaceId or boardId',
  });

export type InvitationSendInput = z.infer<typeof invitationSendSchema>;
