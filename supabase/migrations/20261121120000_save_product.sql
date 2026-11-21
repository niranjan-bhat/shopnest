-- Saves a product from the dashboard in one transaction: the product row,
-- its category links and its variants. A failed save never leaves half a
-- product behind.
--
-- security invoker: RLS applies to every statement. The explicit
-- can_manage_tenant check refuses non-members up front (live products are
-- publicly readable, so RLS alone would not stop them reading).
--
-- pid is the product to update; leave it out (null) to create one.
-- `product` is the validated payload from the save action:
--   { name, slug, description, price_mode, price_paise, compare_at_paise,
--     status, is_featured, attributes, seo, category_ids: [uuid],
--     variants: [{ id | null, sku, options, price_paise, stock_qty,
--                  track_inventory }] }
-- Variants with an id are updated in place (so carts that hold their ids
-- keep working); variants without one are created; the product's other
-- variants are deleted.

create function public.save_product(tid uuid, product jsonb, pid uuid default null)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved uuid;
  variant jsonb;
  kept uuid[];
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
    if saved is null then
      raise exception 'product not found' using errcode = 'P0002';
    end if;
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
        stock_qty = (variant ->> 'stock_qty')::integer,
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

revoke all on function public.save_product(uuid, jsonb, uuid) from public, anon;
grant execute on function public.save_product(uuid, jsonb, uuid) to authenticated;
