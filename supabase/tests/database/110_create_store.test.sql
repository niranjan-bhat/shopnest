-- create_store and store_team: one call makes a whole store or nothing, only
-- a super admin's server request may call it, and only super admins see a
-- store's people. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(24);

delete from public.tenants;
insert into public.templates (key, name, is_active) values
  ('test-template', 'Test', true), ('test-off', 'Off', false);
insert into public.plans (id, name, is_active) values
  ('f0000000-0000-4000-8000-000000000001', 'Test plan', true),
  ('f0000000-0000-4000-8000-000000000002', 'Test retired', false);
insert into auth.users (id, email) values
  ('a1000000-0000-4000-8000-000000000000', 'owner@test.local'),
  ('d1000000-0000-4000-8000-000000000000', 'outsider@test.local'),
  ('e1000000-0000-4000-8000-000000000000', 'admin@test.local');
update public.profiles set is_super_admin = true
 where user_id = 'e1000000-0000-4000-8000-000000000000';

create function pg_temp.make(changes jsonb default '{}',
  actor uuid default 'e1000000-0000-4000-8000-000000000000')
returns jsonb
language sql as $$
  select public.create_store(actor, 'test.local', jsonb_build_object(
    'name', 'New Store', 'slug', 'new-store', 'business_type', 'saree',
    'whatsapp_number', '+919876543210', 'owner_email', 'Owner@Test.local',
    'template_key', 'test-template',
    'plan_id', 'f0000000-0000-4000-8000-000000000001',
    'theme', '{"templateKey":"test-template"}'::jsonb) || changes);
$$;
grant execute on function pg_temp.make(jsonb, uuid) to service_role;

-- Who may call it
select ok(not has_function_privilege('anon', 'public.create_store(uuid, text, jsonb)', 'execute'), 'anon cannot create stores');
select ok(not has_function_privilege('authenticated', 'public.create_store(uuid, text, jsonb)', 'execute'), 'signed-in users cannot create stores');
select ok(not has_function_privilege('anon', 'public.store_team(uuid)', 'execute'), 'anon cannot list a team');

set local role service_role;

select throws_ok($$ select pg_temp.make('{}', 'a1000000-0000-4000-8000-000000000000') $$, '42501', null, 'the actor must be a super admin');
select throws_ok($$ select pg_temp.make('{"slug":"ab"}') $$, '22023', null, 'a short address is refused');
select throws_ok($$ select pg_temp.make('{"slug":"Bad_Slug"}') $$, '23514', null, 'a malformed address is refused');
select throws_ok($$ select pg_temp.make('{"plan_id":"f0000000-0000-4000-8000-000000000002"}') $$, '22023', 'unknown plan', 'a retired plan is refused');
select throws_ok($$ select pg_temp.make('{"template_key":"test-off"}') $$, '22023', 'unknown template', 'a disabled template is refused');
select throws_ok($$ select pg_temp.make('{"owner_email":"nobody@test.local"}') $$, '22023', 'the owner has no account', 'the owner must have an account');
select throws_ok($$ select pg_temp.make('{"whatsapp_number":"123"}') $$, '23514', null, 'a bad WhatsApp number is refused');
select throws_ok($$ select pg_temp.make('{"theme":null}') $$, '22023', 'missing theme', 'a theme is needed');
select is(pg_temp.make('{"slug":"mail"}'), '{"status":"taken"}'::jsonb, 'reserved addresses are refused');
select is((select count(*) from public.tenants), 0::bigint, 'refused requests leave nothing behind');

select is(pg_temp.make() ->> 'status', 'created', 'a store is created');
select results_eq(
  $$ select t.status::text, t.name, d.hostname, d.kind::text, d.is_primary
       from public.tenants t join public.tenant_domains d on d.tenant_id = t.id $$,
  $$ values ('onboarding', 'New Store', 'new-store.test.local', 'subdomain', true) $$,
  'it is not live yet and has its subdomain');
select results_eq(
  $$ select template_key, draft, published from public.tenant_themes $$,
  $$ values ('test-template', '{"templateKey":"test-template"}'::jsonb, null::jsonb) $$,
  'its theme is a draft');
select results_eq(
  $$ select user_id, role::text from public.tenant_members $$,
  $$ values ('a1000000-0000-4000-8000-000000000000'::uuid, 'owner') $$,
  'the owner is matched by email, whatever its case');
select is((select plan_id from public.subscriptions), 'f0000000-0000-4000-8000-000000000001'::uuid, 'it is on the plan');
select is((select action || ' ' || actor_id from public.audit_log where tenant_id = (select id from public.tenants)), 'store.created e1000000-0000-4000-8000-000000000000', 'it is logged');

select is(pg_temp.make(), '{"status":"taken"}'::jsonb, 'an address in use is refused');

-- An address in use as another store's domain also leaves nothing behind.
update public.tenants set slug = 'renamed';
select is(pg_temp.make(), '{"status":"taken"}'::jsonb, 'so is a host name in use');
select is((select count(*) from public.tenants), 1::bigint, 'and no half-made store is left');

-- Team list
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000000"}', true);
select results_eq(
  $$ select email, role::text, signed_in from public.store_team((select id from public.tenants where slug = 'renamed')) $$,
  $$ values ('owner@test.local', 'owner', false) $$,
  'super admins see the team');
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000000"}', true);
select throws_ok(
  $$ select * from public.store_team((select id from public.tenants where slug = 'renamed')) $$,
  '42501', null, 'owners do not (yet)');

select * from finish();
rollback;
