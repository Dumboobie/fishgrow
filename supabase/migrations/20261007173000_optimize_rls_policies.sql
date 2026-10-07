-- Optimize overlapping RLS policies for public/admin reads and store settings writes.
drop policy if exists store_products_user_select on public.store_products;
drop policy if exists store_products_public_select on public.store_products;
create policy store_products_public_select
on public.store_products
for select
to anon, authenticated
using (is_available = true or (select private.is_admin()));

drop policy if exists recommendation_rules_public_select on public.store_product_recommendation_rules;
create policy recommendation_rules_public_select
on public.store_product_recommendation_rules
for select
to anon, authenticated
using (is_active = true or (select private.is_admin()));

drop policy if exists knowledge_articles_public_select on public.knowledge_articles;
create policy knowledge_articles_public_select
on public.knowledge_articles
for select
to anon, authenticated
using (is_published = true or (select private.is_admin()));

drop policy if exists store_settings_admin_write on public.store_settings;
create policy store_settings_admin_insert
on public.store_settings
for insert
to authenticated
with check ((select private.is_admin()));

create policy store_settings_admin_update
on public.store_settings
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy store_settings_admin_delete
on public.store_settings
for delete
to authenticated
using ((select private.is_admin()));
