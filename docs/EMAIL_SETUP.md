# Email Setup

If invitations show in-app but don't arrive in Gmail, your Resend config isn't set up.

## Diagnosis

When you send an invitation the app tells you what happened:

- **"Invitation emailed to …"** → delivered to Resend successfully
- **"Invitation created but email not sent"** → check your terminal running `npm run dev` for the full error

## Fixes

### 1. `RESEND_API_KEY` is missing

Most common issue.

1. Sign up at [resend.com](https://resend.com) (free, no card).
2. [resend.com/api-keys](https://resend.com/api-keys) → Create API Key → copy it (starts with `re_…`).
3. In `.env.local`:
   ```
   RESEND_API_KEY=re_your_actual_key
   RESEND_FROM_EMAIL=TaskFlow <onboarding@resend.dev>
   ```
4. **Restart `npm run dev`** — env vars only load at boot.

### 2. Sandbox mode blocks delivery to anyone but you

When `RESEND_FROM_EMAIL=TaskFlow <onboarding@resend.dev>`, Resend's sandbox only delivers to the email you registered your Resend account with. Every other recipient returns 403.

**Two options:**

**Test with your own email only (fastest):** Invite yourself first. Create a second TaskFlow account with a different email to test the multi-user flow.

**Verify a domain (real fix):**
1. [resend.com/domains](https://resend.com/domains) → Add Domain
2. Add TXT / MX / DKIM records at your DNS provider
3. Wait 5-30 minutes for verification
4. Update env:
   ```
   RESEND_FROM_EMAIL=TaskFlow <no-reply@yourdomain.com>
   ```
5. Restart `npm run dev`

### 3. "Invalid `from` field" error

The value of `RESEND_FROM_EMAIL` isn't in one of Resend's two accepted formats:
- `email@example.com`
- `Name <email@example.com>`

Common mistakes:
- Extra spaces inside angle brackets: `TaskFlow < email@example.com >` (wrong)
- Smart/curly quotes from copy-paste: `"TaskFlow" <…>` (wrong)
- Wrapping the value in quotes inside `.env.local`

The app sanitizes these automatically and falls back to `TaskFlow <onboarding@resend.dev>` with a warning in the terminal. Fix the env var and restart.

### 4. Gmail spam folder

New Resend accounts take a few sends to build reputation. Mark the email as "Not spam" once and future ones deliver normally.

## Verifying

1. Check [resend.com/emails](https://resend.com/emails) — every send attempt (success or failure) is logged there with the full HTML preview.
2. Watch your terminal for `[invitation/send]` lines — errors are logged verbatim.

## Fallback

The app works without email configured:
- Invitation rows still get created
- Invitees with an existing account get an in-app notification
- You can share the invitation link (`/invite/<token>`) manually

So email is a nice-to-have for onboarding new users.
