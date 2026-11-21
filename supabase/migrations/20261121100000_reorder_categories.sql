-- Saves a store's category order in one statement (dashboard drag-to-reorder).
--
-- security invoker: it runs as the caller, so RLS still applies to the
-- update. Live categories are publicly readable, so RLS alone would let a
-- non-member pass the checks and then silently update nothing; the explicit
-- can_manage_tenant check refuses them instead.

create function public.reorder_categories(tid uuid, ordered_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.can_manage_tenant(tid) then
    raise exception 'not allowed to manage this store' using errcode = '42501';
  end if;

  -- The list must name every category of the store exactly once, so a stale
  -- browser tab cannot leave two categories with the same position.
  if cardinality(ordered_ids) is distinct from (
       select count(distinct id) from unnest(ordered_ids) as u(id)
     )
     or cardinality(ordered_ids) is distinct from (
       select count(*) from public.categories c
        where c.tenant_id = tid and c.id = any (ordered_ids)
     )
     or cardinality(ordered_ids) is distinct from (
       select count(*) from public.categories c where c.tenant_id = tid
     )
  then
    raise exception 'ordered_ids must list every category of the store once'
      using errcode = '22023';
  end if;

  update public.categories c
     set position = o.ord - 1
    from unnest(ordered_ids) with ordinality as o(id, ord)
   where c.tenant_id = tid
     and c.id = o.id
     and c.position is distinct from o.ord - 1;
end;
$$;

revoke all on function public.reorder_categories(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_categories(uuid, uuid[]) to authenticated;
