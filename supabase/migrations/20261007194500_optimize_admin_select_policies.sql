drop policy if exists knowledge_articles_admin_all on public.knowledge_articles;
drop policy if exists knowledge_articles_authenticated_select on public.knowledge_articles;
create policy knowledge_articles_authenticated_select on public.knowledge_articles for select to authenticated using (is_published=true or (select private.is_admin()));
create policy knowledge_articles_admin_insert on public.knowledge_articles for insert to authenticated with check ((select private.is_admin()));
create policy knowledge_articles_admin_update on public.knowledge_articles for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy knowledge_articles_admin_delete on public.knowledge_articles for delete to authenticated using ((select private.is_admin()));

drop policy if exists recommendation_rules_admin_all on public.store_product_recommendation_rules;
drop policy if exists recommendation_rules_authenticated_select on public.store_product_recommendation_rules;
create policy recommendation_rules_authenticated_select on public.store_product_recommendation_rules for select to authenticated using (is_active=true or (select private.is_admin()));
create policy recommendation_rules_admin_insert on public.store_product_recommendation_rules for insert to authenticated with check ((select private.is_admin()));
create policy recommendation_rules_admin_update on public.store_product_recommendation_rules for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy recommendation_rules_admin_delete on public.store_product_recommendation_rules for delete to authenticated using ((select private.is_admin()));
