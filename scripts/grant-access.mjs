// Gives an existing account access, until the super-admin UI exists
// (Phase 5). The person must have signed in once at /login first.
//
//   npm run grant -- --email you@example.com --super-admin
//   npm run grant -- --email owner@example.com --store saree-demo [--role staff]
//   npm run grant -- --email you@example.com --super-admin --revoke
//
// Uses NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
// For another project, run node directly with that project's env file:
//   node --env-file=<file> scripts/grant-access.mjs --email ... --super-admin
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    'super-admin': { type: 'boolean', default: false },
    store: { type: 'string' },
    role: { type: 'string', default: 'owner' },
    revoke: { type: 'boolean', default: false },
  },
});

function fail(message) {
  console.error(message);
  process.exit(1);
}

const email = values.email?.trim().toLowerCase();
if (!email || (!values['super-admin'] && !values.store)) {
  fail(
    'Usage: npm run grant -- --email <email> (--super-admin | --store <slug> [--role owner|staff]) [--revoke]',
  );
}
if (!['owner', 'staff'].includes(values.role))
  fail('--role must be owner or staff');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  fail(
    'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.example).',
  );
}

const db = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserId(address) {
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) fail(`Could not list users: ${error.message}`);
    const user = data.users.find((u) => u.email?.toLowerCase() === address);
    if (user) return user.id;
    if (data.users.length < 1000) return null;
  }
}

console.log(`Project: ${url}`);
const userId = await findUserId(email);
if (!userId)
  fail(`No account for ${email}. Sign in once at /login, then run this again.`);

if (values['super-admin']) {
  const { error } = await db
    .from('profiles')
    .update({ is_super_admin: !values.revoke })
    .eq('user_id', userId);
  if (error) fail(`Could not update profile: ${error.message}`);
  console.log(
    `${email} is ${values.revoke ? 'no longer' : 'now'} a super admin.`,
  );
}

if (values.store) {
  const { data: tenant, error } = await db
    .from('tenants')
    .select('id, name')
    .eq('slug', values.store)
    .maybeSingle();
  if (error) fail(`Could not look up store: ${error.message}`);
  if (!tenant) fail(`No store with slug "${values.store}".`);

  if (values.revoke) {
    const { error: deleteError } = await db
      .from('tenant_members')
      .delete()
      .eq('tenant_id', tenant.id)
      .eq('user_id', userId);
    if (deleteError)
      fail(`Could not remove membership: ${deleteError.message}`);
    console.log(`${email} was removed from ${tenant.name}.`);
  } else {
    const { error: upsertError } = await db
      .from('tenant_members')
      .upsert({ tenant_id: tenant.id, user_id: userId, role: values.role });
    if (upsertError) fail(`Could not add membership: ${upsertError.message}`);
    console.log(`${email} is now ${values.role} of ${tenant.name}.`);
  }
}
