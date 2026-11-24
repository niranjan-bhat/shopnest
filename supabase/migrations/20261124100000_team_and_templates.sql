-- Phase 5d: team roles, team changes and templates per plan.
--
--   - staff work on products, categories and orders; the storefront, pages
--     and store settings are for owners (and super admins while editing);
--   - super admins add, change and remove people. A store that has an owner
--     keeps at least one;
--   - a plan offers every template or a chosen few. Like the other limits it
--     stops new choices only: a store keeps the template it has.

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------

-- Owners always; super admins during an edit session on that store.
create function public.can_own_tenant(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
           select 1 from public.tenant_members m
            where m.tenant_id = tid
              and m.user_id = (select auth.uid())
              and m.role = 'owner')
      or (public.is_super_admin() and exists (
            select 1 from public.admin_edit_sessions s
             where s.tenant_id = tid
               and s.user_id = (select auth.uid())
               and s.expires_at > now()));
$$;
revoke all on function public.can_own_tenant(uuid) from public, anon;
grant execute on function public.can_own_tenant(uuid) to authenticated;

alter policy tenants_member_update on public.tenants
  using (public.can_own_tenant(id))
  with check (public.can_own_tenant(id));
alter policy tenants_member_update on public.tenants
  rename to tenants_owner_update;

alter policy tenant_themes_member_update on public.tenant_themes
  using (public.can_own_tenant(tenant_id))
  with check (public.can_own_tenant(tenant_id));
alter policy tenant_themes_member_update on public.tenant_themes
  rename to tenant_themes_owner_update;

drop policy banners_member_all on public.banners;
create policy banners_member_read on public.banners
  for select to authenticated
  using (public.can_manage_tenant(tenant_id));
create policy banners_owner_all on public.banners
  for all to authenticated
  using (public.can_own_tenant(tenant_id))
  with check (public.can_own_tenant(tenant_id));

drop policy store_pages_member_all on public.store_pages;
create policy store_pages_member_read on public.store_pages
  for select to authenticated
  using (public.can_manage_tenant(tenant_id));
create policy store_pages_owner_all on public.store_pages
  for all to authenticated
  using (public.can_own_tenant(tenant_id))
  with check (public.can_own_tenant(tenant_id));

