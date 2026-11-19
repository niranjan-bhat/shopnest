'use client';

import Link from 'next/link';
import Form from 'next/form';
import { useRef, useState, type ReactNode } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import {
  SORT_OPTIONS,
  type CatalogFacets,
  type CatalogFilters,
  type FacetValue,
} from '@/features/catalog/filter';
import { cn } from '@/lib/utils';

const FORM_ID = 'catalog-filters';

function FacetGroup({
  legend,
  name,
  values,
  selected,
}: {
  legend: string;
  name: string;
  values: FacetValue[];
  selected: string[];
}) {
  if (values.length === 0) return null;
  return (
    <fieldset className="border-b border-store-border py-5">
      <legend className="float-left mb-3 w-full text-xs tracking-[0.18em] uppercase">
        {legend}
      </legend>
      <ul className="clear-both space-y-2.5">
        {values.map((facet) => (
          <li key={facet.value}>
            <label className="flex cursor-pointer items-center gap-3 text-sm">
              <input
                type="checkbox"
                name={name}
                value={facet.value}
                defaultChecked={selected.includes(facet.value)}
                className="size-4 accent-store-primary"
              />
              <span className="flex-1">{facet.label}</span>
              <span className="text-store-muted tabular-nums">
                {facet.count}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

/**
 * Filters, sort and result count around a server-rendered product grid.
 * Everything is one GET form, so filtered pages are shareable URLs and work
 * without JavaScript; with JavaScript it submits on every change.
 */
export function CatalogBrowser({
  facets,
  filters,
  activeFilters,
  resultCount,
  clearHref,
  children,
}: {
  facets: CatalogFacets;
  filters: CatalogFilters;
  activeFilters: number;
  resultCount: number;
  clearHref: string;
  children: ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const submit = () => formRef.current?.requestSubmit();

  return (
    <div className="lg:grid lg:grid-cols-[230px_1fr] lg:gap-12">
      <aside
        aria-label="Filters"
        className={cn(
          'lg:sticky lg:top-36 lg:block lg:h-fit',
          panelOpen
            ? 'fixed inset-0 z-50 overflow-y-auto bg-store-bg px-6 pb-28'
            : 'max-lg:hidden',
        )}
      >
        <div className="flex items-center justify-between py-5 lg:hidden">
          <h2 className="font-store-heading text-2xl">Filters</h2>
          <button
            type="button"
            onClick={() => setPanelOpen(false)}
            className="-mr-2 grid size-10 place-items-center rounded-full hover:bg-store-subtle"
            aria-label="Close filters"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <Form
          // Remount when the URL's filters change so checkboxes match it.
          key={JSON.stringify(filters)}
          ref={formRef}
          id={FORM_ID}
          action=""
          replace
          scroll={false}
          onChange={submit}
          className="border-t border-store-border lg:border-t-0"
        >
          <FacetGroup
            legend="Price"
            name="price"
            values={facets.price}
            selected={filters.price}
          />
          <FacetGroup
            legend="Colour"
            name="colour"
            values={facets.colour}
            selected={filters.colour}
          />
          <FacetGroup
            legend="Fabric"
            name="fabric"
            values={facets.fabric}
            selected={filters.fabric}
          />
          <FacetGroup
            legend="Size"
            name="size"
            values={facets.size}
            selected={filters.size}
          />
          <fieldset className="border-b border-store-border py-5">
            <legend className="sr-only">Availability</legend>
            <label className="flex cursor-pointer items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="inStock"
                value="1"
                defaultChecked={filters.inStock}
                className="size-4 accent-store-primary"
              />
              In stock only
            </label>
          </fieldset>
          <noscript>
            <button type="submit" className="mt-4 text-sm underline">
              Apply filters
            </button>
          </noscript>
        </Form>
        {activeFilters > 0 && (
          <Link
            href={clearHref}
            replace
            scroll={false}
            className="mt-4 inline-block text-sm text-store-muted underline underline-offset-4 hover:text-store-text"
          >
            Clear all filters
          </Link>
        )}
        <div className="fixed inset-x-0 bottom-0 border-t border-store-border bg-store-bg p-4 lg:hidden">
          <button
            type="button"
            onClick={() => setPanelOpen(false)}
            className="w-full rounded-store bg-store-primary py-3.5 text-sm font-medium tracking-wide text-store-on-primary uppercase"
          >
            Show {resultCount} {resultCount === 1 ? 'result' : 'results'}
          </button>
        </div>
      </aside>

      <div>
        <div className="mb-8 flex items-center justify-between gap-4 border-y border-store-border py-3 lg:border-t-0 lg:pt-0">
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="flex items-center gap-2 text-sm lg:hidden"
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            Filters{activeFilters > 0 && ` (${activeFilters})`}
          </button>
          <p
            className="hidden text-sm text-store-muted lg:block"
            aria-live="polite"
          >
            {resultCount} {resultCount === 1 ? 'product' : 'products'}
          </p>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-store-muted max-sm:sr-only">Sort by</span>
            <select
              key={filters.sort}
              form={FORM_ID}
              name="sort"
              defaultValue={filters.sort}
              // Outside the <Form> in the DOM, but submitted with it via the
              // `form` attribute; its change event does not reach the form.
              onChange={submit}
              className="bg-transparent py-1.5 pr-1 font-medium outline-none"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {children}
      </div>
    </div>
  );
}
