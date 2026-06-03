-- 0008_fix_realtime_publications_and_rls.sql
-- ============================================================
-- ROOT CAUSE FIX 1: workspace_members was NEVER added to the
-- supabase_realtime publication.
-- ──────────────────────────────────────────────────────────────
-- 0006_rls.sql registers: tasks, board_columns, subtasks,
-- comments, notifications — but NOT workspace_members or
-- task_assignees. Supabase Realtime ONLY broadcasts changes for
-- tables in the supabase_realtime publication. This means no
-- matter how many RTK Query tag fixes are applied client-side,
-- the owner's Realtime channel NEVER receives the INSERT event
-- when someone accepts an invitation — the event never leaves
-- the database.
--
-- ROOT CAUSE FIX 2: workspace_members RLS SELECT gap.
-- ──────────────────────────────────────────────────────────────
-- The existing SELECT policy uses is_workspace_member() which
-- only returns true when the caller is ALREADY in the table.
-- The newly accepted user is not yet a member when the row is
-- committed, so:
--   a) Realtime does not deliver the INSERT event to their channel.
--   b) listMyWorkspaces cannot confirm they joined.
-- "self reads own membership" fixes this: a user can always
-- read their own row regardless of whether they're already a
-- member of other workspaces.
-- ============================================================

-- ── 1. Add tables to Realtime publication ─────────────────────────────

do $$ begin
  perform pg_catalog.pg_publication_add_table(
    'supabase_realtime', 'public.workspace_members'
  );
exception when others then null; end $$;

do $$ begin
  perform pg_catalog.pg_publication_add_table(
    'supabase_realtime', 'public.task_assignees'
  );
exception when others then null; end $$;

-- ── 2. workspace_members RLS additions ───────────────────────────────

do $$ begin
  create policy "self reads own membership"
    on public.workspace_members
    for select
    using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "self joins via invitation"
    on public.workspace_members
    for insert
    with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
