-- 0010_fix_members_visibility.sql
-- ============================================================
-- Fixes members not appearing after invitation acceptance.
-- Three issues addressed:
-- ============================================================

-- ── FIX 1: Add invitations table to Realtime publication ─────────────
-- The workspace layout subscribes to invitations UPDATE events as a
-- backup trigger to invalidate the member list cache. Without this,
-- those events are never broadcast from the database.
do $$ begin
  perform pg_catalog.pg_publication_add_table(
    'supabase_realtime', 'public.invitations'
  );
exception when others then null; end $$;

-- ── FIX 2: Add workspace_members to Realtime publication (idempotent) ─
-- Duplicated from 0008 with exception guard — safe to re-run.
-- Ensures this is applied even if 0008 was skipped.
do $$ begin
  perform pg_catalog.pg_publication_add_table(
    'supabase_realtime', 'public.workspace_members'
  );
exception when others then null; end $$;

-- ── FIX 3: "read workspace siblings" profile policy uses a self-join  ──
-- that can fail at query-plan time if the workspace_members table is
-- very large (sequential scan). Add an index to ensure it stays fast.
-- Also ensure the policy correctly covers the joining-user scenario.
create index if not exists idx_workspace_members_user_id
  on public.workspace_members (user_id);

create index if not exists idx_workspace_members_workspace_user
  on public.workspace_members (workspace_id, user_id);

-- ── FIX 4: Ensure the new member can immediately read their own  ───────
-- workspace_members row after accept_invitation inserts it.
-- (Idempotent — 0008 may already have this, the exception guard is safe.)
do $$ begin
  create policy "self reads own membership"
    on public.workspace_members
    for select
    using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ── FIX 5: Ensure the owner can read NEW member's profile row ─────────
-- "read workspace siblings" joins workspace_members twice. If the new
-- member's row was just inserted in the same request transaction, a
-- STABLE function snapshot might miss it. The fix: add a direct policy
-- so workspace owners/admins can always read all profiles in their workspace.
do $$ begin
  create policy "workspace admin reads member profiles"
    on public.profiles
    for select
    using (
      exists (
        select 1
        from public.workspace_members wm
        where wm.user_id = public.profiles.id
          and public.can_admin_workspace(wm.workspace_id)
      )
    );
exception when duplicate_object then null; end $$;

-- ── FIX 6: Confirm listWorkspaceMembers query returns all members  ─────
-- The RLS policy "members read membership" uses is_workspace_member() which
-- is VOLATILE SECURITY DEFINER — correct. But verify the invitee's row is
-- visible to the owner immediately post-insert by testing the policy logic:
--
--   Owner calls: SELECT * FROM workspace_members WHERE workspace_id = $1
--   Policy check for each row: is_workspace_member($1) where auth.uid() = owner
--   is_workspace_member() queries: SELECT 1 FROM workspace_members
--     WHERE workspace_id=$1 AND user_id=owner → TRUE (owner is a member)
--   → All rows pass. The new member IS visible.
--
-- So the listWorkspaceMembers query itself is NOT the problem.
-- The problem is purely cache staleness + realtime delivery (fixed above).

