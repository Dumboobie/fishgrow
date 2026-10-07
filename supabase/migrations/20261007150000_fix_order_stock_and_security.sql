-- Fix order placement stock handling and function security.
-- The BEFORE INSERT trigger is the single source of truth for stock validation,
-- stock decrement, normalized items, and total amount.

create or replace function public.place_store_order(
  p_items jsonb,
  p_customer_name text,
  p_phone text,
  p_delivery_address text,
  p_province text default '',
  p_district text default '',
  p_subdistrict text default '',
  p_postal_code text default '',
  p_note text default '',
  p_payment_method text default 'bank_transfer',
  p_payment_proof_path text default null
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_order_id bigint;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if coalesce(trim(p_customer_name), '') = ''
     or coalesce(trim(p_phone), '') = ''
     or coalesce(trim(p_delivery_address), '') = '' then
    raise exception 'MISSING_CUSTOMER_DATA';
  end if;

  if p_payment_method not in ('promptpay', 'bank_transfer', 'cod') then
    raise exception 'INVALID_PAYMENT_METHOD';
  end if;

  if p_payment_proof_path is not null
     and left(p_payment_proof_path, length(v_user::text) + 1) <> v_user::text || '/' then
    raise exception 'INVALID_PAYMENT_PROOF_PATH';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART';
  end if;

  insert into public.store_orders (
    user_id, customer_name, phone, delivery_address, note,
    status, total_amount, items, payment_method, payment_status,
    payment_proof_path, shipping_fee, province, district, subdistrict, postal_code
  )
  values (
    v_user, trim(p_customer_name), trim(p_phone), trim(p_delivery_address),
    coalesce(p_note, ''), 'รอรับคำสั่งซื้อ', 0, p_items, p_payment_method,
    case when p_payment_proof_path is null then 'pending' else 'submitted' end,
    p_payment_proof_path, 0, coalesce(p_province, ''), coalesce(p_district, ''),
    coalesce(p_subdistrict, ''), coalesce(p_postal_code, '')
  )
  returning id into v_order_id;

  return v_order_id;
end;
$function$;

revoke execute on function public.place_store_order(
  jsonb, text, text, text, text, text, text, text, text, text, text
) from public;

revoke execute on function public.place_store_order(
  jsonb, text, text, text, text, text, text, text, text, text, text
) from anon;

grant execute on function public.place_store_order(
  jsonb, text, text, text, text, text, text, text, text, text, text
) to authenticated;

create index if not exists store_product_recommendation_rules_product_id_idx
  on public.store_product_recommendation_rules(product_id);
