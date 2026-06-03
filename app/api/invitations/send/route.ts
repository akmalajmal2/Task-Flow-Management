import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { invitationSendSchema } from '@/lib/validations/invitation';
import { sendInvitationEmail } from '@/lib/email/send';

export async function POST(req: NextRequest) {
  try {
    const body = invitationSendSchema.parse(await req.json());
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: inviter } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .maybeSingle();

    let contextName = '';
    if (body.workspaceId) {
      const { data } = await supabase
        .from('workspaces')
        .select('name')
        .eq('id', body.workspaceId)
        .maybeSingle();
      contextName = data?.name ?? '';
    } else if (body.boardId) {
      const { data } = await supabase
        .from('boards')
        .select('name')
        .eq('id', body.boardId)
        .maybeSingle();
      contextName = data?.name ?? '';
    }

    const { data: invitation, error } = await supabase
      .from('invitations')
      .insert({
        workspace_id: body.workspaceId ?? null,
        board_id: body.boardId ?? null,
        email: body.email.toLowerCase(),
        role: body.role,
        invited_by: user.id,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // In-app notification if invitee already has an account
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .ilike('email', body.email)
      .maybeSingle();
    if (existingProfile) {
      await supabaseAdmin.from('notifications').insert({
        user_id: existingProfile.id,
        type: 'invitation_received',
        title: `${inviter?.full_name ?? 'A teammate'} invited you to ${contextName || 'TaskFlow'}`,
        body: `Role: ${body.role}`,
        link: `/invite/${invitation.token}`,
        data: { invitation_id: invitation.id, token: invitation.token },
      });
    }

    let emailWarning: string | null = null;
    if (!process.env.RESEND_API_KEY) {
      emailWarning =
        'Email not sent: RESEND_API_KEY is not configured. Add it to .env.local to deliver invitations by email.';
    } else {
      try {
        const result = await sendInvitationEmail({
          to: body.email,
          token: invitation.token,
          inviterName: inviter?.full_name ?? inviter?.email ?? 'A teammate',
          contextName,
          role: body.role,
        });
        const err = (result as any)?.error;
        if (err) {
          const isSandbox =
            err.statusCode === 403 &&
            typeof err.message === 'string' &&
            err.message.includes('testing emails');
          emailWarning = isSandbox
            ? 'Resend sandbox — emails only deliver to your registered address. Verify a domain at https://resend.com/domains to send to anyone.'
            : `Email delivery failed: ${err.message ?? 'unknown error'}`;
        }
      } catch (err: any) {
        emailWarning = `Email delivery failed: ${err?.message ?? 'unknown error'}`;
      }
    }

    return NextResponse.json({ invitation, emailWarning });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Invalid request' }, { status: 400 });
  }
}
