'use client';

import { useSearchParams } from 'next/navigation';
import {
  createContext,
  Suspense,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { imagesForColour, matchColour } from '@/features/catalog/colours';
import type { MediaImage, ProductDetail } from '@/features/catalog/types';
import {
  initialSelection,
  optionValues,
  type OptionSelection,
} from '@/features/catalog/variants';

type ProductSelection = {
  selection: OptionSelection;
  select: (name: string, value: string) => void;
  /** Photos of the chosen colour. */
  images: MediaImage[];
};

const Context = createContext<ProductSelection | null>(null);

/** What the shopper has chosen, shared by the gallery and the buy panel. */
export function ProductSelectionProvider({
  product,
  children,
}: {
  product: ProductDetail;
  children: ReactNode;
}) {
  const [selection, setSelection] = useState<OptionSelection>(() =>
    initialSelection(
      product.variants,
      product.optionNames,
      product.images[0]?.colour,
    ),
  );
  const select = (name: string, value: string) =>
    setSelection((current) => ({ ...current, [name]: value }));

  return (
    <Context
      value={{
        selection,
        select,
        images: imagesForColour(product.images, selection.colour),
      }}
    >
      {/* Reading the URL is left out of the prerendered page. */}
      <Suspense fallback={null}>
        <ColourFromUrl
          colours={optionValues(product.variants, 'colour')}
          onColour={(colour) => select('colour', colour)}
        />
      </Suspense>
      {children}
    </Context>
  );
}

export function useProductSelection(): ProductSelection {
  const value = useContext(Context);
  if (!value) throw new Error('Outside ProductSelectionProvider');
  return value;
}

/** Links from filtered lists open on a colour: ?colour=red. */
function ColourFromUrl({
  colours,
  onColour,
}: {
  colours: string[];
  onColour: (colour: string) => void;
}) {
  const colour = matchColour(colours, useSearchParams().get('colour'));
  useEffect(() => {
    if (colour) onColour(colour);
    // Only when the link's colour changes, not on every choice after it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colour]);
  return null;
}
