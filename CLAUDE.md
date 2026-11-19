# ShopNest

Multi-tenant ecommerce SaaS for Indian clothing brands (saree shops, ethnic wear, boutiques). Jewellery comes after the MVP.
The full plan is in `docs/PLAN.md`. Read it before starting any phase, and follow its architecture, folder structure and database design.

## Stack

- Next.js 16 (App Router, `src/` layout), React 19, TypeScript strict
- Tailwind CSS; shadcn/ui (Base UI) for dashboard and admin only; storefront templates are custom components
- Supabase (Postgres + RLS + Auth), Cloudflare R2 for images, Zod, React Hook Form, Zustand (cart)
- Vitest, Playwright, pgTAP; Node 26

## Rules

- Work one phase at a time, and only on the tasks of the phase I name. Stop at the phase's exit criteria and summarise what was done.
- Propose a short plan and wait for my OK before writing code for a new phase.
- Every tenant-owned table has `tenant_id`; RLS is enabled on every table; storefront queries filter by `tenant_id` explicitly.
- Money is integer paise (`bigint`); never floats. Order totals are recomputed on the server.
- Store R2 object keys, never full URLs.
- `app/` files stay thin: they call `src/features/*` and render components. Templates never query the database.
- Validate every Server Action input with Zod.
- Schema changes go in `supabase/migrations`; regenerate `src/types/database.ts` afterwards. No `any` in the data layer.
- Never commit `.env.local` or expose the service-role key to the browser.

## Commands

- `npm run dev` · `npm run lint` · `npm run typecheck` · `npm test` · `npm run format`
- `npm run test:e2e` (Playwright) · `npm run db:test` (pgTAP, needs Docker) · `npm run db:types` (after migrations)
- Run tests with `npm test`, not `npx vitest run`: on Windows, a `d:\` path (as VS Code opens it) makes Vitest load twice and every suite fails. `scripts/vitest.mjs` works around this.
- Run lint, typecheck and tests before saying a task is done.
