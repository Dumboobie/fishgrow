-- Grant anon role the ability to SELECT from store_products so that the
-- public storefront can display available products without a user session.
-- The RLS policy store_products_public_select (to anon, authenticated)
-- already filters rows correctly (is_available = true for anon users),
-- but a GRANT is also required for RLS to be evaluated at all.
grant select on public.store_products to anon;

-- Also ensure store_settings and store_product_recommendation_rules
-- are readable by unauthenticated visitors (public pages depend on them).
grant select on public.store_settings to anon;
grant select on public.store_product_recommendation_rules to anon;
