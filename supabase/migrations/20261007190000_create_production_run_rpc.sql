create or replace function public.create_production_run(
  p_recipe_id bigint,
  p_production_date date,
  p_batch_count integer,
  p_batch_code text default null
)
returns public.store_production_runs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_recipe public.store_recipes%rowtype;
  v_product public.store_products%rowtype;
  v_run public.store_production_runs%rowtype;
  v_output numeric(14,3);
  v_material_cost numeric(14,2) := 0;
  v_item record;
  v_required numeric(14,3);
  v_stock numeric(14,3);
begin
  if not coalesce((select private.is_admin()), false) then
    raise exception 'admin access required';
  end if;
  if p_batch_count is null or p_batch_count <= 0 then
    raise exception 'batch_count must be greater than 0';
  end if;
  select * into v_recipe from public.store_recipes where id=p_recipe_id and is_active=true for update;
  if not found then raise exception 'recipe not found or inactive'; end if;
  if v_recipe.product_id is null then raise exception 'recipe has no product'; end if;
  select * into v_product from public.store_products where product_id=v_recipe.product_id for update;
  if not found then raise exception 'product not found'; end if;
  for v_item in select ri.material_id,ri.quantity_kg,ri.material_price from public.store_recipe_items ri where ri.recipe_id=p_recipe_id order by ri.id for update loop
    select stock into v_stock from public.store_materials where id=v_item.material_id and is_active=true for update;
    if not found then raise exception 'material % not found or inactive',v_item.material_id; end if;
    v_required:=v_item.quantity_kg*p_batch_count;
    if v_stock<v_required then raise exception 'insufficient material stock for material %: required %, available %',v_item.material_id,v_required,v_stock; end if;
    update public.store_materials set stock=stock-v_required,updated_at=now() where id=v_item.material_id;
    v_material_cost:=v_material_cost+(v_required*coalesce(v_item.material_price,0));
  end loop;
  v_output:=v_recipe.yield_kg*p_batch_count;
  update public.store_products set stock=stock+v_output,updated_at=now() where product_id=v_product.product_id;
  insert into public.store_production_runs(recipe_id,production_date,batch_count,output_kg,material_cost,batch_code)
  values(p_recipe_id,coalesce(p_production_date,current_date),p_batch_count,v_output,v_material_cost,nullif(trim(p_batch_code),''))
  returning * into v_run;
  return v_run;
end;
$$;
revoke execute on function public.create_production_run(bigint,date,integer,text) from public,anon;
grant execute on function public.create_production_run(bigint,date,integer,text) to authenticated;
