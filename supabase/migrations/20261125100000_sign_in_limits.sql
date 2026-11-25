-- Login hardening: who is sent a sign-in code, and how often anyone may ask
-- for one or guess one. Only the server (service role) calls these.
--
--   - can_sign_in: a member of any store, or a super admin;
--   - asking for a code: one per 75 seconds and 5 an hour for one email,
--     10 an hour from one network. Every email is counted the same way,
--     known or not, so the limits do not show who has an account;
--   - checking a code: 10 an hour for one email, 30 an hour from one network.
--     The server clears an email's checks when a code was right, so only
--     wrong ones add up.
--
-- Neither the email nor the network address is stored: the server sends
-- keyed hashes (HMAC). Refused attempts are not recorded, so a block ends on
-- its own. Rows older than a day are removed as new ones arrive.

create table public.sign_in_attempts (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('send', 'verify')),
  email_hash text not null check (email_hash ~ '^[0-9a-f]{64}$'),
  client_hash text check (client_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
create index sign_in_attempts_email_idx
  on public.sign_in_attempts (email_hash, kind, created_at desc);
create index sign_in_attempts_client_idx
  on public.sign_in_attempts (client_hash, kind, created_at desc)
  where client_hash is not null;
create index sign_in_attempts_created_idx
  on public.sign_in_attempts (created_at);

-- No policies: no browser session can read or write it.
alter table public.sign_in_attempts enable row level security;
revoke all on public.sign_in_attempts from anon, authenticated;
grant select, insert, delete on public.sign_in_attempts to service_role;

-- Records an attempt and returns 'ok', or records nothing and returns the
-- limit it met: 'wait' (asked again too soon), 'email' or 'network'.
create function public.record_sign_in_attempt(
  attempt text, email_key text, client text default null
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  email_limit integer;
  client_limit integer;
begin
  if attempt = 'send' then
    email_limit := 5;
    client_limit := 10;
  elsif attempt = 'verify' then
    email_limit := 10;
    client_limit := 30;
  else
    raise exception 'unknown attempt' using errcode = '22023';
  end if;

  -- One at a time per email and per network, so requests sent together
  -- cannot all slip under the limit. Always in this order: no deadlock.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('sign-in-email:' || email_key, 0));
  if client is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('sign-in-client:' || client, 0));
  end if;

  if client is not null and (
    select count(*)
      from public.sign_in_attempts a
     where a.client_hash = client
       and a.kind = attempt
       and a.created_at > now() - interval '1 hour'
  ) >= client_limit then
    return 'network';
  end if;
  -- A little over a minute: Supabase refuses a second email within 60
  -- seconds of the first, and the first leaves slightly after this check.
  if attempt = 'send' and exists (
    select 1
      from public.sign_in_attempts a
     where a.email_hash = email_key
       and a.kind = 'send'
       and a.created_at > now() - interval '75 seconds'
  ) then
    return 'wait';
  end if;
  if (
    select count(*)
      from public.sign_in_attempts a
     where a.email_hash = email_key
       and a.kind = attempt
       and a.created_at > now() - interval '1 hour'
  ) >= email_limit then
    return 'email';
  end if;

  delete from public.sign_in_attempts a
   where a.id in (
     select old.id
       from public.sign_in_attempts old
      where old.created_at < now() - interval '1 day'
      limit 500
        for update skip locked
   );
  insert into public.sign_in_attempts (kind, email_hash, client_hash)
  values (attempt, email_key, client);
  return 'ok';
end;
$$;

-- SECURITY DEFINER to read auth.users.
create function public.can_sign_in(member_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from auth.users u
      join public.profiles p on p.user_id = u.id
     where lower(u.email) = lower(btrim(member_email))
       and u.deleted_at is null
       and not u.is_sso_user
       and (
         p.is_super_admin
         or exists (
           select 1 from public.tenant_members m where m.user_id = u.id
         )
       )
  );
$$;

revoke all on function public.record_sign_in_attempt(text, text, text)
  from public, anon, authenticated;
revoke all on function public.can_sign_in(text)
  from public, anon, authenticated;
grant execute on function public.record_sign_in_attempt(text, text, text)
  to service_role;
grant execute on function public.can_sign_in(text) to service_role;

-- "for update" above needs the update privilege.
grant update on public.sign_in_attempts to service_role;
