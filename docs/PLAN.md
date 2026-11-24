# Zarify – Project Plan

Nov 19, 2026 · @niranjan

## Overview and key recommendations

Zarify should be one Next.js app, one Supabase database, and a small set of code-based templates driven by per-tenant theme config. The direction in the brief is right; the changes below keep the MVP small without painting us into a corner.

**MVP goal:** a merchant can be onboarded by the super admin, manage their catalog and branding, and receive WhatsApp orders on their own subdomain or custom domain.

**Launch vertical:** clothing brands first, covering saree shops, ethnic wear and boutiques. Jewellery follows after the MVP on the same platform; the schema already supports it through `attributes` and price-on-request.

**Recommendations**

1. **Shared database, shared schema, `tenant_id` on every row, enforced by Supabase Row Level Security (RLS).** No schema-per-tenant or database-per-tenant; that is overengineering at this scale.
2. **Resolve the tenant from the hostname** in Next.js `proxy.ts` (called `middleware.ts` before Next.js 16) and rewrite to an internal `/sites/[host]` route. One deployment serves every store.
3. **Templates are React components, not a page builder.** Each template exposes a fixed set of sections; merchants pick colours, fonts, logo, banners and section order through a validated JSON config.
4. **Start with 3 templates, not 5.** Ship one excellent template first (Phase 1), then add two more once the theming contract is proven.
5. **Make mock data tenant-shaped from day one.** Mock types are the generated database types, so swapping mocks for Supabase is a data-layer change, not a UI rewrite.
6. **Build the dashboard directly on real data.** I suggest moving backend and tenancy before the dashboard (Phase 2), so dashboard forms are built once against real tables instead of mocks and then rewired.
7. **WhatsApp checkout still creates an order record** before opening WhatsApp. Merchants get an order list, and Razorpay later plugs into the same orders table.
8. **Money as integer paise, prices validated on the server.** The client never decides what an order costs.
9. **Store R2 object keys, not URLs,** and upload through short-lived presigned URLs so files never pass through our server.

## Architecture

Every request hits one Next.js deployment; `proxy.ts` reads the hostname, looks up the tenant, and routes to the storefront, the merchant dashboard or the super admin.

&#91;embedded content: Zarify architecture · one app, three surfaces, four services\]

All three audiences enter through the same proxy; only the route and the auth check differ. Images load straight from the R2 CDN, not through the app.

**Hosts**

| Host                      | Serves                         | Auth                            |
| ------------------------- | ------------------------------ | ------------------------------- |
| `zarify.in`               | Marketing site (later)         | None                            |
| `app.zarify.in/dashboard` | Merchant dashboard             | Supabase Auth, tenant member    |
| `app.zarify.in/admin`     | Super admin                    | Supabase Auth, `is_super_admin` |
| `{slug}.zarify.in`        | Storefront on a free subdomain | Public                          |
| `www.merchant.com`        | Storefront on a custom domain  | Public                          |

**Request flow for a storefront**

1. `proxy.ts` takes the `Host` header and resolves it via `tenant_domains` (cached, tagged per tenant).
2. It rewrites `/products/silk-kanjivaram` to `/sites/[host]/products/silk-kanjivaram`. Unknown hosts get a 404 page; suspended tenants get a "store unavailable" page.
3. The `/sites/[host]` layout loads the tenant, its template key and theme config, and renders the template's components.
4. Catalog reads are cached with tags like `tenant:{id}:catalog`; dashboard saves call `revalidateTag`, so storefronts stay fast but update within seconds.

**Data access rules**

- **Server Components** read data; **Server Actions** handle dashboard mutations, each validated with Zod.
- **Route Handlers** only for things that need a URL: presigned upload URLs, Razorpay webhooks, health checks.
- Three Supabase clients in `lib/supabase`: browser (anon key), server (user session via cookies, RLS applies), admin (service role, server-only, used for order creation and super-admin jobs).
- Storefront queries always filter by `tenant_id` explicitly, even where RLS would also restrict them.

**Images**

