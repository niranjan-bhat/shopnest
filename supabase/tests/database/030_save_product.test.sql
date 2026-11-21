-- save_product: members create and edit products atomically; other stores'
-- categories, variants and products are out of reach. Rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

delete from public.tenants;

insert into public.tenants (id, slug, name, status, whatsapp_number) values
  ('a0000000-0000-4000-8000-000000000000', 'store-a', 'Store A', 'active', '+910000000101'),
  ('b0000000-0000-4000-8000-000000000000', 'store-b', 'Store B', 'active', '+910000000102');
insert into auth.users (id, email) values
  ('a1000000-0000-4000-8000-000000000000', 'owner-a@test.local');
insert into public.tenant_members (tenant_id, user_id, role) values
  ('a0000000-0000-4000-8000-000000000000', 'a1000000-0000-4000-8000-000000000000', 'owner');

insert into public.categories (id, tenant_id, name, slug) values
  ('a2000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000000', 'Silk', 'silk'),
  ('a2000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000000', 'Cotton', 'cotton'),
  ('b2000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000000', 'B silk', 'silk');

-- A product of store B, with one variant.
insert into public.products (id, tenant_id, name, slug, status, price_mode, price_paise) values
  ('b3000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000000', 'B saree', 'b-saree', 'active', 'fixed', 100000);
insert into public.product_variants (id, tenant_id, product_id, stock_qty) values
  ('b4000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000000', 'b3000000-0000-4000-8000-000000000001', 3);

-- The payload the dashboard sends, with overrides.
create function pg_temp.payload(extra jsonb default '{}') returns jsonb
language sql as $$
  select jsonb_build_object(
    'name', 'Kurta set', 'slug', 'kurta-set', 'description', 'Cotton kurta',
    'price_mode', 'fixed', 'price_paise', 249900, 'compare_at_paise', null,
    'status', 'draft', 'is_featured', false,
    'attributes', '{"fabric":"Cotton"}'::jsonb, 'seo', '{}'::jsonb,
    'category_ids', '["a2000000-0000-4000-8000-000000000001"]'::jsonb,
    'variants', '[
      {"id":null,"sku":"KS-S","options":{"size":"S"},"price_paise":null,"stock_qty":4,"track_inventory":true},
      {"id":null,"sku":"KS-M","options":{"size":"M"},"price_paise":null,"stock_qty":2,"track_inventory":true}
    ]'::jsonb
  ) || extra;
$$;
grant execute on function pg_temp.payload(jsonb) to anon, authenticated;
create table pg_temp.ids (name text primary key, id uuid);
grant all on pg_temp.ids to authenticated;

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok(
  $$ select public.save_product('a0000000-0000-4000-8000-000000000000', pg_temp.payload()) $$,
  '42501', null, 'anon cannot save products'
);
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-4000-8000-000000000000","role":"authenticated"}';

-- Create.
insert into pg_temp.ids
select 'product', public.save_product('a0000000-0000-4000-8000-000000000000', pg_temp.payload());
select isnt((select id from pg_temp.ids where name = 'product'), null, 'an owner creates a product');
select results_eq(
  $$ select sku from public.product_variants
      where product_id = (select id from pg_temp.ids where name = 'product') order by sku $$,
  $$ values ('KS-M'), ('KS-S') $$,
  'its variants are created'
);
select is(
  (select count(*)::int from public.product_categories
    where product_id = (select id from pg_temp.ids where name = 'product')),
  1, 'its category is linked'
);

-- Edit: keep S (by id, new stock), drop M, add L; switch category.
insert into pg_temp.ids
select 'variant-s', id from public.product_variants
 where product_id = (select id from pg_temp.ids where name = 'product') and sku = 'KS-S';
select lives_ok(
  format($$ select public.save_product('a0000000-0000-4000-8000-000000000000', pg_temp.payload(%L), %L) $$,
    jsonb_build_object(
      'name', 'Kurta set (new)',
      'category_ids', '["a2000000-0000-4000-8000-000000000002"]'::jsonb,
      'variants', jsonb_build_array(
        jsonb_build_object('id', (select id from pg_temp.ids where name = 'variant-s'),
          'sku', 'KS-S', 'options', '{"size":"S"}'::jsonb, 'price_paise', null,
          'stock_qty', 9, 'track_inventory', true),
        '{"id":null,"sku":"KS-L","options":{"size":"L"},"price_paise":259900,"stock_qty":1,"track_inventory":true}'::jsonb
      ))::text,
    (select id from pg_temp.ids where name = 'product')),
  'an owner edits the product'
);
select results_eq(
  $$ select sku, stock_qty from public.product_variants
      where product_id = (select id from pg_temp.ids where name = 'product') order by sku $$,
  $$ values ('KS-L', 1), ('KS-S', 9) $$,
  'removed variants go, new ones arrive, kept ones are updated'
);
select is(
  (select id from public.product_variants where sku = 'KS-S'),
  (select id from pg_temp.ids where name = 'variant-s'),
  'a kept variant keeps its id'
);
select results_eq(
  $$ select category_id from public.product_categories
      where product_id = (select id from pg_temp.ids where name = 'product') $$,
  $$ values ('a2000000-0000-4000-8000-000000000002'::uuid) $$,
  'category links are replaced'
);

-- Refusals.
select throws_ok(
  $$ select public.save_product('a0000000-0000-4000-8000-000000000000', pg_temp.payload('{"slug":"other","variants":[]}')) $$,
  '22023', null, 'a product without variants is refused'
);
select throws_ok(
  $$ select public.save_product('a0000000-0000-4000-8000-000000000000', pg_temp.payload('{"slug":"other","category_ids":["b2000000-0000-4000-8000-000000000001"]}')) $$,
  '23503', null, 'another store''s category is refused'
);
select throws_ok(
  $$ select public.save_product('a0000000-0000-4000-8000-000000000000',
       pg_temp.payload('{"variants":[{"id":"b4000000-0000-4000-8000-000000000001","sku":null,"options":{},"price_paise":null,"stock_qty":1,"track_inventory":true}]}'),
       (select id from pg_temp.ids where name = 'product')) $$,
  '22023', null, 'another product''s variant is refused'
);
select throws_ok(
  $$ select public.save_product('a0000000-0000-4000-8000-000000000000', pg_temp.payload()) $$,
  '23505', null, 'a taken slug is refused'
);
select throws_ok(
  $$ select public.save_product('b0000000-0000-4000-8000-000000000000', pg_temp.payload()) $$,
  '42501', null, 'an owner cannot save into another store'
);
select throws_ok(
  $$ select public.save_product('a0000000-0000-4000-8000-000000000000',
       pg_temp.payload('{"slug":"stolen"}'), 'b3000000-0000-4000-8000-000000000001') $$,
  'P0002', null, 'an owner cannot edit another store''s product'
);
reset role;

select * from finish();
rollback;
