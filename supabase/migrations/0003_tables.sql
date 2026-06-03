-- 0003_tables.sql
-- All application tables. Foreign keys cascade so deleting a workspace
-- cleanly removes everything underneath it.

-- =========================================================================
-- profiles — mirrors auth.users with extra app-only columns
-- =========================================================================
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  full_name     text,
  avatar_url    text,
  is_developer  boolean not null default false,
  is_qa         boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists profiles_email_idx on public.profiles (lower(email));

-- =========================================================================
-- workspaces
-- =========================================================================
create table if not exists public.workspaces (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(name) between 2 and 80),
  description  text,
  owner_id     uuid not null references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists workspaces_owner_idx on public.workspaces (owner_id);

-- =========================================================================
-- workspace_members — workspace-level role
-- =========================================================================
create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references public.profiles(id)   on delete cascade,
  role         public.workspace_role not null default 'member',
  joined_at    timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists workspace_members_user_idx on public.workspace_members (user_id);

-- =========================================================================
-- boards — kanban surface; lives in a workspace
-- =========================================================================
create table if not exists public.boards (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name         text not null check (length(name) between 1 and 80),
  description  text,
  color        text not null default '#2563eb',
  visibility   public.visibility not null default 'private',
  created_by   uuid not null references public.profiles(id),
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists boards_ws_idx on public.boards (workspace_id) where archived_at is null;

-- =========================================================================
-- board_members — explicit board membership (only meaningful for private)
-- =========================================================================
create table if not exists public.board_members (
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  role     public.board_role not null default 'member',
  added_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

create index if not exists board_members_user_idx on public.board_members (user_id);

-- =========================================================================
-- starred_boards — per-user pinned boards in sidebar
-- =========================================================================
create table if not exists public.starred_boards (
  user_id  uuid not null references public.profiles(id) on delete cascade,
  board_id uuid not null references public.boards(id) on delete cascade,
  starred_at timestamptz not null default now(),
  primary key (user_id, board_id)
);

-- =========================================================================
-- columns — kanban columns; ordered by `position`
-- =========================================================================
create table if not exists public.board_columns (
  id        uuid primary key default gen_random_uuid(),
  board_id  uuid not null references public.boards(id) on delete cascade,
  name      text not null check (length(name) between 1 and 40),
  position  numeric not null,
  color     text,
  wip_limit integer check (wip_limit > 0)
);

create index if not exists board_columns_board_idx on public.board_columns (board_id, position);

-- =========================================================================
-- labels — per-board taxonomy
-- =========================================================================
create table if not exists public.labels (
  id       uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  name     text not null check (length(name) between 1 and 30),
  color    text not null default '#94a3b8',
  unique (board_id, lower(name))
);

-- =========================================================================
-- tasks — board-scoped sequence number per board (e.g. "MOB-1")
-- =========================================================================
create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  board_id     uuid not null references public.boards(id) on delete cascade,
  column_id    uuid not null references public.board_columns(id) on delete restrict,
  seq_number   integer not null,
  title        text not null check (length(title) between 1 and 200),
  description  text,
  position     numeric not null,
  priority     public.task_priority not null default 'medium',
  due_date     date,
  weight_stars smallint not null default 0 check (weight_stars between 0 and 5),
  created_by   uuid not null references public.profiles(id),
  archived_at  timestamptz,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (board_id, seq_number)
);

create index if not exists tasks_board_col_idx on public.tasks (board_id, column_id, position) where archived_at is null;
create index if not exists tasks_due_idx on public.tasks (due_date) where due_date is not null and completed_at is null;

-- =========================================================================
-- task_assignees — many-to-many; a task can have multiple assignees
-- =========================================================================
create table if not exists public.task_assignees (
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (task_id, user_id)
);

create index if not exists task_assignees_user_idx on public.task_assignees (user_id);

-- =========================================================================
-- task_labels — many-to-many
-- =========================================================================
create table if not exists public.task_labels (
  task_id  uuid not null references public.tasks(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  primary key (task_id, label_id)
);

-- =========================================================================
-- subtasks — checklist items with optional review workflow
-- =========================================================================
create table if not exists public.subtasks (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.tasks(id) on delete cascade,
  title        text not null check (length(title) between 1 and 200),
  status       public.subtask_status not null default 'todo',
  position     numeric not null default 1024,
  assignee_id  uuid references public.profiles(id),
  created_by   uuid not null references public.profiles(id),
  review_note  text,
  reviewed_by  uuid references public.profiles(id),
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists subtasks_task_idx on public.subtasks (task_id, position);

-- =========================================================================
-- bugs — separate entity from tasks (different fields, different workflow)
-- =========================================================================
create table if not exists public.bugs (
  id              uuid primary key default gen_random_uuid(),
  board_id        uuid not null references public.boards(id) on delete cascade,
  seq_number      integer not null,
  title           text not null check (length(title) between 1 and 200),
  description     text,
  steps_to_repro  text,
  expected        text,
  actual          text,
  severity        public.bug_severity not null default 'minor',
  status          public.bug_status   not null default 'open',
  reporter_id     uuid not null references public.profiles(id),
  assignee_id     uuid references public.profiles(id),
  weight_stars    smallint not null default 0 check (weight_stars between 0 and 5),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (board_id, seq_number)
);

create index if not exists bugs_board_status_idx on public.bugs (board_id, status);

-- =========================================================================
-- comments — polymorphic on parent_type
-- =========================================================================
create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  parent_type text not null check (parent_type in ('task','subtask','bug')),
  parent_id   uuid not null,
  body        text not null,                      -- HTML rendered from Tiptap
  body_json   jsonb not null,                     -- Tiptap doc for re-edit
  author_id   uuid not null references public.profiles(id),
  edited_at   timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists comments_parent_idx on public.comments (parent_type, parent_id, created_at desc);

-- =========================================================================
-- invitations — email + token; either workspace- or board-scoped
-- =========================================================================
create table if not exists public.invitations (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  board_id     uuid references public.boards(id) on delete cascade,
  email        text not null,
  role         public.workspace_role not null default 'member',
  token        text not null unique default encode(gen_random_bytes(24), 'hex'),
  status       public.invitation_status not null default 'pending',
  invited_by   uuid not null references public.profiles(id),
  expires_at   timestamptz not null default (now() + interval '14 days'),
  accepted_at  timestamptz,
  created_at   timestamptz not null default now(),
  check (workspace_id is not null or board_id is not null),
  unique (workspace_id, board_id, lower(email), status)
);

create index if not exists invitations_email_idx on public.invitations (lower(email)) where status = 'pending';

-- =========================================================================
-- notifications — per-user inbox; UI subscribes via Realtime
-- =========================================================================
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       public.notification_type not null,
  title      text not null,
  body       text,
  link       text,
  data       jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;

-- =========================================================================
-- email_queue — outbound email job queue (consumed by edge function)
-- =========================================================================
create table if not exists public.email_queue (
  id         uuid primary key default gen_random_uuid(),
  template   text not null,
  recipient  text not null,
  payload    jsonb not null default '{}'::jsonb,
  attempts   integer not null default 0,
  last_error text,
  sent_at    timestamptz,
  failed_at  timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists email_queue_pending_idx on public.email_queue (created_at) where sent_at is null and failed_at is null;

-- =========================================================================
-- updated_at triggers (using moddatetime extension)
-- =========================================================================
create trigger set_profiles_updated_at   before update on public.profiles
  for each row execute function moddatetime(updated_at);
create trigger set_workspaces_updated_at before update on public.workspaces
  for each row execute function moddatetime(updated_at);
create trigger set_boards_updated_at     before update on public.boards
  for each row execute function moddatetime(updated_at);
create trigger set_tasks_updated_at      before update on public.tasks
  for each row execute function moddatetime(updated_at);
create trigger set_subtasks_updated_at   before update on public.subtasks
  for each row execute function moddatetime(updated_at);
create trigger set_bugs_updated_at       before update on public.bugs
  for each row execute function moddatetime(updated_at);
