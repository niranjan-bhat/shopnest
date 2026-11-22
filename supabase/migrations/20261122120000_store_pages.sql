-- A store's information pages: About us and its policies. A fixed set of
-- slugs, each at most once per store; written in Settings, shown at
-- /pages/<slug> once published. The body is plain text (paragraphs and
-- "- " bullet lines), never HTML.

create table public.store_pages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  slug text not null
    check (slug in ('about', 'shipping', 'returns', 'privacy', 'terms')),
  title text not null check (length(btrim(title)) between 1 and 80),
  body text not null default '' check (length(body) <= 20000),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug),
  -- A published page must have something to show.
  check (not is_published or length(btrim(body)) > 0)
);

create trigger set_updated_at before update on public.store_pages
  for each row execute function public.set_updated_at();

alter table public.store_pages enable row level security;

grant select on public.store_pages to anon;
grant select, insert, update, delete on public.store_pages to authenticated;

create policy store_pages_public_read on public.store_pages
  for select to anon, authenticated
  using (is_published and public.is_live_tenant(tenant_id));
create policy store_pages_member_all on public.store_pages
  for all to authenticated
  using (public.can_manage_tenant(tenant_id))
  with check (public.can_manage_tenant(tenant_id));
