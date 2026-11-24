'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { teamInviteMessage } from '@/features/admin/invite';
import type { TeamMember } from '@/features/admin/queries';
import { addMember, changeMember } from '@/features/admin/team-actions';
import { MEMBER_ROLE_LABEL, MEMBER_ROLES } from '@/features/admin/team-schema';
import type { ActionResult } from '@/lib/action-result';
import { useHydrated } from '@/lib/use-hydrated';
import { CopyButton } from './copy-button';

const selectClass =
  'h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

function RoleOptions() {
  return MEMBER_ROLES.map((role) => (
    <option key={role} value={role}>
      {MEMBER_ROLE_LABEL[role]}
    </option>
  ));
}

/** A store's people: add someone, change a role, remove someone. */
export function TeamCard({
  storeId,
  storeName,
  team,
  loginUrl,
}: {
  storeId: string;
  storeName: string;
  team: TeamMember[];
  loginUrl: string;
}) {
  const hydrated = useHydrated();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('staff');
  const [removing, setRemoving] = useState<string | null>(null);

  const run = (
    action: () => Promise<ActionResult>,
    done: string,
    after?: () => void,
  ) =>
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) {
          toast.error(result.error ?? 'Could not change the team.');
          return;
        }
        after?.();
        toast.success(done);
      } catch {
        toast.error('Something went wrong. Please try again.');
      }
    });

  const add = (event: FormEvent) => {
    event.preventDefault();
    run(
      () => addMember({ storeId, email, role }),
      'Added to the team',
      () => {
        setEmail('');
        setRole('staff');
      },
    );
  };

  return (
    <Card data-testid="team-card" data-hydrated={hydrated || undefined}>
      <CardHeader>
        <CardTitle>Team</CardTitle>
        <p className="text-sm text-muted-foreground">
          Staff work on products, categories and orders. Owners also change the
          storefront and settings.
        </p>
      </CardHeader>
      <CardContent className="grid gap-5 text-sm">
        {team.length === 0 ? (
          <p className="text-muted-foreground">
            Nobody has access to this store.
          </p>
        ) : (
          <ul className="grid gap-4" data-testid="store-team">
            {team.map((member) => (
              <li key={member.userId} className="grid gap-2">
                <p className="break-all">{member.email}</p>
                {!member.signedIn && (
                  <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                    Has not signed in yet
                    {member.role === 'staff' && (
                      <CopyButton
                        text={teamInviteMessage({
                          storeName,
                          email: member.email,
                          loginUrl,
                        })}
                      />
                    )}
                  </div>
                )}
                {removing === member.userId ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () =>
                            changeMember({
                              storeId,
                              userId: member.userId,
                              role: null,
                            }),
                          'Removed from the team',
                          () => setRemoving(null),
                        )
                      }
                    >
                      Remove access
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => setRemoving(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <select
                      aria-label={`Role of ${member.email}`}
                      className={selectClass}
                      value={member.role}
                      disabled={pending}
                      onChange={(event) =>
                        run(
                          () =>
                            changeMember({
                              storeId,
                              userId: member.userId,
                              role: event.target.value,
                            }),
                          'Role changed',
                        )
                      }
                    >
                      <RoleOptions />
                    </select>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => setRemoving(member.userId)}
                    >
                      Remove…
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={add} noValidate className="grid gap-3 border-t pt-4">
          <label htmlFor="member-email" className="font-medium">
            Add someone by email
          </label>
          <Input
            id="member-email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <div className="flex items-center gap-2">
            <select
              aria-label="Role of the new person"
              className={selectClass}
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              <RoleOptions />
            </select>
            <Button type="submit" disabled={pending || email.trim() === ''}>
              {pending ? 'Saving…' : 'Add to team'}
            </Button>
          </div>
          <p className="text-muted-foreground">
            Nothing is emailed until they sign in with a code.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
