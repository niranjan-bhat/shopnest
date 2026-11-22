'use client';

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { zodResolver } from '@hookform/resolvers/zod';
import { cn } from 'cn';
import { GripVertical, ImagePlus, Pencil, Trash2 } from 'lucide-react';
import { useId, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { StoreImage } from '@/components/storefront/store-image';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  createBanner,
  deleteBanner,
  reorderBanners,
  updateBanner,
} from '@/features/theme/banner-actions';
import type { DashboardBanner } from '@/features/theme/banner-queries';
import {
  bannerFormSchema,
  formatIst,
  MAX_BANNERS,
  type BannerField,
  type BannerFormValues,
  type BannerStatus,
  type BannerUse,
} from '@/features/theme/banners';
import { useHydrated } from '@/lib/use-hydrated';
import { ImageField } from './image-field';

const FAILED = 'Something went wrong. Please try again.';

const STATUS: Record<
  BannerStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline' }
> = {
  live: { label: 'Live', variant: 'default' },
  scheduled: { label: 'Scheduled', variant: 'secondary' },
  ended: { label: 'Ended', variant: 'outline' },
};

const USE_LABELS: Record<BannerUse, string> = {
  hero: 'the hero',
  promo: 'a promo section',
};

const nameOf = (banner: DashboardBanner, index: number) =>
  banner.heading || `Banner ${index + 1}`;

function whenText(banner: DashboardBanner): string {
  const { startsAt, endsAt, status } = banner;
  if (status === 'ended' && endsAt) return `Ended ${formatIst(endsAt)}`;
  if (status === 'scheduled' && startsAt) {
    return endsAt
      ? `${formatIst(startsAt)} to ${formatIst(endsAt)}`
      : `From ${formatIst(startsAt)}`;
  }
  return endsAt ? `Until ${formatIst(endsAt)}` : 'Always shown';
}

type DialogState =
  | { mode: 'closed' }
  | { mode: 'add' }
  | { mode: 'edit'; banner: DashboardBanner };

/**
 * The store's banners: add (upload an image), edit heading, link and dates,
 * reorder, delete. Changes save straight away, outside the theme draft.
 */
