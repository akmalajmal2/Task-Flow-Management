-- 0006_rls.sql
-- Row-level security: the authoritative permission layer.
-- The UI should mirror these rules to avoid showing buttons that 403, but
-- security is enforced HERE — even a malicious caller hitting the REST API
-- directly cannot bypass these.

-- Enable RLS on every public table
alter table public.profiles          enable row level security;
alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;
alter table public.boards            enable row level security;
alter table public.board_members     enable row level security;
alter table public.starred_boards    enable row level security;
alter table public.board_columns     enable row level security;
alter table public.labels            enable row level security;
alter table public.tasks             enable row level security;
alter table public.task_assignees    enable row level security;
alter table public.task_labels       enable row level security;
alter table public.subtasks          enable row level security;
alter table public.bugs              enable row level security;
alter table public.comments          enable row level security;
alter table public.invitations       enable row level security;
alter table public.notifications     enable row level security;
alter table public.email_queue       enable row level security;
alter table public.app_settings      enable row level security;

-- =========================================================================
-- profiles
-- =========================================================================
create policy "read own profile" on public.profiles
  for select using (id = auth.uid());

-- Read profile rows of anyone who shares a workspace with you
create policy "read workspace siblings" on public.profiles
  for select using (
    exists (
      select 1 from public.workspace_members me
      join public.workspace_members other using (workspace_id)
      where me.user_id = auth.uid() and other.user_id = public.profiles.id
    )
  );

create policy "update own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- =========================================================================
-- workspaces
-- =========================================================================
create policy "owner reads own workspace" on public.workspaces
  for select using (owner_id = auth.uid());

create policy "members read workspaces" on public.workspaces
  for select using (public.is_workspace_member(id));

create policy "authenticated creates workspace" on public.workspaces
  for insert with check (owner_id = auth.uid());

create policy "owner/admin updates workspace" on public.workspaces
  for update using (public.can_admin_workspace(id));

create policy "owner deletes workspace" on public.workspaces
  for delete using (owner_id = auth.uid());

-- =========================================================================
-- workspace_members
-- =========================================================================
create policy "members read membership" on public.workspace_members
  for select using (public.is_workspace_member(workspace_id));

create policy "owner/admin manages membership" on public.workspace_members
  for all using (public.can_admin_workspace(workspace_id))
  with check (public.can_admin_workspace(workspace_id));

create policy "self leaves workspace" on public.workspace_members
  for delete using (user_id = auth.uid());

-- =========================================================================
-- boards
-- =========================================================================
create policy "view boards" on public.boards
  for select using (public.can_view_board(id));

create policy "workspace member creates board" on public.boards
  for insert with check (
    public.is_workspace_member(workspace_id)
    and (select role from public.workspace_members
         where workspace_id = boards.workspace_id and user_id = auth.uid())
        in ('owner','admin','member')
    and created_by = auth.uid()
  );

create policy "board admin updates board" on public.boards
  for update using (public.can_admin_board(id));

create policy "board admin deletes board" on public.boards
  for delete using (public.can_admin_board(id));

-- =========================================================================
-- board_members
-- =========================================================================
create policy "view board members" on public.board_members
  for select using (public.can_view_board(board_id));

create policy "board admin manages members" on public.board_members
  for all using (public.can_admin_board(board_id))
  with check (public.can_admin_board(board_id));

create policy "self leaves board" on public.board_members
  for delete using (user_id = auth.uid());

-- =========================================================================
-- starred_boards
-- =========================================================================
create policy "self manages stars" on public.starred_boards
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =========================================================================
-- columns / labels
-- =========================================================================
create policy "view columns" on public.board_columns
  for select using (public.can_view_board(board_id));
create policy "admin writes columns" on public.board_columns
  for all using (public.can_admin_board(board_id))
  with check (public.can_admin_board(board_id));

create policy "view labels" on public.labels
  for select using (public.can_view_board(board_id));
create policy "writer manages labels" on public.labels
  for all using (public.can_write_board(board_id))
  with check (public.can_write_board(board_id));

-- =========================================================================
-- tasks
-- =========================================================================
create policy "view tasks" on public.tasks
  for select using (public.can_view_board(board_id));

create policy "writer creates tasks" on public.tasks
  for insert with check (
    public.can_write_board(board_id) and created_by = auth.uid()
  );

-- Anyone with write can move/edit; only creator or board admin can delete.
create policy "writer updates tasks" on public.tasks
  for update using (public.can_write_board(board_id));

create policy "creator or admin deletes task" on public.tasks
  for delete using (
    created_by = auth.uid() or public.can_admin_board(board_id)
  );

-- =========================================================================
-- task_assignees / task_labels
-- =========================================================================
create policy "view assignees" on public.task_assignees
  for select using (
    exists (select 1 from public.tasks t
            where t.id = task_id and public.can_view_board(t.board_id))
  );
create policy "writer manages assignees" on public.task_assignees
  for all using (
    exists (select 1 from public.tasks t
            where t.id = task_id and public.can_write_board(t.board_id))
  ) with check (
    exists (select 1 from public.tasks t
            where t.id = task_id and public.can_write_board(t.board_id))
  );

create policy "view task_labels" on public.task_labels
  for select using (
    exists (select 1 from public.tasks t
            where t.id = task_id and public.can_view_board(t.board_id))
  );
