-- Plans, payments and plan limits. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(38);

delete from public.tenants;
delete from public.plans;
insert into public.plans (id, name, limits, is_active) values
  ('f0000000-0000-4000-8000-000000000001', 'Small', '{"products":2,"team":2}', true),
  ('f0000000-0000-4000-8000-000000000002', 'Old', '{}', false);
insert into public.tenants (id, slug, name, status, whatsapp_number) values
  ('a0000000-0000-4000-8000-000000000000', 'store-a', 'Store A', 'onboarding', '+910000000101'),
  ('b0000000-0000-4000-8000-000000000000', 'store-b', 'Store B', 'active', '+910000000102');
insert into public.subscriptions (tenant_id, plan_id) values
  ('a0000000-0000-4000-8000-000000000000', 'f0000000-0000-4000-8000-000000000001');
insert into auth.users (id, email) values
  ('a1000000-0000-4000-8000-000000000000', 'owner@test.local'),
  ('a1000000-0000-4000-8000-000000000001', 'staff@test.local'),
  ('a1000000-0000-4000-8000-000000000002', 'third@test.local'),
  ('e1000000-0000-4000-8000-000000000000', 'admin@test.local');
update public.profiles set is_super_admin = true
 where user_id = 'e1000000-0000-4000-8000-000000000000';

create function pg_temp.act_as(who text) returns void
language sql as $$
  select set_config('request.jwt.claims', format('{"sub":"%s"}', case who
    when 'admin' then 'e1000000-0000-4000-8000-000000000000'
    else 'a1000000-0000-4000-8000-000000000000' end), true);
