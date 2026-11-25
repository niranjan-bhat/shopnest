-- save_product: an edit never overwrites stock or details that changed
-- meanwhile. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

delete from public.tenants;
insert into public.tenants (id, slug, name, status, whatsapp_number) values
  ('a0000000-0000-4000-8000-000000000000', 'store-a', 'Store A', 'active', '+910000000101');
insert into auth.users (id, email) values
  ('a1000000-0000-4000-8000-000000000000', 'owner-a@test.local');
insert into public.tenant_members (tenant_id, user_id, role) values
  ('a0000000-0000-4000-8000-000000000000', 'a1000000-0000-4000-8000-000000000000', 'owner');
insert into public.products (id, tenant_id, name, slug, status, price_mode, price_paise) values
  ('a3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000000', 'Saree', 'saree', 'active', 'fixed', 100000);
-- The real stock is 3.
insert into public.product_variants (id, tenant_id, product_id, stock_qty) values
  ('a4000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000000', 'a3000000-0000-4000-8000-000000000001', 3);

-- Saves with this stock, the stock the form showed, and other changes.
create function pg_temp.save(stock int, was int, extra jsonb default '{}')
returns uuid
language sql as $$
  select public.save_product('a0000000-0000-4000-8000-000000000000',
    jsonb_build_object(
      'name', 'Saree', 'slug', 'saree', 'price_mode', 'fixed',
      'price_paise', 100000, 'status', 'active', 'is_featured', false,
      'variants', jsonb_build_array(jsonb_build_object(
        'id', 'a4000000-0000-4000-8000-000000000001', 'options', '{}'::jsonb,
        'stock_qty', stock, 'stock_was', was, 'track_inventory', true))
    ) || extra,
    'a3000000-0000-4000-8000-000000000001');
$$;
create function pg_temp.stock() returns int language sql as $$
  select stock_qty from public.product_variants
   where id = 'a4000000-0000-4000-8000-000000000001';
$$;
-- The detail of the conflict error.
create function pg_temp.conflict() returns text language plpgsql as $$
declare found text;
begin
  perform pg_temp.save(10, 5);
  return null;
exception when sqlstate 'ZL005' then
  get stacked diagnostics found = pg_exception_detail;
  return found;
end;
$$;
grant execute on function pg_temp.save(int, int, jsonb), pg_temp.stock(), pg_temp.conflict() to authenticated;

set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-4000-8000-000000000000","role":"authenticated"}';

select lives_ok($$ select pg_temp.save(5, 5, '{"name":"New name"}') $$, 'editing something else saves');
select is(pg_temp.stock(), 3, 'and leaves the stock where an order put it');
select is((select name from public.products), 'New name', 'the edit is saved');

select throws_ok($$ select pg_temp.save(10, 5, '{"name":"Lost"}') $$, 'ZL005', null, 'changing a number that moved is refused');
select is((select name from public.products), 'New name', 'and saves nothing');
select is(pg_temp.conflict()::jsonb, '[{"id":"a4000000-0000-4000-8000-000000000001","stock":3}]'::jsonb, 'the stock now is reported');

select lives_ok($$ select pg_temp.save(3, 5) $$, 'typing the number it already is saves');
select lives_ok($$ select pg_temp.save(10, 3) $$, 'restocking from the real number saves');
select is(pg_temp.stock(), 10, 'and sets it');

select throws_ok($$ select pg_temp.save(10, 10, '{"seen_updated_at":"2020-01-01T00:00:00+00:00"}') $$, 'ZL004', null, 'a product saved elsewhere meanwhile is refused');
select lives_ok($$ select pg_temp.save(10, 10, jsonb_build_object('seen_updated_at', (select updated_at from public.products))) $$, 'an unchanged one saves');

do $$ begin perform pg_temp.save(7, null); end $$;
select is(pg_temp.stock(), 7, 'without stock_was it works as before');

select * from finish();
rollback;