create policy "writer manages task_labels" on public.task_labels
  for all using (
    exists (select 1 from public.tasks t
            where t.id = task_id and public.can_write_board(t.board_id))
  ) with check (
    exists (select 1 from public.tasks t
            where t.id = task_id and public.can_write_board(t.board_id))
  );

-- =========================================================================
-- subtasks
-- =========================================================================
create policy "view subtasks" on public.subtasks
  for select using (
    exists (select 1 from public.tasks t
            where t.id = task_id and public.can_view_board(t.board_id))
  );

create policy "writer creates subtasks" on public.subtasks
  for insert with check (
    exists (select 1 from public.tasks t
            where t.id = task_id and public.can_write_board(t.board_id))
    and created_by = auth.uid()
  );

create policy "writer updates subtasks" on public.subtasks
  for update using (
    exists (select 1 from public.tasks t
            where t.id = task_id and public.can_write_board(t.board_id))
  );

create policy "creator or admin deletes subtask" on public.subtasks
  for delete using (
    created_by = auth.uid()
    or exists (select 1 from public.tasks t
               where t.id = task_id and public.can_admin_board(t.board_id))
  );

-- =========================================================================
-- bugs
-- =========================================================================
create policy "view bugs" on public.bugs
  for select using (public.can_view_board(board_id));

create policy "writer creates bugs" on public.bugs
  for insert with check (
    public.can_write_board(board_id) and reporter_id = auth.uid()
  );

create policy "writer updates bugs" on public.bugs
  for update using (public.can_write_board(board_id));

create policy "reporter or admin deletes bug" on public.bugs
  for delete using (
    reporter_id = auth.uid() or public.can_admin_board(board_id)
  );

-- =========================================================================
-- comments
-- =========================================================================
create policy "view comments" on public.comments
  for select using (
    case parent_type
      when 'task' then exists (
        select 1 from public.tasks t
        where t.id = parent_id and public.can_view_board(t.board_id)
      )
      when 'subtask' then exists (
        select 1 from public.subtasks s
        join public.tasks t on t.id = s.task_id
        where s.id = parent_id and public.can_view_board(t.board_id)
      )
      when 'bug' then exists (
        select 1 from public.bugs b
        where b.id = parent_id and public.can_view_board(b.board_id)
      )
      else false
    end
  );

-- Anyone with view access can comment (this includes viewers).
create policy "viewer creates comments" on public.comments
  for insert with check (
    author_id = auth.uid() and (
      case parent_type
        when 'task' then exists (
          select 1 from public.tasks t
          where t.id = parent_id and public.can_view_board(t.board_id))
        when 'subtask' then exists (
          select 1 from public.subtasks s
          join public.tasks t on t.id = s.task_id
          where s.id = parent_id and public.can_view_board(t.board_id))
        when 'bug' then exists (
          select 1 from public.bugs b
          where b.id = parent_id and public.can_view_board(b.board_id))
        else false
      end
    )
  );

create policy "edit own comment" on public.comments
  for update using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "delete own comment" on public.comments
  for delete using (author_id = auth.uid());

-- =========================================================================
-- invitations
-- =========================================================================
create policy "inviter reads invitation" on public.invitations
  for select using (invited_by = auth.uid());

create policy "invitee reads own invitation" on public.invitations
  for select using (
    exists (select 1 from public.profiles
            where id = auth.uid() and lower(email) = lower(invitations.email))
  );

create policy "ws/board admin sends invitation" on public.invitations
  for insert with check (
    invited_by = auth.uid()
    and (
      (workspace_id is not null and public.can_admin_workspace(workspace_id))
      or (board_id is not null and public.can_admin_board(board_id))
    )
  );

create policy "invitee declines own invitation" on public.invitations
  for update using (
    exists (select 1 from public.profiles
            where id = auth.uid() and lower(email) = lower(invitations.email))
  ) with check (status in ('declined','accepted'));

create policy "inviter or admin revokes" on public.invitations
  for update using (
    invited_by = auth.uid()
    or (workspace_id is not null and public.can_admin_workspace(workspace_id))
    or (board_id is not null and public.can_admin_board(board_id))
  );

create policy "inviter or admin deletes invitation" on public.invitations
  for delete using (
    invited_by = auth.uid()
    or (workspace_id is not null and public.can_admin_workspace(workspace_id))
    or (board_id is not null and public.can_admin_board(board_id))
  );

-- =========================================================================
-- notifications
-- =========================================================================
create policy "read own notifications" on public.notifications
  for select using (user_id = auth.uid());
create policy "update own notifications" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own notifications" on public.notifications
  for delete using (user_id = auth.uid());

-- =========================================================================
-- email_queue + app_settings — read-only to clients (server-only writes)
-- =========================================================================
-- (No policies → all access denied for the anon role; only service-role can touch.)

-- =========================================================================
-- Realtime publications
-- =========================================================================
do $$ begin
  perform pg_catalog.pg_publication_add_table('supabase_realtime', 'public.tasks');
exception when others then null; end $$;

do $$ begin
  perform pg_catalog.pg_publication_add_table('supabase_realtime', 'public.board_columns');
exception when others then null; end $$;

do $$ begin
  perform pg_catalog.pg_publication_add_table('supabase_realtime', 'public.subtasks');
exception when others then null; end $$;

do $$ begin
  perform pg_catalog.pg_publication_add_table('supabase_realtime', 'public.comments');
exception when others then null; end $$;

do $$ begin
  perform pg_catalog.pg_publication_add_table('supabase_realtime', 'public.notifications');
exception when others then null; end $$;
