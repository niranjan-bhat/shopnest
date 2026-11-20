-- Phase 2: core schema. The 17 tables from docs/PLAN.md, with enums, indexes
-- and triggers. Access control (RLS, grants) is in the next migration.
--
-- Conventions
--   - uuid primary keys, timestamptz times, money as bigint paise.
--   - Every tenant-owned table has tenant_id. Child tables reference their
--     parent through (tenant_id, id), so a row can never point at another
--     tenant's parent.
--   - R2 object keys (never URLs), and always under tenants/<tenant_id>/.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.tenant_status as enum ('onboarding', 'active', 'suspended');
create type public.domain_kind as enum ('subdomain', 'custom');
create type public.member_role as enum ('owner', 'staff');
create type public.price_mode as enum ('fixed', 'on_request');
create type public.product_status as enum ('draft', 'active', 'archived');
create type public.order_channel as enum ('whatsapp', 'razorpay');
create type public.order_status as enum (
  'pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'
);
create type public.subscription_status as enum ('active', 'past_due', 'cancelled');

-- An R2 object key such as tenants/<uuid>/products/<uuid>/1.webp.
create domain public.r2_key as text
  check (value ~ '^tenants/[0-9a-f-]{36}/[A-Za-z0-9._/-]+$' and value !~ '\.\.');

-- URL slugs: lower-case letters, digits and single hyphens.
create domain public.slug as text
  check (value ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(value) <= 100);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Platform and access
-- ---------------------------------------------------------------------------

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  setup_fee_paise bigint not null default 0 check (setup_fee_paise >= 0),
  monthly_fee_paise bigint not null default 0 check (monthly_fee_paise >= 0),
  limits jsonb not null default '{}' check (jsonb_typeof(limits) = 'object'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Templates live in code; this table only says which are enabled.
create table public.templates (
  key text primary key check (key ~ '^[a-z][a-z0-9-]*$'),
  name text not null,
  is_active boolean not null default true,
  min_plan_id uuid references public.plans (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug public.slug not null unique,
  name text not null check (length(btrim(name)) between 1 and 120),
  status public.tenant_status not null default 'onboarding',
  business_type text not null default 'clothing',
  -- E.164, e.g. +919876543210.
  whatsapp_number text not null check (whatsapp_number ~ '^\+[1-9][0-9]{7,14}$'),
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenant_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- Bare host name, no port: saree-demo.shopnest.in, www.merchant.com.
  hostname text not null unique
    check (hostname ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'),
  kind public.domain_kind not null,
  is_primary boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
create index tenant_domains_tenant_id_idx on public.tenant_domains (tenant_id);
create unique index tenant_domains_one_primary_idx
  on public.tenant_domains (tenant_id) where is_primary;

-- One row per auth user, created by the trigger at the end of this file.
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenant_members (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  role public.member_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
create index tenant_members_user_id_idx on public.tenant_members (user_id);

create table public.tenant_themes (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  template_key text not null references public.templates (key),
  draft jsonb not null default '{}' check (jsonb_typeof(draft) = 'object'),
  -- Null until the merchant first publishes.
  published jsonb check (published is null or jsonb_typeof(published) = 'object'),
  published_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  parent_id uuid,
  name text not null check (length(btrim(name)) between 1 and 80),
  slug public.slug not null,
  position integer not null default 0,
  image_key public.r2_key,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug),
  unique (tenant_id, id),
  foreign key (tenant_id, parent_id)
    references public.categories (tenant_id, id) on delete set null (parent_id),
  check (parent_id is null or parent_id <> id),
  check (image_key is null or image_key like 'tenants/' || tenant_id || '/%')
);
create index categories_tenant_position_idx on public.categories (tenant_id, position);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 200),
  slug public.slug not null,
  description text,
  price_mode public.price_mode not null default 'fixed',
  -- Null exactly when the price is on request.
  price_paise bigint check (price_paise >= 0),
  compare_at_paise bigint check (compare_at_paise >= 0),
  status public.product_status not null default 'draft',
  -- Fabric, length, blouse piece, purity, weight...
  attributes jsonb not null default '{}' check (jsonb_typeof(attributes) = 'object'),
  is_featured boolean not null default false,
  seo jsonb not null default '{}' check (jsonb_typeof(seo) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug),
  unique (tenant_id, id),
  check ((price_mode = 'fixed') = (price_paise is not null)),
  check (compare_at_paise is null or compare_at_paise > price_paise)
);
create index products_tenant_status_featured_idx
  on public.products (tenant_id, status, is_featured);

create table public.product_categories (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  product_id uuid not null,
  category_id uuid not null,
  primary key (product_id, category_id),
  foreign key (tenant_id, product_id)
    references public.products (tenant_id, id) on delete cascade,
  foreign key (tenant_id, category_id)
    references public.categories (tenant_id, id) on delete cascade
);
create index product_categories_tenant_category_idx
  on public.product_categories (tenant_id, category_id);

-- Every product has at least one variant; simple products get one default.
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  product_id uuid not null,
  sku text,
  options jsonb not null default '{}' check (jsonb_typeof(options) = 'object'),
  -- Overrides the product price when set.
  price_paise bigint check (price_paise >= 0),
  stock_qty integer not null default 0 check (stock_qty >= 0),
  track_inventory boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, product_id)
    references public.products (tenant_id, id) on delete cascade
);
create index product_variants_product_id_idx on public.product_variants (product_id);
create unique index product_variants_tenant_sku_idx
  on public.product_variants (tenant_id, sku) where sku is not null;

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  product_id uuid not null,
  r2_key public.r2_key not null,
  alt text,
  position integer not null default 0,
  width integer check (width > 0),
  height integer check (height > 0),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, product_id)
    references public.products (tenant_id, id) on delete cascade,
  check (r2_key like 'tenants/' || tenant_id || '/%')
);
create index product_images_product_position_idx
  on public.product_images (product_id, position);

