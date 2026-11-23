-- Tenant isolation: a user of store A must never read or change store B's
-- data, and anonymous visitors see only live, public storefront data.
-- Runs in a transaction that is rolled back; fixtures are created here.
begin;
create extension if not exists pgtap with schema extensions;

select plan(37);

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres, which bypasses RLS)
-- ---------------------------------------------------------------------------

-- Start from no stores at all, so counts below see only these fixtures. The
-- seed's demo stores (and everything that cascades from them) come back when
-- the transaction rolls back.
delete from public.tenants;

-- Stores: A and B are live, C is suspended.
insert into public.tenants (id, slug, name, status, whatsapp_number) values
  ('a0000000-0000-4000-8000-000000000000', 'store-a', 'Store A', 'active', '+910000000101'),
  ('b0000000-0000-4000-8000-000000000000', 'store-b', 'Store B', 'active', '+910000000102'),
  ('c0000000-0000-4000-8000-000000000000', 'store-c', 'Store C', 'suspended', '+910000000103');

insert into public.tenant_domains (tenant_id, hostname, kind, is_primary) values
  ('a0000000-0000-4000-8000-000000000000', 'store-a.test.local', 'subdomain', true),
  ('b0000000-0000-4000-8000-000000000000', 'store-b.test.local', 'subdomain', true),
  ('c0000000-0000-4000-8000-000000000000', 'store-c.test.local', 'subdomain', true);

insert into public.templates (key, name) values ('test-template', 'Test')
  on conflict do nothing;
insert into public.tenant_themes (tenant_id, template_key, draft, published) values
  ('a0000000-0000-4000-8000-000000000000', 'test-template', '{"v":"a-draft"}', '{"v":"a-live"}'),
  ('b0000000-0000-4000-8000-000000000000', 'test-template', '{"v":"b-draft"}', null);

-- Users: owner of A, owner of B, an outsider and a super admin. The
-- on_auth_user_created trigger creates their profiles.
insert into auth.users (id, email) values
  ('a1000000-0000-4000-8000-000000000000', 'owner-a@test.local'),
  ('b1000000-0000-4000-8000-000000000000', 'owner-b@test.local'),
  ('d1000000-0000-4000-8000-000000000000', 'outsider@test.local'),
  ('e1000000-0000-4000-8000-000000000000', 'admin@test.local');
update public.profiles set is_super_admin = true
 where user_id = 'e1000000-0000-4000-8000-000000000000';
insert into public.tenant_members (tenant_id, user_id, role) values
  ('a0000000-0000-4000-8000-000000000000', 'a1000000-0000-4000-8000-000000000000', 'owner'),
  ('b0000000-0000-4000-8000-000000000000', 'b1000000-0000-4000-8000-000000000000', 'owner');

insert into public.categories (id, tenant_id, name, slug, is_active) values
  ('a2000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000000', 'A silk', 'silk', true),
  ('a2000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000000', 'A hidden', 'hidden', false),
  ('b2000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000000', 'B silk', 'silk', true);

insert into public.products (id, tenant_id, name, slug, status, price_mode, price_paise) values
  ('a3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000000', 'A live', 'a-live', 'active', 'fixed', 100000),
  ('a3000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000000', 'A draft', 'a-draft', 'draft', 'fixed', 100000),
  ('b3000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000000', 'B live', 'b-live', 'active', 'fixed', 200000),
  ('b3000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000000', 'B draft', 'b-draft', 'draft', 'on_request', null),
  ('c3000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000000', 'C live', 'c-live', 'active', 'fixed', 300000);

insert into public.product_variants (id, tenant_id, product_id, stock_qty) values
  ('a4000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000000', 'a3000000-0000-4000-8000-000000000001', 5),
  ('a4000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000000', 'a3000000-0000-4000-8000-000000000002', 5),
  ('b4000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000000', 'b3000000-0000-4000-8000-000000000001', 5),
  ('b4000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000000', 'b3000000-0000-4000-8000-000000000002', 5),
  ('c4000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000000', 'c3000000-0000-4000-8000-000000000001', 5);

insert into public.product_images (tenant_id, product_id, r2_key) values
  ('a0000000-0000-4000-8000-000000000000', 'a3000000-0000-4000-8000-000000000001', 'tenants/a0000000-0000-4000-8000-000000000000/products/a3000000-0000-4000-8000-000000000001/1.webp'),
  ('a0000000-0000-4000-8000-000000000000', 'a3000000-0000-4000-8000-000000000002', 'tenants/a0000000-0000-4000-8000-000000000000/products/a3000000-0000-4000-8000-000000000002/1.webp');

