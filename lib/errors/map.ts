import type { PostgrestError } from '@supabase/supabase-js';

interface MappedError {
  message: string;
  code?: string;
  /** Original error preserved for debugging. */
  raw?: unknown;
}

/**
 * Translate raw Postgres / PostgREST errors into messages we'd actually
 * show in a toast. Falls back to a generic message if the error code isn't
 * one we recognize.
 */
export function mapSupabaseError(err: PostgrestError | Error | null | undefined): MappedError {
  if (!err) return { message: 'Unknown error' };

  const msg = (err as Error).message ?? '';
  const code = (err as PostgrestError).code;

  if (code === '23505' || /duplicate key/i.test(msg)) {
    return { message: 'That already exists.', code, raw: err };
  }
  if (code === '23503' || /foreign key/i.test(msg)) {
    return { message: 'Referenced record not found.', code, raw: err };
  }
  if (code === '23514' || /violates check constraint/i.test(msg)) {
    return { message: 'Validation failed.', code, raw: err };
  }
  if (code === '42501' || /permission denied/i.test(msg) || /row-level security/i.test(msg)) {
    return { message: "You don't have permission to perform this action.", code, raw: err };
  }
  if (code === 'PGRST116') {
    return { message: 'Not found.', code, raw: err };
  }
  if (code === 'P0001') {
    // raise exception from a custom function — message is meaningful
    return { message: msg, code, raw: err };
  }

  return { message: msg || 'Something went wrong.', code, raw: err };
}
