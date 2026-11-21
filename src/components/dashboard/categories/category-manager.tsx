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
import { FolderTree, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { useId, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/dashboard/empty-state';
import { PageHeader } from '@/components/dashboard/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  reorderCategories,
  setCategoryActive,
} from '@/features/catalog/category-actions';
import type { DashboardCategory } from '@/features/catalog/dashboard';
import { CategoryFormDialog } from './category-form-dialog';
import { DeleteCategoryDialog } from './delete-category-dialog';

const FAILED = 'Something went wrong. Please try again.';

/** The categories page: list, reorder, show/hide, add, edit and delete. */
export function CategoryManager({
  categories,
}: {
  categories: DashboardCategory[];
}) {
  // A local copy so reordering and toggles show instantly. Whenever the
  // server sends a fresh list (after every save), it replaces the copy.
  const [items, setItems] = useState(categories);
  const [received, setReceived] = useState(categories);
  if (categories !== received) {
    setReceived(categories);
    setItems(categories);
  }

  const [form, setForm] = useState<{
    open: boolean;
    category?: DashboardCategory;
  }>({ open: false });
  const [removal, setRemoval] = useState<{
    open: boolean;
    category: DashboardCategory | null;
  }>({ open: false, category: null });
  const [, startTransition] = useTransition();

  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Screen-reader messages in words, not the library's internal ids.
  const nameOf = (id: UniqueIdentifier) =>
    items.find((c) => c.id === id)?.name ?? 'Category';
  const positionOf = (id: UniqueIdentifier | undefined) =>
    `position ${items.findIndex((c) => c.id === id) + 1} of ${items.length}`;
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Picked up ${nameOf(active.id)}. Use the arrow keys to move it, Space to drop it, Escape to cancel.`,
    onDragOver: ({ active, over }) =>
      over ? `${nameOf(active.id)} is at ${positionOf(over.id)}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${nameOf(active.id)} dropped at ${positionOf(over.id)}.`
        : `${nameOf(active.id)} dropped.`,
    onDragCancel: ({ active }) => `Moving ${nameOf(active.id)} was cancelled.`,
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const before = items;
    const next = arrayMove(
      items,
      items.findIndex((c) => c.id === active.id),
      items.findIndex((c) => c.id === over.id),
    );
    setItems(next);
    startTransition(async () => {
      try {
        const result = await reorderCategories(next.map((c) => c.id));
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

  const toggle = (category: DashboardCategory, isActive: boolean) => {
    const setActive = (value: boolean) =>
      setItems((list) =>
        list.map((c) => (c.id === category.id ? { ...c, isActive: value } : c)),
      );
    setActive(isActive);
    startTransition(async () => {
      try {
        const result = await setCategoryActive(category.id, isActive);
        if (!result.ok) {
          setActive(!isActive);
          toast.error(result.error ?? FAILED);
          return;
        }
        toast.success(
          isActive
            ? `${category.name} is shown in your store`
            : `${category.name} is hidden from your store`,
        );
      } catch {
        setActive(!isActive);
        toast.error(FAILED);
      }
    });
  };

  const addButton = (
    <Button onClick={() => setForm({ open: true })}>
      <Plus aria-hidden />
      Add category
    </Button>
  );

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Categories"
        description="How products are grouped in your store's menu."
        actions={items.length > 0 && addButton}
      />

      {items.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title="No categories yet"
          description="Create categories like Silk sarees or Kurta sets so shoppers can browse by type."
          action={addButton}
          testId="no-categories"
        />
      ) : (
        <div className="grid gap-2">
          <p className="text-sm text-muted-foreground" id={`${dndId}-help`}>
            Drag <GripVertical aria-hidden className="inline size-4" /> to
            change the order shoppers see. With a keyboard, focus the handle,
            press Space, use the arrow keys, then press Space again.
          </p>
          <DndContext
            id={dndId}
            sensors={sensors}
            collisionDetection={closestCenter}
            accessibility={{
              announcements,
              screenReaderInstructions: {
                draggable:
                  'To move a category, press Space, use the arrow keys, then press Space again. Press Escape to cancel.',
              },
            }}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={items.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul
                className="divide-y overflow-hidden rounded-xl border"
                aria-label="Categories"
              >
                {items.map((category) => (
                  <CategoryRow
                    key={category.id}
                    category={category}
                    onToggle={toggle}
                    onEdit={() => setForm({ open: true, category })}
                    onDelete={() => setRemoval({ open: true, category })}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
      )}

      <CategoryFormDialog
        open={form.open}
        category={form.category}
        onOpenChange={(open) => setForm((state) => ({ ...state, open }))}
      />
      <DeleteCategoryDialog
        open={removal.open}
        category={removal.category}
        onOpenChange={(open) => setRemoval((state) => ({ ...state, open }))}
      />
    </div>
  );
}

function CategoryRow({
  category,
  onToggle,
  onEdit,
  onDelete,
}: {
  category: DashboardCategory;
  onToggle: (category: DashboardCategory, isActive: boolean) => void;
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
  } = useSortable({ id: category.id });
  const count = category.productCount;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-2 bg-card py-3 pr-2 pl-1 sm:gap-3 sm:pr-3',
        isDragging && 'relative z-10 shadow-lg',
      )}
      data-testid="category-row"
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="cursor-grab touch-none rounded-md p-2 text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
        aria-label={`Move ${category.name}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden className="size-4" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-medium">
          <span className="truncate">{category.name}</span>
          {category.isActive ? (
            category.showInMenu && <Badge variant="secondary">In menu</Badge>
          ) : (
            <Badge variant="outline">Hidden</Badge>
          )}
        </p>
        <p className="truncate text-sm text-muted-foreground">
          <span className="font-mono">/c/{category.slug}</span> · {count}{' '}
          {count === 1 ? 'product' : 'products'}
        </p>
      </div>
      <Switch
        checked={category.isActive}
        onCheckedChange={(checked) => onToggle(category, checked)}
        aria-label={`Show ${category.name} in store`}
      />
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onEdit}
        aria-label={`Edit ${category.name}`}
      >
        <Pencil aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onDelete}
        aria-label={`Delete ${category.name}`}
      >
        <Trash2 aria-hidden />
      </Button>
    </li>
  );
}
