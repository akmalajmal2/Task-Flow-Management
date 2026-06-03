import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendInvitationEmail } from '@/lib/email/send';

const bodySchema = z
  .object({
    workspaceId: z.string().uuid().optional(),
    boardId: z.string().uuid().optional(),
    invites: z
      .array(
        z.object({
          email: z.string().email(),
          role: z.enum(['admin', 'member', 'viewer']),
        })
      )
      .min(1),
  })
  .refine((d) => d.workspaceId || d.boardId, { message: 'Must specify workspaceId or boardId' });

export async function POST(req: NextRequest) {
  try {
    const { workspaceId, boardId, invites } = bodySchema.parse(await req.json());
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let contextName = '';
    if (workspaceId) {
      const { data } = await supabase.from('workspaces').select('name').eq('id', workspaceId).maybeSingle();
      contextName = data?.name ?? '';
    } else if (boardId) {
      const { data } = await supabase.from('boards').select('name').eq('id', boardId).maybeSingle();
      contextName = data?.name ?? '';
    }

    const { data: inviter } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .maybeSingle();
    const inviterName = inviter?.full_name ?? inviter?.email ?? 'A teammate';

    const warnings: string[] = [];
    let created = 0;

    for (const invite of invites) {
      const normalizedEmail = invite.email.toLowerCase();

      const { data: invitation, error: invErr } = await supabase
        .from('invitations')
        .insert({
          workspace_id: workspaceId ?? null,
          board_id: boardId ?? null,
          email: normalizedEmail,
          role: invite.role,
          invited_by: user.id,
        })
        .select()
        .single();

      if (invErr) {
        if (invErr.code !== '23505') {
          warnings.push(`${invite.email}: ${invErr.message}`);
        }
        continue;
      }
      created++;

      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .ilike('email', normalizedEmail)
        .maybeSingle();
      if (existingProfile) {
        await supabaseAdmin.from('notifications').insert({
          user_id: existingProfile.id,
          type: 'invitation_received',
          title: `${inviterName} invited you to ${contextName}`,
          body: `Role: ${invite.role}`,
          link: `/invite/${invitation.token}`,
        });
      }

      if (!process.env.RESEND_API_KEY) {
        warnings.push(`${invite.email}: email not sent (RESEND_API_KEY missing).`);
        continue;
      }

      try {
        const result = await sendInvitationEmail({
          to: invite.email,
          token: invitation.token,
          inviterName,
          contextName,
          role: invite.role,
        });
        const err = (result as any)?.error;
        if (err) {
          const isSandbox =
            err.statusCode === 403 &&
            typeof err.message === 'string' &&
            err.message.includes('testing emails');
          warnings.push(
            isSandbox
              ? `${invite.email}: Resend sandbox mode — only your registered address can receive. Verify a domain at resend.com/domains.`
              : `${invite.email}: ${err.message ?? 'Resend error'}`
          );
        }
      } catch (err: any) {
        warnings.push(`${invite.email}: ${err?.message ?? 'unknown error'}`);
      }
    }

    return NextResponse.json({ created, warnings });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Invalid request' }, { status: 400 });
  }
}
