import type { Notified } from "./types";

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(heading: string, body: string, cta?: { label: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f7f8f9;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#172b4d">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border:1px solid #dcdfe4;border-radius:10px">
<tr><td style="padding:28px 28px 8px;font-size:13px;font-weight:700;color:#0c66e4">Tasklane</td></tr>
<tr><td style="padding:0 28px;font-size:20px;font-weight:650;line-height:1.3">${esc(heading)}</td></tr>
<tr><td style="padding:12px 28px 4px;font-size:15px;line-height:1.55;color:#44546f">${esc(body)}</td></tr>
${cta ? `<tr><td style="padding:20px 28px 28px"><a href="${esc(cta.url)}" style="display:inline-block;background:#0c66e4;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 16px;border-radius:6px">${esc(cta.label)}</a></td></tr>` : `<tr><td style="padding:12px"></td></tr>`}
</table></td></tr></table></body></html>`;
}

async function send(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email:not-sent] to=${to} subject="${subject}" (set RESEND_API_KEY to deliver)`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "Tasklane <onboarding@resend.dev>", to, subject, html }),
  });
  if (!res.ok) console.error("[email:failed]", res.status, await res.text());
}

/** E-mail everyone the database says should hear about a change. Never throws. */
export async function deliver(list: Notified[]) {
  await Promise.allSettled(
    list.map((n) =>
      send(n.email, n.title, layout(n.title, n.body, n.link ? { label: "Open in Tasklane", url: appUrl() + n.link } : undefined)),
    ),
  );
}

export async function sendInvite(p: { token: string; email: string; role: string; project_name: string; inviter_name: string }) {
  const url = `${appUrl()}/invite/${p.token}?email=${encodeURIComponent(p.email)}`;
  await send(
    p.email,
    `${p.inviter_name} invited you to ${p.project_name}`,
    layout(
      `Join ${p.project_name} on Tasklane`,
      `${p.inviter_name} invited you to join as ${p.role}. You only become a member once you accept. The invite expires in 7 days.`,
      { label: "Review invitation", url },
    ),
  );
}