-- As before, for owners only.
create or replace function public.reorder_banners(
  tid uuid,
  ordered_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.can_own_tenant(tid) then
    raise exception 'not allowed to manage this store' using errcode = '42501';
  end if;

  if cardinality(ordered_ids) is distinct from (
       select count(distinct id) from unnest(ordered_ids) as u(id)
     )
     or cardinality(ordered_ids) is distinct from (
       select count(*) from public.banners b
        where b.tenant_id = tid and b.id = any (ordered_ids)
     )
     or cardinality(ordered_ids) is distinct from (
       select count(*) from public.banners b where b.tenant_id = tid
     )
  then
    raise exception 'ordered_ids must list every banner of the store once'
      using errcode = '22023';
  end if;

  update public.banners b
     set position = o.ord - 1
    from unnest(ordered_ids) with ordinality as o(id, ord)
   where b.tenant_id = tid
     and b.id = o.id
     and b.position is distinct from o.ord - 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- Team
-- ---------------------------------------------------------------------------

-- Adds someone whose account exists (the server creates it first). False
-- when they are on the team already. Over the limit raises ZL002.
create function public.add_member(
  tid uuid, member_email text, member_role public.member_role
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  perform public.require_super_admin();
  select u.id into uid
    from auth.users u
   where lower(u.email) = lower(btrim(member_email))
     and u.deleted_at is null
     and not u.is_sso_user;
  if uid is null then
    raise exception 'this person has no account' using errcode = 'P0002';
  end if;
  insert into public.tenant_members (tenant_id, user_id, role)
  values (tid, uid, member_role)
  on conflict (tenant_id, user_id) do nothing;
  if not found then
    return false;
  end if;
  insert into public.audit_log (tenant_id, actor_id, action, entity, entity_id, diff)
  values (tid, auth.uid(), 'member.added', 'tenant_member', uid::text,
          jsonb_build_object('role', member_role));
  return true;
end;
$$;

-- Changes someone's role, or removes them (new_role null). False, and
-- nothing changes, when the store would be left without an owner.
create function public.change_member(
  tid uuid, uid uuid, new_role public.member_role default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_role public.member_role;
begin
  perform public.require_super_admin();
  -- The lock check_team_limit takes: two changes at once see each other.
  perform pg_advisory_xact_lock(hashtextextended('team:' || tid::text, 0));
  select m.role into old_role
    from public.tenant_members m
   where m.tenant_id = tid and m.user_id = uid;
  -- Already gone, or already that role.
  if old_role is null or old_role is not distinct from new_role then
    return true;
  end if;
  if old_role = 'owner' and not exists (
    select 1 from public.tenant_members m
     where m.tenant_id = tid and m.user_id <> uid and m.role = 'owner'
  ) then
    return false;
  end if;
  if new_role is null then
    delete from public.tenant_members m
     where m.tenant_id = tid and m.user_id = uid;
  else
    update public.tenant_members m set role = new_role
     where m.tenant_id = tid and m.user_id = uid;
  end if;
  insert into public.audit_log (tenant_id, actor_id, action, entity, entity_id, diff)
  values (tid, auth.uid(),
          case when new_role is null then 'member.removed' else 'member.role_changed' end,
          'tenant_member', uid::text,
          jsonb_build_object('role', jsonb_build_array(old_role, new_role)));
  return true;
end;
$$;

revoke all on function public.add_member(uuid, text, public.member_role) from public, anon;
revoke all on function public.change_member(uuid, uuid, public.member_role) from public, anon;
grant execute on function public.add_member(uuid, text, public.member_role) to authenticated;
grant execute on function public.change_member(uuid, uuid, public.member_role) to authenticated;

-- ---------------------------------------------------------------------------
-- Templates per plan
-- ---------------------------------------------------------------------------

-- Never used; a minimum plan needs plans in an order, and they have none.
alter table public.templates drop column min_plan_id;

-- Null: every template, including ones added later.
alter table public.plans
  add column template_keys text[] check (cardinality(template_keys) > 0);

-- An active template the plan offers; a store without a plan has them all.
create function public.plan_has_template(plan uuid, template text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
           select 1 from public.templates t
            where t.key = template and t.is_active)
     and not exists (
           select 1 from public.plans p
            where p.id = plan
              and p.template_keys is not null
              and template <> all (p.template_keys));
$$;
revoke all on function public.plan_has_template(uuid, text) from public, anon, authenticated;

-- A store may move only to a template its plan offers. The theme JSON names
-- the template too (storefronts render that one), so it is checked as well.
-- Keeping, or going back to, a template the store has is always fine.
create function public.check_template()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted text;
begin
  for wanted in
    select distinct k
      from unnest(array[
        new.template_key,
        new.draft ->> 'templateKey',
        new.published ->> 'templateKey'
      ]) as k
     where k is not null
       and k is distinct from old.template_key
       and k is distinct from old.draft ->> 'templateKey'
       and k is distinct from old.published ->> 'templateKey'
  loop
    if not public.plan_has_template(
      (select s.plan_id from public.subscriptions s
        where s.tenant_id = new.tenant_id),
      wanted
    ) then
      raise exception 'template not in plan' using errcode = 'ZL003';
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function public.check_template() from public, anon, authenticated;
create trigger check_template
  before update of template_key, draft, published on public.tenant_themes
  for each row execute function public.check_template();

-- As before, plus the plan's templates (null: all).
drop function public.save_plan(text, bigint, bigint, boolean, uuid, integer, integer);
create function public.save_plan(
  plan_name text, setup_fee bigint, monthly_fee bigint, active boolean,
  pid uuid default null, max_products integer default null,
  max_team integer default null, only_templates text[] default null
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
  if exists (
    select 1 from unnest(only_templates) as k
     where not exists (select 1 from public.templates t where t.key = k)
  ) then
    raise exception 'unknown template' using errcode = '22023';
  end if;
  if pid is null then
    insert into public.plans
      (name, setup_fee_paise, monthly_fee_paise, limits, is_active, template_keys)
    values (btrim(plan_name), setup_fee, monthly_fee, new_limits, active, only_templates)
    returning id into saved;
  else
    update public.plans p
       set name = btrim(plan_name), setup_fee_paise = setup_fee,
           monthly_fee_paise = monthly_fee, limits = new_limits,
           is_active = active, template_keys = only_templates
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
                             'limits', new_limits, 'is_active', active,
                             'templates', only_templates));
  return saved;
end;
$$;
revoke all on function public.save_plan(text, bigint, bigint, boolean, uuid, integer, integer, text[]) from public, anon;
grant execute on function public.save_plan(text, bigint, bigint, boolean, uuid, integer, integer, text[]) to authenticated;

-- As before, plus: the template must be in the plan.
create or replace function public.create_store(actor uuid, root text, store jsonb)
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
  if not public.plan_has_template(
    (store ->> 'plan_id')::uuid, store ->> 'template_key'
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
