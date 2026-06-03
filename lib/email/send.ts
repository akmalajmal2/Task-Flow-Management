import { resend, FROM_EMAIL } from './resend';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/**
 * Sends an invitation email. Returns the Resend response so the caller can
 * detect sandbox mode and surface actionable feedback to the user.
 */
export async function sendInvitationEmail(args: {
  to: string;
  token: string;
  inviterName: string;
  contextName: string;
  role: string;
}) {
  const acceptUrl = `${APP_URL}/invite/${args.token}`;
  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:24px;background:#f6f8fa">
  <div style="background:#fff;max-width:560px;margin:0 auto;padding:32px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <h2 style="color:#111;margin:0 0 16px 0">You've been invited to TaskFlow</h2>
    <p style="color:#555;line-height:1.6">
      <strong>${escapeHtml(args.inviterName)}</strong> invited you to join
      <strong>${escapeHtml(args.contextName)}</strong> as <strong>${escapeHtml(args.role)}</strong>.
    </p>
    <a href="${acceptUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin-top:16px">
      Accept invitation
    </a>
    <p style="color:#888;font-size:12px;margin-top:24px">
      Or copy this link: <br/>
      <code style="background:#f1f1f1;padding:4px 8px;border-radius:4px;font-size:11px">${acceptUrl}</code>
    </p>
    <p style="color:#888;font-size:12px;margin-top:16px">
      This invitation expires in 14 days.
    </p>
  </div>
</div>`.trim();

  return resend().emails.send({
    from: FROM_EMAIL,
    to: args.to,
    subject: `${args.inviterName} invited you to ${args.contextName || 'TaskFlow'}`,
    html,
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return c;
    }
  });
}
