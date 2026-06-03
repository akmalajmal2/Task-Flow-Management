import { Resend } from 'resend';

let _resend: Resend | null = null;
export function resend() {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY is not set');
    _resend = new Resend(key);
  }
  return _resend;
}

const DEFAULT_FROM = 'TaskFlow <onboarding@resend.dev>';

/**
 * Validates RESEND_FROM_EMAIL against Resend's accepted formats.
 * Falls back to a safe default with a warning if invalid.
 */
function sanitizeFromEmail(raw: string | undefined): string {
  if (!raw) return DEFAULT_FROM;
  let value = raw
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .trim()
    .replace(/<\s*([^>]+?)\s*>/g, '<$1>')
    .replace(/\s{2,}/g, ' ');

  const bareEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const namedEmail = /^[^<>]+<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>$/;
  if (bareEmail.test(value) || namedEmail.test(value)) return value;

  console.warn(
    `[email] RESEND_FROM_EMAIL="${raw}" is invalid. Falling back to "${DEFAULT_FROM}".`
  );
  return DEFAULT_FROM;
}

export const FROM_EMAIL = sanitizeFromEmail(process.env.RESEND_FROM_EMAIL);
