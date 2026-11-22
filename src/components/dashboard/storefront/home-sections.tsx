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
import { cn } from 'cn';
import { ChevronDown, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { useId, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { DashboardBanner } from '@/features/theme/banner-queries';
import type { Section, SectionType } from '@/features/theme/schema';
import { saveHomeSections } from '@/features/theme/section-actions';
import {
  MAX_SECTIONS,
  newSection,
  SECTION_INFO,
} from '@/features/theme/sections';
import { bannerName, SectionForm } from './section-form';

const FAILED = 'Something went wrong. Please try again.';

type Item = { key: string; section: Section };

const withKeys = (sections: Section[]): Item[] =>
  sections.map((section) => ({ key: crypto.randomUUID(), section }));

/** "Product grid: New arrivals", for lists and screen readers. */
function sectionName(section: Section): string {
  const label = SECTION_INFO[section.type].label;
  switch (section.type) {
    case 'categoryTiles':
    case 'featuredProducts':
      return `${label}: ${section.props.title}`;
    case 'promoBanner':
    case 'brandStory':
      return section.props.heading
        ? `${label}: ${section.props.heading}`
        : label;
    case 'hero':
      return label;
  }
}

/** One line under the name; a warning when shoppers would not see it. */
function sectionDetails(
  section: Section,
  banners: DashboardBanner[],
): { summary: string; warning?: string } {
  switch (section.type) {
    case 'hero': {
      const ids = section.props.bannerIds;
      const shown = ids ? banners.filter((b) => ids.includes(b.id)) : banners;
      const live = shown.filter((b) => b.status === 'live').length;
      return {
        summary: ids
          ? `${shown.length} chosen banner${shown.length === 1 ? '' : 's'}`
          : 'All live banners',
        warning:
          ids && shown.length === 0
            ? 'Its banners were deleted, so it is hidden. Choose others.'
            : live === 0
              ? 'Hidden until one of its banners is live.'
              : undefined,
      };
    }
    case 'categoryTiles':
      return { summary: `Up to ${section.props.limit} categories` };
    case 'featuredProducts':
      return {
        summary: `Up to ${section.props.limit} ${section.props.source === 'featured' ? 'featured' : 'newest'} products`,
      };
    case 'promoBanner': {
      const i = banners.findIndex((b) => b.id === section.props.bannerId);
      const banner = banners[i];
      return {
        summary: banner ? `Banner: ${bannerName(banner, i)}` : 'No banner',
        warning: !banner
          ? 'Its banner was deleted, so it shows without a photo. Choose another.'
          : banner.status === 'live'
            ? undefined
            : 'Its banner is not live, so it shows without a photo.',
      };
    }
    case 'brandStory':
      return {
        summary:
          section.props.body.length > 80
            ? `${section.props.body.slice(0, 80)}…`
            : section.props.body,
      };
  }
}

type Editing =
  | { mode: 'add'; section: Section }
  | { mode: 'edit'; index: number; section: Section };

/**
 * The home page's sections, in order: add, edit, reorder, remove. Every
 * change saves to the draft; shoppers see it after publishing.
 */
export function HomeSections({
  sections,
  banners,
  allowed,
}: {
  sections: Section[];
  banners: DashboardBanner[];
  allowed: SectionType[];
}) {
  // A local copy so changes show at once; replaced by every fresh list.
  const [items, setItems] = useState(() => withKeys(sections));
  const [received, setReceived] = useState(sections);
  if (sections !== received) {
    setReceived(sections);
    setItems(withKeys(sections));
  }
  const [editing, setEditing] = useState<Editing | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [, startTransition] = useTransition();
  const dndId = useId();
  const full = items.length >= MAX_SECTIONS;

  const save = async (next: Item[]): Promise<boolean> => {
    try {
      const result = await saveHomeSections(next.map((i) => i.section));
      if (!result.ok) {
        toast.error(result.error ?? FAILED);
        return false;
      }
      return true;
    } catch {
      toast.error(FAILED);
      return false;
    }
  };

  /** Shows the change at once and undoes it if saving fails. */
  const saveOptimistic = (next: Item[], done?: string) => {
    const before = items;
    setItems(next);
    startTransition(async () => {
      if (await save(next)) {
        if (done) toast.success(done);
      } else {
        setItems(before);
      }
    });
  };

  const openEditor = (state: Editing) => {
    setEditing(state);
    setDialogOpen(true);
  };

  const onSave = async (section: Section) => {
    if (!editing) return false;
    const next =
      editing.mode === 'add'
        ? [...items, { key: crypto.randomUUID(), section }]
        : items.map((item, i) =>
            i === editing.index ? { ...item, section } : item,
          );
    if (!(await save(next))) return false;
    setItems(next);
    setDialogOpen(false);
    toast.success(
      editing.mode === 'add'
        ? 'Section added to the draft'
        : 'Section saved to the draft',
    );
    return true;
  };

  // Reordering.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const indexOf = (key: UniqueIdentifier | undefined) =>
    items.findIndex((i) => i.key === key);
  const labelOf = (key: UniqueIdentifier) => {
    const item = items[indexOf(key)];
    return item ? sectionName(item.section) : 'Section';
  };
  const positionOf = (key: UniqueIdentifier | undefined) =>
    `position ${indexOf(key) + 1} of ${items.length}`;
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
    saveOptimistic(arrayMove(items, indexOf(active.id), indexOf(over.id)));
  };

  const firstBanner = banners[0]?.id ?? null;
  const title =
    editing?.mode === 'edit'
      ? `Edit ${SECTION_INFO[editing.section.type].label.toLowerCase()}`
      : editing
        ? `Add ${SECTION_INFO[editing.section.type].label.toLowerCase()}`
        : '';

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <CardTitle>Home page</CardTitle>
          <p className="max-w-prose text-sm text-muted-foreground">
            The sections of your home page, top to bottom. Changes go to the
            draft: preview them, then publish.
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button type="button" disabled={full} />}
          >
            <Plus aria-hidden />
            Add section
            <ChevronDown aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            {allowed.map((type) => {
              const needsBanner = type === 'promoBanner' && !firstBanner;
              return (
                <DropdownMenuItem
                  key={type}
                  disabled={needsBanner}
                  onClick={() =>
                    openEditor({
                      mode: 'add',
                      section: newSection(type, firstBanner),
                    })
                  }
                >
                  <span className="grid">
                    <span className="font-medium">
                      {SECTION_INFO[type].label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {needsBanner
                        ? 'Add a banner first.'
                        : SECTION_INFO[type].description}
                    </span>
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="grid gap-3">
        {full && (
          <p className="text-sm text-muted-foreground">
            A home page can have up to {MAX_SECTIONS} sections.
          </p>
        )}
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            No sections yet: your home page is empty. Add a hero and a product
            grid to start.
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
                  'To move a section, press Space, use the arrow keys, then press Space again.',
              },
            }}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={items.map((i) => i.key)}
              strategy={verticalListSortingStrategy}
            >
              <ol className="grid gap-2" aria-label="Home page sections">
                {items.map((item, index) => (
                  <SectionRow
                    key={item.key}
                    id={item.key}
                    name={sectionName(item.section)}
                    {...sectionDetails(item.section, banners)}
                    allowed={allowed.includes(item.section.type)}
                    onEdit={() =>
                      openEditor({ mode: 'edit', index, section: item.section })
                    }
                    onRemove={() =>
                      saveOptimistic(
                        items.filter((i) => i.key !== item.key),
                        'Section removed from the draft',
                      )
                    }
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {editing && (
              <DialogDescription>
                {SECTION_INFO[editing.section.type].description}
              </DialogDescription>
            )}
          </DialogHeader>
          {editing && (
            <SectionForm
              key={editing.mode === 'edit' ? editing.index : 'new'}
              section={editing.section}
              banners={banners}
              submitLabel={editing.mode === 'add' ? 'Add section' : 'Save'}
              onSave={onSave}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function SectionRow({
  id,
  name,
  summary,
  warning,
  allowed,
  onEdit,
  onRemove,
}: {
  id: string;
  name: string;
  summary: string;
  warning?: string;
  allowed: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-card p-2',
        isDragging && 'relative z-10 shadow-lg',
      )}
      data-testid="section-row"
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
      <div className="grid min-w-0 flex-1 gap-0.5">
        <span className="truncate font-medium">{name}</span>
        <span className="truncate text-sm text-muted-foreground">
          {summary}
        </span>
        {!allowed && (
          <span className="text-xs text-destructive">
            Not available for this store; it is not shown.
          </span>
        )}
        {allowed && warning && (
          <span className="text-xs text-amber-700 dark:text-amber-400">
            {warning}
          </span>
        )}
      </div>
      <span className="flex shrink-0 gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Edit ${name}`}
          onClick={onEdit}
          disabled={!allowed}
        >
          <Pencil aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-destructive"
          aria-label={`Remove ${name}`}
          onClick={onRemove}
        >
          <Trash2 aria-hidden />
        </Button>
      </span>
    </li>
  );
}