- Bucket layout: `tenants/{tenant_id}/products/{product_id}/{uuid}.webp`, `tenants/{tenant_id}/branding/...`.
- Upload: dashboard asks a server action for a presigned PUT URL, browser uploads straight to R2, then the action saves the key.
- Delivery: a custom domain on the bucket behind Cloudflare's CDN, with a custom `next/image` loader for resizing. It is a separate domain on Cloudflare DNS (not a `zarify.in` subdomain), because `zarify.in` uses Vercel's nameservers for the store wildcard. Development uses the bucket's `r2.dev` address.

**Security baseline**

- RLS on every table, no exceptions; the service-role key never reaches the browser.
- A tenant-isolation test suite runs in CI: user from tenant A must fail to read or write tenant B's rows.
- Order totals are recomputed server-side from database prices.
- Rate limiting on order creation to limit spam orders.

## Folder structure

One repository, one Next.js app (App Router, `src/` layout), organised by feature rather than by file type. No monorepo tooling until a second app actually exists.

```text
shopnest/
├── src/
│   ├── proxy.ts                     # hostname → tenant rewrite
│   ├── app/
│   │   ├── sites/[host]/            # storefront (reached only via rewrite)
│   │   │   ├── layout.tsx           # loads tenant + theme, picks template
│   │   │   ├── page.tsx             # home
│   │   │   ├── c/[category]/page.tsx
│   │   │   ├── p/[product]/page.tsx
│   │   │   ├── cart/page.tsx
│   │   │   ├── checkout/page.tsx    # WhatsApp checkout form
│   │   │   ├── sitemap.ts
│   │   │   └── not-found.tsx
│   │   ├── dashboard/               # merchant dashboard
│   │   │   ├── layout.tsx           # auth + active tenant guard
│   │   │   ├── page.tsx             # overview
│   │   │   ├── products/            # list, new, [id]/edit
│   │   │   ├── categories/
│   │   │   ├── orders/
│   │   │   ├── storefront/          # branding, theme, banners
│   │   │   └── settings/
│   │   ├── admin/                   # super admin
│   │   │   ├── tenants/
│   │   │   ├── templates/
│   │   │   ├── plans/
│   │   │   └── subscriptions/
│   │   ├── (auth)/login/ · auth/callback/
│   │   └── api/                     # webhooks, health only
│   ├── templates/
│   │   ├── registry.ts              # key → manifest
│   │   ├── contract.ts              # shared section prop types
│   │   ├── silk/                    # template 1 (sarees, ethnic wear)
│   │   │   ├── manifest.ts          # sections, defaults, theme schema
│   │   │   ├── sections/            # Hero, FeaturedGrid, CategoryTiles…
│   │   │   └── pages/               # Home, Category, Product layouts
│   │   └── …                        # templates 2 and 3 later
│   ├── features/
│   │   ├── catalog/                 # queries.ts, actions.ts, schemas.ts
│   │   ├── orders/
│   │   ├── cart/
│   │   ├── tenants/
│   │   ├── media/
│   │   ├── theme/
│   │   └── billing/
│   ├── components/
│   │   ├── ui/                      # shadcn/ui primitives
│   │   ├── dashboard/
│   │   └── storefront/              # template-agnostic: CartDrawer, Price
│   ├── lib/
│   │   ├── supabase/                # client.ts, server.ts, admin.ts
│   │   ├── r2.ts · money.ts · whatsapp.ts · tenant.ts
│   │   └── env.ts                   # Zod-validated env vars
│   ├── types/database.ts            # generated by supabase gen types
│   └── mocks/                       # Phase 1 data, typed as database rows
├── supabase/
│   ├── migrations/
│   ├── seed.sql                     # 2 demo tenants
│   └── tests/                       # RLS / isolation tests (pgTAP)
├── tests/e2e/                       # Playwright
└── .env.example
```

**Rules that keep it maintainable**

- `app/` files stay thin: they call `features/*` and render components.
- Templates never query the database. They receive typed props (`StoreContext`, `Product[]`) from the route.
- Anything in `features/*/actions.ts` checks tenant membership before writing, even though RLS also checks.

## Template and theming system

A tenant's look = a template key + a theme config stored as JSON and validated by that template's Zod schema. Templates differ in layout and section design; theme config changes colours, fonts, imagery and section order within a template.

**Theme config (stored in `tenant_themes`)**