$$;
grant execute on function pg_temp.act_as(text) to authenticated;
create function pg_temp.pay(n int, months int, paid date default '2026-01-10') returns void
language sql as $$
  select public.record_payment('a0000000-0000-4000-8000-000000000000',
    format('c0000000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid,
    99900, paid, 'upi', months, ' UTR1 ');
$$;
grant execute on function pg_temp.pay(int, int, date) to authenticated;
create function pg_temp.due() returns date
language sql as $$
  select next_due from public.subscriptions
   where tenant_id = 'a0000000-0000-4000-8000-000000000000';
$$;
grant execute on function pg_temp.due() to authenticated;

-- ---------------------------------------------------------------------------
-- Team limit (2)
-- ---------------------------------------------------------------------------
insert into public.tenant_members (tenant_id, user_id, role) values
  ('a0000000-0000-4000-8000-000000000000', 'a1000000-0000-4000-8000-000000000000', 'owner');
select lives_ok($$ insert into public.tenant_members values ('a0000000-0000-4000-8000-000000000000', 'a1000000-0000-4000-8000-000000000001', 'staff') $$, 'a second person fits');
select throws_ok($$ insert into public.tenant_members values ('a0000000-0000-4000-8000-000000000000', 'a1000000-0000-4000-8000-000000000002', 'owner') $$, 'ZL002', null, 'a third does not, owner or not');
select lives_ok($$ insert into public.tenant_members values ('a0000000-0000-4000-8000-000000000000', 'a1000000-0000-4000-8000-000000000001', 'owner') on conflict (tenant_id, user_id) do update set role = excluded.role $$, 'changing a role is not an addition');
select lives_ok($$ insert into public.tenant_members values ('b0000000-0000-4000-8000-000000000000', 'a1000000-0000-4000-8000-000000000002', 'owner') $$, 'a store without a plan is not limited');

-- ---------------------------------------------------------------------------
-- Product limit (2), as the owner
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.act_as('owner');
select throws_ok(
  $$ insert into public.products (tenant_id, name, slug, status, price_mode, price_paise)
     select 'a0000000-0000-4000-8000-000000000000', 'P', 'bulk-' || n, 'draft', 'fixed', 100 from generate_series(1, 3) n $$,
  'ZL001', null, 'three at once are refused');
select lives_ok(
  $$ insert into public.products (tenant_id, name, slug, status, price_mode, price_paise)
     select 'a0000000-0000-4000-8000-000000000000', 'P', 'p-' || n, 'draft', 'fixed', 100 from generate_series(1, 2) n $$,
  'two fit; drafts count');
select lives_ok($$ insert into public.products (tenant_id, name, slug, status, price_mode, price_paise) values ('a0000000-0000-4000-8000-000000000000', 'P', 'p-3', 'archived', 'fixed', 100) $$, 'archived products do not count');
select throws_ok($$ insert into public.products (tenant_id, name, slug, status, price_mode, price_paise) values ('a0000000-0000-4000-8000-000000000000', 'P', 'p-4', 'active', 'fixed', 100) $$, 'ZL001', null, 'a third is refused');
select throws_ok($$ update public.products set status = 'draft' where slug = 'p-3' $$, 'ZL001', null, 'so is restoring an archived one');
select lives_ok($$ update public.products set status = 'active', name = 'Q' where slug = 'p-1' $$, 'existing products can still be edited');
select lives_ok($$ update public.products set status = 'archived' where slug = 'p-2' $$, 'archiving frees a place');
select lives_ok($$ update public.products set status = 'draft' where slug = 'p-3' $$, 'which a restore can use');

-- Merchants and billing
select is((select name from public.plans), 'Small', 'an owner sees their plan');
select is_empty($$ select id from public.subscription_payments $$, 'but no payments');
select throws_ok($$ select pg_temp.pay(1, 1) $$, '42501', null, 'cannot record one');
select throws_ok($$ select public.void_payment('a0000000-0000-4000-8000-000000000000', 'c0000000-0000-4000-8000-000000000001', 'x') $$, '42501', null, 'cannot void one');
select throws_ok($$ select public.set_subscription('a0000000-0000-4000-8000-000000000000', 'f0000000-0000-4000-8000-000000000001') $$, '42501', null, 'cannot change plan');
select throws_ok($$ select public.save_plan('Free', 0, 0, true) $$, '42501', null, 'cannot make plans');
select throws_ok($$ insert into public.subscription_payments (id, tenant_id, amount_paise, paid_on, method, months) values (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000000', 1, now(), 'cash', 1) $$, '42501', null, 'cannot write payments directly');
select throws_ok($$ update public.subscriptions set next_due = '2030-01-01' $$, '42501', null, 'cannot write the due date');

-- ---------------------------------------------------------------------------
-- Payments, as a super admin
-- ---------------------------------------------------------------------------
select pg_temp.act_as('admin');
select is(pg_temp.due(), null::date, 'a store that is not billed has no due date');
select public.set_subscription('a0000000-0000-4000-8000-000000000000', 'f0000000-0000-4000-8000-000000000001', '2026-01-31');
select is(pg_temp.due(), '2026-01-31'::date, 'the first payment is due the day billing starts');
select pg_temp.pay(1, 1);
select is(pg_temp.due(), '2026-02-28'::date, 'one month on, a short month ends early');
select pg_temp.pay(1, 1);
select is((select count(*) from public.subscription_payments), 1::bigint, 'a repeat is saved once');
select is(pg_temp.due(), '2026-02-28'::date, 'and moves nothing');
select pg_temp.pay(2, 1);
select is(pg_temp.due(), '2026-03-31'::date, 'the due day does not drift');
select pg_temp.pay(3, 0);
select is(pg_temp.due(), '2026-03-31'::date, 'a setup fee covers no months');
select is((select reference from public.subscription_payments limit 1), 'UTR1', 'the reference is tidied');
select throws_ok($$ select pg_temp.pay(4, 1, (now() + interval '3 days')::date) $$, '22023', null, 'a future payment is refused');
select throws_ok($$ select pg_temp.pay(4, 37) $$, '23514', null, 'as are more than 36 months');
select throws_ok($$ select public.void_payment('a0000000-0000-4000-8000-000000000000', 'c0000000-0000-4000-8000-000000000001', ' ') $$, '22023', null, 'voiding needs a reason');
select public.void_payment('b0000000-0000-4000-8000-000000000000', 'c0000000-0000-4000-8000-000000000001', 'wrong store');
select is((select count(*) from public.subscription_payments where voided_at is not null), 0::bigint, 'a payment is not voided through another store');
select public.void_payment('a0000000-0000-4000-8000-000000000000', 'c0000000-0000-4000-8000-000000000001', 'Typed twice');
select is(pg_temp.due(), '2026-02-28'::date, 'voiding takes the months back');
select throws_ok($$ select public.set_subscription('a0000000-0000-4000-8000-000000000000', 'f0000000-0000-4000-8000-000000000002') $$, '22023', 'unknown plan', 'a store cannot move to a retired plan');

-- Plans
select isnt(public.save_plan(' Big ', 500000, 249900, true, null, 500), null, 'a plan is created');
select is((select limits from public.plans where name = 'Big'), '{"products":500}'::jsonb, 'an empty limit is unlimited');
select throws_ok($$ select public.save_plan('Big', 0, 0, true) $$, '23505', null, 'names are unique');

-- Billing starts when a store first goes live
select public.set_subscription('a0000000-0000-4000-8000-000000000000', 'f0000000-0000-4000-8000-000000000001', null);
reset role;
update public.tenants set status = 'active' where slug = 'store-a';
select is(
  (select billing_start from public.subscriptions where tenant_id = 'a0000000-0000-4000-8000-000000000000'),
  (now() at time zone 'Asia/Kolkata')::date, 'going live starts billing');

select * from finish();
rollback;
