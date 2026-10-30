-- =====================================================================
-- Tasklane — Supabase schema
-- Run once in the Supabase SQL editor on a fresh project.
--
-- Design rules
--  * Tables are READ-ONLY for the browser (RLS select policies only).
--  * Every write goes through a SECURITY DEFINER function that checks the
--    caller's role and the workflow rules, locks the row, and writes the
--    audit trail + notifications in the same transaction.
--  * The first account that signs up becomes the workspace admin.
-- =====================================================================

create extension if not exists pgcrypto;

create type public.project_role  as enum ('manager', 'developer', 'tester');
create type public.task_status   as enum ('proposed', 'declined', 'todo', 'in_progress', 'in_review', 'testing', 'done');
create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.invite_status as enum ('pending', 'accepted', 'declined', 'revoked');

-- ---------------------------------------------------------------- tables
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text not null default '',
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);
create unique index profiles_email_key on public.profiles (lower(email));

create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique check (key ~ '^[A-Z][A-Z0-9]{1,5}$'),
  name        text not null check (char_length(name) between 2 and 80),
  description text not null default '',
  task_seq    integer not null default 0,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.project_members (
  project_id  uuid not null references public.projects (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        public.project_role not null,
  joined_at   timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index project_members_user_idx on public.project_members (user_id);

create table public.project_invites (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  email        text not null,
  role         public.project_role not null,
  token        uuid not null unique default gen_random_uuid(),
  status       public.invite_status not null default 'pending',
  invited_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '7 days',
  responded_at timestamptz
);
create unique index one_pending_invite
  on public.project_invites (project_id, lower(email)) where status = 'pending';

create table public.tasks (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references public.projects (id) on delete cascade,
  number               integer not null,
  title                text not null check (char_length(title) between 3 and 160),
  description          text not null default '',
  priority             public.task_priority not null default 'medium',
  position             double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  status               public.task_status not null default 'todo',  -- non-managers' tasks start as 'proposed'
  requires_testing     boolean not null,
  estimate_hours       numeric(6,1) check (estimate_hours is null or (estimate_hours > 0 and estimate_hours <= 999)),
  due_at               timestamptz not null,
  assignee_id          uuid references public.profiles (id) on delete set null,
  reporter_id          uuid references public.profiles (id) on delete set null,
  updated_by           uuid references public.profiles (id) on delete set null,
  started_at           timestamptz,
  review_requested_at  timestamptz,
  completed_at         timestamptz,
  last_decision_note   text,
  overdue_notified_at  timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (project_id, number)
);
create index tasks_project_status_idx on public.tasks (project_id, status);
create index tasks_assignee_idx on public.tasks (assignee_id);

create table public.task_events (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks (id) on delete cascade,
  project_id  uuid not null references public.projects (id) on delete cascade,
  actor_id    uuid references public.profiles (id) on delete set null,
  kind        text not null,
  from_status public.task_status,
  to_status   public.task_status,
  note        text,
  created_at  timestamptz not null default now()
);
create index task_events_task_idx on public.task_events (task_id, created_at);

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  project_id  uuid references public.projects (id) on delete cascade,
  task_id     uuid references public.tasks (id) on delete cascade,
  kind        text not null,
  title       text not null,
  body        text not null default '',
  link        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ------------------------------------------------- new user → profile
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, is_admin)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    not exists (select 1 from public.profiles)
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- ------------------------------------------------------- access helpers
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.member_role(p uuid)
returns public.project_role language sql stable security definer set search_path = public as $$
  select role from public.project_members where project_id = p and user_id = auth.uid()
$$;

create or replace function public.can_view(p uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.member_role(p) is not null
$$;

create or replace function public.can_manage(p uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.member_role(p) = 'manager'
$$;

-- Internal: store an in-app notification and return the e-mail payload.
create or replace function public._notify(
  p_user uuid, p_project uuid, p_task uuid, p_kind text, p_title text, p_body text, p_link text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare pr public.profiles;
begin
  select * into pr from public.profiles where id = p_user;
  if not found then return '[]'::jsonb; end if;
  insert into public.notifications (user_id, project_id, task_id, kind, title, body, link)
  values (p_user, p_project, p_task, p_kind, p_title, p_body, p_link);
  return jsonb_build_object('email', pr.email, 'name', pr.full_name,
                            'title', p_title, 'body', p_body, 'link', p_link);
end $$;

-- ------------------------------------------------------------- RLS
alter table public.profiles        enable row level security;
alter table public.projects        enable row level security;
alter table public.project_members enable row level security;
alter table public.project_invites enable row level security;
alter table public.tasks           enable row level security;
alter table public.task_events     enable row level security;
alter table public.notifications   enable row level security;

create policy profiles_read on public.profiles for select to authenticated using (
  id = auth.uid() or public.is_admin() or exists (
    select 1 from public.project_members a
    join public.project_members b on a.project_id = b.project_id
    where a.user_id = auth.uid() and b.user_id = profiles.id)
);
create policy projects_read on public.projects        for select to authenticated using (public.can_view(id));
create policy members_read  on public.project_members for select to authenticated using (public.can_view(project_id));
create policy invites_read  on public.project_invites for select to authenticated using (public.can_manage(project_id));
create policy tasks_read    on public.tasks           for select to authenticated using (public.can_view(project_id));
create policy events_read   on public.task_events     for select to authenticated using (public.can_view(project_id));
create policy notices_read  on public.notifications   for select to authenticated using (user_id = auth.uid());
create policy notices_mark  on public.notifications   for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Browser roles can only read, plus flip notifications.read_at.
revoke all on public.profiles, public.projects, public.project_members, public.project_invites,
              public.tasks, public.task_events, public.notifications from anon;
revoke insert, update, delete on public.profiles, public.projects, public.project_members,
              public.project_invites, public.tasks, public.task_events, public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ------------------------------------------------------- projects
create or replace function public.create_project(p_key text, p_name text, p_description text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pr public.projects;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if char_length(btrim(coalesce(p_name, ''))) < 2 then raise exception 'Give the project a name'; end if;
  if upper(btrim(coalesce(p_key, ''))) !~ '^[A-Z][A-Z0-9]{1,5}$' then
    raise exception 'The key must be 2 to 6 letters or digits and start with a letter';
  end if;
  insert into public.projects (key, name, description, created_by)
  values (upper(btrim(p_key)), btrim(p_name), coalesce(p_description, ''), auth.uid())
  returning * into pr;
  insert into public.project_members (project_id, user_id, role) values (pr.id, auth.uid(), 'manager');
  return to_jsonb(pr);
exception when unique_violation then
  raise exception 'A project with the key % already exists', upper(btrim(p_key));
end $$;

create or replace function public.set_admin(p_user uuid, p_admin boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only admins can change admin access'; end if;
  if not p_admin and (select count(*) from public.profiles where is_admin and id <> p_user) = 0 then
    raise exception 'The workspace needs at least one admin';
  end if;
  update public.profiles set is_admin = p_admin where id = p_user;
end $$;

-- ------------------------------------------------------- invitations
create or replace function public.create_invite(p_project uuid, p_email text, p_role public.project_role)
returns jsonb language plpgsql security definer set search_path = public as $$
declare i public.project_invites; pr public.projects; me public.profiles; em text := lower(btrim(p_email));
begin
  if not public.can_manage(p_project) then raise exception 'Only managers can invite people'; end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid e-mail address'; end if;
  if exists (select 1 from public.project_members m join public.profiles p on p.id = m.user_id
             where m.project_id = p_project and lower(p.email) = em) then
    raise exception '% is already a member of this project', em;
  end if;
  -- Re-inviting replaces any pending invite (this is how "resend" works).
  update public.project_invites set status = 'revoked', responded_at = now()
   where project_id = p_project and lower(email) = em and status = 'pending';
  insert into public.project_invites (project_id, email, role, invited_by)
  values (p_project, em, p_role, auth.uid()) returning * into i;
  select * into pr from public.projects where id = p_project;
  select * into me from public.profiles where id = auth.uid();
  return jsonb_build_object('token', i.token, 'email', i.email, 'role', i.role,
                            'project_name', pr.name, 'inviter_name', me.full_name);
end $$;

create or replace function public.revoke_invite(p_invite uuid)
returns void language plpgsql security definer set search_path = public as $$
declare i public.project_invites;
begin
  select * into i from public.project_invites where id = p_invite;
  if not found then raise exception 'Invite not found'; end if;
  if not public.can_manage(i.project_id) then raise exception 'Only managers can cancel invites'; end if;
  update public.project_invites set status = 'revoked', responded_at = now()
   where id = p_invite and status = 'pending';
end $$;

-- Invites addressed to the signed-in user's e-mail.
create or replace function public.my_invites()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'token', i.token, 'role', i.role, 'project_name', p.name, 'project_key', p.key,
    'inviter_name', inv.full_name, 'created_at', i.created_at) order by i.created_at desc), '[]'::jsonb)
  from public.project_invites i
  join public.projects p on p.id = i.project_id
  left join public.profiles inv on inv.id = i.invited_by
  where i.status = 'pending' and i.expires_at > now()
    and lower(i.email) = lower((select email from public.profiles where id = auth.uid()))
$$;

create or replace function public.get_invite(p_token uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare i public.project_invites; pr public.projects; inv public.profiles;
begin
  select * into i from public.project_invites where token = p_token;
  if not found then return null; end if;
  select * into pr  from public.projects where id = i.project_id;
  select * into inv from public.profiles where id = i.invited_by;
  return jsonb_build_object('email', i.email, 'role', i.role, 'status', i.status,
    'expired', i.expires_at < now(), 'project_id', pr.id, 'project_name', pr.name,
    'project_key', pr.key, 'inviter_name', inv.full_name);
end $$;

create or replace function public.accept_invite(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare i public.project_invites; me public.profiles; pr public.projects; out jsonb := '[]'::jsonb;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then raise exception 'Not signed in'; end if;
  select * into i from public.project_invites where token = p_token for update;
  if not found then raise exception 'This invite link is not valid'; end if;
  if lower(i.email) <> lower(me.email) then
    raise exception 'This invite was sent to %. Sign in with that address to accept it.', i.email;
  end if;
  if i.status = 'accepted' then
    return jsonb_build_object('project_id', i.project_id, 'notified', '[]'::jsonb);
  end if;
  if i.status <> 'pending' then raise exception 'This invite is no longer valid'; end if;
  if i.expires_at < now() then raise exception 'This invite has expired. Ask a manager to send a new one.'; end if;

  insert into public.project_members (project_id, user_id, role)
  values (i.project_id, me.id, i.role) on conflict (project_id, user_id) do nothing;
  update public.project_invites set status = 'accepted', responded_at = now() where id = i.id;

  select * into pr from public.projects where id = i.project_id;
  if i.invited_by is not null and i.invited_by <> me.id then
    out := out || public._notify(i.invited_by, pr.id, null, 'invite_accepted',
             me.full_name || ' joined ' || pr.name, 'Joined as ' || i.role, '/projects/' || pr.id || '/members');
  end if;
  return jsonb_build_object('project_id', pr.id, 'notified', out);
end $$;

create or replace function public.decline_invite(p_token uuid)
returns void language plpgsql security definer set search_path = public as $$
declare i public.project_invites; me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  select * into i from public.project_invites where token = p_token for update;
  if not found or lower(i.email) <> lower(me.email) then raise exception 'This invite is not addressed to you'; end if;
  update public.project_invites set status = 'declined', responded_at = now()
   where id = i.id and status = 'pending';
end $$;

-- ------------------------------------------------------- members
create or replace function public.set_member_role(p_project uuid, p_user uuid, p_role public.project_role)
returns void language plpgsql security definer set search_path = public as $$
declare cur public.project_role;
begin
  if not public.can_manage(p_project) then raise exception 'Only managers can change roles'; end if;
  select role into cur from public.project_members where project_id = p_project and user_id = p_user for update;
  if not found then raise exception 'That person is not a member'; end if;
  if cur = 'manager' and p_role <> 'manager' and not exists (
       select 1 from public.project_members where project_id = p_project and role = 'manager' and user_id <> p_user) then
    raise exception 'A project needs at least one manager';
  end if;
  update public.project_members set role = p_role where project_id = p_project and user_id = p_user;
end $$;

create or replace function public.remove_member(p_project uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare cur public.project_role;
begin
  if not (public.can_manage(p_project) or p_user = auth.uid()) then
    raise exception 'Only managers can remove people';
  end if;
  select role into cur from public.project_members where project_id = p_project and user_id = p_user for update;
  if not found then raise exception 'That person is not a member'; end if;
  if cur = 'manager' and not exists (
       select 1 from public.project_members where project_id = p_project and role = 'manager' and user_id <> p_user) then
    raise exception 'A project needs at least one manager';
  end if;
  -- Hand their open work back to the board instead of orphaning it mid-flight.
  update public.tasks
     set assignee_id = null,
         status = case when status = 'in_progress' then 'todo' else status end,
         updated_by = auth.uid(), updated_at = now()
   where project_id = p_project and assignee_id = p_user and status <> 'done';
  delete from public.project_members where project_id = p_project and user_id = p_user;
end $$;

-- ------------------------------------------------------- tasks
--
-- Intake rule
--   Managers (and workspace admins) create tasks straight into "To do".
--   Everyone else *proposes* a task: it lands in "Proposed" and nobody can start
--   it until a manager approves it (editing due date / estimate / priority /
--   assignee on the way). A manager can also decline it with a reason; the
--   proposer can then revise and resubmit, or withdraw it.
create or replace function public.create_task(
  p_project uuid, p_title text, p_description text, p_priority public.task_priority,
  p_requires_testing boolean, p_estimate numeric, p_due timestamptz, p_assignee uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid(); mgr boolean := public.can_manage(p_project);
  proj public.projects; t public.tasks; out jsonb := '[]'::jsonb; st public.task_status; actor text; u record;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if not public.can_view(p_project) then raise exception 'You are not a member of this project'; end if;
  if p_requires_testing is null then raise exception 'Say whether this task needs testing'; end if;
  if p_estimate is not null and (p_estimate <= 0 or p_estimate > 999) then
    raise exception 'Estimate must be between 0.5 and 999 hours (or leave it empty)';
  end if;
  if p_due is null or p_due <= now() then raise exception 'Pick a due date in the future'; end if;
  if p_assignee is not null then
    if not exists (select 1 from public.project_members where project_id = p_project and user_id = p_assignee) then
      raise exception 'The assignee must be a project member';
    end if;
    if not mgr and p_assignee <> me then
      raise exception 'Only managers can assign work to other people. Leave it unassigned and a manager will decide.';
    end if;
  end if;

  st := case when mgr then 'todo'::public.task_status else 'proposed'::public.task_status end;
  update public.projects set task_seq = task_seq + 1 where id = p_project returning * into proj;
  insert into public.tasks (project_id, number, title, description, priority, status, requires_testing,
                            estimate_hours, due_at, assignee_id, reporter_id, updated_by)
  values (p_project, proj.task_seq, btrim(p_title), coalesce(p_description, ''), p_priority, st,
          p_requires_testing, p_estimate, p_due, p_assignee, me, me)
  returning * into t;
  insert into public.task_events (task_id, project_id, actor_id, kind, to_status)
  values (t.id, p_project, me, case when mgr then 'created' else 'proposed' end, st);

  if mgr then
    if p_assignee is not null and p_assignee <> me then
      out := out || public._notify(p_assignee, p_project, t.id, 'assigned',
               proj.key || '-' || t.number || ' was assigned to you', t.title,
               '/projects/' || p_project || '?task=' || t.id);
    end if;
  else
    select full_name into actor from public.profiles where id = me;
    for u in select user_id from public.project_members
              where project_id = p_project and role = 'manager' and user_id <> me loop
      out := out || public._notify(u.user_id, p_project, t.id, 'proposal',
               proj.key || '-' || t.number || ' needs your approval',
               actor || ' proposed “' || t.title || '”',
               '/projects/' || p_project || '?task=' || t.id);
    end loop;
  end if;
  return jsonb_build_object('task', to_jsonb(t), 'notified', out);
end $$;

-- Managers edit anything that is not done. The proposer may edit their own
-- proposal while it is Proposed or Declined (editing a declined one resubmits it).
create or replace function public.update_task(
  p_task uuid, p_title text, p_description text, p_priority public.task_priority,
  p_requires_testing boolean, p_estimate numeric, p_due timestamptz, p_assignee uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  old public.tasks; t public.tasks; me uuid := auth.uid(); out jsonb := '[]'::jsonb;
  ref text; actor text; mgr boolean; owner boolean; resubmit boolean; u record;
begin
  select * into old from public.tasks where id = p_task for update;
  if not found then raise exception 'Task not found'; end if;
  mgr   := public.can_manage(old.project_id);
  owner := old.reporter_id = me and old.status in ('proposed', 'declined');
  if not (mgr or owner) then raise exception 'Only managers can edit tasks'; end if;
  if old.status = 'done' then raise exception 'Reopen this task before editing it'; end if;
  if p_requires_testing is null then raise exception 'Say whether this task needs testing'; end if;
  if p_estimate is not null and (p_estimate <= 0 or p_estimate > 999) then
    raise exception 'Estimate must be between 0.5 and 999 hours (or leave it empty)';
  end if;
  if p_due is distinct from old.due_at and p_due <= now() then raise exception 'Pick a due date in the future'; end if;
  if p_requires_testing <> old.requires_testing and old.status = 'testing' then
    raise exception 'Testing has already started, so this setting can no longer change';
  end if;
  if p_assignee is not null and not exists (
       select 1 from public.project_members where project_id = old.project_id and user_id = p_assignee) then
    raise exception 'The assignee must be a project member';
  end if;
  if not mgr and p_assignee is not null and p_assignee <> me then
    raise exception 'Only a manager can assign work to other people';
  end if;
  if p_assignee is null and old.status not in ('todo', 'proposed', 'declined') then
    raise exception 'Tasks that are underway need an assignee';
  end if;

  resubmit := not mgr and old.status = 'declined';
  update public.tasks set
    title = btrim(p_title), description = coalesce(p_description, ''), priority = p_priority,
    requires_testing = p_requires_testing, estimate_hours = p_estimate, due_at = p_due,
    assignee_id = p_assignee, updated_by = me, updated_at = now(),
    status = case when resubmit then 'proposed'::public.task_status else status end,
    last_decision_note = case when resubmit then null else last_decision_note end,
    overdue_notified_at = case when p_due is distinct from old.due_at then null else overdue_notified_at end
  where id = p_task returning * into t;

  select key || '-' || t.number into ref from public.projects where id = t.project_id;
  select full_name into actor from public.profiles where id = me;
  insert into public.task_events (task_id, project_id, actor_id, kind, from_status, to_status)
  values (t.id, t.project_id, me,
          case when resubmit then 'resubmitted'
               when t.assignee_id is distinct from old.assignee_id then 'reassigned' else 'edited' end,
          case when resubmit then old.status end, case when resubmit then t.status end);

  if resubmit then
    for u in select user_id from public.project_members
              where project_id = t.project_id and role = 'manager' and user_id <> me loop
      out := out || public._notify(u.user_id, t.project_id, t.id, 'proposal',
               ref || ' was revised and needs approval', actor || ' resubmitted “' || t.title || '”',
               '/projects/' || t.project_id || '?task=' || t.id);
    end loop;
  elsif t.status not in ('proposed', 'declined') and t.assignee_id is distinct from old.assignee_id then
    if t.assignee_id is not null and t.assignee_id <> me then
      out := out || public._notify(t.assignee_id, t.project_id, t.id, 'assigned',
               ref || ' was assigned to you', t.title, '/projects/' || t.project_id || '?task=' || t.id);
    end if;
    if old.assignee_id is not null and old.assignee_id <> me then
      out := out || public._notify(old.assignee_id, t.project_id, t.id, 'unassigned',
               ref || ' was reassigned', t.title, '/projects/' || t.project_id || '?task=' || t.id);
    end if;
  end if;
  return jsonb_build_object('task', to_jsonb(t), 'notified', out);
end $$;

-- Approve a proposal. The manager may change the details in the same step; the
-- proposer is told exactly what was adjusted. Only after this can anyone start it.
create or replace function public.approve_task(
  p_task uuid, p_title text, p_description text, p_priority public.task_priority,
  p_requires_testing boolean, p_estimate numeric, p_due timestamptz, p_assignee uuid, p_note text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  old public.tasks; t public.tasks; me uuid := auth.uid(); out jsonb := '[]'::jsonb;
  ref text; actor text; note text := nullif(btrim(coalesce(p_note, '')), '');
  changed text[] := '{}'; summary text; other_approvers int;
begin
  select * into old from public.tasks where id = p_task for update;
  if not found then raise exception 'Task not found'; end if;
  if not public.can_manage(old.project_id) then raise exception 'Only a manager can approve a task'; end if;
  if old.status not in ('proposed', 'declined') then
    raise exception 'STALE: this task is no longer waiting for approval';
  end if;
  select count(*) into other_approvers from public.profiles p
   where p.id <> me and (p.is_admin or exists (
     select 1 from public.project_members m
      where m.user_id = p.id and m.project_id = old.project_id and m.role = 'manager'));
  if old.reporter_id = me and other_approvers > 0 then
    raise exception 'You cannot approve your own proposal. Ask another manager.';
  end if;
  if p_requires_testing is null then raise exception 'Say whether this task needs testing'; end if;
  if p_estimate is not null and (p_estimate <= 0 or p_estimate > 999) then
    raise exception 'Estimate must be between 0.5 and 999 hours (or leave it empty)';
  end if;
  if p_due is null or p_due <= now() then raise exception 'Pick a due date in the future before approving'; end if;
  if p_assignee is not null and not exists (
       select 1 from public.project_members where project_id = old.project_id and user_id = p_assignee) then
    raise exception 'The assignee must be a project member';
  end if;

  if p_due is distinct from old.due_at then changed := array_append(changed, 'due date'); end if;
  if p_estimate is distinct from old.estimate_hours then changed := array_append(changed, 'estimate'); end if;
  if p_priority is distinct from old.priority then changed := array_append(changed, 'priority'); end if;
  if p_assignee is distinct from old.assignee_id then changed := array_append(changed, 'assignee'); end if;
  if p_requires_testing is distinct from old.requires_testing then changed := array_append(changed, 'testing requirement'); end if;
  summary := case when array_length(changed, 1) > 0 then 'Adjusted: ' || array_to_string(changed, ', ') else null end;

  update public.tasks set
    title = btrim(p_title), description = coalesce(p_description, ''), priority = p_priority,
    requires_testing = p_requires_testing, estimate_hours = p_estimate, due_at = p_due,
    assignee_id = p_assignee, status = 'todo', last_decision_note = null,
    updated_by = me, updated_at = now(), overdue_notified_at = null
  where id = p_task returning * into t;

  select key || '-' || t.number into ref from public.projects where id = t.project_id;
  select full_name into actor from public.profiles where id = me;
  insert into public.task_events (task_id, project_id, actor_id, kind, from_status, to_status, note)
  values (t.id, t.project_id, me, 'approved_proposal', old.status, 'todo',
          nullif(concat_ws(E'\n', summary, note), ''));

  if t.reporter_id is not null and t.reporter_id <> me then
    out := out || public._notify(t.reporter_id, t.project_id, t.id, 'proposal_approved',
             ref || ' was approved',
             concat_ws('. ', actor || ' approved “' || t.title || '”', summary, note),
             '/projects/' || t.project_id || '?task=' || t.id);
  end if;
  if t.assignee_id is not null and t.assignee_id <> me and t.assignee_id is distinct from t.reporter_id then
    out := out || public._notify(t.assignee_id, t.project_id, t.id, 'assigned',
             ref || ' was assigned to you', t.title, '/projects/' || t.project_id || '?task=' || t.id);
  end if;
  return jsonb_build_object('task', to_jsonb(t), 'notified', out);
end $$;

-- Managers delete anything; a proposer may withdraw their own pending/declined proposal.
create or replace function public.delete_task(p_task uuid)
returns void language plpgsql security definer set search_path = public as $$
declare pid uuid; rep uuid; st public.task_status;
begin
  select project_id, reporter_id, status into pid, rep, st from public.tasks where id = p_task;
  if pid is null then raise exception 'Task not found'; end if;
  if not (public.can_manage(pid) or (rep = auth.uid() and st in ('proposed', 'declined'))) then
    raise exception 'Only managers can delete tasks';
  end if;
  delete from public.tasks where id = p_task;
end $$;

-- The workflow. p_from is the status the caller saw; if the card has moved
-- since (someone else approved it, say) the move is refused as STALE.
-- p_override lets a manager/admin move a card anywhere outside the normal
-- workflow (any column, with a mandatory reason that is logged and sent to the assignee).
create or replace function public.transition_task(
  p_task uuid, p_from public.task_status, p_to public.task_status, p_note text default null,
  p_override boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t public.tasks; me uuid := auth.uid(); adm boolean := public.is_admin();
  r public.project_role; mgr boolean; note text := nullif(btrim(coalesce(p_note, '')), '');
  out jsonb := '[]'::jsonb; ref text; actor text; link text; u record;
  other_approvers int; other_testers int; has_testers boolean;
begin
  if me is null then raise exception 'Not signed in'; end if;
  select * into t from public.tasks where id = p_task for update;
  if not found then raise exception 'Task not found'; end if;

  r := public.member_role(t.project_id);
  mgr := adm or r = 'manager';
  if r is null and not adm then raise exception 'You are not a member of this project'; end if;
  if t.status <> p_from then
    raise exception 'STALE: this card was already moved to %', replace(t.status::text, '_', ' ');
  end if;

  select full_name into actor from public.profiles where id = me;
  select key || '-' || t.number into ref from public.projects where id = t.project_id;
  link := '/projects/' || t.project_id || '?task=' || t.id;

  select count(*) into other_approvers from public.profiles p
   where p.id <> me and (p.is_admin or exists (
     select 1 from public.project_members m
      where m.user_id = p.id and m.project_id = t.project_id and m.role = 'manager'));
  select count(*) into other_testers from public.project_members
   where project_id = t.project_id and role = 'tester' and user_id <> me;
  has_testers := exists (select 1 from public.project_members where project_id = t.project_id and role = 'tester');

  if p_from in ('proposed', 'declined') or p_to in ('proposed', 'declined') then
    -- Intake lane: only "decline a proposal" is a plain move; approval has its own function.
    if p_from = 'proposed' and p_to = 'declined' then
      if not mgr then raise exception 'Only a manager can decline a proposal'; end if;
      if note is null then raise exception 'Say why it is declined so the proposer can revise it'; end if;
      t.last_decision_note := note;
      if t.reporter_id is not null and t.reporter_id <> me then
        out := out || public._notify(t.reporter_id, t.project_id, t.id, 'proposal_declined',
                 ref || ' was declined', actor || ': ' || note, link);
      end if;
    else
      raise exception 'Proposals are approved or declined by a manager. Open the task and use Review proposal.';
    end if;

  elsif p_override then
    if not mgr then raise exception 'Only a manager can move a card outside the workflow'; end if;
    if p_from = p_to then raise exception 'The card is already there'; end if;
    if note is null then raise exception 'Add a reason. It is logged and sent to the assignee.'; end if;
    if t.assignee_id is null and p_to <> 'todo' then raise exception 'Assign this task before moving it'; end if;
    if p_to = 'testing' and not t.requires_testing then raise exception 'This task does not need testing'; end if;
    if t.assignee_id = me and other_approvers > 0 and p_to in ('testing', 'done') then
      raise exception 'You cannot approve your own task, even as an override. Ask another manager.';
    end if;
    if p_to = 'in_progress' then
      t.started_at := coalesce(t.started_at, now());
      t.last_decision_note := note;
    elsif p_to = 'in_review' then
      t.review_requested_at := now();
      t.last_decision_note := null;
    else
      t.last_decision_note := null;
    end if;
    if t.assignee_id is not null and t.assignee_id <> me then
      out := out || public._notify(t.assignee_id, t.project_id, t.id, 'moved',
               ref || ' was moved to ' || replace(p_to::text, '_', ' '), actor || ': ' || note, link);
    end if;

  elsif p_from = 'todo' and p_to = 'in_progress' then
    if t.assignee_id is null then
      if mgr then raise exception 'Assign this task to someone before starting it'; end if;
      t.assignee_id := me;                      -- a team member picks up an unassigned card
    elsif t.assignee_id <> me then
      raise exception 'Only the person this task is assigned to can start it';
    end if;
    t.started_at := coalesce(t.started_at, now());

  elsif p_from = 'in_progress' and p_to = 'todo' then
    if t.assignee_id is distinct from me then raise exception 'Only the assignee can move this task back to To do'; end if;

  elsif p_from = 'in_progress' and p_to = 'in_review' then
    if t.assignee_id is null then raise exception 'Assign this task before sending it for review'; end if;
    if t.assignee_id <> me then raise exception 'Only the assignee can send this task for review'; end if;
    t.review_requested_at := now();
    t.last_decision_note := null;
    for u in select user_id from public.project_members
              where project_id = t.project_id and role = 'manager' and user_id <> me loop
      out := out || public._notify(u.user_id, t.project_id, t.id, 'review_requested',
               ref || ' is ready for review', actor || ' sent “' || t.title || '” for review', link);
    end loop;

  elsif p_from = 'in_review' and p_to in ('testing', 'done', 'todo') then
    if not mgr then raise exception 'Only a manager can approve or reject a review'; end if;
    if t.assignee_id = me and other_approvers > 0 then
      raise exception 'You cannot review your own task. Ask another manager.';
    end if;
    if p_to = 'testing' and not t.requires_testing then raise exception 'This task does not need testing'; end if;
    if p_to = 'done' and t.requires_testing then raise exception 'This task needs testing before it can be completed'; end if;
    if p_to = 'todo' then
      if note is null then raise exception 'Add a note so the assignee knows what to fix'; end if;
      t.last_decision_note := note;
      if t.assignee_id is not null and t.assignee_id <> me then
        out := out || public._notify(t.assignee_id, t.project_id, t.id, 'rejected',
                 ref || ' was sent back', actor || ': ' || note, link);
      end if;
    else
      t.last_decision_note := null;
      if t.assignee_id is not null and t.assignee_id <> me then
        out := out || public._notify(t.assignee_id, t.project_id, t.id, 'approved',
                 ref || ' was approved', actor || ' approved “' || t.title || '”', link);
      end if;
      if p_to = 'testing' then
        for u in select user_id from public.project_members
                  where project_id = t.project_id and role = 'tester' and user_id <> me loop
          out := out || public._notify(u.user_id, t.project_id, t.id, 'testing_requested',
                   ref || ' is ready to test', t.title, link);
        end loop;
      end if;
    end if;

  elsif p_from = 'testing' and p_to in ('done', 'in_progress') then
    if not (r = 'tester' or (mgr and not has_testers)) then
      raise exception 'Only a tester can pass or fail testing';
    end if;
    if t.assignee_id = me and other_testers > 0 then raise exception 'You cannot test your own task'; end if;
    if p_to = 'in_progress' then
      if note is null then raise exception 'Describe what failed so the assignee can fix it'; end if;
      t.last_decision_note := note;
      if t.assignee_id is not null and t.assignee_id <> me then
        out := out || public._notify(t.assignee_id, t.project_id, t.id, 'test_failed',
                 ref || ' failed testing', actor || ': ' || note, link);
      end if;
    else
      t.last_decision_note := null;
      if t.assignee_id is not null and t.assignee_id <> me then
        out := out || public._notify(t.assignee_id, t.project_id, t.id, 'test_passed',
                 ref || ' passed testing', t.title, link);
      end if;
    end if;

  elsif p_from = 'done' and p_to = 'in_progress' then
    if not mgr then raise exception 'Only a manager can reopen a completed task'; end if;
    if note is null then raise exception 'Add a note explaining why this is reopened'; end if;
    if t.assignee_id is null then raise exception 'Assign this task before reopening it'; end if;
    t.last_decision_note := note;
    if t.assignee_id <> me then
      out := out || public._notify(t.assignee_id, t.project_id, t.id, 'reopened',
               ref || ' was reopened', actor || ': ' || note, link);
    end if;

  else
    raise exception 'That move is not allowed in this workflow';
  end if;

  update public.tasks set
    status = p_to, assignee_id = t.assignee_id, started_at = t.started_at,
    review_requested_at = t.review_requested_at, last_decision_note = t.last_decision_note,
    completed_at = case when p_to = 'done' then now() when p_from = 'done' then null else completed_at end,
    updated_by = me, updated_at = now()
  where id = t.id returning * into t;

  insert into public.task_events (task_id, project_id, actor_id, kind, from_status, to_status, note)
  values (t.id, t.project_id, me, case when p_override then 'override' else 'moved' end, p_from, p_to, note);

  return jsonb_build_object('task', to_jsonb(t), 'notified', out);
end $$;

-- Overdue sweep: call hourly (see /api/cron/overdue). Notifies once per due date.
create or replace function public.flag_overdue()
returns jsonb language plpgsql security definer set search_path = public as $$
declare t record; u record; out jsonb := '[]'::jsonb; ref text; lnk text;
begin
  for t in select tk.*, p.key from public.tasks tk join public.projects p on p.id = tk.project_id
            where tk.status = 'in_progress' and tk.due_at < now() and tk.overdue_notified_at is null loop
    ref := t.key || '-' || t.number;
    lnk := '/projects/' || t.project_id || '?task=' || t.id;
    if t.assignee_id is not null then
      out := out || public._notify(t.assignee_id, t.project_id, t.id, 'overdue',
               ref || ' is overdue', t.title, lnk);
    end if;
    for u in select user_id from public.project_members
              where project_id = t.project_id and role = 'manager' and user_id is distinct from t.assignee_id loop
      out := out || public._notify(u.user_id, t.project_id, t.id, 'overdue',
               ref || ' is overdue', t.title, lnk);
    end loop;
    update public.tasks set overdue_notified_at = now() where id = t.id;
  end loop;
  return out;
end $$;

-- A card that changes column goes to the bottom of the new column, unless the caller set a position.
create or replace function public.tasks_bump_position()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status and new.position is not distinct from old.position then
    new.position := extract(epoch from clock_timestamp()) * 1000;
  end if;
  return new;
end $$;

drop trigger if exists tasks_bump_position on public.tasks;
create trigger tasks_bump_position before update on public.tasks
  for each row execute function public.tasks_bump_position();

-- Managers / admins put a card anywhere in its column.
create or replace function public.reorder_task(p_task uuid, p_position double precision)
returns public.tasks language plpgsql security definer set search_path = public as $$
declare t public.tasks; me uuid := auth.uid();
begin
  if me is null then raise exception 'Not signed in'; end if;
  select * into t from public.tasks where id = p_task for update;
  if not found then raise exception 'Task not found'; end if;
  if not (public.is_admin() or public.member_role(t.project_id) = 'manager') then
    raise exception 'Only a manager can reorder cards';
  end if;
  update public.tasks set position = p_position, updated_by = me, updated_at = now()
   where id = t.id returning * into t;
  return t;
end $$;

revoke execute on function public.reorder_task(uuid, double precision) from public, anon;
grant  execute on function public.reorder_task(uuid, double precision) to authenticated;

create or replace function public.delete_project(p_project uuid, p_confirm_key text)
returns void language plpgsql security definer set search_path = public as $$
declare pr public.projects;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into pr from public.projects where id = p_project;
  if not found then raise exception 'Project not found'; end if;
  if pr.created_by is distinct from auth.uid() then
    raise exception 'Only the person who created this project can delete it';
  end if;
  if upper(btrim(coalesce(p_confirm_key, ''))) <> pr.key then
    raise exception 'Type the project key exactly to confirm';
  end if;
  delete from public.projects where id = p_project;
end $$;

-- Only signed-in users (and the server's service role) may call functions.
revoke execute on all functions in schema public from public, anon;
grant  execute on all functions in schema public to authenticated, service_role;

-- Internal functions must not be callable from the browser.
revoke all on function public._notify(uuid, uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.flag_overdue() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- ------------------------------------------------------- realtime
alter table public.tasks           replica identity full;
alter table public.project_members replica identity full;
alter table public.project_invites replica identity full;
alter publication supabase_realtime add table
  public.tasks, public.notifications, public.project_members, public.project_invites;

-- ------------------------------------------------------- v8: files on review remarks
-- Run once on an existing database (SQL Editor).
-- Lets the person who sends a card back (or declines / fails / reopens it) attach photos or PDFs to
-- their remark. Files live in a private Storage bucket; only project members can open them.

-- 1) The files attached to the CURRENT remark (cleared automatically when the remark changes).
alter table public.tasks add column if not exists last_decision_files jsonb not null default '[]'::jsonb;

create or replace function public._clear_decision_files()
returns trigger language plpgsql as $$
begin
  if (new.last_decision_note is distinct from old.last_decision_note or new.status is distinct from old.status)
     and new.last_decision_files is not distinct from old.last_decision_files then
    new.last_decision_files := '[]'::jsonb;
  end if;
  return new;
end $$;

drop trigger if exists tasks_clear_files on public.tasks;
create trigger tasks_clear_files before update on public.tasks
  for each row execute function public._clear_decision_files();

-- 2) Private bucket: 5 MB per file, images and PDFs only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('task-files', 'task-files', false, 5242880,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Object paths look like  <project id>/<task id>/<file>. CASE keeps the uuid cast away from other buckets.
drop policy if exists task_files_read   on storage.objects;
drop policy if exists task_files_upload on storage.objects;
drop policy if exists task_files_remove on storage.objects;

create policy task_files_read on storage.objects for select to authenticated
  using (case when bucket_id = 'task-files' then public.can_view(((storage.foldername(name))[1])::uuid) else false end);
create policy task_files_upload on storage.objects for insert to authenticated
  with check (case when bucket_id = 'task-files' then public.can_view(((storage.foldername(name))[1])::uuid) else false end);
create policy task_files_remove on storage.objects for delete to authenticated
  using (case when bucket_id = 'task-files' then public.can_manage(((storage.foldername(name))[1])::uuid) else false end);

-- 3) Attach the uploaded files to the remark. Only whoever wrote the remark can do this.
create or replace function public.set_decision_files(p_task uuid, p_files jsonb)
returns public.tasks language plpgsql security definer set search_path = public as $$
declare t public.tasks; me uuid := auth.uid(); f jsonb;
begin
  if me is null then raise exception 'Not signed in'; end if;
  select * into t from public.tasks where id = p_task for update;
  if not found then raise exception 'Task not found'; end if;
  if not public.can_view(t.project_id) then raise exception 'You are not a member of this project'; end if;
  if t.updated_by is distinct from me then raise exception 'Only the person who wrote the remark can attach files to it'; end if;
  if t.last_decision_note is null then raise exception 'There is no remark to attach files to'; end if;
  if jsonb_typeof(p_files) <> 'array' then raise exception 'Invalid file list'; end if;
  if jsonb_array_length(p_files) > 5 then raise exception 'Attach at most 5 files'; end if;
  for f in select * from jsonb_array_elements(p_files) loop
    if left(coalesce(f ->> 'path', ''), length(t.project_id::text || '/' || t.id::text || '/')) <> t.project_id::text || '/' || t.id::text || '/' then
      raise exception 'Invalid file path';
    end if;
    if coalesce(f ->> 'type', '') not in ('image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf') then
      raise exception 'Only photos and PDFs can be attached';
    end if;
  end loop;
  update public.tasks set last_decision_files = p_files where id = t.id returning * into t;
  return t;
end $$;

revoke execute on function public.set_decision_files(uuid, jsonb) from public, anon;
grant  execute on function public.set_decision_files(uuid, jsonb) to authenticated;
revoke execute on function public._clear_decision_files() from public, anon, authenticated;

notify pgrst, 'reload schema';
