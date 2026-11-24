-- Going live, suspending, and super admin edit sessions. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(34);

delete from public.tenants;
insert into public.templates (key, name) values ('test-template', 'Test');
insert into public.tenants (id, slug, name, status, whatsapp_number) values
  ('a0000000-0000-4000-8000-000000000000', 'store-a', 'Store A', 'onboarding', '+910000000101'),
  ('b0000000-0000-4000-8000-000000000000', 'store-b', 'Store B', 'active', '+910000000102');
insert into public.tenant_domains (tenant_id, hostname, kind, is_primary) values
  ('a0000000-0000-4000-8000-000000000000', 'store-a.test.local', 'subdomain', true),
  ('b0000000-0000-4000-8000-000000000000', 'store-b.test.local', 'subdomain', true);
insert into public.tenant_themes (tenant_id, template_key, draft) values
  ('a0000000-0000-4000-8000-000000000000', 'test-template', '{"v":1}');
insert into public.products (id, tenant_id, name, slug, status, price_mode, price_paise) values
  ('a3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000000', 'A draft', 'a-draft', 'draft', 'fixed', 100000),
  ('b3000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000000', 'B draft', 'b-draft', 'draft', 'fixed', 100000);
insert into auth.users (id, email) values
  ('a1000000-0000-4000-8000-000000000000', 'owner@test.local'),
  ('e1000000-0000-4000-8000-000000000000', 'admin@test.local');
update public.profiles set is_super_admin = true
 where user_id = 'e1000000-0000-4000-8000-000000000000';
insert into public.tenant_members (tenant_id, user_id, role) values
  ('a0000000-0000-4000-8000-000000000000', 'a1000000-0000-4000-8000-000000000000', 'owner');

create function pg_temp.act_as(who text) returns void
language sql as $$
  select set_config('request.jwt.claims', format('{"sub":"%s"}', case who
    when 'admin' then 'e1000000-0000-4000-8000-000000000000'
    else 'a1000000-0000-4000-8000-000000000000' end), true);
$$;
grant execute on function pg_temp.act_as(text) to authenticated;

-- Anon
set local role anon;
select throws_ok($$ select public.set_store_status('b0000000-0000-4000-8000-000000000000', 'suspended', 'x') $$, '42501', null, 'anon cannot change a status');
select throws_ok($$ select public.allow_editing('b0000000-0000-4000-8000-000000000000') $$, '42501', null, 'anon cannot start editing');
select throws_ok($$ select * from public.admin_edit_sessions $$, '42501', null, 'anon cannot read sessions');
reset role;

-- The owner
set local role authenticated;
select pg_temp.act_as('owner');
select throws_ok($$ select public.set_store_status('a0000000-0000-4000-8000-000000000000', 'active') $$, '42501', null, 'owners cannot go live themselves');
select throws_ok($$ select public.store_missing('a0000000-0000-4000-8000-000000000000') $$, '42501', null, 'nor read the checklist function');
select throws_ok($$ select public.allow_editing('a0000000-0000-4000-8000-000000000000') $$, '42501', null, 'nor start an edit session');
select throws_ok($$ insert into public.admin_edit_sessions values ('b0000000-0000-4000-8000-000000000000', 'a1000000-0000-4000-8000-000000000000', now() + interval '1 day') $$, '42501', null, 'nobody inserts sessions directly');
select throws_ok($$ update public.tenants set suspended_reason = 'x' $$, '42501', null, 'owners cannot write the reason');
select ok(public.can_manage_tenant('a0000000-0000-4000-8000-000000000000'), 'members manage without a session');
select ok(not public.can_view_tenant('b0000000-0000-4000-8000-000000000000'), 'and cannot open other stores');

