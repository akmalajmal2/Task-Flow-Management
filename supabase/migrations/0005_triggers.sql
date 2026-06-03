-- 0005_triggers.sql
-- Wires the functions in 0004 to specific table events.

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists workspace_owner_as_member on public.workspaces;
create trigger workspace_owner_as_member
  after insert on public.workspaces
  for each row execute function public.add_owner_as_member();

drop trigger if exists board_defaults on public.boards;
create trigger board_defaults
  after insert on public.boards
  for each row execute function public.create_board_defaults();

drop trigger if exists tasks_assign_seq on public.tasks;
create trigger tasks_assign_seq
  before insert on public.tasks
  for each row execute function public.assign_task_seq();

drop trigger if exists bugs_assign_seq on public.bugs;
create trigger bugs_assign_seq
  before insert on public.bugs
  for each row execute function public.assign_bug_seq();

drop trigger if exists subtask_status_change on public.subtasks;
create trigger subtask_status_change
  before update of status on public.subtasks
  for each row execute function public.on_subtask_status_change();

drop trigger if exists comment_mentions on public.comments;
create trigger comment_mentions
  after insert on public.comments
  for each row execute function public.on_comment_insert();

drop trigger if exists bug_assignment on public.bugs;
create trigger bug_assignment
  after insert or update on public.bugs
  for each row execute function public.on_bug_change();
