-- Store contact details: members edit their own store's only; anyone reads
-- a live store's; bad values are refused.
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

set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-4000-8000-000000000000","role":"authenticated"}';

select lives_ok(
  $$ update public.tenants set
       contact_email = 'hello@store-a.in',
       contact_phone = '080 2345 6789',
       address = '{"line1":"12 Silk Street","city":"Chennai","state":"Tamil Nadu","pincode":"600001"}',
       opening_hours = 'Mon–Sat, 10 am – 8 pm'
     where id = 'a0000000-0000-4000-8000-000000000000' $$,
  'an owner saves the store''s contact details'
);

update public.tenants set contact_email = 'x@evil.in'
  where id = 'b0000000-0000-4000-8000-000000000000';
reset role;
select is(
  (select contact_email from public.tenants where id = 'b0000000-0000-4000-8000-000000000000'),
  null,
  'an owner cannot change another store''s details'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-4000-8000-000000000000","role":"authenticated"}';
select throws_ok(
  $$ update public.tenants set contact_email = 'not an email'
     where id = 'a0000000-0000-4000-8000-000000000000' $$,
  '23514', null, 'an invalid email is refused'
);
select throws_ok(
  $$ update public.tenants set address = '"12 Silk Street"'
     where id = 'a0000000-0000-4000-8000-000000000000' $$,
  '23514', null, 'an address must be an object'
);
select throws_ok(
  $$ update public.tenants set contact_phone = 'call me'
     where id = 'a0000000-0000-4000-8000-000000000000' $$,
  '23514', null, 'a phone number must be digits'
);
reset role;

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select is(
  (select address->>'city' from public.tenants where id = 'a0000000-0000-4000-8000-000000000000'),
  'Chennai',
  'shoppers read a live store''s address'
);
select throws_ok(
  $$ update public.tenants set opening_hours = 'never'
     where id = 'a0000000-0000-4000-8000-000000000000' $$,
  '42501', null, 'anon cannot change contact details'
);
reset role;

select * from finish();
rollback;
