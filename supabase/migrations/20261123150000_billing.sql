-- Phase 5c: plans, manual payments and plan limits.
--
--   - super admins create and edit plans, and move a store between them;
--   - payments are recorded by hand and voided, never edited or deleted;
--   - a store's next payment is due billing_start + the months paid for, so
--     voiding a payment simply takes its months back. Overdue is worked out
--     from that date when it is read; nothing is suspended automatically;
--   - product and team limits are enforced by triggers, so every path that
--     adds one is covered. Going over blocks new additions only.

-- ---------------------------------------------------------------------------
-- Subscriptions and payments
-- ---------------------------------------------------------------------------

-- current_period_end was never written; billing works in whole days (India).
alter table public.subscriptions drop column current_period_end;
alter table public.subscriptions
  -- Null: not billed (demo stores, stores that are not live yet).
  add column billing_start date,
  -- The day the next payment is due; kept by sync_next_due.
  add column next_due date;
create index subscriptions_next_due_idx on public.subscriptions (next_due)
  where next_due is not null;

create type public.payment_method as enum ('upi', 'bank', 'cash', 'card', 'other');

create table public.subscription_payments (
  id uuid primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  amount_paise bigint not null check (amount_paise > 0),
  paid_on date not null,
  method public.payment_method not null,
  reference text check (length(reference) between 1 and 120),
  -- Months of the plan it covers; 0 for a setup fee on its own.
  months integer not null check (months between 0 and 36),
  recorded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references auth.users (id) on delete set null,
  void_reason text check (length(void_reason) between 1 and 500),
  check ((voided_at is null) = (void_reason is null))
);
create index subscription_payments_tenant_idx
  on public.subscription_payments (tenant_id, paid_on desc);
create index subscription_payments_recorded_by_idx
  on public.subscription_payments (recorded_by);
create index subscription_payments_voided_by_idx
  on public.subscription_payments (voided_by);

alter table public.subscription_payments enable row level security;
grant select on public.subscription_payments to authenticated;
create policy subscription_payments_admin_read on public.subscription_payments
  for select to authenticated
  using ((select public.is_super_admin()));

-- Members see their own store's plan even after it is retired.
create policy plans_own_read on public.plans
  for select to authenticated
  using (exists (
    select 1 from public.subscriptions s where s.plan_id = plans.id
  ));

