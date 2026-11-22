-- reorder_banners: members reorder their own store's banners only.
begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

delete from public.tenants;

insert into public.tenants (id, slug, name, status, whatsapp_number) values
  ('a0000000-0000-4000-8000-000000000000', 'store-a', 'Store A', 'active', '+910000000101'),
  ('b0000000-0000-4000-8000-000000000000', 'store-b', 'Store B', 'active', '+910000000102');
insert into auth.users (id, email) values
  ('a1000000-0000-4000-8000-000000000000', 'owner-a@test.local');
insert into public.tenant_members (tenant_id, user_id, role) values
  ('a0000000-0000-4000-8000-000000000000', 'a1000000-0000-4000-8000-000000000000', 'owner');

-- The second banner of store A is scheduled (not public yet): members still
-- see and order it.
insert into public.banners (id, tenant_id, image_key, position, starts_at) values
  ('a6000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000000', 'tenants/a0000000-0000-4000-8000-000000000000/banners/1.webp', 0, null),
  ('a6000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000000', 'tenants/a0000000-0000-4000-8000-000000000000/banners/2.webp', 1, now() + interval '1 day'),
  ('b6000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000000', 'tenants/b0000000-0000-4000-8000-000000000000/banners/1.webp', 0, null);

set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-4000-8000-000000000000","role":"authenticated"}';

select lives_ok(
  $$ select public.reorder_banners('a0000000-0000-4000-8000-000000000000', array[
       'a6000000-0000-4000-8000-000000000002',
       'a6000000-0000-4000-8000-000000000001']::uuid[]) $$,
  'an owner reorders the store''s banners'
);
select results_eq(
  $$ select id::text from public.banners
      where tenant_id = 'a0000000-0000-4000-8000-000000000000' order by position $$,
  $$ values ('a6000000-0000-4000-8000-000000000002'), ('a6000000-0000-4000-8000-000000000001') $$,
  'the scheduled banner is now first'
);
select throws_ok(
  $$ select public.reorder_banners('a0000000-0000-4000-8000-000000000000',
       array['a6000000-0000-4000-8000-000000000001']::uuid[]) $$,
  '22023', null, 'a list missing a banner is refused'
);
select throws_ok(
  $$ select public.reorder_banners('a0000000-0000-4000-8000-000000000000', array[
       'a6000000-0000-4000-8000-000000000001',
       'a6000000-0000-4000-8000-000000000001']::uuid[]) $$,
  '22023', null, 'a banner listed twice is refused'
);
select throws_ok(
  $$ select public.reorder_banners('a0000000-0000-4000-8000-000000000000', array[
       'a6000000-0000-4000-8000-000000000001',
       'b6000000-0000-4000-8000-000000000001']::uuid[]) $$,
  '22023', null, 'another store''s banner cannot be slipped in'
);
select throws_ok(
  $$ select public.reorder_banners('b0000000-0000-4000-8000-000000000000',
       array['b6000000-0000-4000-8000-000000000001']::uuid[]) $$,
  '42501', null, 'an owner cannot reorder another store''s banners'
);
reset role;

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok(
  $$ select public.reorder_banners('a0000000-0000-4000-8000-000000000000',
       array['a6000000-0000-4000-8000-000000000001']::uuid[]) $$,
  '42501', null, 'anon cannot reorder'
);
reset role;

select * from finish();
rollback;
