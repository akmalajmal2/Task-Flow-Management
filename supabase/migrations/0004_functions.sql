-- 0004_functions.sql
-- Helper functions used by RLS policies + business-logic triggers + RPCs.
--
-- All RLS helpers are SECURITY DEFINER + VOLATILE on purpose:
--   - DEFINER: they read tables the caller may not have direct SELECT on
--     (e.g., workspace_members from inside a board policy). Without it the
--     helper returns false and RLS denies access incorrectly.
--   - VOLATILE: forces Postgres to re-run on each call. Marking them STABLE
--     causes snapshot caching that can miss rows just inserted by an
--     earlier trigger in the same transaction (e.g., the workspace creator
--     being added by add_owner_as_member is invisible to the post-insert
--     SELECT check).

-- =========================================================================
-- Auth helpers — used inside RLS USING / WITH CHECK clauses
-- =========================================================================

create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql volatile security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid()
  );
$$;

create or replace function public.my_workspace_role(ws uuid)
returns public.workspace_role
language sql volatile security definer
set search_path = public
as $$
  select role from public.workspace_members
  where workspace_id = ws and user_id = auth.uid();
$$;

create or replace function public.can_admin_workspace(ws uuid)
returns boolean
language sql volatile security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('owner','admin')
     from public.workspace_members
     where workspace_id = ws and user_id = auth.uid()),
    false
  );
$$;

-- can_view_board: public board → any workspace member; private → board_member
create or replace function public.can_view_board(b uuid)
returns boolean
language sql volatile security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.boards bd
    where bd.id = b
      and (
        -- public board: any workspace member can view
        (bd.visibility = 'public' and public.is_workspace_member(bd.workspace_id))
        or
        -- private board: explicit board_member row required
        exists (
          select 1 from public.board_members bm
          where bm.board_id = b and bm.user_id = auth.uid()
        )
      )
  );
$$;

-- can_edit_board: workspace admin/owner OR board_member with admin role
create or replace function public.can_admin_board(b uuid)
returns boolean
language sql volatile security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.boards bd
    where bd.id = b
      and (
        public.can_admin_workspace(bd.workspace_id)
        or exists (
          select 1 from public.board_members bm
          where bm.board_id = b and bm.user_id = auth.uid() and bm.role = 'admin'
        )
      )
  );
$$;

-- can_write_board: anything except read-only (i.e., not a viewer)
-- A viewer is a workspace_member with role 'viewer' AND not in board_members.
create or replace function public.can_write_board(b uuid)
returns boolean
language sql volatile security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.boards bd
    where bd.id = b
      and public.can_view_board(b)
      and (
        -- explicit board_member (any role) → can write
        exists (
          select 1 from public.board_members bm
          where bm.board_id = b and bm.user_id = auth.uid()
        )
        or
        -- public board: workspace owner/admin/member can write; viewer cannot
        (bd.visibility = 'public'
         and (select role from public.workspace_members
              where workspace_id = bd.workspace_id and user_id = auth.uid())
             in ('owner','admin','member'))
      )
  );
$$;

-- =========================================================================
-- handle_new_user — auto-create profile when auth.users row appears
-- =========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- =========================================================================
-- add_owner_as_member — when a workspace is created, owner is auto-added
-- =========================================================================
create or replace function public.add_owner_as_member()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (workspace_id, user_id) do nothing;
  return new;
end;
$$;

-- =========================================================================
-- create_board_defaults — when a board is created, add 4 columns + creator
-- =========================================================================
create or replace function public.create_board_defaults()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.board_columns (board_id, name, position, color) values
    (new.id, 'Backlog',     1024, '#94a3b8'),
    (new.id, 'In Progress', 2048, '#2563eb'),
    (new.id, 'In Review',   3072, '#9333ea'),
    (new.id, 'Done',        4096, '#16a34a');

  -- Creator is auto-added as board admin
  insert into public.board_members (board_id, user_id, role)
  values (new.id, new.created_by, 'admin')
  on conflict (board_id, user_id) do update set role = 'admin';

  return new;
end;
$$;

