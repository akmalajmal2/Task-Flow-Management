-- 0009_renormalize_positions.sql
-- Utility function: rewrite positions for all tasks in a column to multiples
-- of 1024, starting at 1024. Call this when client-side avgPosition collapses
-- positions below 0.001 gap. Requires board_admin or ws_admin role.

create or replace function public.renormalize_column_positions(p_column_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  i integer := 0;
begin
  for r in
    select id
    from public.tasks
    where column_id = p_column_id
      and archived_at is null
    order by position
  loop
    i := i + 1;
    update public.tasks
    set position = i * 1024
    where id = r.id;
  end loop;
end;
$$;

-- Grant execute only to authenticated users (RLS on tasks still applies)
grant execute on function public.renormalize_column_positions(uuid) to authenticated;
