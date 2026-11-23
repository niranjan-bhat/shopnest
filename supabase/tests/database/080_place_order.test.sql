-- place_order: only the server places orders; every line is re-priced from
-- the database; changes since the shopper looked (price, stock, no longer
-- for sale) save nothing and are reported; a repeated checkout returns the
-- same order. Rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;

select plan(27);

delete from public.tenants;

insert into public.tenants (id, slug, name, status, whatsapp_number) values
  ('a0000000-0000-4000-8000-000000000000', 'store-a', 'Store A', 'active', '+910000000101'),
  ('b0000000-0000-4000-8000-000000000000', 'store-b', 'Store B', 'active', '+910000000102'),
  ('c0000000-0000-4000-8000-000000000000', 'store-c', 'Store C', 'suspended', '+910000000103');
insert into auth.users (id, email) values
  ('a1000000-0000-4000-8000-000000000000', 'owner-a@test.local'),
  ('b1000000-0000-4000-8000-000000000000', 'owner-b@test.local');
insert into public.tenant_members (tenant_id, user_id, role) values
  ('a0000000-0000-4000-8000-000000000000', 'a1000000-0000-4000-8000-000000000000', 'owner'),
  ('b0000000-0000-4000-8000-000000000000', 'b1000000-0000-4000-8000-000000000000', 'owner');

-- Store A: a saree at ₹10,000 whose M size costs ₹12,000 (tracked, 2 left),
-- a dupatta with untracked stock, a necklace on request, and a draft.
insert into public.products (id, tenant_id, name, slug, status, price_mode, price_paise) values
  ('a3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000000', 'Silk saree', 'silk-saree', 'active', 'fixed', 1000000),
  ('a3000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000000', 'Dupatta', 'dupatta', 'active', 'fixed', 150000),
  ('a3000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000000', 'Necklace', 'necklace', 'active', 'on_request', null),
  ('a3000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000000', 'Draft kurta', 'draft-kurta', 'draft', 'fixed', 200000);
insert into public.product_variants (id, tenant_id, product_id, options, price_paise, stock_qty, track_inventory) values
  ('a4000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000000', 'a3000000-0000-4000-8000-000000000001', '{"size":"S"}', null, 5, true),
  ('a4000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000000', 'a3000000-0000-4000-8000-000000000001', '{"size":"M"}', 1200000, 2, true),
  ('a4000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000000', 'a3000000-0000-4000-8000-000000000002', '{}', null, 0, false),
  ('a4000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000000', 'a3000000-0000-4000-8000-000000000003', '{}', null, 1, true),
  ('a4000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000000', 'a3000000-0000-4000-8000-000000000004', '{}', null, 9, true);

-- Store B: one product, and store C (suspended): one product.
insert into public.products (id, tenant_id, name, slug, status, price_mode, price_paise) values
  ('b3000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000000', 'B saree', 'b-saree', 'active', 'fixed', 500000),
  ('c3000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000000', 'C saree', 'c-saree', 'active', 'fixed', 500000);
insert into public.product_variants (id, tenant_id, product_id, stock_qty) values
  ('b4000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000000', 'b3000000-0000-4000-8000-000000000001', 5),
  ('c4000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000000', 'c3000000-0000-4000-8000-000000000001', 5);

create function pg_temp.customer(extra jsonb default '{}') returns jsonb
language sql as $$
  select jsonb_build_object(
    'name', 'Lakshmi Iyer', 'phone', '+919876543210', 'notes', '',
    'address', jsonb_build_object(
      'line1', '12 Gandhi Road', 'line2', '', 'city', 'Kanchipuram',
      'state', 'Tamil Nadu', 'pincode', '631502')
  ) || extra;
$$;
-- The bag in the tests below: S × 1, M × 2, dupatta × 3, necklace × 1, at
-- the prices the shopper was shown.
create function pg_temp.bag(m_price bigint default 1200000, m_qty int default 2) returns jsonb
language sql as $$
  select jsonb_build_array(
    jsonb_build_object('variant_id', 'a4000000-0000-4000-8000-000000000001', 'qty', 1, 'unit_price_paise', 1000000),
    jsonb_build_object('variant_id', 'a4000000-0000-4000-8000-000000000002', 'qty', m_qty, 'unit_price_paise', m_price),
    jsonb_build_object('variant_id', 'a4000000-0000-4000-8000-000000000003', 'qty', 3, 'unit_price_paise', 150000),
    jsonb_build_object('variant_id', 'a4000000-0000-4000-8000-000000000004', 'qty', 1, 'unit_price_paise', null)
  );