insert into public.banners (tenant_id, image_key, heading, starts_at, ends_at) values
  ('a0000000-0000-4000-8000-000000000000', 'tenants/a0000000-0000-4000-8000-000000000000/banners/now.webp', 'A now', null, null),
  ('a0000000-0000-4000-8000-000000000000', 'tenants/a0000000-0000-4000-8000-000000000000/banners/old.webp', 'A expired', now() - interval '2 days', now() - interval '1 day'),
  ('a0000000-0000-4000-8000-000000000000', 'tenants/a0000000-0000-4000-8000-000000000000/banners/soon.webp', 'A upcoming', now() + interval '1 day', null);

insert into public.orders (tenant_id, customer_name, customer_phone, address, subtotal_paise, total_paise) values
  ('a0000000-0000-4000-8000-000000000000', 'First A', '+919800000001', '{}', 100000, 100000),
  ('a0000000-0000-4000-8000-000000000000', 'Second A', '+919800000002', '{}', 100000, 100000),
  ('b0000000-0000-4000-8000-000000000000', 'First B', '+919800000003', '{}', 200000, 200000);

-- ---------------------------------------------------------------------------
-- Schema guarantees
-- ---------------------------------------------------------------------------

select is_empty(
  $$ select c.relname from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p')
        and not c.relrowsecurity $$,
  'RLS is enabled on every public table'
);

select is(
  (select count(*)::int from public.profiles
    where user_id in ('a1000000-0000-4000-8000-000000000000', 'd1000000-0000-4000-8000-000000000000')),
  2,
  'a profile is created for every new auth user'
);

select results_eq(
  $$ select tenant_id::text, order_number from public.orders order by tenant_id, order_number $$,
  $$ values ('a0000000-0000-4000-8000-000000000000', 1001),
            ('a0000000-0000-4000-8000-000000000000', 1002),
            ('b0000000-0000-4000-8000-000000000000', 1001) $$,
  'order numbers count up per tenant from 1001'
);

select throws_ok(
  $$ insert into public.product_variants (tenant_id, product_id)
     values ('a0000000-0000-4000-8000-000000000000', 'b3000000-0000-4000-8000-000000000001') $$,
  '23503', null,
  'a row cannot point at another tenant''s parent'
);

select throws_ok(
  $$ insert into public.product_images (tenant_id, product_id, r2_key)
     values ('a0000000-0000-4000-8000-000000000000', 'a3000000-0000-4000-8000-000000000001',
             'tenants/b0000000-0000-4000-8000-000000000000/products/x/1.webp') $$,
  '23514', null,
  'image keys must live under the row''s own tenant prefix'
);

select throws_ok(
  $$ insert into public.product_images (tenant_id, product_id, r2_key)
     values ('a0000000-0000-4000-8000-000000000000', 'a3000000-0000-4000-8000-000000000001',
             'https://media.example.com/tenants/a0000000-0000-4000-8000-000000000000/x.webp') $$,
  '23514', null,
  'image keys cannot be URLs'
);

-- ---------------------------------------------------------------------------
-- Anonymous visitors
-- ---------------------------------------------------------------------------

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select results_eq(
  $$ select name from public.products order by name $$,
  array['A live', 'B live'],
  'anon sees only active products of live stores'
);

select results_eq(
  $$ select slug::text from public.tenants order by slug $$,
  array['store-a', 'store-b'],
  'anon does not see suspended stores'
);

select results_eq(
  $$ select hostname from public.tenant_domains order by hostname $$,
  array['store-a.test.local', 'store-b.test.local'],
  'anon resolves only live stores'' domains'
);

select results_eq(
  $$ select name from public.categories order by name $$,
  array['A silk', 'B silk'],
  'anon sees only active categories'
);

select is(
  (select count(*)::int from public.product_variants),
  2,
  'anon sees variants of live products only'
);

select is(
  (select count(*)::int from public.product_images),
  1,
  'anon sees images of live products only'
);

select results_eq(
  $$ select heading from public.banners $$,
  array['A now'],
  'anon sees only banners inside their date window'
);

select results_eq(
  $$ select published ->> 'v' from public.tenant_themes $$,
  array['a-live'],
  'anon sees published themes of live stores'
);

select throws_ok(
  $$ select draft from public.tenant_themes $$,
  '42501', null,
  'anon cannot read draft themes'
);

select throws_ok(
  $$ select * from public.orders $$,
  '42501', null,
  'anon cannot read orders'
);

