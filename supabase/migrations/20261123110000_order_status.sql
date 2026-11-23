-- Phase 4c: merchants work through their orders.
--
-- Status moves one step at a time:
--   pending -> confirmed -> packed -> shipped -> delivered
-- and any order not yet shipped can be cancelled. Stock moves with status:
-- confirming takes the ordered quantities out of tracked stock (refused,
-- with the short lines listed, if there is not enough), and cancelling an
-- order that was confirmed puts them back. Both happen in the same
-- transaction as the status change, so stock and status never disagree.
--
-- Members could change status and notes directly before. Status now
-- changes only through set_order_status (a direct change would skip the
-- stock), and `notes` holds what the customer wrote at checkout, which the
-- store should not rewrite: the store's own notes go in staff_notes.
--
-- Price-on-request lines get their agreed price from the merchant while the
-- order is pending (set_order_prices); an order is confirmed only once every
-- line has a price.

revoke update (status, notes) on public.orders from authenticated;

-- The store's own notes on an order (courier, stitching, delivery date).
-- The customer never sees them.
alter table public.orders
  add column staff_notes text check (length(staff_notes) <= 2000);
grant update (staff_notes) on public.orders to authenticated;

-- Which lines were on request when ordered, so they stay editable after the
-- merchant has entered a price.
alter table public.order_items
  add column price_on_request boolean not null default false;
update public.order_items set price_on_request = true where unit_price_paise is null;

create function public.order_item_price_on_request()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.price_on_request := new.unit_price_paise is null;
  return new;
end;
$$;

create trigger order_item_price_on_request before insert on public.order_items
  for each row execute function public.order_item_price_on_request();

-- tid: the store; ord: the order; next: the status to move to.
-- Returns one of
--   { status: "ok" }
--   { status: "needs_prices" }  some price-on-request lines have no price
--   { status: "short", lines: [{ name, options, qty, available }] }
-- Raises 42501 for non-members, P0002 for an unknown order and 22023 for a
-- move that is not allowed.
create function public.set_order_status(
  tid uuid,
  ord uuid,
  next public.order_status
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status public.order_status;
  short jsonb;
begin
  if not public.can_manage_tenant(tid) then
    raise exception 'not allowed to manage this store' using errcode = '42501';
  end if;

  select o.status into current_status
    from public.orders o
   where o.tenant_id = tid and o.id = ord
   for update;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;

  -- Already there (a double click, another tab): nothing to do.
  if current_status = next then
    return jsonb_build_object('status', 'ok');
  end if;

  if not (
    (current_status = 'pending' and next in ('confirmed', 'cancelled'))
    or (current_status = 'confirmed' and next in ('packed', 'cancelled'))
    or (current_status = 'packed' and next in ('shipped', 'cancelled'))
    or (current_status = 'shipped' and next = 'delivered')
  ) then
    raise exception 'an order cannot move from % to %', current_status, next
      using errcode = '22023';
  end if;

  if next = 'confirmed' then
    if exists (
      select 1 from public.order_items oi
       where oi.tenant_id = tid and oi.order_id = ord
         and oi.unit_price_paise is null
    ) then
      return jsonb_build_object('status', 'needs_prices');
    end if;

    -- Lock the variants, then check every line before taking anything.
    perform 1
       from public.product_variants v
       join public.order_items oi
         on oi.tenant_id = v.tenant_id and oi.variant_id = v.id
      where oi.tenant_id = tid and oi.order_id = ord
      for update of v;

    select jsonb_agg(
             jsonb_build_object(
               'name', oi.name_snapshot,
               'options', oi.options_snapshot,
               'qty', oi.qty,
               'available', v.stock_qty
             )
             order by oi.position
           )
      into short
      from public.order_items oi
      join public.product_variants v
        on v.tenant_id = oi.tenant_id and v.id = oi.variant_id
     where oi.tenant_id = tid and oi.order_id = ord
       and v.track_inventory and v.stock_qty < oi.qty;
    if short is not null then
      return jsonb_build_object('status', 'short', 'lines', short);
    end if;

    update public.product_variants v
       set stock_qty = v.stock_qty - oi.qty
      from public.order_items oi
     where oi.tenant_id = tid and oi.order_id = ord
       and v.tenant_id = oi.tenant_id and v.id = oi.variant_id
       and v.track_inventory;
  elsif next = 'cancelled' and current_status <> 'pending' then
    -- It was confirmed, so its stock was taken: put it back. Lines whose
    -- variant has since been deleted have nothing to return to.
    update public.product_variants v
       set stock_qty = v.stock_qty + oi.qty
      from public.order_items oi
     where oi.tenant_id = tid and oi.order_id = ord
       and v.tenant_id = oi.tenant_id and v.id = oi.variant_id
       and v.track_inventory;
  end if;

  update public.orders o
     set status = next
   where o.tenant_id = tid and o.id = ord;
  return jsonb_build_object('status', 'ok');
end;
$$;

-- Sets the agreed price of price-on-request lines on a pending order and
-- recomputes its totals. prices: [{ item_id, unit_price_paise }], where
-- null clears a price again.
create function public.set_order_prices(tid uuid, ord uuid, prices jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status public.order_status;
  subtotal bigint;
  changed integer;
begin
  if not public.can_manage_tenant(tid) then
    raise exception 'not allowed to manage this store' using errcode = '42501';
  end if;
  select o.status into current_status
    from public.orders o
   where o.tenant_id = tid and o.id = ord
   for update;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if current_status <> 'pending' then
    raise exception 'prices can only change before the order is confirmed'
      using errcode = '22023';
  end if;
  if jsonb_typeof(prices) is distinct from 'array'
     or exists (
       select 1 from jsonb_array_elements(prices) p
        where p ->> 'item_id' is null
           or (p -> 'unit_price_paise' <> 'null'::jsonb and (
                jsonb_typeof(p -> 'unit_price_paise') is distinct from 'number'
                or (p ->> 'unit_price_paise')::numeric < 0
                or (p ->> 'unit_price_paise')::numeric
                   <> trunc((p ->> 'unit_price_paise')::numeric)
              ))
     ) then
    raise exception 'prices must be whole paise, 0 or more' using errcode = '22023';
  end if;

  update public.order_items oi
     set unit_price_paise = (p ->> 'unit_price_paise')::bigint
    from jsonb_array_elements(prices) p
   where oi.tenant_id = tid and oi.order_id = ord
     and oi.id = (p ->> 'item_id')::uuid
     and oi.price_on_request;
  get diagnostics changed = row_count;
  if changed <> jsonb_array_length(prices) then
    raise exception 'only price-on-request lines of this order can be priced'
      using errcode = '22023';
  end if;

  select coalesce(sum(oi.unit_price_paise * oi.qty), 0)
    into subtotal
    from public.order_items oi
   where oi.tenant_id = tid and oi.order_id = ord;
  update public.orders o
     set subtotal_paise = subtotal, total_paise = subtotal
   where o.tenant_id = tid and o.id = ord;
end;
$$;

revoke all on function public.set_order_status(uuid, uuid, public.order_status)
  from public, anon;
grant execute on function public.set_order_status(uuid, uuid, public.order_status)
  to authenticated;
revoke all on function public.set_order_prices(uuid, uuid, jsonb) from public, anon;
grant execute on function public.set_order_prices(uuid, uuid, jsonb) to authenticated;

-- The orders list filters by status within a store.
create index orders_tenant_status_created_idx
  on public.orders (tenant_id, status, created_at desc);
