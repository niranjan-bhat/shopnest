-- store_pages: shoppers read published pages of live stores; members manage
-- their own store's pages only.
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

delete from public.tenants;

insert into public.tenants (id, slug, name, status, whatsapp_number) values
  ('a0000000-0000-4000-8000-000000000000', 'store-a', 'Store A', 'active', '+910000000101'),
  ('b0000000-0000-4000-8000-000000000000', 'store-b', 'Store B', 'active', '+910000000102'),
  ('c0000000-0000-4000-8000-000000000000', 'store-c', 'Store C', 'suspended', '+910000000103');
insert into auth.users (id, email) values
  ('a1000000-0000-4000-8000-000000000000', 'owner-a@test.local');
insert into public.tenant_members (tenant_id, user_id, role) values
  ('a0000000-0000-4000-8000-000000000000', 'a1000000-0000-4000-8000-000000000000', 'owner');

insert into public.store_pages (tenant_id, slug, title, body, is_published) values
  ('a0000000-0000-4000-8000-000000000000', 'shipping', 'Shipping', 'We ship in 3 days.', true),
  ('a0000000-0000-4000-8000-000000000000', 'returns', 'Returns', 'Draft text', false),
  ('b0000000-0000-4000-8000-000000000000', 'shipping', 'Shipping', 'B ships.', true),
  ('c0000000-0000-4000-8000-000000000000', 'shipping', 'Shipping', 'C ships.', true);

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select results_eq(
  $$ select tenant_id::text || ':' || slug from public.store_pages order by 1 $$,
  $$ values ('a0000000-0000-4000-8000-000000000000:shipping'),
            ('b0000000-0000-4000-8000-000000000000:shipping') $$,
  'shoppers see only published pages of live stores'
);
select throws_ok(
  $$ insert into public.store_pages (tenant_id, slug, title)
     values ('a0000000-0000-4000-8000-000000000000', 'about', 'About') $$,
  '42501', null, 'anon cannot write pages'
);
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-4000-8000-000000000000","role":"authenticated"}';
select is(
  (select count(*)::int from public.store_pages
    where tenant_id = 'a0000000-0000-4000-8000-000000000000'),
  2,
  'an owner sees the store''s drafts too'
);
select lives_ok(
  $$ insert into public.store_pages (tenant_id, slug, title, body)
     values ('a0000000-0000-4000-8000-000000000000', 'about', 'About us', 'Our story') $$,
  'an owner adds a page'
);
select throws_ok(
  $$ insert into public.store_pages (tenant_id, slug, title)
     values ('b0000000-0000-4000-8000-000000000000', 'about', 'About') $$,
  '42501', null, 'an owner cannot add another store''s page'
);
select throws_ok(
  $$ insert into public.store_pages (tenant_id, slug, title)
     values ('a0000000-0000-4000-8000-000000000000', 'shipping', 'Again') $$,
  '23505', null, 'each page exists once per store'
);
select throws_ok(
  $$ insert into public.store_pages (tenant_id, slug, title)
     values ('a0000000-0000-4000-8000-000000000000', 'faq', 'FAQ') $$,
  '23514', null, 'only the known pages'
);
select throws_ok(
  $$ update public.store_pages set body = '  ', is_published = true
     where tenant_id = 'a0000000-0000-4000-8000-000000000000' and slug = 'returns' $$,
  '23514', null, 'an empty page cannot be published'
);
reset role;

select * from finish();
rollback;