-- =========================================================================
-- assign_task_seq — auto-fill seq_number per board
-- =========================================================================
create or replace function public.assign_task_seq()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  next_seq integer;
begin
  if new.seq_number is not null then return new; end if;
  select coalesce(max(seq_number), 0) + 1 into next_seq
  from public.tasks where board_id = new.board_id;
  new.seq_number := next_seq;
  return new;
end;
$$;

create or replace function public.assign_bug_seq()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  next_seq integer;
begin
  if new.seq_number is not null then return new; end if;
  select coalesce(max(seq_number), 0) + 1 into next_seq
  from public.bugs where board_id = new.board_id;
  new.seq_number := next_seq;
  return new;
end;
$$;

-- =========================================================================
-- on_subtask_status_change — fan out review notifications + completed_at
-- =========================================================================
create or replace function public.on_subtask_status_change()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  parent_task record;
  author_name text;
  app_url text;
begin
  if new.status = old.status then return new; end if;

  select t.id as task_id, t.title as task_title, t.board_id,
         b.name as board_name, b.workspace_id
    into parent_task
  from public.tasks t
  join public.boards b on b.id = t.board_id
  where t.id = new.task_id;

  select coalesce(value, 'http://localhost:3000') into app_url
  from public.app_settings where key = 'app_url';
  app_url := coalesce(app_url, 'http://localhost:3000');

  if new.status = 'in_review' then
    select full_name into author_name from public.profiles
    where id = coalesce(new.assignee_id, new.created_by);

    insert into public.notifications (user_id, type, title, body, link, data)
    select
      bm.user_id,
      'subtask_review_requested',
      'Subtask ready for review',
      coalesce(author_name, 'A member') || ' moved "' || new.title || '" to In Review',
      '/workspaces/' || parent_task.workspace_id ||
        '/boards/' || parent_task.board_id ||
        '?task=' || parent_task.task_id,
      jsonb_build_object('subtask_id', new.id, 'task_id', new.task_id)
    from public.board_members bm
    where bm.board_id = parent_task.board_id and bm.role = 'admin';
  end if;

  if new.status in ('done','rejected') and new.assignee_id is not null then
    insert into public.notifications (user_id, type, title, body, link, data)
    values (
      new.assignee_id,
      case when new.status = 'done' then 'subtask_approved' else 'subtask_rejected' end,
      case when new.status = 'done' then 'Your subtask was approved' else 'Your subtask was rejected' end,
      coalesce(new.review_note, new.title),
      '/workspaces/' || parent_task.workspace_id ||
        '/boards/' || parent_task.board_id ||
        '?task=' || parent_task.task_id,
      jsonb_build_object('subtask_id', new.id)
    );
  end if;

  if new.status = 'done' and old.completed_at is null then
    new.completed_at := now();
  end if;

  return new;
end;
$$;

-- =========================================================================
-- on_comment_insert — notify mentioned users
-- =========================================================================
create or replace function public.on_comment_insert()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  mentioned_id text;
  author_name text;
  workspace_id uuid;
  board_id uuid;
  link text;
begin
  select full_name into author_name from public.profiles where id = new.author_id;

  -- Resolve link based on parent type
  if new.parent_type = 'task' then
    select t.board_id, b.workspace_id into board_id, workspace_id
    from public.tasks t join public.boards b on b.id = t.board_id
    where t.id = new.parent_id;
    link := '/workspaces/' || workspace_id || '/boards/' || board_id ||
            '?task=' || new.parent_id;
  elsif new.parent_type = 'subtask' then
    select t.board_id, b.workspace_id into board_id, workspace_id
    from public.subtasks s
    join public.tasks t on t.id = s.task_id
    join public.boards b on b.id = t.board_id
    where s.id = new.parent_id;
    link := '/workspaces/' || workspace_id || '/boards/' || board_id;
  elsif new.parent_type = 'bug' then
    select bg.board_id, b.workspace_id into board_id, workspace_id
    from public.bugs bg join public.boards b on b.id = bg.board_id
    where bg.id = new.parent_id;
    link := '/workspaces/' || workspace_id || '/boards/' || board_id || '/bugs';
  end if;

  -- Iterate over mention IDs in body_json
  for mentioned_id in
    select distinct (m->>'id')::text
    from jsonb_path_query(new.body_json, '$.**.attrs ? (@.id != null)') as m
  loop
    if mentioned_id::uuid = new.author_id then continue; end if;
    insert into public.notifications (user_id, type, title, body, link, data)
    values (
      mentioned_id::uuid,
      'task_mentioned',
      coalesce(author_name, 'Someone') || ' mentioned you',
      left(regexp_replace(new.body, '<[^>]+>', '', 'g'), 200),
      link,
      jsonb_build_object('comment_id', new.id, 'parent_type', new.parent_type)
    );
  end loop;

  return new;
