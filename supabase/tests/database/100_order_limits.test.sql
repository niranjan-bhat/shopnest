-- place_order's spam limits: 3 orders an hour per phone number per store,
-- 10 an hour per network address across stores. A limited request saves
-- nothing; a repeated checkout still returns its order. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

delete from public.tenants;

insert into public.tenants (id, slug, name, status, whatsapp_number) values
  ('a0000000-0000-4000-8000-000000000000', 'store-a', 'Store A', 'active', '+910000000101'),
  ('b0000000-0000-4000-8000-000000000000', 'store-b', 'Store B', 'active', '+910000000102');
insert into public.products (id, tenant_id, name, slug, status, price_mode, price_paise) values
  ('a3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000000', 'A saree', 'a-saree', 'active', 'fixed', 100000),
  ('b3000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000000', 'B saree', 'b-saree', 'active', 'fixed', 100000);
insert into public.product_variants (id, tenant_id, product_id, stock_qty, track_inventory) values
  ('a4000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000000', 'a3000000-0000-4000-8000-000000000001', 0, false),
  ('b4000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000000', 'b3000000-0000-4000-8000-000000000001', 0, false);

-- An order at store a or b from a phone number (10 digits after +91) and
-- network hash; `n` makes the checkout id.
create function pg_temp.order_from(store text, n int, phone text, client text default null)
returns jsonb
language sql as $$
  select public.place_order(
    (case store when 'a' then 'a0000000-0000-4000-8000-000000000000'
                else 'b0000000-0000-4000-8000-000000000000' end)::uuid,
    format('d0000000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid,
    jsonb_build_object(
      'name', 'Test shopper', 'phone', '+91' || phone,
      'address', '{"line1":"1 Road","city":"Pune","state":"Maharashtra","pincode":"411001"}'::jsonb),
    jsonb_build_array(jsonb_build_object(
      'variant_id', case store when 'a' then 'a4000000-0000-4000-8000-000000000001'
                               else 'b4000000-0000-4000-8000-000000000001' end,
      'qty', 1, 'unit_price_paise', 100000)),
    client);
$$;
grant execute on function pg_temp.order_from(text, int, text, text) to service_role;

set local role service_role;

-- Phone: three an hour at one store.
select is(pg_temp.order_from('a', 1, '9000000001') ->> 'status', 'placed', 'a first order is placed');
select is(pg_temp.order_from('a', 2, '9000000001') ->> 'status', 'placed', 'a second');
select is(pg_temp.order_from('a', 3, '9000000001') ->> 'status', 'placed', 'a third');
select is(
  pg_temp.order_from('a', 4, '9000000001'),
  '{"status": "limited", "limit": "phone"}'::jsonb,
  'a fourth within the hour is refused'
);
select is((select count(*)::int from public.orders), 3, 'and saves nothing');
select is(pg_temp.order_from('a', 1, '9000000001') ->> 'status', 'placed',
  'repeating a checkout already placed still returns its order');
select is(pg_temp.order_from('b', 5, '9000000001') ->> 'status', 'placed',
  'the same phone can still order at another store');

-- An hour later the phone can order again.
update public.orders set created_at = now() - interval '61 minutes';
select is(pg_temp.order_from('a', 6, '9000000001') ->> 'status', 'placed',
  'older orders no longer count');

-- Network: ten an hour across stores, whatever the phone numbers.
delete from public.orders;
select is(
  (select count(*)::int from generate_series(1, 10) n
    where pg_temp.order_from(case when n % 2 = 0 then 'a' else 'b' end, 100 + n,
            '90000001' || lpad(n::text, 2, '0'), repeat('ab', 32)) ->> 'status' = 'placed'),
  10, 'ten orders from one network, across stores, are placed'
);
select is(
  pg_temp.order_from('a', 200, '9000000200', repeat('ab', 32)),
  '{"status": "limited", "limit": "network"}'::jsonb,
  'an eleventh is refused'
);
select is(pg_temp.order_from('a', 201, '9000000201', repeat('cd', 32)) ->> 'status', 'placed',
  'another network is not affected');
select is(pg_temp.order_from('a', 202, '9000000202') ->> 'status', 'placed',
  'an order without a network hash only meets the phone limit');

reset role;
select * from finish();
rollback;
