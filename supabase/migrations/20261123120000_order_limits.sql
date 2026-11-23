-- Phase 4d: spam limits on placing orders, inside place_order so no path
-- can skip them (docs/PLAN.md, "Rate limiting on order creation").
--
--   - 3 orders an hour from one phone number at one store;
--   - 10 orders an hour from one network address, across all stores.
--
-- The network address is never stored. createOrder sends `client`, a keyed
-- hash of it (HMAC with a server secret), and only that is kept, in
-- orders.client_hash. Addresses the server cannot see (none, or a local one
-- in development) send null and only the phone limit applies.
--
-- A limited request saves nothing and returns { status: "limited",
-- limit: "phone" | "network" }. A repeat of a checkout that was already
-- placed still returns its order.
--
-- Adding the parameter changes the function's signature, so the old one is
-- dropped and place_order is defined again; apart from the limits and the
-- stored hash it is unchanged (20261123100000_place_order.sql).

alter table public.orders
  add column client_hash text check (client_hash ~ '^[0-9a-f]{64}$');

create index orders_tenant_phone_created_idx
  on public.orders (tenant_id, customer_phone, created_at desc);
create index orders_client_created_idx
  on public.orders (client_hash, created_at desc)
  where client_hash is not null;

drop function public.place_order(uuid, uuid, jsonb, jsonb);