export function BannerLibrary({
  banners,
  uploadsEnabled,
}: {
  banners: DashboardBanner[];
  uploadsEnabled: boolean;
}) {
  // A local copy so reordering shows at once; replaced by every fresh list.
  const [items, setItems] = useState(banners);
  const [received, setReceived] = useState(banners);
  if (banners !== received) {
    setReceived(banners);
    setItems(banners);
  }
  const [dialog, setDialog] = useState<DialogState>({ mode: 'closed' });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [removing, setRemoving] = useState<{
    open: boolean;
    banner: DashboardBanner | null;
  }>({ open: false, banner: null });
  const [, startTransition] = useTransition();
  const dndId = useId();

  const open = (state: DialogState) => {
    setDialog(state);
    setDialogOpen(true);
  };
  const full = items.length >= MAX_BANNERS;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const indexOf = (id: UniqueIdentifier | undefined) =>
    items.findIndex((b) => b.id === id);
  const labelOf = (id: UniqueIdentifier) => {
    const i = indexOf(id);
    return i < 0 ? 'Banner' : nameOf(items[i], i);
  };
  const positionOf = (id: UniqueIdentifier | undefined) =>
    `position ${indexOf(id) + 1} of ${items.length}`;
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Picked up ${labelOf(active.id)}. Use the arrow keys to move it, Space to drop it.`,
    onDragOver: ({ active, over }) =>
      over ? `${labelOf(active.id)} is at ${positionOf(over.id)}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${labelOf(active.id)} dropped at ${positionOf(over.id)}.`
        : `${labelOf(active.id)} dropped.`,
    onDragCancel: ({ active }) => `Moving ${labelOf(active.id)} was cancelled.`,
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const before = items;
    const next = arrayMove(items, indexOf(active.id), indexOf(over.id));
    setItems(next);
    startTransition(async () => {
      try {
        const result = await reorderBanners(next.map((b) => b.id));
        if (!result.ok) {
          setItems(before);
          toast.error(result.error ?? FAILED);
        }
      } catch {
        setItems(before);
        toast.error(FAILED);
      }
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <CardTitle>Banners</CardTitle>
          <p className="max-w-prose text-sm text-muted-foreground">
            Large photos for your home page hero and promo sections. The hero
            shows them in this order. Changes here go live straight away,
            without publishing.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => open({ mode: 'add' })}
          disabled={!uploadsEnabled || full}
        >
          <ImagePlus aria-hidden />
          Add banner
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3">
        {!uploadsEnabled && (
          <p className="text-sm text-muted-foreground">
            Image uploads are not set up for this site yet.
          </p>
        )}
        {full && (
          <p className="text-sm text-muted-foreground">
            A store can have up to {MAX_BANNERS} banners. Delete one to add
            another.
          </p>
        )}
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            No banners yet. Add a wide photo, at least 1600 pixels across.
          </p>
        ) : (
          <DndContext
            id={dndId}
            sensors={sensors}
            collisionDetection={closestCenter}
            accessibility={{
              announcements,
              screenReaderInstructions: {
                draggable:
                  'To move a banner, press Space, use the arrow keys, then press Space again.',
              },
            }}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={items.map((b) => b.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="grid gap-2" aria-label="Banners">
                {items.map((banner, i) => (
                  <BannerRow
                    key={banner.id}
                    banner={banner}
                    name={nameOf(banner, i)}
                    onEdit={() => open({ mode: 'edit', banner })}
                    onDelete={() => setRemoving({ open: true, banner })}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialog.mode === 'edit' ? 'Edit banner' : 'Add banner'}
            </DialogTitle>
            <DialogDescription>
              Dates are Indian time. A banner goes up or comes down within a few
              minutes of its time.
            </DialogDescription>
          </DialogHeader>
          {dialog.mode !== 'closed' && (
            <BannerForm
              key={dialog.mode === 'edit' ? dialog.banner.id : 'new'}
              banner={dialog.mode === 'edit' ? dialog.banner : null}
              uploadsEnabled={uploadsEnabled}
              onDone={() => setDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <DeleteBannerDialog
        open={removing.open}
        banner={removing.banner}
        name={
          removing.banner
            ? nameOf(
                removing.banner,
                items.findIndex((b) => b.id === removing.banner?.id),
              )
            : ''
        }
        onOpenChange={(isOpen) => setRemoving((s) => ({ ...s, open: isOpen }))}
      />
    </Card>
  );
}

function BannerRow({
  banner,
  name,
  onEdit,
  onDelete,
}: {
  banner: DashboardBanner;
  name: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: banner.id });
  const status = STATUS[banner.status];
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-card p-2',
        isDragging && 'relative z-10 shadow-lg',
        banner.status === 'ended' && 'opacity-70',
      )}
      data-testid="banner-row"
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="shrink-0 cursor-grab touch-none rounded-md p-1.5 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
        aria-label={`Move ${name}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden className="size-4" />
      </button>
      <span className="relative aspect-[2/1] w-24 shrink-0 overflow-hidden rounded-md bg-muted sm:w-32">
        <StoreImage
          image={{ key: banner.imageKey, alt: '', width: 1920, height: 960 }}
          sizes="128px"
          fill
          alt=""
        />
      </span>
      <div className="grid min-w-0 flex-1 gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'truncate font-medium',
              !banner.heading && 'text-muted-foreground',
            )}
          >
            {name}
          </span>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <p className="truncate text-sm text-muted-foreground">
          {whenText(banner)}
          {banner.link && <> · {banner.link}</>}
        </p>
        {banner.uses.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Used in {banner.uses.map((u) => USE_LABELS[u]).join(' and ')}
          </p>
        )}
      </div>
      <span className="flex shrink-0 gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Edit ${name}`}
          onClick={onEdit}
        >
          <Pencil aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-destructive"
          aria-label={`Delete ${name}`}
          onClick={onDelete}
        >
          <Trash2 aria-hidden />
        </Button>
      </span>
    </li>
  );
}

