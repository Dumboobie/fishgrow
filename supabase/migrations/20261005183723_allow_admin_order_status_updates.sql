grant update (status) on public.store_orders to authenticated;

drop policy if exists store_orders_admin_status_update on public.store_orders;
create policy store_orders_admin_status_update
on public.store_orders
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  )
);
