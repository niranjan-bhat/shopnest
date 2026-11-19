-- Baseline migration (Phase 0).
-- Proves the migration pipeline runs locally and in CI. The real schema
-- (tenants, catalog, orders, RLS) arrives in Phase 2 as new migrations.
-- Never edit an applied migration; add a new one instead.

comment on schema public is 'ShopNest application schema';
