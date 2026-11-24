-- Staff roles, team changes and templates per plan. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(38);

delete from public.tenants;
delete from public.plans;
delete from public.templates;
insert into public.templates (key, name) values ('one', 'One'), ('two', 'Two');
insert into public.plans (id, name, limits, template_keys) values
  ('f0000000-0000-4000-8000-000000000001', 'Small', '{"team":3}', '{one}');
insert into public.tenants (id, slug, name, status, whatsapp_number) values
  ('a0000000-0000-4000-8000-000000000000', 'store-a', 'Store A', 'active', '+910000000101');
insert into public.tenant_themes (tenant_id, template_key, draft) values
  ('a0000000-0000-4000-8000-000000000000', 'one', '{"templateKey":"one"}');
insert into public.subscriptions (tenant_id, plan_id) values
  ('a0000000-0000-4000-8000-000000000000', 'f0000000-0000-4000-8000-000000000001');
insert into auth.users (id, email) values
  ('a1000000-0000-4000-8000-000000000000', 'owner@test.local'),
  ('a1000000-0000-4000-8000-000000000001', 'staff@test.local'),
  ('a1000000-0000-4000-8000-000000000002', 'third@test.local'),
  ('a1000000-0000-4000-8000-000000000003', 'fourth@test.local'),
  ('e1000000-0000-4000-8000-000000000000', 'admin@test.local');
update public.profiles set is_super_admin = true
 where user_id = 'e1000000-0000-4000-8000-000000000000';
insert into public.tenant_members (tenant_id, user_id, role) values
  ('a0000000-0000-4000-8000-000000000000', 'a1000000-0000-4000-8000-000000000000', 'owner');
insert into public.banners (id, tenant_id, image_key, position) values
  ('ba000000-0000-4000-8000-000000000000', 'a0000000-0000-4000-8000-000000000000', 'tenants/a0000000-0000-4000-8000-000000000000/k.webp', 0);
insert into public.store_pages (tenant_id, slug, title) values
  ('a0000000-0000-4000-8000-000000000000', 'about', 'About');

create function pg_temp.act_as(who text) returns void
language sql as $$
  select set_config('request.jwt.claims', format('{"sub":"%s"}', case who
    when 'admin' then 'e1000000-0000-4000-8000-000000000000'
    when 'owner' then 'a1000000-0000-4000-8000-000000000000'
    else 'a1000000-0000-4000-8000-000000000001' end), true);
$$;
grant execute on function pg_temp.act_as(text) to authenticated;
create function pg_temp.add(email text, r public.member_role default 'staff') returns boolean
language sql as $$
  select public.add_member('a0000000-0000-4000-8000-000000000000', email, r);
