-- 0007_seed_helpers.sql
-- One-time helpers and final touches.

-- Friendly view: my_workspaces with role attached
create or replace view public.my_workspaces as
select w.*, wm.role
from public.workspaces w
join public.workspace_members wm on wm.workspace_id = w.id
where wm.user_id = auth.uid();

grant select on public.my_workspaces to authenticated;
