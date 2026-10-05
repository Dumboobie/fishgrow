drop policy if exists app_state_authenticated_select on public.app_state;
create policy app_state_admin_select
on public.app_state for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
);


