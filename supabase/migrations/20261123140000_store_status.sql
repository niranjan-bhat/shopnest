-- Phase 5b: going live, suspending, and viewing a store as its merchant.
--
--   - set_store_status moves a store between onboarding, active and
--     suspended, checks it is ready first, and logs it;
--   - super admins read every store but may change one only while they have
--     an edit session on it (30 minutes, logged). can_manage_tenant, which
--     every write policy and function already uses, now requires it, so no
--     screen or API call can skip it;
--   - is_suspended_host lets a storefront tell "suspended" from "unknown"
--     without showing anything else about the store.

-- Shown to the store's team; null unless suspended.
alter table public.tenants
  add column suspended_reason text check (length(suspended_reason) between 1 and 500);

-- ---------------------------------------------------------------------------
-- Edit sessions
-- ---------------------------------------------------------------------------

create table public.admin_edit_sessions (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  expires_at timestamptz not null,
  primary key (tenant_id, user_id)
);
create index admin_edit_sessions_user_id_idx on public.admin_edit_sessions (user_id);

alter table public.admin_edit_sessions enable row level security;
grant select on public.admin_edit_sessions to authenticated;
create policy admin_edit_sessions_own_read on public.admin_edit_sessions
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Members always; super admins during an edit session on that store.
create or replace function public.can_manage_tenant(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_tenant_member(tid)
      or (public.is_super_admin() and exists (
            select 1 from public.admin_edit_sessions s
             where s.tenant_id = tid
               and s.user_id = (select auth.uid())
               and s.expires_at > now()));
$$;

-- Members and super admins: may open the store in the dashboard.
create function public.can_view_tenant(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_tenant_member(tid) or public.is_super_admin();
$$;

-- Reads that went through can_manage_tenant still work without a session.
do $$
declare
  t text;
begin
  foreach t in array array[
    'tenants', 'tenant_domains', 'tenant_members', 'tenant_themes',
    'categories', 'products', 'product_categories', 'product_variants',
    'product_images', 'banners', 'store_pages', 'orders', 'order_items',
    'subscriptions'
  ] loop
    execute format(
      'create policy %I on public.%I for select to authenticated
         using ((select public.is_super_admin()))',
      t || '_admin_read', t);
  end loop;
end;
$$;

-- Starts (or restarts) a 30-minute edit session; returns when it ends.
create function public.allow_editing(tid uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  ends timestamptz := now() + interval '30 minutes';
begin
  if not public.is_super_admin() then
    raise exception 'super admins only' using errcode = '42501';
  end if;
  insert into public.admin_edit_sessions (tenant_id, user_id, expires_at)
  values (tid, me, ends)
  on conflict (tenant_id, user_id) do update set expires_at = excluded.expires_at;
  insert into public.audit_log (tenant_id, actor_id, action, entity, entity_id)
  values (tid, me, 'store.editing_allowed', 'tenant', tid::text);
  return ends;
end;
$$;

create function public.stop_editing(tid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_super_admin() then
    raise exception 'super admins only' using errcode = '42501';
  end if;
  delete from public.admin_edit_sessions
   where tenant_id = tid and user_id = auth.uid();
  if found then
    insert into public.audit_log (tenant_id, actor_id, action, entity, entity_id)
    values (tid, auth.uid(), 'store.editing_stopped', 'tenant', tid::text);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Status
-- ---------------------------------------------------------------------------

-- What a store still needs before it can go live: 'theme' (never published)
-- and 'products' (none active). A WhatsApp number is always set. Super
-- admins only; also called by set_store_status.
create function public.store_missing(tid uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_super_admin() then
    raise exception 'super admins only' using errcode = '42501';
  end if;
  return array_remove(array[
    case when not exists (
      select 1 from public.tenant_themes t
       where t.tenant_id = tid and t.published is not null
    ) then 'theme' end,
    case when not exists (
      select 1 from public.products p
       where p.tenant_id = tid and p.status = 'active'
    ) then 'products' end
  ], null);
end;
$$;

-- Allowed: onboarding -> active (when ready), active -> suspended (with a
-- reason), suspended -> active. Returns { status: "ok" } or
-- { status: "not_ready", missing: [...] }.
create function public.set_store_status(
  tid uuid,
  next public.tenant_status,
  reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current public.tenant_status;
  missing text[];
  why text := nullif(btrim(reason), '');
begin
  if not public.is_super_admin() then
    raise exception 'super admins only' using errcode = '42501';
  end if;
  select t.status into current from public.tenants t where t.id = tid for update;
  if not found then
    raise exception 'no such store' using errcode = 'P0002';
  end if;
  if current = next then
    return jsonb_build_object('status', 'ok');
  end if;
  if not ((current, next) in (
    ('onboarding', 'active'), ('active', 'suspended'), ('suspended', 'active')
  )) then
    raise exception 'cannot go from % to %', current, next using errcode = '22023';
  end if;

  if current = 'onboarding' then
    missing := public.store_missing(tid);
    if cardinality(missing) > 0 then
      return jsonb_build_object('status', 'not_ready', 'missing', to_jsonb(missing));
    end if;
  end if;
  if next = 'suspended' and why is null then
    raise exception 'a reason is needed' using errcode = '22023';
  end if;

  update public.tenants
     set status = next,
         suspended_reason = case when next = 'suspended' then why end
   where id = tid;
  insert into public.audit_log (tenant_id, actor_id, action, entity, entity_id, diff)
  values (tid, auth.uid(),
          case when next = 'suspended' then 'store.suspended'
               when current = 'suspended' then 'store.reactivated'
               else 'store.live' end,
          'tenant', tid::text,
          case when why is not null then jsonb_build_object('reason', why) end);
  return jsonb_build_object('status', 'ok');
end;
$$;

-- True when the host belongs to a suspended store.
create function public.is_suspended_host(host text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.tenant_domains d
      join public.tenants t on t.id = d.tenant_id
     where d.hostname = host and t.status = 'suspended'
  );
$$;

revoke all on function public.can_view_tenant(uuid) from public, anon;
revoke all on function public.allow_editing(uuid) from public, anon;
revoke all on function public.stop_editing(uuid) from public, anon;
revoke all on function public.store_missing(uuid) from public, anon;
revoke all on function public.set_store_status(uuid, public.tenant_status, text)
  from public, anon;
grant execute on function public.can_view_tenant(uuid) to authenticated;
grant execute on function public.allow_editing(uuid) to authenticated;
grant execute on function public.stop_editing(uuid) to authenticated;
grant execute on function public.store_missing(uuid) to authenticated;
grant execute on function public.set_store_status(uuid, public.tenant_status, text)
  to authenticated;
grant execute on function public.is_suspended_host(text) to anon, authenticated;
