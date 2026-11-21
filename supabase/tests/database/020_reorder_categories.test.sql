-- reorder_categories: members reorder their own store; nobody else can, and
-- incomplete or duplicated lists are refused. Rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

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

insert into public.categories (id, tenant_id, name, slug, position) values
  ('a2000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000000', 'One', 'one', 0),
  ('a2000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000000', 'Two', 'two', 1),
  ('a2000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000000', 'Three', 'three', 2),
  ('b2000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000000', 'B one', 'one', 0);

-- Anonymous visitors cannot call it at all.
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok(
  $$ select public.reorder_categories('a0000000-0000-4000-8000-000000000000',
       array['a2000000-0000-4000-8000-000000000001']::uuid[]) $$,
  '42501',
  null,
  'anon cannot reorder'
);
reset role;

-- Owner of A.
set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-4000-8000-000000000000","role":"authenticated"}';

select lives_ok(
  $$ select public.reorder_categories('a0000000-0000-4000-8000-000000000000', array[
       'a2000000-0000-4000-8000-000000000003',
       'a2000000-0000-4000-8000-000000000001',
       'a2000000-0000-4000-8000-000000000002']::uuid[]) $$,
  'an owner reorders their store'
);
select results_eq(
  $$ select slug::text from public.categories
      where tenant_id = 'a0000000-0000-4000-8000-000000000000' order by position $$,
  $$ values ('three'), ('one'), ('two') $$,
  'positions follow the new order'
);

select throws_ok(
  $$ select public.reorder_categories('a0000000-0000-4000-8000-000000000000', array[
       'a2000000-0000-4000-8000-000000000001',
       'a2000000-0000-4000-8000-000000000002']::uuid[]) $$,
  '22023',
  null,
  'a list missing a category is refused'
);
select throws_ok(
  $$ select public.reorder_categories('a0000000-0000-4000-8000-000000000000', array[
       'a2000000-0000-4000-8000-000000000001',
       'a2000000-0000-4000-8000-000000000001',
       'a2000000-0000-4000-8000-000000000002']::uuid[]) $$,
  '22023',
  null,
  'a list with a duplicate is refused'
);
select throws_ok(
  $$ select public.reorder_categories('a0000000-0000-4000-8000-000000000000', array[
       'a2000000-0000-4000-8000-000000000001',
       'a2000000-0000-4000-8000-000000000002',
       'b2000000-0000-4000-8000-000000000001']::uuid[]) $$,
  '22023',
  null,
  'another store''s category cannot be slipped in'
);

-- A's owner cannot reorder B.
select throws_ok(
  $$ select public.reorder_categories('b0000000-0000-4000-8000-000000000000',
       array['b2000000-0000-4000-8000-000000000001']::uuid[]) $$,
  '42501',
  null,
  'an owner cannot reorder another store'
);
reset role;

select is(
  (select position from public.categories where id = 'b2000000-0000-4000-8000-000000000001'),
  0,
  'store B is untouched'
);

select * from finish();
rollback;