```json
{
  "templateKey": "silk",
  "tokens": {
    "colors": {
      "primary": "#7A1F2B",
      "accent": "#C9A227",
      "background": "#FBF8F3",
      "text": "#1E1A16"
    },
    "fonts": { "heading": "Cormorant Garamond", "body": "Inter" },
    "radius": "sm"
  },
  "branding": { "logoKey": "tenants/…/branding/logo.webp", "faviconKey": "…" },
  "sections": [
    { "type": "hero", "props": { "bannerIds": ["…"] } },
    { "type": "categoryTiles", "props": { "limit": 6 } },
    { "type": "featuredProducts", "props": { "title": "New Arrivals" } }
  ]
}
```

**How it renders**

- Tokens become CSS variables on the storefront `<html>` element; Tailwind classes reference them (`bg-[var(--color-primary)]` or theme-mapped utilities), so one template serves many brands.
- Fonts come from a curated whitelist loaded with `next/font`, not free text, which keeps performance predictable.
- The home page maps `sections[]` to the template's section components through `registry.ts`. Unknown section types are skipped, not crashed on.

**Template manifest (code)**

- `key`, display name, preview image, supported section types, default theme config, Zod schema for its props.
- The `templates` table only stores which templates are enabled and on which plans; the template itself lives in code and ships with deploys.

**Draft and publish**

- Merchants edit a `draft` config and preview it; "Publish" copies draft to `published` and revalidates the tenant's cache tag. This avoids half-finished edits going live.

## Database design

Seventeen tables in Supabase Postgres cover the MVP; every tenant-owned table carries `tenant_id uuid not null` with an index, and RLS is enabled on all of them. Conventions: `uuid` primary keys (`gen_random_uuid()`), `timestamptz` for times, money as `bigint` paise, status columns as Postgres enums.

**Platform and access**

| Table            | Key columns                                                                                                                  | Notes                                    |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `tenants`        | id, slug (unique), name, status (`onboarding`/`active`/`suspended`), business\_type, whatsapp\_number, currency, created\_at | One row per store                        |
| `tenant_domains` | id, tenant\_id, hostname (unique), kind (`subdomain`/`custom`), is\_primary, verified\_at                                    | Hostname lookup for `proxy.ts`           |
| `profiles`       | user\_id (PK → auth.users), full\_name, phone, is\_super\_admin                                                              | Created by trigger on sign-up            |
| `tenant_members` | tenant\_id, user\_id (composite PK), role (`owner`/`staff`)                                                                  | Staff accounts are cheap to support now  |
| `templates`      | key (PK), name, is\_active                                                                                                  | Code holds the template; this enables it |
| `tenant_themes`  | tenant\_id (PK), template\_key, draft jsonb, published jsonb, published\_at                                                  | Theme config from the section above      |

**Catalog**

| Table                | Key columns                                                                                                                                                                                                                    | Notes                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `categories`         | id, tenant\_id, parent\_id, name, slug, position, image\_key, is\_active                                                                                                                                                       | unique (tenant\_id, slug); one level of nesting in UI                      |
| `products`           | id, tenant\_id, name, slug, description, price\_mode (fixed/on\_request), price\_paise (null when on request), compare\_at\_paise, status (`draft`/`active`/`archived`), attributes jsonb, is\_featured, seo jsonb, timestamps | unique (tenant\_id, slug); `attributes` holds fabric, purity, weight, etc. |
| `product_categories` | product\_id, category\_id, tenant\_id                                                                                                                                                                                          | Many-to-many                                                               |
| `product_variants`   | id, tenant\_id, product\_id, sku, options jsonb, price\_paise (nullable override), stock\_qty, track\_inventory                                                                                                                | Every product has ≥1 variant; simple products get one default              |
| `product_images`     | id, tenant\_id, product\_id, r2\_key, alt, position, width, height                                                                                                                                                             | Ordered gallery                                                            |
| `banners`            | id, tenant\_id, image\_key, heading, link, position, starts\_at, ends\_at                                                                                                                                                      | Hero and promo banners                                                     |

**Orders and billing**

