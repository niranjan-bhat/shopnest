-- Smoke test: proves pgTAP runs and the baseline migration applied.
-- Tenant-isolation (RLS) tests are added in Phase 2.
begin;
create extension if not exists pgtap with schema extensions;

select plan(2);

select has_schema('public', 'public schema exists');
select is(
  obj_description('public'::regnamespace, 'pg_namespace'),
  'ShopNest application schema',
  'baseline migration applied'
);

select * from finish();
rollback;