-- Recomputes next_due. The caller has locked the subscription row.
create function public.sync_next_due(tid uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.subscriptions s
     set next_due = (s.billing_start + make_interval(months => (
           select coalesce(sum(p.months), 0)::integer
             from public.subscription_payments p
            where p.tenant_id = tid and p.voided_at is null)))::date
   where s.tenant_id = tid;
$$;
revoke all on function public.sync_next_due(uuid) from public, anon, authenticated;

create function public.require_super_admin()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.is_super_admin() then
    raise exception 'super admins only' using errcode = '42501';
  end if;
end;
$$;

-- Billing starts the day a store first goes live (it can be changed).
create function public.start_billing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.subscriptions s
     set billing_start = (now() at time zone 'Asia/Kolkata')::date
   where s.tenant_id = new.id and s.billing_start is null;
  perform public.sync_next_due(new.id);
  return new;
end;
$$;
revoke all on function public.start_billing() from public, anon, authenticated;
create trigger start_billing after update of status on public.tenants
  for each row when (old.status = 'onboarding' and new.status = 'active')
  execute function public.start_billing();

-- Records a payment. `pid` comes from the form, so a repeat of the same
-- submission is saved once.
create function public.record_payment(
  tid uuid, pid uuid, amount bigint, paid date,
  how public.payment_method, months integer, ref text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_super_admin();
  perform 1 from public.subscriptions s where s.tenant_id = tid for update;
  if not found then
    raise exception 'the store has no subscription' using errcode = 'P0002';
  end if;
  if paid > (now() at time zone 'Asia/Kolkata')::date then
    raise exception 'a payment cannot be in the future' using errcode = '22023';
  end if;
  insert into public.subscription_payments
    (id, tenant_id, amount_paise, paid_on, method, months, reference, recorded_by)
  values (pid, tid, amount, paid, how, months, nullif(btrim(ref), ''), auth.uid())
  on conflict (id) do nothing;
  if not found then
    return;
  end if;
  perform public.sync_next_due(tid);
  insert into public.audit_log (tenant_id, actor_id, action, entity, entity_id, diff)
  values (tid, auth.uid(), 'payment.recorded', 'subscription_payment', pid::text,
          jsonb_build_object('amount_paise', amount, 'months', months));
end;
$$;

create function public.void_payment(tid uuid, pid uuid, reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_super_admin();
  if nullif(btrim(reason), '') is null then
    raise exception 'a reason is needed' using errcode = '22023';
  end if;
  perform 1 from public.subscriptions s where s.tenant_id = tid for update;
  update public.subscription_payments p
     set voided_at = now(), voided_by = auth.uid(), void_reason = btrim(reason)
   where p.id = pid and p.tenant_id = tid and p.voided_at is null;
  if not found then
    return;
  end if;
  perform public.sync_next_due(tid);
  insert into public.audit_log (tenant_id, actor_id, action, entity, entity_id, diff)
  values (tid, auth.uid(), 'payment.voided', 'subscription_payment', pid::text,
          jsonb_build_object('reason', btrim(reason)));
end;
$$;

-- Moves a store to a plan and sets when its billing starts (null: not
-- billed). Moving to a smaller plan never removes anything.
create function public.set_subscription(tid uuid, plan uuid, starts date default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  old public.subscriptions;
begin
  perform public.require_super_admin();
  select * into old from public.subscriptions s where s.tenant_id = tid for update;
  if old.plan_id is distinct from plan and not exists (
    select 1 from public.plans p where p.id = plan and p.is_active
  ) then
    raise exception 'unknown plan' using errcode = '22023';
  end if;
  insert into public.subscriptions (tenant_id, plan_id, billing_start)
  values (tid, plan, starts)
  on conflict (tenant_id) do update
    set plan_id = excluded.plan_id, billing_start = excluded.billing_start;
  perform public.sync_next_due(tid);
  insert into public.audit_log (tenant_id, actor_id, action, entity, entity_id, diff)
  values (tid, auth.uid(), 'subscription.changed', 'subscription', tid::text,
          jsonb_build_object(
            'plan', jsonb_build_array(old.plan_id, plan),
            'billing_start', jsonb_build_array(old.billing_start, starts)));
end;
$$;

-- Creates a plan (pid null) or changes one. A null limit is unlimited.
create function public.save_plan(
  plan_name text, setup_fee bigint, monthly_fee bigint, active boolean,
  pid uuid default null, max_products integer default null,
  max_team integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved uuid;
  new_limits jsonb := jsonb_strip_nulls(
    jsonb_build_object('products', max_products, 'team', max_team));
begin
  perform public.require_super_admin();
  if max_products < 1 or max_team < 1 then
    raise exception 'limits must be at least 1' using errcode = '22023';
  end if;
  if pid is null then
    insert into public.plans
      (name, setup_fee_paise, monthly_fee_paise, limits, is_active)
    values (btrim(plan_name), setup_fee, monthly_fee, new_limits, active)
    returning id into saved;
  else
    update public.plans p
       set name = btrim(plan_name), setup_fee_paise = setup_fee,
           monthly_fee_paise = monthly_fee, limits = new_limits,
           is_active = active
     where p.id = pid
    returning p.id into saved;
    if saved is null then
      raise exception 'no such plan' using errcode = 'P0002';
    end if;
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, diff)
  values (auth.uid(), 'plan.saved', 'plan', saved::text,
          jsonb_build_object('name', plan_name, 'setup_fee_paise', setup_fee,
                             'monthly_fee_paise', monthly_fee,
                             'limits', new_limits, 'is_active', active));
  return saved;
end;
$$;

-- ---------------------------------------------------------------------------
-- Limits
-- ---------------------------------------------------------------------------

-- A store's limit, or null when unlimited (no plan, or not in the plan).
create function public.plan_limit(tid uuid, what text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (p.limits ->> what)::integer
    from public.subscriptions s
    join public.plans p on p.id = s.plan_id
   where s.tenant_id = tid;
$$;
revoke all on function public.plan_limit(uuid, text) from public, anon, authenticated;

-- The advisory locks make two additions at once count each other.
create function public.check_product_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  max_products integer;
  used integer;
begin
  if new.status = 'archived' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status <> 'archived'
     and old.tenant_id = new.tenant_id then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('products:' || new.tenant_id::text, 0));
  max_products := public.plan_limit(new.tenant_id, 'products');
  if max_products is null then
    return new;
  end if;
  select count(*) into used
    from public.products p
   where p.tenant_id = new.tenant_id and p.status <> 'archived';
  if used >= max_products then
    raise exception 'product limit reached' using errcode = 'ZL001';
  end if;
  return new;
end;
$$;
revoke all on function public.check_product_limit() from public, anon, authenticated;
create trigger check_product_limit
  before insert or update of status, tenant_id on public.products
  for each row execute function public.check_product_limit();

create function public.check_team_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  max_team integer;
  used integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('team:' || new.tenant_id::text, 0));
  max_team := public.plan_limit(new.tenant_id, 'team');
  if max_team is null or exists (
    -- Already on the team (an upsert that changes their role).
    select 1 from public.tenant_members m
     where m.tenant_id = new.tenant_id and m.user_id = new.user_id
  ) then
    return new;
  end if;
  select count(*) into used
    from public.tenant_members m
   where m.tenant_id = new.tenant_id;
  if used >= max_team then
    raise exception 'team limit reached' using errcode = 'ZL002';
  end if;
  return new;
end;
$$;
revoke all on function public.check_team_limit() from public, anon, authenticated;
create trigger check_team_limit before insert on public.tenant_members
  for each row execute function public.check_team_limit();

revoke all on function public.require_super_admin() from public, anon;
revoke all on function public.record_payment(uuid, uuid, bigint, date, public.payment_method, integer, text) from public, anon;
revoke all on function public.void_payment(uuid, uuid, text) from public, anon;
revoke all on function public.set_subscription(uuid, uuid, date) from public, anon;
revoke all on function public.save_plan(text, bigint, bigint, boolean, uuid, integer, integer) from public, anon;
grant execute on function public.require_super_admin() to authenticated;
grant execute on function public.record_payment(uuid, uuid, bigint, date, public.payment_method, integer, text) to authenticated;
grant execute on function public.void_payment(uuid, uuid, text) to authenticated;
grant execute on function public.set_subscription(uuid, uuid, date) to authenticated;
grant execute on function public.save_plan(text, bigint, bigint, boolean, uuid, integer, integer) to authenticated;
