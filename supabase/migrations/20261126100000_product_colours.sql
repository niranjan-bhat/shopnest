-- Colour lives in one place: a product's colour options (its variants).
--
-- A photo may be tagged with one of them. Untagged (null), it belongs to
-- every colour. A tag whose colour the product no longer has counts as
-- untagged when read, so removing a colour loses no photo, and adding the
-- colour back brings its photos with it. Existing RLS covers the column.
alter table public.product_images
  add column colour text check (length(btrim(colour)) between 1 and 40);

-- The Colour detail is gone: it becomes the colour option of products that
-- have none. Products with colour options keep those.
update public.product_variants v
   set options = v.options
       || jsonb_build_object('colour', left(btrim(p.attributes ->> 'colour'), 40))
  from public.products p
 where p.tenant_id = v.tenant_id and p.id = v.product_id
   and btrim(coalesce(p.attributes ->> 'colour', '')) <> ''
   and not exists (
     select 1 from public.product_variants o
      where o.tenant_id = v.tenant_id and o.product_id = v.product_id
        and o.options ? 'colour'
   );

update public.products
   set attributes = attributes - 'colour'
 where attributes ? 'colour';