| Table                     | Key columns                                                                                                                                                               | Notes                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `orders`                  | id, tenant\_id, order\_number, customer\_name, customer\_phone, address jsonb, channel (`whatsapp`/`razorpay`), status, subtotal\_paise, total\_paise, notes, created\_at | unique (tenant\_id, order\_number); per-tenant counter |
| `order_items`             | id, tenant\_id, order\_id, variant\_id, name\_snapshot, options\_snapshot, unit\_price\_paise, qty                                                                        | Snapshots survive product edits                        |
| `plans` / `subscriptions` | plans: id, name, setup\_fee\_paise, monthly\_fee\_paise, limits jsonb, template_keys · subscriptions: id, tenant\_id, plan\_id, status, current\_period\_end                             | Manual billing in MVP                                  |
| `audit_log`               | id, tenant\_id, actor\_id, action, entity, entity\_id, diff jsonb, created\_at                                                                                            | Who changed what                                       |

Order status flow: `pending` → `confirmed` → `packed` → `shipped` → `delivered`, plus `cancelled`. Razorpay later adds a `payments` table and a `payment_status` column; nothing above needs to change.

**RLS model**

- Two `security definer` helpers: `is_tenant_member(tid uuid)` and `is_super_admin()`.
- **Merchant tables:** select/insert/update/delete allowed when `is_tenant_member(tenant_id) or is_super_admin()`.
- **Public storefront reads:** anon can select `products`, `categories`, `product_images`, `banners`, `tenant_themes.published` only where the row is active and the tenant is active.
- **Orders:** no anon insert policy. Orders are created by a server action using the admin client, after re-pricing items from the database. Merchants read and update their own orders.
- **Super admin tables** (`plans`, `subscriptions`, `templates` writes): super admin only.

**Indexes worth adding from the start:** `tenant_domains(hostname)`, `products(tenant_id, status, is_featured)`, `orders(tenant_id, created_at desc)`, `product_variants(product_id)`.

## Development phases

Eight phases, each ending in something demoable; MVP is Phases 0–5. I've reordered one thing from the brief: backend and tenancy (Phase 2) come before the merchant dashboard (Phase 3), so the dashboard is built once on real data.

### Phase 0 — Foundations

- [x] Next.js (App Router, TypeScript strict), Tailwind, shadcn/ui, ESLint + Prettier
- [x] Supabase project (dev + prod), Supabase CLI, migrations folder, type generation script
- [x] Cloudflare R2 bucket + media domain; Vercel project with preview deployments
- [x] `lib/env.ts` with Zod-validated env vars; `money.ts` helpers (paise ↔ ₹ formatting)
- [x] CI: typecheck, lint, unit tests on every PR

**Exit:** empty app deploys to preview; a migration runs locally and in CI.

### Phase 1 — Premium storefront (mock data)

- [x] Write the core table types by hand (matching the schema) and build `mocks/` for 2 stores: a saree shop and a women's ethnic-wear boutique
- [x] Theme token → CSS variable pipeline; font whitelist via `next/font`
- [x] Template 1: header, footer, hero, category tiles, featured grid, product card
- [x] Pages: home, category (filter + sort), product (gallery, variants, zoom), cart, checkout form
- [x] Cart in local storage; WhatsApp checkout builds a `wa.me` message (no order record yet)
- [x] Mobile-first polish, image loading strategy, Lighthouse ≥ 90 on mobile

**Exit:** two visibly different branded stores from one template, switched by config.

### Phase 2 — Backend, auth and tenancy core

- [x] Migrations for all tables in the database section, enums, indexes, triggers (`updated_at`, profile creation)
- [x] RLS policies + helper functions; pgTAP isolation tests in CI
- [x] Supabase Auth (email OTP or magic link) for merchants and super admin
- [x] `proxy.ts` hostname resolution + `/sites/[host]` rewrite; `*.localhost` for local dev
- [x] Replace mocks with `features/catalog/queries.ts`; cache tags per tenant
- [x] Seed script with the two demo stores

**Exit:** `saree-demo.localhost:3000` and `boutique-demo.localhost:3000` render from Supabase; isolation tests pass.

### Phase 3 — Merchant dashboard

