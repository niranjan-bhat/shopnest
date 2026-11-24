-- Phase 5a: creating a store from the super admin area.
--
--   - two starter plans (names, fees and limits are editable later);
--   - exactly one subscription per store; existing stores go on Growth;
--   - create_store adds the store, its subdomain, draft theme, owner and
--     subscription in one transaction, so a failure leaves nothing behind;
--   - store_team lists a store's people with their emails, which live in
--     auth.users and are otherwise out of reach.

-- limits: { products, team }; a missing key means unlimited. `team` counts
-- everyone with access, owners included. Enforced from Phase 5c.
insert into public.plans (id, name, monthly_fee_paise, limits) values
  ('00000000-0000-4000-8000-000000000001', 'Starter', 99900, '{"products": 100, "team": 2}'),
  ('00000000-0000-4000-8000-000000000002', 'Growth', 249900, '{"products": 500, "team": 6}')
on conflict (name) do nothing;

drop index public.subscriptions_tenant_id_idx;
alter table public.subscriptions
  add constraint subscriptions_tenant_id_key unique (tenant_id);

insert into public.subscriptions (tenant_id, plan_id)
select t.id, p.id
  from public.tenants t
  cross join public.plans p
 where p.name = 'Growth'
on conflict (tenant_id) do nothing;

-- store: { name, slug, business_type, whatsapp_number, owner_email,
--          template_key, plan_id, theme }
-- root: the platform's root domain without a port (zarify.in, localhost).
--
-- The owner's account must exist (the server creates it first). Returns
-- { status: "created", tenant_id } or, when the address is in use or
-- reserved, { status: "taken" } and nothing is saved.
--
-- SECURITY DEFINER to read auth.users; only the service role may call it.
-- The actor is checked again here, so a server bug cannot skip it.
create function public.create_store(actor uuid, root text, store jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_slug text := store ->> 'slug';
  host text := (store ->> 'slug') || '.' || root;
  owner_id uuid;
  new_id uuid;
begin
  if not exists (
    select 1 from public.profiles p where p.user_id = actor and p.is_super_admin
  ) then
    raise exception 'only a super admin can create a store' using errcode = '42501';
  end if;

  if new_slug is null or length(new_slug) not between 3 and 40 then
    raise exception 'invalid store address' using errcode = '22023';
  end if;
  if jsonb_typeof(store -> 'theme') is distinct from 'object' then
    raise exception 'missing theme' using errcode = '22023';
  end if;

  -- Keep in step with RESERVED_SLUGS in src/features/admin/store-schema.ts.
  if new_slug = any (array[
    'admin', 'api', 'app', 'assets', 'auth', 'billing', 'blog', 'cdn',
    'dashboard', 'dev', 'docs', 'email', 'ftp', 'help', 'images', 'login',
    'mail', 'media', 'preview', 'send', 'shop', 'sites', 'smtp', 'staging',
    'static', 'status', 'store', 'support', 'test', 'www', 'zarify'
  ]) then
    return jsonb_build_object('status', 'taken');
  end if;

  if not exists (
    select 1 from public.plans p
     where p.id = (store ->> 'plan_id')::uuid and p.is_active
  ) then
    raise exception 'unknown plan' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.templates t
     where t.key = store ->> 'template_key' and t.is_active
  ) then
    raise exception 'unknown template' using errcode = '22023';
  end if;

  select u.id into owner_id
    from auth.users u
   where lower(u.email) = lower(store ->> 'owner_email')
     and u.deleted_at is null
     and not u.is_sso_user;
  if owner_id is null then
    raise exception 'the owner has no account' using errcode = '22023';
  end if;

  -- Someone else may take the address between any check and this insert, so
  -- the unique constraints decide.
  begin
    insert into public.tenants (slug, name, business_type, whatsapp_number)
    values (new_slug, store ->> 'name', store ->> 'business_type',
            store ->> 'whatsapp_number')
    returning id into new_id;

    insert into public.tenant_domains
      (tenant_id, hostname, kind, is_primary, verified_at)
    values (new_id, host, 'subdomain', true, now());
  exception when unique_violation then
    return jsonb_build_object('status', 'taken');
  end;

  insert into public.tenant_themes (tenant_id, template_key, draft)
  values (new_id, store ->> 'template_key', store -> 'theme');

  insert into public.tenant_members (tenant_id, user_id, role)
  values (new_id, owner_id, 'owner');

  insert into public.subscriptions (tenant_id, plan_id)
  values (new_id, (store ->> 'plan_id')::uuid);

  insert into public.audit_log (tenant_id, actor_id, action, entity, entity_id, diff)
  values (new_id, actor, 'store.created', 'tenant', new_id::text,
          jsonb_build_object('slug', new_slug, 'plan_id', store ->> 'plan_id',
                             'owner_id', owner_id));

  return jsonb_build_object('status', 'created', 'tenant_id', new_id);
end;
$$;

revoke all on function public.create_store(uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_store(uuid, text, jsonb) to service_role;

-- A store's people, owners first. Super admins only.
create function public.store_team(tid uuid)
returns table (user_id uuid, email text, role public.member_role, signed_in boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_super_admin() then
    raise exception 'super admins only' using errcode = '42501';
  end if;
  return query
    select m.user_id, u.email::text, m.role, u.last_sign_in_at is not null
      from public.tenant_members m
      join auth.users u on u.id = m.user_id
     where m.tenant_id = tid
     order by m.role, m.created_at;
end;
$$;

revoke all on function public.store_team(uuid) from public, anon, authenticated;
grant execute on function public.store_team(uuid) to authenticated;
