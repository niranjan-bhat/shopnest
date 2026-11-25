-- can_sign_in and record_sign_in_attempt: only the server may call them,
-- codes go only to members and super admins, and the limits hold. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(25);

delete from public.tenants;
delete from public.sign_in_attempts;
insert into public.tenants (id, slug, name, status, whatsapp_number) values
  ('a0000000-0000-4000-8000-000000000000', 'store-a', 'Store A', 'active', '+910000000101');
insert into auth.users (id, email) values
  ('a1000000-0000-4000-8000-000000000000', 'owner@test.local'),
  ('d1000000-0000-4000-8000-000000000000', 'outsider@test.local'),
  ('e1000000-0000-4000-8000-000000000000', 'admin@test.local');
update public.profiles set is_super_admin = true
 where user_id = 'e1000000-0000-4000-8000-000000000000';
insert into public.tenant_members (tenant_id, user_id, role) values
  ('a0000000-0000-4000-8000-000000000000', 'a1000000-0000-4000-8000-000000000000', 'staff');

-- An attempt by email number e from network number c (null: unknown).
create function pg_temp.attempt(kind text, e int, c int default null)
returns text
language sql as $$
  select public.record_sign_in_attempt(
    kind, lpad(e::text, 64, '0'), lpad(c::text, 64, 'a'));
$$;
grant execute on function pg_temp.attempt(text, int, int) to service_role;

select ok(not has_function_privilege('anon', 'public.can_sign_in(text)', 'execute'), 'anon cannot ask who has access');
select ok(not has_function_privilege('authenticated', 'public.can_sign_in(text)', 'execute'), 'users cannot ask who has access');
select ok(not has_function_privilege('anon', 'public.record_sign_in_attempt(text, text, text)', 'execute'), 'anon cannot record attempts');
select ok(not has_function_privilege('authenticated', 'public.record_sign_in_attempt(text, text, text)', 'execute'), 'users cannot record attempts');
select ok(not has_table_privilege('anon', 'public.sign_in_attempts', 'select,insert,update,delete'), 'anon cannot touch attempts');
select ok(not has_table_privilege('authenticated', 'public.sign_in_attempts', 'select,insert,update,delete'), 'users cannot touch attempts');

set local role service_role;

select ok(public.can_sign_in(' Owner@Test.local '), 'a member, however typed');
select ok(public.can_sign_in('admin@test.local'), 'a super admin');
select ok(not public.can_sign_in('outsider@test.local'), 'not an account with no store');
select ok(not public.can_sign_in('nobody@test.local'), 'not an unknown email');

reset role;
delete from public.tenant_members;
set local role service_role;
select ok(not public.can_sign_in('owner@test.local'), 'not someone removed from their store');

-- Sending, one email
select is(pg_temp.attempt('send', 1), 'ok', 'a first code');
select is(pg_temp.attempt('send', 1), 'wait', 'a second straight away');
reset role;
update public.sign_in_attempts set created_at = now() - interval '2 minutes';
set local role service_role;
select is(pg_temp.attempt('send', 1), 'ok', 'a second after the wait');
reset role;
insert into public.sign_in_attempts (kind, email_hash)
select 'send', lpad('1', 64, '0') from generate_series(1, 3);
update public.sign_in_attempts set created_at = now() - interval '10 minutes';
set local role service_role;
select is(pg_temp.attempt('send', 1), 'email', 'a sixth within the hour');
select is(pg_temp.attempt('send', 2), 'ok', 'another email is not held up');
reset role;
update public.sign_in_attempts set created_at = now() - interval '61 minutes';
set local role service_role;
select is(pg_temp.attempt('send', 1), 'ok', 'allowed again after an hour');

-- Sending, one network
select is(
  (select count(*) from generate_series(101, 110) e where pg_temp.attempt('send', e, 1) = 'ok'),
  10::bigint, 'ten emails from one network');
select is(pg_temp.attempt('send', 111, 1), 'network', 'the eleventh is refused');
select is(pg_temp.attempt('send', 111, 2), 'ok', 'another network is not held up');

-- Checking codes
select is(
  (select count(*) from generate_series(1, 11) n where pg_temp.attempt('verify', 1 + 0 * n) = 'ok'),
  10::bigint, 'ten guesses for one email');
select is(pg_temp.attempt('verify', 1), 'email', 'the next is refused');
select is(
  (select count(*) from generate_series(201, 231) e where pg_temp.attempt('verify', e, 1) = 'ok'),
  30::bigint, 'thirty guesses from one network');

select throws_ok($$ select pg_temp.attempt('other', 1) $$, '22023', null, 'an unknown attempt is refused');

reset role;
update public.sign_in_attempts set created_at = now() - interval '25 hours';
set local role service_role;
do $$ begin perform pg_temp.attempt('send', 1); end $$;
select is((select count(*) from public.sign_in_attempts), 1::bigint, 'old rows are removed');

select * from finish();
rollback;