$$;
grant execute on function pg_temp.customer(jsonb) to anon, authenticated, service_role;
grant execute on function pg_temp.bag(bigint, int) to anon, authenticated, service_role;
create table pg_temp.results (name text primary key, result jsonb);
grant all on pg_temp.results to service_role;

-- Only the server may place orders.
set local role anon;
select throws_ok(
  $$ select public.place_order('a0000000-0000-4000-8000-000000000000',
       'd0000000-0000-4000-8000-000000000001', pg_temp.customer(), pg_temp.bag()) $$,
  '42501', null, 'shoppers cannot call place_order directly'
);
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-4000-8000-000000000000","role":"authenticated"}';
select throws_ok(
  $$ select public.place_order('a0000000-0000-4000-8000-000000000000',
       'd0000000-0000-4000-8000-000000000001', pg_temp.customer(), pg_temp.bag()) $$,
  '42501', null, 'merchants cannot call place_order directly'
);
reset role;

set local role service_role;

-- A good order.
insert into pg_temp.results
select 'placed', public.place_order('a0000000-0000-4000-8000-000000000000',
  'd0000000-0000-4000-8000-000000000001', pg_temp.customer(), pg_temp.bag());
select is((select result ->> 'status' from pg_temp.results where name = 'placed'),
  'placed', 'the order is placed');
select is((select (result ->> 'order_number')::int from pg_temp.results where name = 'placed'),
  1001, 'it gets the store''s first order number');
-- 1 × 10,000 + 2 × 12,000 (the variant''s own price) + 3 × 1,500; the
-- necklace is on request and adds nothing.
select is((select (result ->> 'subtotal_paise')::bigint from pg_temp.results where name = 'placed'),
  3850000::bigint, 'the subtotal is priced from the database');
select is((select (result ->> 'total_paise')::bigint from pg_temp.results where name = 'placed'),
  3850000::bigint, 'the total matches the subtotal');
select is((select (result ->> 'has_price_on_request')::boolean from pg_temp.results where name = 'placed'),
  true, 'it says some prices are still to be confirmed');
select results_eq(
  $$ select name_snapshot, options_snapshot, qty, unit_price_paise, position::int
       from public.order_items order by position $$,
  $$ values ('Silk saree', '{"size":"S"}'::jsonb, 1, 1000000::bigint, 0),
            ('Silk saree', '{"size":"M"}'::jsonb, 2, 1200000::bigint, 1),
            ('Dupatta', '{}'::jsonb, 3, 150000::bigint, 2),
            ('Necklace', '{}'::jsonb, 1, null::bigint, 3) $$,
  'its lines keep names, options, prices and the bag''s order'
);
select is(
  (select jsonb_agg(l ->> 'name') from pg_temp.results,
     jsonb_array_elements(result -> 'lines') l where name = 'placed'),
  '["Silk saree", "Silk saree", "Dupatta", "Necklace"]'::jsonb,
  'the result lists the lines in the same order'
);
select results_eq(
  $$ select customer_name, customer_phone, address ->> 'city', notes, status::text, channel::text
       from public.orders $$,
  $$ values ('Lakshmi Iyer', '+919876543210', 'Kanchipuram', null::text, 'pending', 'whatsapp') $$,
  'the customer and a pending WhatsApp order are saved'
);
select is((select sum(stock_qty)::int from public.product_variants
            where tenant_id = 'a0000000-0000-4000-8000-000000000000'),
  17, 'stock does not move until the merchant confirms');

-- The same checkout again returns the same order.
select is(
  (public.place_order('a0000000-0000-4000-8000-000000000000',
     'd0000000-0000-4000-8000-000000000001', pg_temp.customer(), pg_temp.bag()) ->> 'order_id'),
  (select result ->> 'order_id' from pg_temp.results where name = 'placed'),
  'a repeated checkout returns the order it made'
);
select is((select count(*)::int from public.orders), 1, 'and makes no second order');

-- A price changed since the shopper saw it: nothing is saved.
insert into pg_temp.results
select 'price', public.place_order('a0000000-0000-4000-8000-000000000000',
  'd0000000-0000-4000-8000-000000000002', pg_temp.customer(), pg_temp.bag(m_price => 1100000));
select is((select result ->> 'status' from pg_temp.results where name = 'price'),
  'changed', 'a changed price is reported');
select is(
  (select result -> 'lines' from pg_temp.results where name = 'price'),
  '[{"variant_id": "a4000000-0000-4000-8000-000000000002", "problems": ["price"],
     "unit_price_paise": 1200000, "available_qty": 2}]'::jsonb,
  'with the line and its current price'
);
select is((select count(*)::int from public.orders), 1, 'and no order is saved');

