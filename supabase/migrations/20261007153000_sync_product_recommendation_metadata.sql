-- Align public product metadata with the active recommendation rules.
-- Do not invent protein percentages or pellet sizes; those remain NULL until verified product specs are supplied.

update public.store_products p
set
  fish_types = coalesce((
    select array_agg(distinct r.fish_type order by r.fish_type)
    from public.store_product_recommendation_rules r
    where r.product_id = p.product_id and r.is_active
  ), '{}'::text[]),
  stages = coalesce((
    select array_agg(distinct r.stage order by r.stage)
    from public.store_product_recommendation_rules r
    where r.product_id = p.product_id and r.is_active
  ), '{}'::text[]),
  goals = coalesce((
    select array_agg(distinct r.goal order by r.goal)
    from public.store_product_recommendation_rules r
    where r.product_id = p.product_id and r.is_active
  ), '{}'::text[]),
  description = case
    when nullif(trim(p.description), '') is null then
      'อาหารปลาที่พัฒนาภายใต้แนวคิด FISHGROW สำหรับการเพาะเลี้ยงสัตว์น้ำ'
    else p.description
  end,
  usage_note = case
    when nullif(trim(p.usage_note), '') is null then
      'ปรับปริมาณอาหารตามชนิดปลา ช่วงวัย น้ำหนักปลา คุณภาพน้ำ และการกินจริง'
    else p.usage_note
  end,
  storage_note = case
    when nullif(trim(p.storage_note), '') is null then
      'เก็บในที่แห้งและเย็น หลีกเลี่ยงแสงแดดและความชื้น และปิดปากถุงให้สนิท'
    else p.storage_note
  end
where exists (
  select 1
  from public.store_product_recommendation_rules r
  where r.product_id = p.product_id and r.is_active
);
