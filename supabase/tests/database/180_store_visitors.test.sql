-- Store visitors: people are counted once a day, per store, and merchants
-- see only their own store's totals. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(21);

delete from public.tenants;
insert into public.tenants (id, slug, name, status, whatsapp_number) values
  ('a0000000-0000-4000-8000-000000000000', 'store-a', 'Store A', 'active', '+910000000101'),
  ('b0000000-0000-4000-8000-000000000000', 'store-b', 'Store B', 'active', '+910000000102'),
  ('c0000000-0000-4000-8000-000000000000', 'store-c', 'Store C', 'onboarding', '+910000000103');
insert into auth.users (id, email) values
  ('a1000000-0000-4000-8000-000000000000', 'owner-a@test.local'),
  ('b1000000-0000-4000-8000-000000000000', 'owner-b@test.local'),
  ('e1000000-0000-4000-8000-000000000000', 'admin@test.local');
update public.profiles set is_super_admin = true
 where user_id = 'e1000000-0000-4000-8000-000000000000';
insert into public.tenant_members (tenant_id, user_id, role) values
  ('a0000000-0000-4000-8000-000000000000', 'a1000000-0000-4000-8000-000000000000', 'owner'),
  ('b0000000-0000-4000-8000-000000000000', 'b1000000-0000-4000-8000-000000000000', 'owner');
insert into public.products (id, tenant_id, name, slug, status, price_mode, price_paise) values
  ('a3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000000', 'Saree', 'saree', 'active', 'fixed', 100),
  ('a3000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000000', 'Draft', 'draft', 'draft', 'fixed', 100),
  ('b3000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000000', 'B saree', 'b-saree', 'active', 'fixed', 100);

-- Person p, on network n, does something in store a, b or c.
create function pg_temp.does(store text, p int, event text, product uuid default null, n int default 1)
returns void
language sql as $$
  select public.record_store_visit(
    (store || '0000000-0000-4000-8000-000000000000')::uuid,
    lpad(p::text, 64, '0'), lpad(n::text, 64, 'a'), event, product);
$$;
grant execute on function pg_temp.does(text, int, text, uuid, int) to service_role;

select ok(not has_function_privilege('anon', 'public.record_store_visit(uuid, text, text, text, uuid)', 'execute'), 'anon cannot record visits');
select ok(not has_function_privilege('authenticated', 'public.record_store_visit(uuid, text, text, text, uuid)', 'execute'), 'users cannot record visits');
select ok(not has_table_privilege('authenticated', 'public.store_visit_keys', 'select'), 'users cannot read the hashes');
select ok(not has_table_privilege('anon', 'public.store_visits', 'select'), 'anon cannot read totals');
select ok(not has_table_privilege('authenticated', 'public.store_visits', 'insert,update,delete'), 'users cannot change totals');

set local role service_role;
do $$ begin
  perform pg_temp.does('a', 1, 'visit');
  perform pg_temp.does('a', 1, 'visit');
  perform pg_temp.does('a', 2, 'visit');
  perform pg_temp.does('b', 1, 'visit');
  -- Straight to a product or a chat is a visit too.
  perform pg_temp.does('a', 3, 'product', 'a3000000-0000-4000-8000-000000000001');
  perform pg_temp.does('a', 3, 'product', 'a3000000-0000-4000-8000-000000000001');
  perform pg_temp.does('a', 1, 'product', 'a3000000-0000-4000-8000-000000000001');
  perform pg_temp.does('a', 1, 'product', 'a3000000-0000-4000-8000-000000000002');
  perform pg_temp.does('a', 1, 'product', 'b3000000-0000-4000-8000-000000000001');
  perform pg_temp.does('a', 1, 'product');
  perform pg_temp.does('a', 1, 'bag');
  perform pg_temp.does('a', 1, 'bag');
  perform pg_temp.does('a', 2, 'chat');
  perform pg_temp.does('c', 1, 'visit');
end $$;
select throws_ok($$ select pg_temp.does('a', 1, 'other') $$, '22023', null, 'an unknown event is refused');
reset role;

select is((select visitors from public.store_visits where tenant_id = 'a0000000-0000-4000-8000-000000000000'), 3, 'each person once');
select is((select visitors from public.store_visits where tenant_id = 'b0000000-0000-4000-8000-000000000000'), 1, 'per store');
select is((select count(*) from public.store_visits where tenant_id = 'c0000000-0000-4000-8000-000000000000'), 0::bigint, 'nothing for a store that is not live');
select results_eq($$ select product_id, visitors from public.store_product_visits $$, $$ values ('a3000000-0000-4000-8000-000000000001'::uuid, 2) $$, 'people per product, only the store''s products on sale');
select results_eq($$ select bag, chats from public.store_visits where tenant_id = 'a0000000-0000-4000-8000-000000000000' $$, $$ values (1, 1) $$, 'bag and chats once each');

-- One network inventing people.
set local role service_role;
do $$ begin
  for i in 1001..1310 loop perform pg_temp.does('b', i, 'visit', null, 2); end loop;
end $$;
reset role;
select is((select visitors from public.store_visits where tenant_id = 'b0000000-0000-4000-8000-000000000000'), 301, 'a network is limited to 300 people a day');

-- A new day: counted again; old hashes go, totals stay.
update public.store_visit_keys set day = day - 2;
update public.store_visits set day = day - 2;
set local role service_role;
do $$ begin perform pg_temp.does('a', 1, 'visit'); end $$;
reset role;
select is((select count(*) from public.store_visits where tenant_id = 'a0000000-0000-4000-8000-000000000000'), 2::bigint, 'a new day has its own total');
select is((select count(*) from public.store_visit_keys), 1::bigint, 'old hashes are deleted');

-- Reading
set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-4000-8000-000000000000","role":"authenticated"}';
select is((select count(distinct tenant_id) from public.store_visits), 1::bigint, 'a merchant sees one store');
select throws_ok($$ select public.store_visitor_stats('b0000000-0000-4000-8000-000000000000', 7) $$, '42501', null, 'and not another''s numbers');
select is(jsonb_array_length(public.store_visitor_stats('a0000000-0000-4000-8000-000000000000', 7) -> 'daily'), 7, 'every day is listed');
select is((select sum((d ->> 'visitors')::int) from jsonb_array_elements(public.store_visitor_stats('a0000000-0000-4000-8000-000000000000', 7) -> 'daily') d), 4::bigint, 'with its visitors');
select is(public.store_visitor_stats('a0000000-0000-4000-8000-000000000000', 1) -> 'daily' -> 0 ->> 'visitors', '1', 'today alone');
select is(public.store_visitor_stats('a0000000-0000-4000-8000-000000000000', 7) -> 'products' -> 0 ->> 'name', 'Saree', 'the most viewed product');
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"e1000000-0000-4000-8000-000000000000","role":"authenticated"}';
select lives_ok($$ select public.store_visitor_stats('b0000000-0000-4000-8000-000000000000', 30) $$, 'a super admin sees any store');

select * from finish();
rollback;
