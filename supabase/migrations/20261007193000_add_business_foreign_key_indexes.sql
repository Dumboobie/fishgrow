create index if not exists store_production_runs_recipe_id_idx on public.store_production_runs(recipe_id);
create index if not exists store_recipe_items_material_id_idx on public.store_recipe_items(material_id);
create index if not exists store_recipes_product_id_idx on public.store_recipes(product_id);
