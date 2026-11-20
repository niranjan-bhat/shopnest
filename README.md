# ShopNest

Multi-tenant online stores for Indian clothing brands. The plan, architecture
and database design are in [docs/PLAN.md](docs/PLAN.md).

## Local setup

Needs Node (see `.nvmrc`) and Docker Desktop running.

```bash
npm install
npx supabase start          # local Postgres, Auth, Mailpit; applies migrations + seed
npx supabase status         # copy API_URL, ANON_KEY and SERVICE_ROLE_KEY
cp .env.example .env.local  # and paste those values in
npm run dev
```

Every store has its own host name, and the dashboard has its own (any
`*.localhost` name points at your machine, no hosts-file changes needed):

| URL                                 | What                                  |
| ----------------------------------- | ------------------------------------- |
| http://localhost:3000               | Platform page listing the demo stores |
| http://saree-demo.localhost:3000    | Demo store: Tara Weaves (sarees)      |
| http://boutique-demo.localhost:3000 | Demo store: Noor Atelier (boutique)   |
| http://app.localhost:3000/login     | Merchant sign-in (6-digit email code) |
| http://127.0.0.1:54324              | Mailpit: the sign-in emails land here |
| http://127.0.0.1:54323              | Supabase Studio                       |

### Signing in and access

Anyone can sign in at `/login`, but a new account sees no stores. Give access
from the command line (until the super-admin screens arrive):

```bash
npm run grant -- --email you@example.com --store saree-demo   # owner of a store
npm run grant -- --email you@example.com --super-admin        # all stores, /admin
```

## Commands

| Command                      | Does                                                   |
| ---------------------------- | ------------------------------------------------------ |
| `npm run dev`                | Dev server                                             |
| `npm run lint` / `typecheck` | ESLint / TypeScript                                    |
| `npm test`                   | Unit tests (Vitest)                                    |
| `npm run test:e2e`           | Browser tests (Playwright; needs Supabase running)     |
| `npm run db:test`            | Database and tenant-isolation tests (pgTAP)            |
| `npm run db:reset`           | Rebuild the local database from migrations + seed      |
| `npm run db:types`           | Regenerate `src/types/database.ts` after a migration   |
| `npm run db:seed`            | Regenerate `supabase/seed.sql` from the demo fixtures  |
| `npm run mock:media`         | Rebuild demo images in `public/mock-media` from photos |
