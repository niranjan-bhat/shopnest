-- set_order_status and set_order_prices: merchants move orders one step at
-- a time; confirming takes tracked stock (or lists what is short) and
-- cancelling a confirmed order returns it; price-on-request lines are
-- priced before confirming. Other stores and shoppers have no access.
-- Rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;

select plan(31);

delete from public.tenants;

insert into public.tenants (id, slug, name, status, whatsapp_number) values
  ('a0000000-0000-4000-8000-000000000000', 'store-a', 'Store A', 'active', '+910000000101'),
  ('b0000000-0000-4000-8000-000000000000', 'store-b', 'Store B', 'active', '+910000000102');
insert into auth.users (id, email) values
  ('a1000000-0000-4000-8000-000000000000', 'owner-a@test.local'),
  ('b1000000-0000-4000-8000-000000000000', 'owner-b@test.local');
insert into public.tenant_members (tenant_id, user_id, role) values
  ('a0000000-0000-4000-8000-000000000000', 'a1000000-0000-4000-8000-000000000000', 'owner'),
  ('b0000000-0000-4000-8000-000000000000', 'b1000000-0000-4000-8000-000000000000', 'owner');

-- A saree (tracked, 3 left), a dupatta (not tracked) and a necklace on request.
insert into public.products (id, tenant_id, name, slug, status, price_mode, price_paise) values
  ('a3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000000', 'Silk saree', 'silk-saree', 'active', 'fixed', 1000000),
  ('a3000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000000', 'Dupatta', 'dupatta', 'active', 'fixed', 150000),
  ('a3000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000000', 'Necklace', 'necklace', 'active', 'on_request', null);
insert into public.product_variants (id, tenant_id, product_id, stock_qty, track_inventory) values
  ('a4000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000000', 'a3000000-0000-4000-8000-000000000001', 3, true),
  ('a4000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000000', 'a3000000-0000-4000-8000-000000000002', 0, false),
  ('a4000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000000', 'a3000000-0000-4000-8000-000000000003', 1, true);

create function pg_temp.place(checkout text, items jsonb) returns uuid
language sql as $$
  select (public.place_order(
    'a0000000-0000-4000-8000-000000000000', checkout::uuid,
    '{"name":"Lakshmi Iyer","phone":"+919876543210","address":{"line1":"12 Gandhi Road","city":"Kanchipuram","state":"Tamil Nadu","pincode":"631502"}}',
    items) ->> 'order_id')::uuid;
$$;
create function pg_temp.stock(variant text) returns int
language sql as $$
  select stock_qty from public.product_variants where id = variant::uuid;
$$;
create table pg_temp.ids (name text primary key, id uuid);
grant all on pg_temp.ids to authenticated, service_role;
grant execute on function pg_temp.stock(text) to authenticated;

