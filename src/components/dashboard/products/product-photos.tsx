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
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from 'cn';
import { GripVertical, ImagePlus, Pencil, Trash2 } from 'lucide-react';
import { useId, useRef, useState, useTransition, type DragEvent } from 'react';
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import type { DashboardImage } from '@/features/catalog/dashboard';
import {
  ImageProblem,
  prepareImage,
  type PreparedImage,
} from '@/features/media/prepare-image';
import {
  addProductImages,
  deleteProductImage,
  prepareProductImageUploads,
  reorderProductImages,
  setProductImageAlt,
  setProductImageColour,
} from '@/features/media/product-image-actions';
import { MAX_IMAGES_PER_PRODUCT } from '@/features/media/rules';

const FAILED = 'Something went wrong. Please try again.';

type Pending = { id: string; name: string; problem?: string };

/**
 * A product's photos: upload (click or drop), reorder (the first is the
 * cover), describe for screen readers, delete. Changes save immediately,
 * separately from the product form.
 */
export function ProductPhotos({
  productId,
  productName,
  images,
  colours,
  uploadsEnabled,
}: {
  productId: string;
  productName: string;
  images: DashboardImage[];
  /** The product's saved colours. */
  colours: string[];
  uploadsEnabled: boolean;
}) {
  // A local copy so reordering shows at once; replaced by every fresh list.
  const [items, setItems] = useState(images);
  const [received, setReceived] = useState(images);
  if (images !== received) {
    setReceived(images);
    setItems(images);
  }
  const [pending, setPending] = useState<Pending[]>([]);
  const [editing, setEditing] = useState<{
    open: boolean;
    image: DashboardImage | null;
  }>({ open: false, image: null });
  const [removing, setRemoving] = useState<{
    open: boolean;
    image: DashboardImage | null;
  }>({ open: false, image: null });
  const [, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const dndId = useId();

  const room = MAX_IMAGES_PER_PRODUCT - items.length - pending.length;
  const busy = pending.some((p) => !p.problem);

  const upload = async (files: File[]) => {
    if (files.length === 0) return;
    if (files.length > room) {
      toast.error(
        room <= 0
          ? `A product can have up to ${MAX_IMAGES_PER_PRODUCT} photos.`
          : `Only ${room} more photo${room === 1 ? '' : 's'} fit. Choose fewer.`,
      );
      return;
    }
    const batch: Pending[] = files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
    }));
    setPending((list) => [...list.filter((p) => !p.problem), ...batch]);
    const fail = (id: string, problem: string) =>
      setPending((list) =>
        list.map((p) => (p.id === id ? { ...p, problem } : p)),
      );
    const done = (ids: string[]) =>
      setPending((list) => list.filter((p) => !ids.includes(p.id)));

    // 1. Shrink in the browser; skip files that cannot be read.
    const prepared: { pending: Pending; image: PreparedImage }[] = [];
    for (const [i, file] of files.entries()) {
      try {
        prepared.push({ pending: batch[i], image: await prepareImage(file) });
      } catch (error) {
        fail(
          batch[i].id,
          error instanceof ImageProblem ? error.message : 'Could not read it.',
        );
      }
    }
    if (prepared.length === 0) return;
    const ids = prepared.map((p) => p.pending.id);

    try {
      // 2. Signed URLs, 3. upload straight to storage, 4. record them.
      const ready = await prepareProductImageUploads({
        productId,
        files: prepared.map((p) => ({
          type: p.image.type,
          size: p.image.blob.size,
        })),
      });
      if (!ready.ok) {
        for (const id of ids) fail(id, ready.error);
        return;
      }
      await Promise.all(
        ready.uploads.map(async (target, i) => {
          const response = await fetch(target.uploadUrl, {
            method: 'PUT',
            body: prepared[i].image.blob,
            headers: { 'Content-Type': target.contentType },
          });
          if (!response.ok)
            throw new Error(`Upload failed: ${response.status}`);
        }),
      );
      const saved = await addProductImages({
        productId,
        images: ready.uploads.map((target, i) => ({
          key: target.key,
          width: prepared[i].image.width,
          height: prepared[i].image.height,
        })),
      });
      if (!saved.ok) {
        for (const id of ids) fail(id, saved.error ?? FAILED);
        return;
      }
      done(ids);
      toast.success(
        prepared.length === 1
          ? 'Photo added'
          : `${prepared.length} photos added`,
      );
    } catch {
      for (const id of ids) fail(id, 'Upload failed. Check your connection.');
    }
  };

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragOver(false);
    if (!uploadsEnabled || busy) return;
    void upload(
      [...event.dataTransfer.files].filter((f) => f.type.startsWith('image/')),
    );
  };

  // Reordering.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const labelOf = (id: UniqueIdentifier) =>
    `Photo ${items.findIndex((i) => i.id === id) + 1}`;
  const positionOf = (id: UniqueIdentifier | undefined) =>
    `position ${items.findIndex((i) => i.id === id) + 1} of ${items.length}`;
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
    const next = arrayMove(
      items,
      items.findIndex((i) => i.id === active.id),
      items.findIndex((i) => i.id === over.id),
    );
    setItems(next);
    startTransition(async () => {
      try {
        const result = await reorderProductImages({
          productId,
          ids: next.map((i) => i.id),
        });
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

  const setColour = (image: DashboardImage, colour: string | null) => {
    const before = items;
    setItems(items.map((i) => (i.id === image.id ? { ...i, colour } : i)));
    startTransition(async () => {
      try {
        const result = await setProductImageColour({ id: image.id, colour });
        if (result.ok) {
          toast.success('Photo colour saved');
          return;
        }
        setItems(before);
        toast.error(result.error ?? FAILED);
      } catch {
        setItems(before);
        toast.error(FAILED);
      }
    });
  };

  return (
    <div className="grid gap-4">
      {colours.length > 1 && items.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Choose the colour each photo shows. Shoppers who pick a colour see its
          photos first.
        </p>
      )}
      {items.length > 0 && (
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          accessibility={{
            announcements,
            screenReaderInstructions: {
              draggable:
                'To move a photo, press Space, use the arrow keys, then press Space again.',
            },
          }}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={items.map((i) => i.id)}
            strategy={rectSortingStrategy}
          >
            <ul
              className="grid grid-cols-3 gap-3 sm:grid-cols-4"
              aria-label="Photos"
            >
              {items.map((image, i) => (
                <PhotoTile
                  key={image.id}
                  image={image}
                  index={i}
                  productName={productName}
                  colours={colours}
                  onColour={(colour) => setColour(image, colour)}
                  onEdit={() => setEditing({ open: true, image })}
                  onDelete={() => setRemoving({ open: true, image })}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {pending.length > 0 && (
        <ul className="grid gap-1 text-sm" aria-live="polite">
          {pending.map((p) => (
            <li
              key={p.id}
              className={cn(p.problem && 'text-destructive')}
              data-testid="pending-photo"
            >
              {p.name}: {p.problem ?? 'Uploading…'}
            </li>
          ))}
        </ul>
      )}

      {uploadsEnabled ? (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed px-4 py-6 text-center text-sm transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
            dragOver ? 'border-primary bg-muted' : 'hover:bg-muted/50',
            (room <= 0 || busy) && 'pointer-events-none opacity-50',
          )}
        >
          <ImagePlus aria-hidden className="size-5 text-muted-foreground" />
          <span className="font-medium">
            {busy ? 'Uploading…' : 'Add photos'}
          </span>
          <span className="text-muted-foreground">
            Click or drop JPEG, PNG or WebP. Up to {MAX_IMAGES_PER_PRODUCT}{' '}
            photos; they are resized for you.
          </span>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            aria-label="Add photos"
            disabled={room <= 0 || busy}
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = '';
              void upload(files);
            }}
          />
        </label>
      ) : (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          Photo uploads are not set up for this site yet.
        </p>
      )}

      <AltDialog
        open={editing.open}
        image={editing.image}
        onOpenChange={(open) => setEditing((s) => ({ ...s, open }))}
      />
      <DeletePhotoDialog
        open={removing.open}
        image={removing.image}
        position={
          removing.image
            ? items.findIndex((i) => i.id === removing.image?.id) + 1
            : 0
        }
        onOpenChange={(open) => setRemoving((s) => ({ ...s, open }))}
      />
    </div>
  );
}

function PhotoTile({
  image,
  index,
  productName,
  colours,
  onColour,
  onEdit,
  onDelete,
}: {
  image: DashboardImage;
  index: number;
  productName: string;
  colours: string[];
  onColour: (colour: string | null) => void;
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
  } = useSortable({ id: image.id });
  const label = `photo ${index + 1}`;
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('grid content-start gap-1.5', isDragging && 'z-10')}
      data-testid="photo-tile"
    >
      <div
        className={cn(
          'group relative aspect-[3/4] overflow-hidden rounded-lg border bg-muted',
          isDragging && 'shadow-lg',
        )}
      >
        <StoreImage
          image={image}
          sizes="(min-width: 640px) 180px, 30vw"
          fill
          alt={image.alt || `${productName}, ${label}`}
        />
        {index === 0 && <Badge className="absolute top-2 left-2">Cover</Badge>}
        <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/60 to-transparent p-1.5">
          <button
            ref={setActivatorNodeRef}
            type="button"
            className="cursor-grab touch-none rounded-md bg-background/90 p-1.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
            aria-label={`Move ${label}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical aria-hidden className="size-4" />
          </button>
          <span className="flex gap-1">
            <button
              type="button"
              className="rounded-md bg-background/90 p-1.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-label={`Describe ${label}`}
              onClick={onEdit}
            >
              <Pencil aria-hidden className="size-4" />
            </button>
            <button
              type="button"
              className="rounded-md bg-background/90 p-1.5 text-destructive outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-label={`Delete ${label}`}
              onClick={onDelete}
            >
              <Trash2 aria-hidden className="size-4" />
            </button>
          </span>
        </div>
      </div>
      {colours.length > 1 && (
        <select
          value={image.colour ?? ''}
          onChange={(e) => onColour(e.target.value || null)}
          aria-label={`Colour of ${label}`}
          className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">All colours</option>
          {colours.map((colour) => (
            <option key={colour} value={colour}>
              {colour}
            </option>
          ))}
        </select>
      )}
    </li>
  );
}

function AltDialog({
  open,
  image,
  onOpenChange,
}: {
  open: boolean;
  image: DashboardImage | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Describe this photo</DialogTitle>
          <DialogDescription>
            Read out by screen readers and used by search engines, e.g. “Ruby
            Kanjivaram saree, pallu with peacock motifs”.
          </DialogDescription>
        </DialogHeader>
        {image && (
          <AltForm
            key={image.id}
            image={image}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AltForm({
  image,
  onDone,
}: {
  image: DashboardImage;
  onDone: () => void;
}) {
  const [alt, setAlt] = useState(image.alt);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const save = () =>
    startTransition(async () => {
      try {
        const result = await setProductImageAlt({ id: image.id, alt });
        if (!result.ok) {
          if (result.fieldErrors?.alt) setError(result.fieldErrors.alt);
          else toast.error(result.error ?? FAILED);
          return;
        }
        toast.success('Description saved');
        onDone();
      } catch {
        toast.error(FAILED);
      }
    });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="grid gap-2"
    >
      <Textarea
        value={alt}
        onChange={(e) => {
          setAlt(e.target.value);
          setError('');
        }}
        rows={3}
        aria-label="Photo description"
        aria-invalid={Boolean(error)}
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <DialogFooter className="mt-4">
        <DialogClose render={<Button type="button" variant="outline" />}>
          Cancel
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
      </DialogFooter>
    </form>
  );
}

function DeletePhotoDialog({
  open,
  image,
  position,
  onOpenChange,
}: {
  open: boolean;
  image: DashboardImage | null;
  position: number;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const confirm = () => {
    if (!image) return;
    startTransition(async () => {
      try {
        const result = await deleteProductImage(image.id);
        if (!result.ok) {
          toast.error(result.error ?? FAILED);
          return;
        }
        toast.success('Photo deleted');
        onOpenChange(false);
      } catch {
        toast.error(FAILED);
      }
    });
  };
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete photo {position}?</AlertDialogTitle>
          <AlertDialogDescription>
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
