-- Saving a product never overwrites what changed while it was being edited.
--
-- Two optional parts of the payload (20261121120000_save_product.sql has the
-- rest); a save without them works as before:
--   seen_updated_at      the product's updated_at when the form loaded.
--                        Different now: ZL004, someone else saved it.
--   variants[].stock_was the stock the form showed. Sent back unchanged, the
--                        stock is left as it is now (orders may have moved
--                        it). Changed, while the real stock moved to
--                        something else: ZL005, with the stock now in the
--                        error's detail: [{ id, stock }].
-- Either error saves nothing. Stock moved by orders does not touch the
-- product's updated_at, so orders never block an edit of anything else.

create or replace function public.save_product(tid uuid, product jsonb, pid uuid default null)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved uuid;
  variant jsonb;
  kept uuid[];
  seen timestamptz;
  conflicts jsonb;
begin
  if not public.can_manage_tenant(tid) then
    raise exception 'not allowed to manage this store' using errcode = '42501';
  end if;
  if jsonb_typeof(product -> 'variants') is distinct from 'array'
     or jsonb_array_length(product -> 'variants') = 0 then
    raise exception 'a product needs at least one variant' using errcode = '22023';
  end if;

  if pid is null then
    insert into public.products (
      tenant_id, name, slug, description, price_mode, price_paise,
      compare_at_paise, status, is_featured, attributes, seo
    ) values (
      tid,
      product ->> 'name',
      product ->> 'slug',
      product ->> 'description',
      (product ->> 'price_mode')::public.price_mode,
      (product ->> 'price_paise')::bigint,
      (product ->> 'compare_at_paise')::bigint,
      (product ->> 'status')::public.product_status,
      (product ->> 'is_featured')::boolean,
      coalesce(product -> 'attributes', '{}'),
      coalesce(product -> 'seo', '{}')
    )
    returning id into saved;
  else
    select p.updated_at into seen
      from public.products p
     where p.tenant_id = tid and p.id = pid
       for update;
    if not found then
      raise exception 'product not found' using errcode = 'P0002';
    end if;
    if product ->> 'seen_updated_at' is not null
       and (product ->> 'seen_updated_at')::timestamptz <> seen then
      raise exception 'the product changed since it was loaded'
        using errcode = 'ZL004';
    end if;

    -- Hold the variants, so no order takes stock between the check and the
    -- save.
    perform 1
       from public.product_variants pv
      where pv.tenant_id = tid and pv.product_id = pid
      order by pv.id
        for update;
    select jsonb_agg(jsonb_build_object('id', pv.id, 'stock', pv.stock_qty))
      into conflicts
      from jsonb_array_elements(product -> 'variants') v
      join public.product_variants pv
        on pv.tenant_id = tid and pv.product_id = pid
       and pv.id = (v ->> 'id')::uuid
     where v ->> 'stock_was' is not null
       and (v ->> 'stock_qty')::integer <> (v ->> 'stock_was')::integer
       and pv.stock_qty <> (v ->> 'stock_was')::integer
       and pv.stock_qty <> (v ->> 'stock_qty')::integer;
    if conflicts is not null then
      raise exception 'stock changed since it was loaded'
        using errcode = 'ZL005', detail = conflicts::text;
    end if;

    update public.products set
      name = product ->> 'name',
      slug = product ->> 'slug',
      description = product ->> 'description',
      price_mode = (product ->> 'price_mode')::public.price_mode,
      price_paise = (product ->> 'price_paise')::bigint,
      compare_at_paise = (product ->> 'compare_at_paise')::bigint,
      status = (product ->> 'status')::public.product_status,
      is_featured = (product ->> 'is_featured')::boolean,
      attributes = coalesce(product -> 'attributes', '{}'),
      seo = coalesce(product -> 'seo', '{}')
    where tenant_id = tid and id = pid
    returning id into saved;
  end if;

  -- Category links: exactly the given categories. The composite foreign key
  -- (tenant_id, category_id) rejects another store's category.
  delete from public.product_categories pc
   where pc.tenant_id = tid and pc.product_id = saved
     and pc.category_id not in (
       select value::uuid
         from jsonb_array_elements_text(coalesce(product -> 'category_ids', '[]'))
     );
  insert into public.product_categories (tenant_id, product_id, category_id)
  select tid, saved, value::uuid
    from jsonb_array_elements_text(coalesce(product -> 'category_ids', '[]'))
  on conflict do nothing;

  -- Variants: delete the ones no longer listed first, so their SKUs are free
  -- for the updates and inserts that follow.
  select coalesce(array_agg((v ->> 'id')::uuid), '{}')
    into kept
    from jsonb_array_elements(product -> 'variants') v
   where v ->> 'id' is not null;

  delete from public.product_variants pv
   where pv.tenant_id = tid and pv.product_id = saved
     and not (pv.id = any (kept));

  for variant in select * from jsonb_array_elements(product -> 'variants')
  loop
    if variant ->> 'id' is null then
      insert into public.product_variants (
        tenant_id, product_id, sku, options, price_paise, stock_qty,
        track_inventory
      ) values (
        tid, saved,
        variant ->> 'sku',
        coalesce(variant -> 'options', '{}'),
        (variant ->> 'price_paise')::bigint,
        (variant ->> 'stock_qty')::integer,
        (variant ->> 'track_inventory')::boolean
      );
    else
      update public.product_variants set
        sku = variant ->> 'sku',
        options = coalesce(variant -> 'options', '{}'),
        price_paise = (variant ->> 'price_paise')::bigint,
        stock_qty = case
          when (variant ->> 'stock_qty')::integer
               = (variant ->> 'stock_was')::integer then stock_qty
          else (variant ->> 'stock_qty')::integer
        end,
        track_inventory = (variant ->> 'track_inventory')::boolean
      where tenant_id = tid and product_id = saved
        and id = (variant ->> 'id')::uuid;
      if not found then
        raise exception 'variant % is not part of this product', variant ->> 'id'
          using errcode = '22023';
      end if;
    end if;
  end loop;

  return saved;
end;
$$;