-- More than is in stock.
select is(
  (public.place_order('a0000000-0000-4000-8000-000000000000',
     'd0000000-0000-4000-8000-000000000003', pg_temp.customer(), pg_temp.bag(m_qty => 3)) -> 'lines'),
  '[{"variant_id": "a4000000-0000-4000-8000-000000000002", "problems": ["stock"],
     "unit_price_paise": 1200000, "available_qty": 2}]'::jsonb,
  'a line short of stock is reported with what is left'
);

-- No longer for sale: a draft product, another store's variant, an unknown one.
select is(
  (public.place_order('a0000000-0000-4000-8000-000000000000',
     'd0000000-0000-4000-8000-000000000004', pg_temp.customer(),
     '[{"variant_id":"a4000000-0000-4000-8000-000000000005","qty":1,"unit_price_paise":200000},
       {"variant_id":"b4000000-0000-4000-8000-000000000001","qty":1,"unit_price_paise":500000},
       {"variant_id":"e4000000-0000-4000-8000-000000000001","qty":1,"unit_price_paise":100}]') -> 'lines'),
  '[{"variant_id": "a4000000-0000-4000-8000-000000000005", "problems": ["unavailable"], "unit_price_paise": null, "available_qty": null},
    {"variant_id": "b4000000-0000-4000-8000-000000000001", "problems": ["unavailable"], "unit_price_paise": null, "available_qty": null},
    {"variant_id": "e4000000-0000-4000-8000-000000000001", "problems": ["unavailable"], "unit_price_paise": null, "available_qty": null}]'::jsonb,
  'drafts, other stores'' items and unknown items are not for sale'
);

-- Requests that should never reach the database.
select throws_ok(
  $$ select public.place_order('c0000000-0000-4000-8000-000000000000',
       'd0000000-0000-4000-8000-000000000005', pg_temp.customer(),
       '[{"variant_id":"c4000000-0000-4000-8000-000000000001","qty":1,"unit_price_paise":500000}]') $$,
  'P0002', null, 'a suspended store takes no orders'
);
select throws_ok(
  $$ select public.place_order('a0000000-0000-4000-8000-000000000000',
       'd0000000-0000-4000-8000-000000000006', pg_temp.customer(), '[]') $$,
  '22023', null, 'an empty bag is refused'
);
select throws_ok(
  $$ select public.place_order('a0000000-0000-4000-8000-000000000000',
       'd0000000-0000-4000-8000-000000000006', pg_temp.customer(),
       '[{"variant_id":"a4000000-0000-4000-8000-000000000001","qty":11,"unit_price_paise":1000000}]') $$,
  '22023', null, 'more than 10 of one item is refused'
);
select throws_ok(
  $$ select public.place_order('a0000000-0000-4000-8000-000000000000',
       'd0000000-0000-4000-8000-000000000006', pg_temp.customer(),
       '[{"variant_id":"a4000000-0000-4000-8000-000000000001","qty":1.5,"unit_price_paise":1000000}]') $$,
  '22023', null, 'part of an item is refused'
);
select throws_ok(
  $$ select public.place_order('a0000000-0000-4000-8000-000000000000',
       'd0000000-0000-4000-8000-000000000006', pg_temp.customer(),
       '[{"variant_id":"a4000000-0000-4000-8000-000000000001","qty":1,"unit_price_paise":1000000},
         {"variant_id":"a4000000-0000-4000-8000-000000000001","qty":1,"unit_price_paise":1000000}]') $$,
  '22023', null, 'the same item on two lines is refused'
);
select throws_ok(
  $$ select public.place_order('a0000000-0000-4000-8000-000000000000',
       'd0000000-0000-4000-8000-000000000006', pg_temp.customer('{"phone":"12345"}'), pg_temp.bag()) $$,
  '22023', null, 'a bad phone number is refused'
);

-- Order numbers count per store.
select is(
  (public.place_order('b0000000-0000-4000-8000-000000000000',
     'd0000000-0000-4000-8000-000000000001', pg_temp.customer(),
     '[{"variant_id":"b4000000-0000-4000-8000-000000000001","qty":1,"unit_price_paise":500000}]')
   ->> 'order_number')::int,
  1001, 'each store numbers its own orders, and checkout ids are per store'
);
reset role;

-- Each store's team sees only its own orders.
set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-4000-8000-000000000000","role":"authenticated"}';
select results_eq(
  $$ select customer_name, (select count(*)::int from public.order_items) from public.orders $$,
  $$ values ('Lakshmi Iyer', 4) $$,
  'a store''s owner sees its order and lines'
);
set local request.jwt.claims to '{"sub":"b1000000-0000-4000-8000-000000000000","role":"authenticated"}';
select is(
  (select count(*)::int from public.order_items),
  1, 'and not another store''s'
);
reset role;

select * from finish();
rollback;
