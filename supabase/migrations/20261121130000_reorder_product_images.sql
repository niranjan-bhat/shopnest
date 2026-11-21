-- Saves the order of one product's photos (dashboard drag-to-reorder); the
-- first is the cover. Same rules as reorder_categories: runs as the caller
-- (RLS applies), refuses non-members explicitly (live photos are public),
-- and needs every photo of the product exactly once.

create function public.reorder_product_images(
  tid uuid,
  pid uuid,
  ordered_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.can_manage_tenant(tid) then
    raise exception 'not allowed to manage this store' using errcode = '42501';
  end if;

  if cardinality(ordered_ids) is distinct from (
       select count(distinct id) from unnest(ordered_ids) as u(id)
     )
     or cardinality(ordered_ids) is distinct from (
       select count(*) from public.product_images i
        where i.tenant_id = tid and i.product_id = pid
          and i.id = any (ordered_ids)
     )
     or cardinality(ordered_ids) is distinct from (
       select count(*) from public.product_images i
        where i.tenant_id = tid and i.product_id = pid
     )
  then
    raise exception 'ordered_ids must list every photo of the product once'
      using errcode = '22023';
  end if;

  update public.product_images i
     set position = o.ord - 1
    from unnest(ordered_ids) with ordinality as o(id, ord)
   where i.tenant_id = tid
     and i.product_id = pid
     and i.id = o.id
     and i.position is distinct from o.ord - 1;
end;
$$;

revoke all on function public.reorder_product_images(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.reorder_product_images(uuid, uuid, uuid[]) to authenticated;
