create table if not exists public.store_products (
  product_id bigint primary key,
  sku text not null unique,
  name text not null,
  stock numeric(12,2) not null default 0 check (stock >= 0),
  price numeric(12,2) not null check (price >= 0),
  is_available boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.store_products enable row level security;
grant select on public.store_products to authenticated;
grant insert, update, delete on public.store_products to authenticated;

create policy store_products_user_select on public.store_products
for select to authenticated using (true);
create policy store_products_admin_insert on public.store_products
for insert to authenticated
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy store_products_admin_update on public.store_products
for update to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy store_products_admin_delete on public.store_products
for delete to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

insert into public.store_products (product_id, sku, name, stock, price, is_available)
values (1, 'FG-WS40', 'FISHGROW White Snapper 40', 680, 40, true)
on conflict (product_id) do nothing;

create table if not exists public.store_orders (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  customer_name text not null,
  phone text not null,
  delivery_address text not null,
  note text not null default '',
  status text not null default 'รอรับคำสั่งซื้อ',
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists store_orders_user_created_idx on public.store_orders(user_id, created_at desc);
alter table public.store_orders enable row level security;
grant select on public.store_orders to authenticated;
grant insert (user_id, customer_name, phone, delivery_address, note, items) on public.store_orders to authenticated;

create policy store_orders_select_owner_or_admin on public.store_orders
for select to authenticated using (
  (select auth.uid()) = user_id
  or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
);
create policy store_orders_insert_owner on public.store_orders
for insert to authenticated with check ((select auth.uid()) = user_id);

create or replace function public.validate_store_order()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  item jsonb;
  product_row public.store_products%rowtype;
  requested_product_id bigint;
  requested_quantity integer;
  calculated_total numeric(12,2) := 0;
  normalized_items jsonb := '[]'::jsonb;
begin
  if (select auth.uid()) is null or new.user_id <> (select auth.uid()) then
    raise exception 'Sign in to place an order for your own account';
  end if;
  if jsonb_typeof(new.items) <> 'array' or jsonb_array_length(new.items) = 0 then
    raise exception 'Add at least one product to your order';
  end if;
  if jsonb_array_length(new.items) > 50 then
    raise exception 'Too many different products in one order';
  end if;
  for item in select value from jsonb_array_elements(new.items)
  loop
    begin
      requested_product_id := (item ->> 'product_id')::bigint;
      requested_quantity := (item ->> 'quantity')::integer;
    exception when others then
      raise exception 'Invalid product or quantity';
    end;
    if requested_quantity < 1 or requested_quantity > 100000 then
      raise exception 'Quantity must be a positive whole number';
    end if;
    select * into product_row
    from public.store_products
    where product_id = requested_product_id and is_available = true;
    if not found then
      raise exception 'A selected product is no longer available';
    end if;
    if product_row.stock < requested_quantity then
      raise exception 'Not enough stock for %', product_row.name;
    end if;
    calculated_total := calculated_total + (product_row.price * requested_quantity);
    normalized_items := normalized_items || jsonb_build_array(jsonb_build_object(
      'product_id', product_row.product_id,
      'sku', product_row.sku,
      'name', product_row.name,
      'unit_price', product_row.price,
      'quantity', requested_quantity,
      'line_total', product_row.price * requested_quantity
    ));
  end loop;
  new.items := normalized_items;
  new.total_amount := calculated_total;
  new.status := 'รอรับคำสั่งซื้อ';
  return new;
end;
$$;

drop trigger if exists store_orders_validate_before_insert on public.store_orders;
create trigger store_orders_validate_before_insert
before insert on public.store_orders
for each row execute function public.validate_store_order();