$$;
grant execute on function pg_temp.add(text, public.member_role) to authenticated;
create function pg_temp.change(n int, r public.member_role default null) returns boolean
language sql as $$
  select public.change_member('a0000000-0000-4000-8000-000000000000',
    format('a1000000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid, r);
$$;
grant execute on function pg_temp.change(int, public.member_role) to authenticated;

-- ---------------------------------------------------------------------------
-- Adding people
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.act_as('owner');
select throws_ok($$ select pg_temp.add('staff@test.local') $$, '42501', null, 'owners cannot add people');
select throws_ok($$ select pg_temp.change(0) $$, '42501', null, 'or remove them');
select pg_temp.act_as('admin');
select ok(pg_temp.add(' Staff@test.local '), 'a super admin adds staff');
select ok(not pg_temp.add('staff@test.local', 'owner'), 'adding them again does nothing');
select throws_ok($$ select pg_temp.add('nobody@test.local') $$, 'P0002', null, 'an unknown email is refused');
select ok(pg_temp.add('third@test.local', 'owner'), 'a second owner fits');
select throws_ok($$ select pg_temp.add('fourth@test.local') $$, 'ZL002', null, 'the plan limits the team');

-- ---------------------------------------------------------------------------
-- What staff can do
-- ---------------------------------------------------------------------------
select pg_temp.act_as('staff');
select ok(not public.can_own_tenant('a0000000-0000-4000-8000-000000000000'), 'staff are not owners');
select ok(public.can_manage_tenant('a0000000-0000-4000-8000-000000000000'), 'but work on the store');
select lives_ok($$ insert into public.categories (tenant_id, name, slug) values ('a0000000-0000-4000-8000-000000000000', 'C', 'c') $$, 'staff add categories');
select lives_ok($$ insert into public.products (tenant_id, name, slug, status, price_mode, price_paise) values ('a0000000-0000-4000-8000-000000000000', 'P', 'p', 'draft', 'fixed', 100) $$, 'staff add products');
select is((select count(*)::int from public.banners), 1, 'staff read banners');
select is((select count(*)::int from public.store_pages), 1, 'staff read pages');
select is_empty($$ update public.tenants set name = 'X' returning 1 $$, 'staff cannot change settings');
select is_empty($$ update public.tenant_themes set draft = '{}' returning 1 $$, 'staff cannot change the theme');
select is_empty($$ update public.banners set position = 3 returning 1 $$, 'staff cannot change banners');
select is_empty($$ delete from public.banners returning 1 $$, 'staff cannot delete banners');
select throws_ok($$ insert into public.banners (tenant_id, image_key, position) values ('a0000000-0000-4000-8000-000000000000', 'tenants/a0000000-0000-4000-8000-000000000000/k2.webp', 1) $$, '42501', null, 'staff cannot add banners');
select throws_ok($$ select public.reorder_banners('a0000000-0000-4000-8000-000000000000', '{ba000000-0000-4000-8000-000000000000}') $$, '42501', null, 'staff cannot reorder banners');
select is_empty($$ update public.store_pages set title = 'X' returning 1 $$, 'staff cannot change pages');
select throws_ok($$ insert into public.store_pages (tenant_id, slug, title) values ('a0000000-0000-4000-8000-000000000000', 'terms', 'T') $$, '42501', null, 'staff cannot add pages');
select throws_ok($$ update public.tenant_members set role = 'owner' $$, '42501', null, 'staff cannot promote themselves');

select pg_temp.act_as('owner');
select isnt_empty($$ update public.tenants set name = 'New' returning 1 $$, 'owners change settings');
select lives_ok($$ select public.reorder_banners('a0000000-0000-4000-8000-000000000000', '{ba000000-0000-4000-8000-000000000000}') $$, 'owners reorder banners');
select pg_temp.act_as('admin');
select is_empty($$ update public.tenants set name = 'X' returning 1 $$, 'a super admin is read-only');
select lives_ok($$ select public.allow_editing('a0000000-0000-4000-8000-000000000000') $$, 'until they allow editing');
select isnt_empty($$ update public.tenants set name = 'Y' returning 1 $$, 'then they act as an owner');

-- ---------------------------------------------------------------------------
-- Templates
-- ---------------------------------------------------------------------------
select pg_temp.act_as('owner');
select throws_ok($$ update public.tenant_themes set template_key = 'two' $$, 'ZL003', null, 'a template outside the plan is refused');
select throws_ok($$ update public.tenant_themes set draft = '{"templateKey":"two"}' $$, 'ZL003', null, 'in the draft too');
select lives_ok($$ update public.tenant_themes set draft = '{"templateKey":"one","x":1}' $$, 'other changes are fine');
select pg_temp.act_as('admin');
select throws_ok($$ select public.save_plan('Small', 0, 0, true, 'f0000000-0000-4000-8000-000000000001', null, null, '{nope}') $$, '22023', null, 'a plan names real templates');
select lives_ok($$ select public.save_plan('Small', 0, 0, true, 'f0000000-0000-4000-8000-000000000001') $$, 'a plan offers every template');
select pg_temp.act_as('owner');
select lives_ok($$ update public.tenant_themes set template_key = 'two', draft = '{"templateKey":"two"}' $$, 'then a store may use any');

-- ---------------------------------------------------------------------------
-- Roles and removal
-- ---------------------------------------------------------------------------
select pg_temp.act_as('admin');
select ok(pg_temp.change(0, 'staff'), 'one of two owners becomes staff');
select ok(not pg_temp.change(2, 'staff'), 'the last owner cannot');
select ok(not pg_temp.change(2), 'or be removed');
select ok(pg_temp.change(1), 'staff are removed');
reset role;
select is(
  (select count(*)::int from public.audit_log where action like 'member.%'),
  4, 'every change is logged');

select * from finish();
rollback;
