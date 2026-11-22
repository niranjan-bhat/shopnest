-- Store contact details, edited by the merchant in Settings and shown on the
-- storefront (contact page and footer). Public like the rest of a live
-- store's row: nothing here is private.

alter table public.tenants
  add column contact_email text
    check (
      contact_email is null
      or (length(contact_email) <= 254
          and contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
    ),
  -- As typed for display (landlines included); links use its digits.
  add column contact_phone text
    check (contact_phone is null or contact_phone ~ '^\+?[0-9 ()-]{6,20}$'),
  -- { line1, line2?, city, state, pincode }, checked by the app.
  add column address jsonb
    check (address is null or jsonb_typeof(address) = 'object'),
  add column opening_hours text
    check (opening_hours is null or length(opening_hours) <= 200);

grant update (contact_email, contact_phone, address, opening_hours)
  on public.tenants to authenticated;
