'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { TemplateOption } from '@/features/admin/queries';
import { savePlan } from '@/features/billing/actions';
import {
  planSchema,
  type PlanField,
  type PlanInput,
  type PlanValues,
} from '@/features/billing/schema';
import { useHydrated } from '@/lib/use-hydrated';

const TEXT_FIELDS: {
  name: Exclude<PlanField, 'isActive' | 'allTemplates' | 'templates'>;
  label: string;
  hint?: string;
}[] = [
  { name: 'name', label: 'Name' },
  {
    name: 'monthlyFee',
    label: 'Monthly fee (₹)',
    hint: 'Changes what is suggested for the next payment. Nothing already recorded changes.',
  },
  { name: 'setupFee', label: 'Setup fee (₹)' },
  {
    name: 'maxProducts',
    label: 'Products',
    hint: 'Draft and active. Leave empty for no limit.',
  },
  {
    name: 'maxTeam',
    label: 'People on the team',
    hint: 'Owners included. Leave empty for no limit.',
  },
];

export function PlanForm({
  planId,
  initial,
  templates,
}: {
  planId: string | null;
  initial: PlanInput;
  templates: TemplateOption[];
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [pending, startTransition] = useTransition();
  const {
    register,
    control,
    setValue,
    clearErrors,
    handleSubmit,
    setError,
    getValues,
    reset,
    formState: { errors },
  } = useForm<PlanInput, unknown, PlanValues>({
    resolver: zodResolver(planSchema),
    defaultValues: initial,
  });

  const allTemplates = useWatch({ control, name: 'allTemplates' });
  const chosen = useWatch({ control, name: 'templates' });

  // The action parses what was typed, so send that, not the parsed values.
  const onSubmit = () => {
    const raw = getValues();
    startTransition(async () => {
      try {
        const result = await savePlan(planId, raw);
        if (result.ok) {
          toast.success('Plan saved');
          // Visited pages stay mounted: leave a fresh form behind.
          reset(planId ? raw : initial);
          router.push('/admin/plans');
          return;
        }
        for (const [field, message] of Object.entries(
          result.fieldErrors ?? {},
        )) {
          setError(field as PlanField, { message }, { shouldFocus: true });
        }
        toast.error(result.error ?? 'Check the highlighted fields.');
      } catch {
        toast.error('Something went wrong. Please try again.');
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      data-hydrated={hydrated || undefined}
    >
      <Card>
        <CardContent>
          <FieldGroup>
            {TEXT_FIELDS.map(({ name, label, hint }) => (
              <Field key={name} data-invalid={Boolean(errors[name])}>
                <FieldLabel htmlFor={`plan-${name}`}>{label}</FieldLabel>
                <Input
                  id={`plan-${name}`}
                  autoComplete="off"
                  inputMode={name === 'name' ? 'text' : 'decimal'}
                  aria-invalid={Boolean(errors[name])}
                  {...register(name)}
                />
                {hint && <FieldDescription>{hint}</FieldDescription>}
                <FieldError errors={[errors[name]]} />
              </Field>
            ))}
            <fieldset className="grid gap-3 text-sm">
              <legend className="mb-3 font-medium">Templates</legend>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="size-4"
                  {...register('allTemplates', {
                    onChange: () => clearErrors('templates'),
                  })}
                />
                All templates, including new ones
              </label>
              {!allTemplates &&
                templates.map((template) => (
                  <label
                    key={template.key}
                    className="ml-7 flex items-center gap-3"
                  >
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={chosen.includes(template.key)}
                      onChange={(event) => {
                        clearErrors('templates');
                        setValue(
                          'templates',
                          event.target.checked
                            ? [...chosen, template.key]
                            : chosen.filter((key) => key !== template.key),
                          { shouldDirty: true },
                        );
                      }}
                    />
                    {template.name}
                  </label>
                ))}
              <FieldDescription>
                Stores keep the template they already use.
              </FieldDescription>
              <FieldError
                errors={[errors.templates as { message?: string } | undefined]}
              />
            </fieldset>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4"
                {...register('isActive')}
              />
              <span>
                <span className="font-medium">Offered to stores</span>
                <span className="block text-muted-foreground">
                  Untick to retire it. Stores already on it stay on it.
                </span>
              </span>
            </label>
            <div>
              <Button type="submit" disabled={pending}>
                {pending ? 'Saving…' : 'Save plan'}
              </Button>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>
    </form>
  );
}
