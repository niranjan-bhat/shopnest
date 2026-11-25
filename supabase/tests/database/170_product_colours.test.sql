-- Photo colours: members tag their own store's photos only. Rolled back.
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
  ('a3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000000', 'A', 'a', 'active', 'fixed', 100),
  ('b3000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000000', 'B', 'b', 'active', 'fixed', 100);
insert into public.product_images (id, tenant_id, product_id, r2_key) values
  ('a5000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000000', 'a3000000-0000-4000-8000-000000000001', 'tenants/a0000000-0000-4000-8000-000000000000/1.webp'),
  ('b5000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000000', 'b3000000-0000-4000-8000-000000000001', 'tenants/b0000000-0000-4000-8000-000000000000/1.webp');

select is((select count(*) from public.product_images where colour is not null), 0::bigint, 'a new photo has no colour');

set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-4000-8000-000000000000","role":"authenticated"}';
update public.product_images set colour = 'Red';
select throws_ok($$ update public.product_images set colour = ' ' $$, '23514', null, 'a blank colour is refused');
reset role;

select is((select colour from public.product_images where id = 'a5000000-0000-4000-8000-000000000001'), 'Red', 'a member tags their photo');
select is((select colour from public.product_images where id = 'b5000000-0000-4000-8000-000000000001'), null, 'another store''s photo is untouched');
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select is((select colour from public.product_images where id = 'a5000000-0000-4000-8000-000000000001'), 'Red', 'shoppers see the tag');
select throws_ok($$ update public.product_images set colour = 'Blue' $$, '42501', null, 'shoppers cannot change it');

select * from finish();
rollback;
