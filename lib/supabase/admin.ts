import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Service-role client. Bypasses RLS — use ONLY in trusted server code
 * (route handlers, edge functions). Never import from client components.
 *
 * Common uses:
 *   - Look up a profile by email when sending invitations (the inviter
 *     might not have RLS rights to that profile row).
 *   - Insert notifications on behalf of another user.
 */
export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  }
);