create function public.place_order(
  tid uuid,
  checkout uuid,
  customer jsonb,
  items jsonb,
  client text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  placed_id uuid;
  line_count integer;
  priced jsonb;
  problems jsonb;
  subtotal bigint;
begin
  if checkout is null then
    raise exception 'a checkout id is needed' using errcode = '22023';
  end if;

  -- Sent before: return what was made, whatever has changed since.
  select o.id into placed_id
    from public.orders o
   where o.tenant_id = tid and o.checkout_id = checkout;

  if placed_id is null then
    if not exists (
      select 1 from public.tenants t where t.id = tid and t.status = 'active'
    ) then
      raise exception 'store not found or not open' using errcode = 'P0002';
    end if;

    -- The shape of the request. The server validates it first; these keep
    -- the database honest on its own.
    if jsonb_typeof(items) is distinct from 'array' then
      raise exception 'items must be a list' using errcode = '22023';
    end if;
    line_count := jsonb_array_length(items);
    if line_count not between 1 and 50 then
      raise exception 'an order has 1 to 50 lines' using errcode = '22023';
    end if;
    if exists (
      select 1
        from jsonb_array_elements(items) i
       where i ->> 'variant_id' is null
          or jsonb_typeof(i -> 'qty') is distinct from 'number'
          or (i ->> 'qty')::numeric not in (1, 2, 3, 4, 5, 6, 7, 8, 9, 10)
    ) then
      raise exception 'each line needs a variant and a quantity of 1 to 10'
        using errcode = '22023';
    end if;
    if (
      select count(distinct i ->> 'variant_id')
        from jsonb_array_elements(items) i
    ) <> line_count then
      raise exception 'a variant appears on more than one line'
        using errcode = '22023';
    end if;
    if jsonb_typeof(customer) is distinct from 'object'
       or length(btrim(coalesce(customer ->> 'name', ''))) not between 2 and 80
       or coalesce(customer ->> 'phone', '') !~ '^\+91[6-9][0-9]{9}$'
       or jsonb_typeof(customer -> 'address') is distinct from 'object'
       or length(btrim(coalesce(customer #>> '{address,line1}', ''))) = 0
       or length(btrim(coalesce(customer #>> '{address,city}', ''))) = 0
       or length(btrim(coalesce(customer #>> '{address,state}', ''))) = 0
       or coalesce(customer #>> '{address,pincode}', '') !~ '^[1-9][0-9]{5}$'
    then
      raise exception 'customer details are incomplete' using errcode = '22023';
    end if;

    -- Spam limits. A repeat of a checkout already placed returned above, so
    -- a retry is never refused here.
    if (
      select count(*)
        from public.orders o
       where o.tenant_id = tid
         and o.customer_phone = customer ->> 'phone'
         and o.created_at > now() - interval '1 hour'
    ) >= 3 then
      return jsonb_build_object('status', 'limited', 'limit', 'phone');
    end if;
    if client is not null and (
      select count(*)
        from public.orders o
       where o.client_hash = client
         and o.created_at > now() - interval '1 hour'
    ) >= 10 then
      return jsonb_build_object('status', 'limited', 'limit', 'network');
    end if;

    -- Price every line from the database, once.
    select jsonb_agg(
             jsonb_build_object(
               'position', w.ord - 1,
               'variant_id', w.variant_id,
               'qty', w.qty,
               'shown_paise', w.shown_paise,
               'available', p.id is not null,
               'unit_price_paise',
                 case when p.price_mode = 'fixed'
                      then coalesce(v.price_paise, p.price_paise) end,
               'available_qty',
                 -- Nothing about items that are not for sale.
                 case when p.id is not null and v.track_inventory
                      then v.stock_qty end,
               'name', p.name,
               'options', v.options
             )
             order by w.ord
           )
      into priced
      from (
        select (i ->> 'variant_id')::uuid as variant_id,
               (i ->> 'qty')::integer as qty,
               (i ->> 'unit_price_paise')::bigint as shown_paise,
               x.ord
          from jsonb_array_elements(items) with ordinality as x (i, ord)
      ) w
      left join public.product_variants v
        on v.tenant_id = tid and v.id = w.variant_id
      left join public.products p
        on p.tenant_id = tid and p.id = v.product_id and p.status = 'active';

    -- What changed since the shopper saw it.
    select jsonb_agg(
             jsonb_build_object(
               'variant_id', l ->> 'variant_id',
               'problems', to_jsonb(array_remove(array[
                 case when not (l ->> 'available')::boolean
                      then 'unavailable' end,
                 case when (l ->> 'available')::boolean
                       and (l ->> 'available_qty')::integer < (l ->> 'qty')::integer
                      then 'stock' end,
                 case when (l ->> 'available')::boolean
                       and (l ->> 'unit_price_paise')::bigint
                           is distinct from (l ->> 'shown_paise')::bigint
                      then 'price' end
               ], null)),
               'unit_price_paise', l -> 'unit_price_paise',
               'available_qty', l -> 'available_qty'
             )
             order by (l ->> 'position')::integer
           )
      into problems
      from jsonb_array_elements(priced) l
     where not (l ->> 'available')::boolean
        or (l ->> 'available_qty')::integer < (l ->> 'qty')::integer
        or (l ->> 'unit_price_paise')::bigint
           is distinct from (l ->> 'shown_paise')::bigint;

    if problems is not null then
      return jsonb_build_object('status', 'changed', 'lines', problems);
    end if;

    select coalesce(sum(
             (l ->> 'unit_price_paise')::bigint * (l ->> 'qty')::integer
           ), 0)
      into subtotal
      from jsonb_array_elements(priced) l;

    -- A replay that raced this one may have just saved the same checkout:
    -- then keep its order and add nothing.
    insert into public.orders (
      tenant_id, checkout_id, customer_name, customer_phone, address, notes,
      subtotal_paise, total_paise, client_hash
    ) values (
      tid,
      checkout,
      btrim(customer ->> 'name'),
      customer ->> 'phone',
      customer -> 'address',
      nullif(btrim(coalesce(customer ->> 'notes', '')), ''),
      subtotal,
      subtotal,
      client
    )
    on conflict (tenant_id, checkout_id) do nothing
    returning id into placed_id;

    if placed_id is not null then
      insert into public.order_items (
        tenant_id, order_id, variant_id, name_snapshot, options_snapshot,
        unit_price_paise, qty, position
      )
      select tid,
             placed_id,
             (l ->> 'variant_id')::uuid,
             l ->> 'name',
             l -> 'options',
             (l ->> 'unit_price_paise')::bigint,
             (l ->> 'qty')::integer,
             (l ->> 'position')::smallint
        from jsonb_array_elements(priced) l;
    else
      select o.id into placed_id
        from public.orders o
       where o.tenant_id = tid and o.checkout_id = checkout;
    end if;
  end if;

  return (
    select jsonb_build_object(
             'status', 'placed',
             'order_id', o.id,
             'order_number', o.order_number,
             'subtotal_paise', o.subtotal_paise,
             'total_paise', o.total_paise,
             'has_price_on_request', bool_or(oi.unit_price_paise is null),
             'lines', jsonb_agg(
               jsonb_build_object(
                 'variant_id', oi.variant_id,
                 'name', oi.name_snapshot,
                 'options', oi.options_snapshot,
                 'qty', oi.qty,
                 'unit_price_paise', oi.unit_price_paise
               )
               order by oi.position
             )
           )
      from public.orders o
      join public.order_items oi
        on oi.tenant_id = o.tenant_id and oi.order_id = o.id
     where o.id = placed_id
     group by o.id
  );
end;
$$;

revoke all on function public.place_order(uuid, uuid, jsonb, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.place_order(uuid, uuid, jsonb, jsonb, text)
  to service_role;