-- A super admin without a session: reads, no writes
select pg_temp.act_as('admin');
select ok(public.can_view_tenant('a0000000-0000-4000-8000-000000000000'), 'super admins may open any store');
select ok(not public.can_manage_tenant('a0000000-0000-4000-8000-000000000000'), 'but not change it');
select is((select count(*) from public.products), 2::bigint, 'they read draft products');
select is((select count(*) from public.tenant_themes), 1::bigint, 'and draft themes');
select is_empty($$ update public.products set name = 'Hacked' returning id $$, 'a product update changes nothing');
select is_empty($$ update public.tenants set name = 'Hacked' returning id $$, 'nor a store update');
select throws_ok($$ insert into public.categories (tenant_id, name, slug) values ('a0000000-0000-4000-8000-000000000000', 'X', 'x') $$, '42501', null, 'an insert is refused');

-- With a session on A
select ok(public.allow_editing('a0000000-0000-4000-8000-000000000000') > now() + interval '29 minutes', 'a session lasts 30 minutes');
select is((select count(*) from public.admin_edit_sessions), 1::bigint, 'they see their session');
select isnt_empty($$ update public.products set name = 'Renamed' where tenant_id = 'a0000000-0000-4000-8000-000000000000' returning id $$, 'now they can change A');
select is_empty($$ update public.products set name = 'Renamed' where tenant_id = 'b0000000-0000-4000-8000-000000000000' returning id $$, 'but not B');
reset role;
update public.admin_edit_sessions set expires_at = now() - interval '1 second';
set local role authenticated;
select ok(not public.can_manage_tenant('a0000000-0000-4000-8000-000000000000'), 'an expired session is no session');
select public.allow_editing('a0000000-0000-4000-8000-000000000000');
select public.stop_editing('a0000000-0000-4000-8000-000000000000');
select ok(not public.can_manage_tenant('a0000000-0000-4000-8000-000000000000'), 'stopping ends it');

-- Going live
select is(public.set_store_status('a0000000-0000-4000-8000-000000000000', 'active'),
  '{"status":"not_ready","missing":["theme","products"]}'::jsonb, 'an unfinished store cannot go live');
select throws_ok($$ select public.set_store_status('a0000000-0000-4000-8000-000000000000', 'suspended', 'x') $$, '22023', null, 'nor be suspended');
reset role;
update public.tenant_themes set published = draft;
update public.products set status = 'active' where tenant_id = 'a0000000-0000-4000-8000-000000000000';
set local role authenticated;
select is(public.set_store_status('a0000000-0000-4000-8000-000000000000', 'active'), '{"status":"ok"}'::jsonb, 'a ready one goes live');

-- Suspending
select throws_ok($$ select public.set_store_status('a0000000-0000-4000-8000-000000000000', 'suspended', '  ') $$, '22023', 'a reason is needed', 'suspending needs a reason');
select is(public.set_store_status('a0000000-0000-4000-8000-000000000000', 'suspended', ' Unpaid '), '{"status":"ok"}'::jsonb, 'it is suspended');
reset role;
set local role anon;
select is_empty($$ select id from public.tenants where slug = 'store-a' $$, 'shoppers cannot see it');
select ok(public.is_suspended_host('store-a.test.local') and not public.is_suspended_host('store-b.test.local') and not public.is_suspended_host('none.test.local'), 'only its host says suspended');
reset role;
set local role authenticated;
select pg_temp.act_as('owner');
select is((select suspended_reason from public.tenants where slug = 'store-a'), 'Unpaid', 'its owner sees why');
select isnt_empty($$ update public.products set name = 'Still mine' where tenant_id = 'a0000000-0000-4000-8000-000000000000' returning id $$, 'and can keep working');
select pg_temp.act_as('admin');
select public.set_store_status('a0000000-0000-4000-8000-000000000000', 'active');
select is((select status || coalesce(suspended_reason, '') from public.tenants where slug = 'store-a'), 'active', 'reactivating clears the reason');
reset role;
select results_eq(
  $$ select action from public.audit_log where tenant_id = 'a0000000-0000-4000-8000-000000000000' order by action $$,
  $$ values ('store.editing_allowed'), ('store.editing_allowed'), ('store.editing_stopped'), ('store.live'), ('store.reactivated'), ('store.suspended') $$,
  'everything is logged');

select * from finish();
rollback;