select throws_ok(
  $$ insert into public.orders (tenant_id, customer_name, customer_phone, address, subtotal_paise, total_paise)
     values ('a0000000-0000-4000-8000-000000000000', 'x', 'x', '{}', 1, 1) $$,
  '42501', null,
  'anon cannot create orders'
);

select throws_ok(
  $$ insert into public.products (tenant_id, name, slug, price_paise)
     values ('a0000000-0000-4000-8000-000000000000', 'x', 'x', 1) $$,
  '42501', null,
  'anon cannot write the catalog'
);

reset role;

-- ---------------------------------------------------------------------------
-- Owner of store A
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-4000-8000-000000000000","role":"authenticated"}';

select results_eq(
  $$ select name from public.products order by name $$,
  array['A draft', 'A live', 'B live'],
  'member sees own drafts and other stores'' public products, not their drafts'
);

select results_eq(
  $$ select customer_name from public.orders order by customer_name $$,
  array['First A', 'Second A'],
  'member reads only own store''s orders'
);

select results_eq(
  $$ select published ->> 'v' from public.tenant_themes $$,
  array['a-live'],
  'member reads only own store''s theme'
);

select results_eq(
  $$ select tenant_id::text from public.tenant_members $$,
  array['a0000000-0000-4000-8000-000000000000'],
  'member sees only own memberships'
);

select throws_ok(
  $$ insert into public.products (tenant_id, name, slug, price_paise)
     values ('b0000000-0000-4000-8000-000000000000', 'Planted', 'planted', 1) $$,
  '42501', null,
  'member cannot create products in another store'
);

update public.products set name = 'Hacked' where id = 'b3000000-0000-4000-8000-000000000001';
delete from public.categories where id = 'b2000000-0000-4000-8000-000000000001';
-- Status changes only through set_order_status (090); staff notes are editable.
update public.orders set staff_notes = 'Hacked' where tenant_id = 'b0000000-0000-4000-8000-000000000000';

select lives_ok(
  $$ update public.products set name = 'A live (edited)' where id = 'a3000000-0000-4000-8000-000000000001' $$,
  'member can edit own products'
);

select throws_ok(
  $$ update public.profiles set is_super_admin = true where user_id = 'a1000000-0000-4000-8000-000000000000' $$,
  '42501', null,
  'member cannot make themselves super admin'
);

select throws_ok(
  $$ update public.tenants set status = 'active' where id = 'a0000000-0000-4000-8000-000000000000' $$,
  '42501', null,
  'member cannot change store status'
);

select throws_ok(
  $$ insert into public.tenant_members (tenant_id, user_id, role)
     values ('b0000000-0000-4000-8000-000000000000', 'a1000000-0000-4000-8000-000000000000', 'owner') $$,
  '42501', null,
  'member cannot join another store'
);

select throws_ok(
  $$ insert into public.orders (tenant_id, customer_name, customer_phone, address, subtotal_paise, total_paise)
     values ('a0000000-0000-4000-8000-000000000000', 'x', 'x', '{}', 1, 1) $$,
  '42501', null,
  'member cannot create orders directly'
);

reset role;

select is(
  (select name from public.products where id = 'b3000000-0000-4000-8000-000000000001'),
  'B live',
  'member update of another store''s product changed nothing'
);

select is(
  (select count(*)::int from public.categories where id = 'b2000000-0000-4000-8000-000000000001'),
  1,
  'member delete of another store''s category removed nothing'
);

select is(
  (select staff_notes from public.orders where tenant_id = 'b0000000-0000-4000-8000-000000000000'),
  null,
  'member update of another store''s order changed nothing'
);

select is(
  (select name from public.products where id = 'a3000000-0000-4000-8000-000000000001'),
  'A live (edited)',
  'member edit of own product was saved'
);

-- ---------------------------------------------------------------------------
-- Signed in, but not a member of any store
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub":"d1000000-0000-4000-8000-000000000000","role":"authenticated"}';

select results_eq(
  $$ select name from public.products order by name $$,
  array['A live (edited)', 'B live'],
  'non-member sees only public products'
);

select is_empty(
  $$ select id from public.orders $$,
  'non-member sees no orders'
);

select is_empty(
  $$ select tenant_id from public.tenant_themes $$,
  'non-member sees no theme drafts'
);

reset role;

-- ---------------------------------------------------------------------------
-- Super admin
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub":"e1000000-0000-4000-8000-000000000000","role":"authenticated"}';

select is(
  (select count(*)::int from public.products),
  5,
  'super admin sees every product, including drafts and suspended stores'
);

select is(
  (select count(*)::int from public.orders),
  3,
  'super admin sees every order'
);

reset role;

select * from finish();
rollback;
