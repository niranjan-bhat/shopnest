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

1. [x] **Database migrations** before merging `phase-4-ordering`:
       `npx supabase db push --remote --dry-run` should list `place_order`, `order_status` and `order_limits`,
       then `npx supabase db push --remote`. The checkout breaks if the code ships without them.
2. [x] **Place a test order** on a live store from your phone: it reaches WhatsApp with an order number, shows
       up under Dashboard → Orders as New with the same total, and confirming then cancelling it moves the stock
       down and back. Cancel the test order afterwards.
3. [x] **Spam limits** need nothing set up: Vercel supplies the shopper's network address, and only a hash
       of it, keyed with the Supabase service-role key, is stored. Rotating that key restarts the hourly counts.

## Deploy Phase 5 (super admin and subscriptions)

1. [x] **Database migrations** before merging `phase-5-admin`:
       `npx supabase db push --remote --dry-run` should list `create_store`, `store_status`, `billing` and `team_and_templates`, then `npx supabase db push --remote`.
       It adds the Starter and Growth plans and puts every existing store on Growth.
2. [ ] **Plan prices.** Starter (₹999) and Growth (₹2,499) are placeholders: set the real ones in Admin → Plans before billing anyone.
3. [ ] **Create a test store** at `https://app.zarify.in/admin`, with an owner email you can read: the owner signs in
       with a code and sees the store, and `https://<address>.zarify.in` says "Page not found" until it is live.
4. [ ] **Go live, then suspend it** from its admin page: the address opens, then says "currently unavailable".
5. [ ] **Super admins are read-only now** in stores they are not a member of: use "Allow editing" in the dashboard.
6. [ ] **Billing dates.** Existing stores are not billed until you set "Billing starts" on their admin page; new stores
       start the day they first go live. Plan limits apply to existing stores at once (Growth: 500 products, 6 people).
7. [ ] **Staff roles.** Anyone with the staff role loses the storefront and settings pages. Check each store's
       Team card on its admin page and make the right people owners.
8. [ ] **Templates.** Every plan offers all templates until you narrow it in Admin → Plans.

## Deploy Phase 5.5 (landing page)

No migrations or environment variables.

1. [ ] **Make `zarify.in` the main address.** Vercel → Domains: today it redirects to `www.zarify.in`. Reverse that, because
       the page names `https://zarify.in` as its address to Google.
2. [ ] **Check it on your phone**: "Chat on WhatsApp" reaches your sales number, both demos open, "Sign in" opens the app.
       Send yourself the link on WhatsApp: the share image appears.
3. [ ] **Review Privacy and Terms** (`/privacy`, `/terms`): they are drafts. Add the business name and city.
4. [ ] **Contact email**: set up `hello@zarify.in` and add it to both pages and the footer.
5. [ ] **Prices** are not shown. Add them to the page once they are final.

## Deploy login hardening

The order matters: a wrong one can lock everyone out of `app.zarify.in`.

1. [x] **Database migration** before merging `login-hardening`: `npx supabase db push --remote --dry-run` should list
       `sign_in_limits`, then `npx supabase db push --remote`. Sign-in breaks if the code ships without it.
2. [x] **Turnstile widget.** Cloudflare dashboard → Turnstile → Add widget: name "Zarify login", hostname
       `app.zarify.in`, mode Managed. No DNS change is needed. Copy the site key and the secret key.
3. [x] **Vercel → Environment Variables (Production only):** `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and
       `TURNSTILE_SECRET_KEY` (as Secret). Not Preview: the widget only works on `app.zarify.in`.
4. [x] **Merge and deploy** (the site key is built in, so redeploy if you add it later). Sign out, then sign in
       at `https://app.zarify.in/login`, including a resend. Try an email with no access: same message, no email.
5. [x] **Then Supabase → Authentication → Attack Protection:** enable CAPTCHA, provider Turnstile, with the same
       secret key. Sign in again straight away; if no code arrives, turn it off and check the Vercel logs for
       "Sending a sign-in code failed".
6. [x] **Supabase → Authentication → Sign In / Providers:** turn off "Allow new users to sign up". Keep the Email
       provider on. Add a person from a store's Team card to confirm accounts can still be made.
7. [ ] **Clean up (optional).** Authentication → Users may hold strangers who signed in before. They are sent no
       more codes; delete the ones you don't know.

Rotating the service-role key restarts the hourly counts. The limits are in the migration's header comment.

## Deploy the product save checks

1. [ ] **Database migration** before merging `fix-stale-stock`: `npx supabase db push --remote --dry-run` should list only
       `save_product_conflicts`, then `npx supabase db push --remote`. The code live before it keeps working with it.

## Deploy product colours

1. [ ] **Database migration** before merging `product-colours`: `npx supabase db push --remote --dry-run` should list only
       `product_colours` and `variant_order`, then `npx supabase db push --remote`. It moves each product's Colour detail into its colour
       options, so the live colour filter stays empty until the new code is deployed: merge right after.
2. [ ] **Redeploy without the build cache** after merging, so stores drop their cached products.

## Deploy store visitors

1. [ ] **Database migration** before merging `store-visitors`: `npx supabase db push --remote --dry-run` should list only
       `store_visitors`, then `npx supabase db push --remote`. The dashboard's Overview page breaks if the code ships without it.
2. [ ] **Check it live**: open a store on your phone, look at a product, then see Dashboard → Overview → Visitors → Today.
3. [ ] **Stores' own privacy pages** written before this: add the sample's line about counting visits.

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