end;
$$;

-- =========================================================================
-- on_bug_assignment — notify assignee
-- =========================================================================
create or replace function public.on_bug_change()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  reporter_name text;
  workspace_id uuid;
begin
  if tg_op = 'UPDATE' and new.assignee_id is not distinct from old.assignee_id then
    return new;
  end if;
  if new.assignee_id is null then return new; end if;

  select b.workspace_id into workspace_id from public.boards b where b.id = new.board_id;
  select full_name into reporter_name from public.profiles where id = new.reporter_id;

  insert into public.notifications (user_id, type, title, body, link, data)
  values (
    new.assignee_id,
    'bug_assigned',
    'Bug assigned: ' || new.title,
    coalesce(reporter_name, 'Someone') || ' assigned you a ' || new.severity || ' bug',
    '/workspaces/' || workspace_id || '/boards/' || new.board_id || '/bugs',
    jsonb_build_object('bug_id', new.id)
  );
  return new;
end;
$$;

-- =========================================================================
-- accept_invitation RPC — caller redeems an invite by token
-- =========================================================================
create or replace function public.accept_invitation(p_token text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  inv public.invitations;
  my_email text;
  target_workspace_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select email into my_email from public.profiles where id = auth.uid();

  select * into inv from public.invitations
  where token = p_token and status = 'pending' and expires_at > now()
  for update;

  if not found then
    raise exception 'invalid or expired invitation' using errcode = 'P0002';
  end if;

  if lower(inv.email) <> lower(my_email) then
    raise exception 'email mismatch' using errcode = 'P0003';
  end if;

  -- Workspace invitation
  if inv.workspace_id is not null then
    insert into public.workspace_members (workspace_id, user_id, role)
    values (inv.workspace_id, auth.uid(), inv.role)
    on conflict (workspace_id, user_id) do nothing;
    target_workspace_id := inv.workspace_id;
  end if;

  -- Board invitation
  if inv.board_id is not null then
    select workspace_id into target_workspace_id
    from public.boards where id = inv.board_id;

    -- Auto-join workspace as 'member' so the user can navigate
    insert into public.workspace_members (workspace_id, user_id, role)
    values (target_workspace_id, auth.uid(), 'member')
    on conflict (workspace_id, user_id) do nothing;

    insert into public.board_members (board_id, user_id, role)
    values (inv.board_id, auth.uid(),
            case when inv.role = 'admin' then 'admin'::public.board_role
                 else 'member'::public.board_role end)
    on conflict (board_id, user_id) do nothing;
  end if;

  update public.invitations
     set status = 'accepted', accepted_at = now()
   where id = inv.id;

  insert into public.notifications (user_id, type, title, link)
  values (
    inv.invited_by,
    'invitation_accepted',
    my_email || ' accepted your invitation',
    '/workspaces/' || target_workspace_id
  );

  return jsonb_build_object(
    'workspace_id', target_workspace_id,
    'board_id', inv.board_id
  );
end;
$$;

-- =========================================================================
-- mark_all_notifications_read RPC
-- =========================================================================
create or replace function public.mark_all_notifications_read()
returns void language sql security definer set search_path = public as $$
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null;
$$;

-- =========================================================================
-- app_settings — single-row config consumed by triggers
-- =========================================================================
create table if not exists public.app_settings (
  key text primary key,
  value text
);
insert into public.app_settings (key, value) values ('app_url', 'http://localhost:3000')
  on conflict (key) do nothing;