function BannerForm({
  banner,
  uploadsEnabled,
  onDone,
}: {
  banner: DashboardBanner | null;
  uploadsEnabled: boolean;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const hydrated = useHydrated();
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [imageError, setImageError] = useState('');
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<BannerFormValues>({
    resolver: zodResolver(bannerFormSchema),
    defaultValues: {
      heading: banner?.heading ?? '',
      link: banner?.link ?? '',
      startsAt: banner?.startsAtLocal ?? '',
      endsAt: banner?.endsAtLocal ?? '',
    },
  });

  // Checked on every attempt, so it shows alongside any field errors.
  const missingImage = () => {
    if (banner || imageKey) return false;
    setImageError('Upload a photo for the banner.');
    return true;
  };

  const onSubmit = (values: BannerFormValues) => {
    if (missingImage()) return;
    startTransition(async () => {
      try {
        const result = banner
          ? await updateBanner(banner.id, values)
          : await createBanner({ imageKey, values });
        if (result.ok) {
          toast.success(banner ? 'Banner saved' : 'Banner added');
          onDone();
          return;
        }
        for (const [field, message] of Object.entries(
          result.fieldErrors ?? {},
        )) {
          setError(field as BannerField, { message }, { shouldFocus: true });
        }
        if (result.error) toast.error(result.error);
      } catch {
        toast.error(FAILED);
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit, missingImage)}
      noValidate
      data-hydrated={hydrated || undefined}
    >
      <FieldGroup>
        {banner ? (
          <span className="relative block aspect-[2/1] overflow-hidden rounded-lg bg-muted">
            <StoreImage
              image={{
                key: banner.imageKey,
                alt: '',
                width: 1920,
                height: 960,
              }}
              sizes="480px"
              fill
              alt=""
            />
          </span>
        ) : (
          <Field data-invalid={Boolean(imageError)}>
            <FieldLabel>Photo</FieldLabel>
            <ImageField
              kind="banner"
              label="Banner photo"
              value={imageKey}
              onChange={(key) => {
                setImageKey(key);
                setImageError('');
              }}
              uploadsEnabled={uploadsEnabled}
              previewClassName="aspect-[2/1] w-40"
              error={imageError}
            />
            <FieldDescription>
              A wide photo, at least 1600 pixels across. The left side sits
              behind the heading, so keep the subject to the right.
            </FieldDescription>
          </Field>
        )}
        <Field data-invalid={Boolean(errors.heading)}>
          <FieldLabel htmlFor="banner-heading">Heading</FieldLabel>
          <Input
            id="banner-heading"
            autoComplete="off"
            placeholder="e.g. The Diwali edit"
            aria-invalid={Boolean(errors.heading)}
            {...register('heading')}
          />
          <FieldDescription>Shown large over the photo.</FieldDescription>
          <FieldError errors={[errors.heading]} />
        </Field>
        <Field data-invalid={Boolean(errors.link)}>
          <FieldLabel htmlFor="banner-link">Link</FieldLabel>
          <Input
            id="banner-link"
            autoComplete="off"
            placeholder="e.g. /c/kanjivaram"
            aria-invalid={Boolean(errors.link)}
            {...register('link')}
          />
          <FieldDescription>
            Where the button goes: a page of your store such as /c/sarees, or a
            full web address.
          </FieldDescription>
          <FieldError errors={[errors.link]} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={Boolean(errors.startsAt)}>
            <FieldLabel htmlFor="banner-starts">Show from</FieldLabel>
            <Input
              id="banner-starts"
              type="datetime-local"
              aria-invalid={Boolean(errors.startsAt)}
              {...register('startsAt')}
            />
            <FieldDescription>Empty: straight away.</FieldDescription>
            <FieldError errors={[errors.startsAt]} />
          </Field>
          <Field data-invalid={Boolean(errors.endsAt)}>
            <FieldLabel htmlFor="banner-ends">Show until</FieldLabel>
            <Input
              id="banner-ends"
              type="datetime-local"
              aria-invalid={Boolean(errors.endsAt)}
              {...register('endsAt')}
            />
            <FieldDescription>Empty: until you remove it.</FieldDescription>
            <FieldError errors={[errors.endsAt]} />
          </Field>
        </div>
      </FieldGroup>
      <DialogFooter className="mt-6">
        <DialogClose render={<Button type="button" variant="outline" />}>
          Cancel
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : banner ? 'Save' : 'Add banner'}
        </Button>
      </DialogFooter>
    </form>
  );
}

function DeleteBannerDialog({
  open,
  banner,
  name,
  onOpenChange,
}: {
  open: boolean;
  banner: DashboardBanner | null;
  name: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const confirm = () => {
    if (!banner) return;
    startTransition(async () => {
      try {
        const result = await deleteBanner(banner.id);
        if (!result.ok) {
          toast.error(result.error ?? FAILED);
          return;
        }
        toast.success('Banner deleted');
        onOpenChange(false);
      } catch {
        toast.error(FAILED);
      }
    });
  };
  const uses = banner?.uses ?? [];
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            {uses.length > 0 &&
              `It is used in ${uses.map((u) => USE_LABELS[u]).join(' and ')} of your home page${uses.includes('promo') ? '; the promo will show without a photo' : ''}. `}
            It is removed from your store straight away. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={confirm}
          >
            {pending ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
