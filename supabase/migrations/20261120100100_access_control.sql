-- Phase 2: access control. RLS on every table, plus explicit grants.
--
-- Model (docs/PLAN.md, "RLS model")
--   - anon reads only public storefront data of active stores: active
--     products and categories, their variants, images and category links,
--     banners in their date window, store domains, and the published theme.
--   - Tenant members (and super admins) manage their own store's catalog and
--     read and update its orders.
--   - Nobody creates orders through the API: the server re-prices the cart
--     and inserts with the service role (Phase 4).
--   - Platform tables (plans, templates, subscriptions, memberships, tenant
--     status, profiles.is_super_admin) are changed only by the service role.
--
-- Grants are explicit. Supabase grants anon and authenticated everything on
-- new tables by default; that default is revoked here, so every future table
-- must be granted on purpose in its migration.

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
revoke all on all tables in schema public from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers. SECURITY DEFINER so they can read the tables they check without
-- recursing into those tables' own policies.
-- ---------------------------------------------------------------------------

create function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_super_admin from public.profiles p where p.user_id = (select auth.uid())),
    false
  );
$$;

create function public.is_tenant_member(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tenant_members m
     where m.tenant_id = tid and m.user_id = (select auth.uid())
  );
$$;

-- Members of the tenant, or a super admin.
create function public.can_manage_tenant(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_tenant_member(tid) or public.is_super_admin();
$$;

-- The tenant's storefront is public.
create function public.is_live_tenant(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tenants t where t.id = tid and t.status = 'active'
  );
$$;

-- The product is on sale in a public storefront.
create function public.is_live_product(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.products p
      join public.tenants t on t.id = p.tenant_id
     where p.id = pid and p.status = 'active' and t.status = 'active'
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS on every table
-- ---------------------------------------------------------------------------

alter table public.plans enable row level security;
alter table public.templates enable row level security;
alter table public.tenants enable row level security;
alter table public.tenant_domains enable row level security;
alter table public.profiles enable row level security;
alter table public.tenant_members enable row level security;
alter table public.tenant_themes enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_categories enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.banners enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.subscriptions enable row level security;
alter table public.audit_log enable row level security;

-- ---------------------------------------------------------------------------
-- Platform and access
-- ---------------------------------------------------------------------------

grant select on public.plans to authenticated;
create policy plans_read on public.plans
  for select to authenticated
  using (is_active or (select public.is_super_admin()));

grant select on public.templates to authenticated;
create policy templates_read on public.templates
  for select to authenticated
  using (true);

-- Merchants may edit their store's name and contact details; status is
-- platform-controlled.
grant select on public.tenants to anon, authenticated;
grant update (name, whatsapp_number, business_type) on public.tenants to authenticated;
create policy tenants_public_read on public.tenants
  for select to anon, authenticated
  using (status = 'active');
create policy tenants_member_read on public.tenants
  for select to authenticated
  using (public.can_manage_tenant(id));
create policy tenants_member_update on public.tenants
  for update to authenticated
  using (public.can_manage_tenant(id))
  with check (public.can_manage_tenant(id));

grant select on public.tenant_domains to anon, authenticated;
create policy tenant_domains_public_read on public.tenant_domains
  for select to anon, authenticated
  using (public.is_live_tenant(tenant_id));
create policy tenant_domains_member_read on public.tenant_domains
  for select to authenticated
  using (public.can_manage_tenant(tenant_id));

-- Users edit their own name and phone, never is_super_admin.
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
create policy profiles_read on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_super_admin()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select on public.tenant_members to authenticated;
create policy tenant_members_read on public.tenant_members
  for select to authenticated
  using (user_id = (select auth.uid()) or public.can_manage_tenant(tenant_id));

-- anon sees only the published theme (column grant), never the draft.
grant select (tenant_id, template_key, published, published_at)
  on public.tenant_themes to anon;
grant select, update (template_key, draft, published, published_at)
  on public.tenant_themes to authenticated;
create policy tenant_themes_public_read on public.tenant_themes
  for select to anon
  using (published is not null and public.is_live_tenant(tenant_id));
create policy tenant_themes_member_read on public.tenant_themes
  for select to authenticated
  using (public.can_manage_tenant(tenant_id));
create policy tenant_themes_member_update on public.tenant_themes
  for update to authenticated
  using (public.can_manage_tenant(tenant_id))
  with check (public.can_manage_tenant(tenant_id));

-- ---------------------------------------------------------------------------
-- Catalog: public reads of live data; members manage their own store.
-- ---------------------------------------------------------------------------

grant select on public.categories, public.products, public.product_categories,
  public.product_variants, public.product_images, public.banners
  to anon;
grant select, insert, update, delete on public.categories, public.products,
  public.product_categories, public.product_variants, public.product_images,
  public.banners
  to authenticated;

create policy categories_public_read on public.categories
  for select to anon, authenticated
  using (is_active and public.is_live_tenant(tenant_id));
create policy categories_member_all on public.categories
  for all to authenticated
  using (public.can_manage_tenant(tenant_id))
  with check (public.can_manage_tenant(tenant_id));

create policy products_public_read on public.products
  for select to anon, authenticated
  using (status = 'active' and public.is_live_tenant(tenant_id));
create policy products_member_all on public.products
  for all to authenticated
  using (public.can_manage_tenant(tenant_id))
  with check (public.can_manage_tenant(tenant_id));

create policy product_categories_public_read on public.product_categories
  for select to anon, authenticated
  using (public.is_live_product(product_id));
create policy product_categories_member_all on public.product_categories
  for all to authenticated
  using (public.can_manage_tenant(tenant_id))
  with check (public.can_manage_tenant(tenant_id));

create policy product_variants_public_read on public.product_variants
  for select to anon, authenticated
  using (public.is_live_product(product_id));
create policy product_variants_member_all on public.product_variants
  for all to authenticated
  using (public.can_manage_tenant(tenant_id))
  with check (public.can_manage_tenant(tenant_id));

create policy product_images_public_read on public.product_images
  for select to anon, authenticated
  using (public.is_live_product(product_id));
create policy product_images_member_all on public.product_images
  for all to authenticated
  using (public.can_manage_tenant(tenant_id))
  with check (public.can_manage_tenant(tenant_id));

create policy banners_public_read on public.banners
  for select to anon, authenticated
  using (
    public.is_live_tenant(tenant_id)
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );
create policy banners_member_all on public.banners
  for all to authenticated
  using (public.can_manage_tenant(tenant_id))
  with check (public.can_manage_tenant(tenant_id));

-- ---------------------------------------------------------------------------
-- Orders and billing. No insert grants: orders are created server-side.
-- ---------------------------------------------------------------------------

grant select on public.orders to authenticated;
grant update (status, notes) on public.orders to authenticated;
create policy orders_member_read on public.orders
  for select to authenticated
  using (public.can_manage_tenant(tenant_id));
create policy orders_member_update on public.orders
  for update to authenticated
  using (public.can_manage_tenant(tenant_id))
  with check (public.can_manage_tenant(tenant_id));

grant select on public.order_items to authenticated;
create policy order_items_member_read on public.order_items
  for select to authenticated
  using (public.can_manage_tenant(tenant_id));

grant select on public.subscriptions to authenticated;
create policy subscriptions_member_read on public.subscriptions
  for select to authenticated
  using (public.can_manage_tenant(tenant_id));

grant select on public.audit_log to authenticated;
create policy audit_log_read on public.audit_log
  for select to authenticated
  using (
    (select public.is_super_admin())
    or (tenant_id is not null and public.is_tenant_member(tenant_id))
  );