-- Order 1: saree × 2, dupatta × 4, necklace × 1 (on request).
-- Order 2: saree × 2 (together with order 1, more than the 3 in stock).
set local role service_role;
insert into pg_temp.ids values
  ('one', pg_temp.place('d0000000-0000-4000-8000-000000000001', '[
     {"variant_id":"a4000000-0000-4000-8000-000000000001","qty":2,"unit_price_paise":1000000},
     {"variant_id":"a4000000-0000-4000-8000-000000000002","qty":4,"unit_price_paise":150000},
     {"variant_id":"a4000000-0000-4000-8000-000000000003","qty":1,"unit_price_paise":null}]')),
  ('two', pg_temp.place('d0000000-0000-4000-8000-000000000002', '[
     {"variant_id":"a4000000-0000-4000-8000-000000000001","qty":2,"unit_price_paise":1000000}]'));
insert into pg_temp.ids
select 'necklace-line', id from public.order_items
 where order_id = (select id from pg_temp.ids where name = 'one') and name_snapshot = 'Necklace';
insert into pg_temp.ids
select 'saree-line', id from public.order_items
 where order_id = (select id from pg_temp.ids where name = 'one') and name_snapshot = 'Silk saree';
reset role;

select results_eq(
  $$ select name_snapshot, price_on_request from public.order_items
      where order_id = (select id from pg_temp.ids where name = 'one') order by position $$,
  $$ values ('Silk saree', false), ('Dupatta', false), ('Necklace', true) $$,
  'lines remember which were on request'
);

-- Shoppers and other stores cannot touch the order.
set local role anon;
select throws_ok(
  $$ select public.set_order_status('a0000000-0000-4000-8000-000000000000',
       (select id from pg_temp.ids where name = 'one'), 'confirmed') $$,
  '42501', null, 'shoppers cannot change an order'
);
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"b1000000-0000-4000-8000-000000000000","role":"authenticated"}';
select throws_ok(
  $$ select public.set_order_status('a0000000-0000-4000-8000-000000000000',
       (select id from pg_temp.ids where name = 'one'), 'confirmed') $$,
  '42501', null, 'another store cannot change it'
);
select throws_ok(
  $$ select public.set_order_status('b0000000-0000-4000-8000-000000000000',
       (select id from pg_temp.ids where name = 'one'), 'confirmed') $$,
  'P0002', null, 'nor reach it through its own store'
);
select throws_ok(
  $$ select public.set_order_prices('a0000000-0000-4000-8000-000000000000',
       (select id from pg_temp.ids where name = 'one'), '[]') $$,
  '42501', null, 'nor price it'
);

-- The store's owner.
set local request.jwt.claims to '{"sub":"a1000000-0000-4000-8000-000000000000","role":"authenticated"}';

select throws_ok(
  $$ update public.orders set status = 'confirmed'
      where id = (select id from pg_temp.ids where name = 'one') $$,
  '42501', null, 'status cannot be changed directly, past the stock'
);
select throws_ok(
  $$ update public.orders set notes = 'Rewritten'
      where id = (select id from pg_temp.ids where name = 'one') $$,
  '42501', null, 'the customer''s note cannot be rewritten'
);
select lives_ok(
  $$ update public.orders set staff_notes = 'Gift wrap'
      where id = (select id from pg_temp.ids where name = 'one') $$,
  'the store''s own notes can be edited'
);

select is(
  public.set_order_status('a0000000-0000-4000-8000-000000000000',
    (select id from pg_temp.ids where name = 'one'), 'confirmed'),
  '{"status": "needs_prices"}'::jsonb,
  'an order with an unpriced line cannot be confirmed'
);
select throws_ok(
  $$ select public.set_order_prices('a0000000-0000-4000-8000-000000000000',
       (select id from pg_temp.ids where name = 'one'),
       jsonb_build_array(jsonb_build_object('item_id', (select id from pg_temp.ids where name = 'saree-line'), 'unit_price_paise', 1))) $$,
  '22023', null, 'lines with a fixed price cannot be repriced'
);
select throws_ok(
  $$ select public.set_order_prices('a0000000-0000-4000-8000-000000000000',
       (select id from pg_temp.ids where name = 'one'),
       jsonb_build_array(jsonb_build_object('item_id', (select id from pg_temp.ids where name = 'necklace-line'), 'unit_price_paise', 10.5))) $$,
  '22023', null, 'part of a paisa is refused'
);
select lives_ok(
  $$ select public.set_order_prices('a0000000-0000-4000-8000-000000000000',
       (select id from pg_temp.ids where name = 'one'),
       jsonb_build_array(jsonb_build_object('item_id', (select id from pg_temp.ids where name = 'necklace-line'), 'unit_price_paise', 4500000))) $$,
  'the agreed price is entered'
);
-- 2 × 10,000 + 4 × 1,500 + 45,000
select results_eq(
  $$ select subtotal_paise, total_paise from public.orders
      where id = (select id from pg_temp.ids where name = 'one') $$,
  $$ values (7100000::bigint, 7100000::bigint) $$,
  'and the totals follow'
);

-- Moves that skip a step are refused.
select throws_ok(
  $$ select public.set_order_status('a0000000-0000-4000-8000-000000000000',
       (select id from pg_temp.ids where name = 'one'), 'shipped') $$,
  '22023', null, 'a pending order cannot jump to shipped'
);

-- Confirm: tracked stock goes down; untracked stock is left alone.
select is(
  public.set_order_status('a0000000-0000-4000-8000-000000000000',
    (select id from pg_temp.ids where name = 'one'), 'confirmed'),
  '{"status": "ok"}'::jsonb, 'the order is confirmed'
);
select is(pg_temp.stock('a4000000-0000-4000-8000-000000000001'), 1, 'the saree stock drops by 2');
select is(pg_temp.stock('a4000000-0000-4000-8000-000000000003'), 0, 'the necklace stock drops by 1');
select is(pg_temp.stock('a4000000-0000-4000-8000-000000000002'), 0, 'untracked stock is left alone');
select is(
  public.set_order_status('a0000000-0000-4000-8000-000000000000',
    (select id from pg_temp.ids where name = 'one'), 'confirmed'),
  '{"status": "ok"}'::jsonb, 'confirming again changes nothing'
);
select is(pg_temp.stock('a4000000-0000-4000-8000-000000000001'), 1, 'and takes no more stock');
select throws_ok(
  $$ select public.set_order_prices('a0000000-0000-4000-8000-000000000000',
       (select id from pg_temp.ids where name = 'one'),
       jsonb_build_array(jsonb_build_object('item_id', (select id from pg_temp.ids where name = 'necklace-line'), 'unit_price_paise', 1))) $$,
  '22023', null, 'prices are fixed once confirmed'
);

-- Not enough left for the second order: nothing moves.
select is(
  public.set_order_status('a0000000-0000-4000-8000-000000000000',
    (select id from pg_temp.ids where name = 'two'), 'confirmed'),
  '{"status": "short", "lines": [{"name": "Silk saree", "options": {}, "qty": 2, "available": 1}]}'::jsonb,
  'a short line is reported with what is left'
);
select is(
  (select status::text from public.orders where id = (select id from pg_temp.ids where name = 'two')),
  'pending', 'and the order stays pending'
);
select is(pg_temp.stock('a4000000-0000-4000-8000-000000000001'), 1, 'and no stock is taken');

-- Cancelling a pending order moves no stock.
select is(
  public.set_order_status('a0000000-0000-4000-8000-000000000000',
    (select id from pg_temp.ids where name = 'two'), 'cancelled') ->> 'status',
  'ok', 'a pending order is cancelled'
);
select is(pg_temp.stock('a4000000-0000-4000-8000-000000000001'), 1, 'without touching stock');

-- Packed, then cancelled: the stock comes back.
select is(
  public.set_order_status('a0000000-0000-4000-8000-000000000000',
    (select id from pg_temp.ids where name = 'one'), 'packed') ->> 'status',
  'ok', 'a confirmed order is packed'
);
select is(
  public.set_order_status('a0000000-0000-4000-8000-000000000000',
    (select id from pg_temp.ids where name = 'one'), 'cancelled') ->> 'status',
  'ok', 'and cancelled'
);
select is(pg_temp.stock('a4000000-0000-4000-8000-000000000001'), 3, 'the saree stock is returned');
select is(pg_temp.stock('a4000000-0000-4000-8000-000000000003'), 1, 'and the necklace stock');
select throws_ok(
  $$ select public.set_order_status('a0000000-0000-4000-8000-000000000000',
       (select id from pg_temp.ids where name = 'one'), 'confirmed') $$,
  '22023', null, 'a cancelled order stays cancelled'
);
reset role;

select * from finish();
rollback;
