-- reorder_product_images: members reorder their own product's photos only.
begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

delete from public.tenants;

insert into public.tenants (id, slug, name, status, whatsapp_number) values
  ('a0000000-0000-4000-8000-000000000000', 'store-a', 'Store A', 'active', '+910000000101'),
  ('b0000000-0000-4000-8000-000000000000', 'store-b', 'Store B', 'active', '+910000000102');
insert into auth.users (id, email) values
  ('a1000000-0000-4000-8000-000000000000', 'owner-a@test.local');
insert into public.tenant_members (tenant_id, user_id, role) values
  ('a0000000-0000-4000-8000-000000000000', 'a1000000-0000-4000-8000-000000000000', 'owner');

insert into public.products (id, tenant_id, name, slug, status, price_mode, price_paise) values
  ('a3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000000', 'A one', 'a-one', 'active', 'fixed', 100),
  ('a3000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000000', 'A two', 'a-two', 'active', 'fixed', 100),
  ('b3000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000000', 'B one', 'b-one', 'active', 'fixed', 100);

insert into public.product_images (id, tenant_id, product_id, r2_key, position) values
  ('a5000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000000', 'a3000000-0000-4000-8000-000000000001', 'tenants/a0000000-0000-4000-8000-000000000000/products/p/1.webp', 0),
  ('a5000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000000', 'a3000000-0000-4000-8000-000000000001', 'tenants/a0000000-0000-4000-8000-000000000000/products/p/2.webp', 1),
  ('a5000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000000', 'a3000000-0000-4000-8000-000000000002', 'tenants/a0000000-0000-4000-8000-000000000000/products/q/1.webp', 0),
  ('b5000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000000', 'b3000000-0000-4000-8000-000000000001', 'tenants/b0000000-0000-4000-8000-000000000000/products/p/1.webp', 0);

set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-4000-8000-000000000000","role":"authenticated"}';

select lives_ok(
  $$ select public.reorder_product_images('a0000000-0000-4000-8000-000000000000',
       'a3000000-0000-4000-8000-000000000001', array[
       'a5000000-0000-4000-8000-000000000002',
       'a5000000-0000-4000-8000-000000000001']::uuid[]) $$,
  'an owner reorders a product''s photos'
);
select results_eq(
  $$ select id::text from public.product_images
      where product_id = 'a3000000-0000-4000-8000-000000000001' order by position $$,
  $$ values ('a5000000-0000-4000-8000-000000000002'), ('a5000000-0000-4000-8000-000000000001') $$,
  'the second photo is now the cover'
);
select throws_ok(
  $$ select public.reorder_product_images('a0000000-0000-4000-8000-000000000000',
       'a3000000-0000-4000-8000-000000000001',
       array['a5000000-0000-4000-8000-000000000001']::uuid[]) $$,
  '22023', null, 'a list missing a photo is refused'
);
select throws_ok(
  $$ select public.reorder_product_images('a0000000-0000-4000-8000-000000000000',
       'a3000000-0000-4000-8000-000000000001', array[
       'a5000000-0000-4000-8000-000000000001',
       'a5000000-0000-4000-8000-000000000003']::uuid[]) $$,
  '22023', null, 'another product''s photo cannot be slipped in'
);
select throws_ok(
  $$ select public.reorder_product_images('b0000000-0000-4000-8000-000000000000',
       'b3000000-0000-4000-8000-000000000001',
       array['b5000000-0000-4000-8000-000000000001']::uuid[]) $$,
  '42501', null, 'an owner cannot reorder another store''s photos'
);
reset role;

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok(
  $$ select public.reorder_product_images('a0000000-0000-4000-8000-000000000000',
       'a3000000-0000-4000-8000-000000000001',
       array['a5000000-0000-4000-8000-000000000001']::uuid[]) $$,
  '42501', null, 'anon cannot reorder'
);
reset role;

select * from finish();
rollback;
