-- Saves the order of a store's banners (dashboard drag-to-reorder). Same
-- rules as reorder_product_images: runs as the caller (RLS applies), refuses
-- non-members explicitly (live banners are public), and needs every banner
-- of the store exactly once.

create function public.reorder_banners(
  tid uuid,
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
       select count(*) from public.banners b
        where b.tenant_id = tid and b.id = any (ordered_ids)
     )
     or cardinality(ordered_ids) is distinct from (
       select count(*) from public.banners b where b.tenant_id = tid
     )
  then
    raise exception 'ordered_ids must list every banner of the store once'
      using errcode = '22023';
  end if;

  update public.banners b
     set position = o.ord - 1
    from unnest(ordered_ids) with ordinality as o(id, ord)
   where b.tenant_id = tid
     and b.id = o.id
     and b.position is distinct from o.ord - 1;
end;
$$;

revoke all on function public.reorder_banners(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_banners(uuid, uuid[]) to authenticated;
