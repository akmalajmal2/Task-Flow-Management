-- 0002_enums.sql
-- Strongly-typed status fields. Easier to reason about than free-form text
-- and gets automatic check-constraint enforcement.

do $$ begin
  create type public.workspace_role as enum ('owner','admin','member','viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.board_role as enum ('admin','member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.visibility as enum ('public','private');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_priority as enum ('low','medium','high','critical');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.subtask_status as enum ('todo','in_progress','in_review','done','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.bug_severity as enum ('trivial','minor','major','critical','blocker');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.bug_status as enum ('open','assigned','fixing','fixed','reopened','closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.invitation_status as enum ('pending','accepted','declined','revoked','expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_type as enum (
    'task_assigned', 'task_moved', 'task_commented', 'task_mentioned',
    'subtask_review_requested', 'subtask_approved', 'subtask_rejected',
    'bug_assigned', 'invitation_received', 'invitation_accepted',
    'board_member_added'
  );
exception when duplicate_object then null; end $$;