- [x] Dashboard shell, tenant guard, navigation, empty states
- [x] Categories CRUD with drag-to-reorder
- [x] Products CRUD: details, attributes, variants, pricing, stock, status, with a clothing attribute preset (fabric, length, blouse piece, size, colour, care)
- [x] Image upload via presigned R2 URLs, reorder, alt text, delete
- [x] Storefront settings: logo, colours, fonts, banners, section order, draft/preview/publish
- [x] Store settings: name, WhatsApp number, address, policies pages

**Exit:** a merchant can build a full catalog and rebrand the store without developer help.

### Phase 4 — Ordering

- [x] `createOrder` server action: validate cart, re-price from DB, check stock, create order + items, return WhatsApp link
- [x] Order confirmation page with order number; carts with price-on-request items show the total as "to be confirmed"
- [x] Dashboard orders list, detail, status changes, stock decrement on confirm
- [x] Rate limiting and basic spam protection on checkout

**Exit:** a test order appears in the dashboard and in WhatsApp with matching totals.

### Phase 5 — Super admin and subscriptions

- [x] Tenant onboarding wizard: create tenant, owner invite, template, subdomain, plan
- [x] Tenant list with status, suspend/reactivate, impersonate-read-only view
- [x] Plans and subscriptions with manual payment recording; plan limits (products, staff)
- [x] Template enable/disable per plan

**Exit:** a new store goes from zero to live on a subdomain in under 30 minutes, without touching code. MVP done.

### Phase 6 — Templates 2–3, custom domains, hardening

- [ ] Templates 2 and 3 on the same section contract: a second clothing style, then a jewellery template with its attribute preset and price-on-request display when that vertical opens
- [ ] Custom domain flow: add domain, DNS instructions, verification, SSL via the hosting provider's domains API
- [ ] SEO: metadata, sitemap per tenant, structured data for products, Open Graph images
- [ ] Monitoring (error tracking, uptime), backups check, audit log views

### Phase 7 — Razorpay (future)

- [ ] Razorpay orders API, checkout, signature verification, webhook handler
- [ ] `payments` table, refunds, payment status in dashboard
- [ ] Decide: one platform Razorpay account vs Razorpay Route to merchant accounts

## Risks and open decisions

The biggest risk is cross-tenant data leakage; the biggest scope risk is jewellery pricing. Everything else is manageable with the plan above.

**Risks**

| Risk                                                   | Mitigation                                                                               |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| A missing RLS policy leaks one store's data to another | RLS on every table, pgTAP isolation tests in CI, explicit `tenant_id` filters in queries |
| Spam or fake WhatsApp orders                           | Rate limiting, phone format validation, merchant confirms orders before stock moves      |
| Custom domain SSL and DNS support burden               | Free subdomains first; custom domains in Phase 6 with a guided DNS checklist             |
| Template sprawl as merchants ask for one-off changes   | Fixed section contract; changes go into the template for everyone, not per-tenant forks  |
| Image storage and bandwidth costs                      | Compress to WebP on upload, size limits per plan, CDN caching                            |
| Customer personal data (names, phones, addresses)      | Collect only what orders need; review India's DPDP Act obligations before launch         |

**Open decisions**

- [ ] **Hosting for custom domains:** Vercel (simplest with Next.js, domains API) vs Cloudflare for SaaS custom hostnames. Leaning Vercel for MVP.
- [ ] **Jewellery pricing:** fixed prices only for MVP, plus a "price on request" option (decided). Jewellers list weight, purity and making charges, and the final price is confirmed on WhatsApp at order time, so nobody updates prices daily. A live gold-rate feed can come later if merchants ask.
- [ ] **GST:** are prices shown tax-inclusive, and do merchants need GST invoices from the platform?
- [ ] **Shopper accounts:** guest checkout only for MVP (recommended), accounts later.
- [ ] **Merchant login:** email magic link vs phone OTP (phone OTP needs an SMS provider and costs per message).
- [ ] **Platform domain name** for subdomains and the dashboard.

**Working conventions**

- One phase = one branch and a short review before merge; each phase starts by revisiting this doc.
- Every schema change is a migration in `supabase/migrations`; never edit the database by hand.
- Regenerate `types/database.ts` after each migration; no `any` across the data layer.
