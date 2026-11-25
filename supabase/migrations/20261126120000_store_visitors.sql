-- How many people visited a store, for its merchant.
--
-- Everything is counted in people per day (India time), never in page
-- loads: one person counts once a day for visiting, once for each product
-- they open, once for adding to the bag and once for opening a chat.
--
-- A person is a keyed hash of the network address and browser, made by the
-- server with the store and the day in it, so it cannot be followed to
-- another store or another day. Hashes are only needed to count people
-- once: they are deleted from the second day on, as new visits arrive. The
-- daily totals hold no personal data and are kept for 13 months.

create table public.store_visit_keys (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  day date not null,
  visitor text not null check (visitor ~ '^[0-9a-f]{64}$'),
  -- 'visit', 'bag', 'chat' or 'product:<id>'
  what text not null check (length(what) <= 60),
  -- The network alone, on 'visit' rows: limits invented visitors.
  network text check (network ~ '^[0-9a-f]{64}$'),
  primary key (tenant_id, day, visitor, what)
);
create index store_visit_keys_day_idx on public.store_visit_keys (day);
create index store_visit_keys_network_idx
  on public.store_visit_keys (tenant_id, day, network)
  where network is not null;

create table public.store_visits (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  day date not null,
  visitors integer not null default 0,
  bag integer not null default 0,
  chats integer not null default 0,
  primary key (tenant_id, day)
);

create table public.store_product_visits (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  day date not null,
  product_id uuid not null,
  visitors integer not null default 0,
  primary key (tenant_id, day, product_id),
  foreign key (tenant_id, product_id)
    references public.products (tenant_id, id) on delete cascade
);
create index store_product_visits_product_idx
  on public.store_product_visits (tenant_id, product_id);

alter table public.store_visit_keys enable row level security;
alter table public.store_visits enable row level security;
alter table public.store_product_visits enable row level security;
revoke all on public.store_visit_keys, public.store_visits,
  public.store_product_visits from anon, authenticated;

-- Merchants read their own totals; only the server writes, and nobody but
-- the server sees the hashes.
grant select on public.store_visits, public.store_product_visits to authenticated;
create policy store_visits_read on public.store_visits
  for select to authenticated
  using ((select public.can_view_tenant(tenant_id)));
create policy store_product_visits_read on public.store_product_visits
  for select to authenticated
  using ((select public.can_view_tenant(tenant_id)));
grant select, insert, update, delete on public.store_visit_keys,
  public.store_visits, public.store_product_visits to service_role;

-- Counts one thing a person did: 'visit', 'product', 'bag' or 'chat'.
-- Repeats, stores that are not live and products not on sale count nothing.
create function public.record_store_visit(
  tid uuid, person text, net text, event text, product uuid default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if event not in ('visit', 'product', 'bag', 'chat') then
    raise exception 'unknown event' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.tenants t where t.id = tid and t.status = 'active'
  ) then
    return;
  end if;

  if not exists (
    select 1 from public.store_visit_keys k
     where k.tenant_id = tid and k.day = today
       and k.visitor = person and k.what = 'visit'
  ) then
    -- Many people can share a mobile network's address; more than this is
    -- someone making up browsers.
    if (
      select count(*) from public.store_visit_keys k
       where k.tenant_id = tid and k.day = today and k.network = net
    ) >= 300 then
      return;
    end if;
    insert into public.store_visit_keys (tenant_id, day, visitor, what, network)
    values (tid, today, person, 'visit', net)
    on conflict do nothing;
    if found then
      insert into public.store_visits as s (tenant_id, day, visitors)
      values (tid, today, 1)
      on conflict (tenant_id, day) do update set visitors = s.visitors + 1;
      delete from public.store_visit_keys k
       where k.ctid in (
         select old.ctid from public.store_visit_keys old
          where old.day < today - 1
          limit 500
            for update skip locked
       );
      delete from public.store_visits s
       where s.tenant_id = tid and s.day < today - interval '13 months';
      delete from public.store_product_visits s
       where s.tenant_id = tid and s.day < today - interval '13 months';
    end if;
  end if;

  if event = 'product' then
    if not exists (
      select 1 from public.products p
       where p.tenant_id = tid and p.id = product and p.status = 'active'
    ) then
      return;
    end if;
    insert into public.store_visit_keys (tenant_id, day, visitor, what)
    values (tid, today, person, 'product:' || product)
    on conflict do nothing;
    if found then
      insert into public.store_product_visits as s
        (tenant_id, day, product_id, visitors)
      values (tid, today, product, 1)
      on conflict (tenant_id, day, product_id)
        do update set visitors = s.visitors + 1;
    end if;
  elsif event in ('bag', 'chat') then
    insert into public.store_visit_keys (tenant_id, day, visitor, what)
    values (tid, today, person, event)
    on conflict do nothing;
    if found then
      update public.store_visits s
         set bag = s.bag + (event = 'bag')::integer,
             chats = s.chats + (event = 'chat')::integer
       where s.tenant_id = tid and s.day = today;
    end if;
  end if;
end;
$$;

-- The last `days` days up to today, for the dashboard: people per day (with
-- empty days), totals, and the five most viewed products. Runs as the
-- caller, so RLS applies too.
create function public.store_visitor_stats(tid uuid, days integer)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Kolkata')::date;
  first_day date;
begin
  if not public.can_view_tenant(tid) then
    raise exception 'not allowed to see this store' using errcode = '42501';
  end if;
  if days not between 1 and 90 then
    raise exception 'between 1 and 90 days' using errcode = '22023';
  end if;
  first_day := today - (days - 1);
  return jsonb_build_object(
    'daily', (
      select jsonb_agg(
               jsonb_build_object(
                 'day', d.day::date, 'visitors', coalesce(s.visitors, 0))
               order by d.day)
        from generate_series(first_day, today, interval '1 day') as d (day)
        left join public.store_visits s
          on s.tenant_id = tid and s.day = d.day::date
    ),
    'bag', (
      select coalesce(sum(s.bag), 0) from public.store_visits s
       where s.tenant_id = tid and s.day >= first_day
    ),
    'chats', (
      select coalesce(sum(s.chats), 0) from public.store_visits s
       where s.tenant_id = tid and s.day >= first_day
    ),
    'orders', (
      select count(*) from public.orders o
       where o.tenant_id = tid
         and o.created_at >= first_day::timestamp at time zone 'Asia/Kolkata'
    ),
    'products', (
      select coalesce(jsonb_agg(
               jsonb_build_object(
                 'id', t.id, 'name', t.name, 'visitors', t.visitors)
               order by t.visitors desc, t.name), '[]')
        from (
          select p.id, p.name, sum(v.visitors) as visitors
            from public.store_product_visits v
            join public.products p
              on p.tenant_id = v.tenant_id and p.id = v.product_id
           where v.tenant_id = tid and v.day >= first_day
           group by p.id, p.name
           order by 3 desc, 2
           limit 5
        ) t
    )
  );
end;
$$;

revoke all on function public.record_store_visit(uuid, text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.record_store_visit(uuid, text, text, text, uuid)
  to service_role;
revoke all on function public.store_visitor_stats(uuid, integer)
  from public, anon;
grant execute on function public.store_visitor_stats(uuid, integer)
  to authenticated;
