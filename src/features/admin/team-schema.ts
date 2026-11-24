import { z } from 'zod';

// A store's team, as super admins change it.

export const MEMBER_ROLES = ['owner', 'staff'] as const;

export const MEMBER_ROLE_LABEL: Record<(typeof MEMBER_ROLES)[number], string> =
  { owner: 'Owner', staff: 'Staff' };

const role = z.enum(MEMBER_ROLES, 'Choose a role');

export const addMemberSchema = z.object({
  storeId: z.uuid(),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, 'Keep it under 254 characters')
    .pipe(z.email('Enter a valid email address')),
  role,
});

export const changeMemberSchema = z.object({
  storeId: z.uuid(),
  userId: z.uuid(),
  /** Null removes them. */
  role: role.nullable(),
});

/** The code check_team_limit raises. */
export const TEAM_LIMIT_CODE = 'ZL002';
