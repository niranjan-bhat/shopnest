# Launch checklist

Everything production needs that is not in the code. Tick items as you go
and add new ones here, so nothing lives only in a chat.

Production today: `zarify.in` on Vercel (DNS on Vercel), Supabase project
`awkomocddsafljhxhlux` (Mumbai), R2 bucket `zarify-prod`.

## Done

- [x] Domain `zarify.in` bought (Hostinger), nameservers moved to Vercel
- [x] Vercel domains `zarify.in` and `*.zarify.in`; `NEXT_PUBLIC_ROOT_DOMAIN=zarify.in`
- [x] Hosted Supabase: schema and demo data pushed (Phase 2)
- [x] Supabase auth: site URL `https://app.zarify.in`, redirect `/auth/callback`, OTP length 6, expiry 600 s
- [x] Email via Resend from `no-reply@mail.zarify.in` (domain verified, records in Vercel DNS)
- [x] You are super admin on production
- [x] R2 bucket `zarify-prod` created, public development URL enabled

## Deploy Phase 3 (dashboard)

Do these in order. Steps 1 to 6 are safe before merging: the live site
ignores the new database functions and keeps serving `/mock-media`.

1. [ ] **Database migrations.** Preview, then apply (asks for the database password):
       `npx supabase db push --remote --dry-run`, then `npx supabase db push --remote`.
       Expect four: `reorder_categories`, `category_menu_flag`, `save_product`, `reorder_product_images`.
       Never add `--include-seed` on production.
2. [x] **CORS on `zarify-prod`**: allow origin `https://app.zarify.in`, method `PUT`, header `content-type`.
3. [x] **R2 API token for production**: Object Read & Write on `zarify-prod` only (separate from the dev token).
4. [x] **`.env.hosted`**: add `R2_ACCOUNT_ID`, the new `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`, `R2_BUCKET=zarify-prod`.
5. [x] **Copy the demo photos to the bucket** (skips files already there):
       `node --env-file=.env.hosted scripts/upload-demo-media.mjs`
6. [x] **Vercel → Settings → Environment Variables (Production):**
       `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (as Secret), `R2_BUCKET=zarify-prod`,
       `NEXT_PUBLIC_MEDIA_BASE_URL=https://pub-efb6c498a91f450b828dc042bcb50ee9.r2.dev`.
       Only after step 5, or the demo stores show broken images.
7. [x] **Push `phase-3-dashboard`**, check the Vercel preview build is green, open a PR, merge to `main`.
8. [ ] **Check the live site** at `https://app.zarify.in`:
       categories (reorder, menu flag), products (add, edit, sizes), photos (upload, reorder, delete),
       and that the store pages still show their photos.
9. [ ] **Region**: in the deployment's Functions view, the region is `bom1` (Mumbai, from `vercel.json`).
10. [ ] **Email templates**: if they still say "ShopNest", paste `supabase/templates/sign-in-code.html`
        into Supabase → Authentication → Emails → **Confirm sign up** and **Magic link or OTP**.

## Deploy Phase 3.5–3.6 (storefront editor, store settings)

1. [x] **Database migrations** before merging `phase-3-storefront-editor` (all on production, checked 2026-11-23):
       `npx supabase db push --remote --dry-run` should list `reorder_banners`, `store_contact` and `store_pages`
       (plus any Phase 3 ones from step 1 above not yet applied), then `npx supabase db push --remote`.
2. [ ] **Check the live site**: Storefront → Banners: add one (upload), edit its dates, reorder, delete;
       a scheduled banner appears on the store within about 5 minutes of its start time.
3. [ ] **Store details**: Settings → fill in each live store's address, hours and email (the demo stores'
       details are in `seed.sql` only, which never runs on production), then check `/contact` and the footer.
4. [ ] **Pages**: Settings → Pages: write at least Shipping, Returns and Privacy for each live store
       (Razorpay asks for these later), show them, and check the footer links.

## Deploy Phase 4 (ordering)

1. [ ] **Database migrations** before merging `phase-4-ordering`:
       `npx supabase db push --remote --dry-run` should list `place_order` (and the later Phase 4 ones),
       then `npx supabase db push --remote`. The checkout breaks if the code ships without them.

## Before the first real merchant

- [ ] **Image domain.** `r2.dev` addresses are rate-limited and uncached (Cloudflare: development only).
      Buy a cheap second domain with DNS on **Cloudflare** (not `zarify.in`, which must stay on Vercel
      for the store wildcard). Connect it to `zarify-prod` under Custom Domains (e.g. `images.<domain>`),
      then change only `NEXT_PUBLIC_MEDIA_BASE_URL` in Vercel and redeploy. The database stores keys,
      so nothing else changes.
- [ ] **Vercel Pro.** The Hobby plan is for non-commercial use only.
- [ ] **Supabase Pro.** The free plan pauses after about a week without traffic (stores go offline) and has no daily backups.
- [ ] **Session limit.** After Supabase Pro: Authentication → Sessions → inactivity timeout (e.g. 7 days).
- [ ] **Email limits.** Supabase → Authentication → Rate Limits: raise email sends to about 30 an hour.
- [ ] **Trademark.** File "Zarify" in classes 35 and 42 (and 14 for jewellery) through a trademark agent.
- [ ] **Tax.** Ask a CA when GST registration applies and whether prices include GST.
- [ ] **Privacy.** Review India's DPDP Act duties for customer names, phones and addresses (orders, Phase 4).

## Every deploy

- [ ] New migrations? `npx supabase db push --remote --dry-run`, then apply, **before** merging the code that uses them.
- [ ] New environment variables? Add them in Vercel (Production and Preview) before merging.
- [ ] Changed data by hand in the Supabase editor? Redeploy with "Use existing Build Cache" unticked
      (store pages are cached for hours).
