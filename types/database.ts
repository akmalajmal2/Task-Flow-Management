/**
 * STUB — replace with output of `npm run db:types` after `supabase start`.
 * This file lets TypeScript compile before the live schema is generated.
 *
 * The full Supabase-generated file will look like:
 *   export type Database = {
 *     public: { Tables: { ... }; Views: { ... }; ... }
 *   }
 */

export type Database = {
  public: {
    Tables: Record<string, { Row: any; Insert: any; Update: any }>;
    Views: Record<string, { Row: any }>;
    Functions: Record<string, { Args: any; Returns: any }>;
    Enums: Record<string, string>;
  };
};