-- Hero and promo banners.
create table public.banners (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  image_key public.r2_key not null,
  heading text,
  link text,
  position integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at is null or ends_at is null or ends_at > starts_at),
  check (image_key like 'tenants/' || tenant_id || '/%')
);
create index banners_tenant_position_idx on public.banners (tenant_id, position);

-- ---------------------------------------------------------------------------
-- Orders and billing
-- ---------------------------------------------------------------------------

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- Always assigned by assign_order_number(); any value passed in is replaced.
  order_number integer not null default 0,
  customer_name text not null,
  customer_phone text not null,
  address jsonb not null check (jsonb_typeof(address) = 'object'),
  channel public.order_channel not null default 'whatsapp',
  status public.order_status not null default 'pending',
  subtotal_paise bigint not null check (subtotal_paise >= 0),
  total_paise bigint not null check (total_paise >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, order_number),
  unique (tenant_id, id)
);
create index orders_tenant_created_idx on public.orders (tenant_id, created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  order_id uuid not null,
  variant_id uuid,
  -- Snapshots survive later product edits and deletes.
  name_snapshot text not null,
  options_snapshot jsonb not null default '{}'
    check (jsonb_typeof(options_snapshot) = 'object'),
  -- Null when the price is on request.
  unit_price_paise bigint check (unit_price_paise >= 0),
  qty integer not null check (qty > 0),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, order_id)
    references public.orders (tenant_id, id) on delete cascade,
  foreign key (tenant_id, variant_id)
    references public.product_variants (tenant_id, id) on delete set null (variant_id)
);
create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_variant_id_idx on public.order_items (variant_id);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  status public.subscription_status not null default 'active',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_tenant_id_idx on public.subscriptions (tenant_id);
create index subscriptions_plan_id_idx on public.subscriptions (plan_id);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  -- Null for platform-level actions.
  tenant_id uuid references public.tenants (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  diff jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_tenant_created_idx on public.audit_log (tenant_id, created_at desc);
create index audit_log_actor_id_idx on public.audit_log (actor_id);

-- Foreign-key indexes not covered above.
create index templates_min_plan_id_idx on public.templates (min_plan_id);
create index tenant_themes_template_key_idx on public.tenant_themes (template_key);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger set_updated_at before update on public.plans
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.tenants
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.tenant_themes
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.product_variants
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.banners
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Per-tenant order numbers starting at 1001. The advisory lock serialises
-- concurrent orders for the same tenant; other tenants are not blocked.
create function public.assign_order_number()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('orders:' || new.tenant_id::text, 0));
  select coalesce(max(o.order_number), 1000) + 1
    into new.order_number
    from public.orders o
   where o.tenant_id = new.tenant_id;
  return new;
end;
$$;

create trigger assign_order_number before insert on public.orders
  for each row execute function public.assign_order_number();

-- Order numbers never change once assigned.
create function public.keep_order_number()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.order_number := old.order_number;
  return new;
end;
$$;

create trigger keep_order_number before update on public.orders
  for each row execute function public.keep_order_number();

-- Creates the profile row for every new auth user.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''));
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
