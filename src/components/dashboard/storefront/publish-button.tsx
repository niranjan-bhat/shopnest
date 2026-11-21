'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { publishTheme } from '@/features/theme/actions';

/** Makes the draft theme live. */
export function PublishButton({
  disabled,
  size = 'default',
}: {
  disabled?: boolean;
  size?: 'default' | 'sm';
}) {
  const [pending, startTransition] = useTransition();
  const publish = () =>
    startTransition(async () => {
      try {
        const result = await publishTheme();
        if (result.ok) toast.success('Published. Your store is updated.');
        else toast.error(result.error ?? 'Could not publish.');
      } catch {
        toast.error('Something went wrong. Please try again.');
      }
    });
  return (
    <Button
      type="button"
      size={size}
      onClick={publish}
      disabled={disabled || pending}
    >
      {pending ? 'Publishing…' : 'Publish'}
    </Button>
  );
}
