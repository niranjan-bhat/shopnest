import {
  listBanners,
  listCatalogItems,
  listCategories,
} from '@/features/catalog/queries';
import { sortCatalog } from '@/features/catalog/filter';
import type {
  Banner,
  CategorySummary,
  ProductCardData,
} from '@/features/catalog/types';
import type { Section, SectionOf, SectionType } from '@/features/theme/schema';

/** A home-page section together with the data it renders. */
export type ResolvedSection =
  | (SectionOf<'hero'> & { banners: Banner[] })
  | (SectionOf<'categoryTiles'> & { categories: CategorySummary[] })
  | (SectionOf<'featuredProducts'> & { products: ProductCardData[] })
  | (SectionOf<'promoBanner'> & { banner: Banner | null })
  | SectionOf<'brandStory'>;

/**
 * Loads the data for each configured section. Sections the template does not
 * support, or that have nothing to show, are left out.
 */
export async function resolveHomeSections(
  tenantId: string,
  sections: Section[],
  supported: readonly SectionType[],
): Promise<ResolvedSection[]> {
  const [banners, categories, catalog] = await Promise.all([
    listBanners(tenantId),
    listCategories(tenantId),
    listCatalogItems(tenantId),
  ]);
  const bannerById = new Map(banners.map((b) => [b.id, b]));

  const resolved = sections
    .filter((section) => supported.includes(section.type))
    .map((section): ResolvedSection | null => {
      switch (section.type) {
        case 'hero': {
          const ids = section.props.bannerIds;
          const chosen = ids
            ? ids
                .map((id) => bannerById.get(id))
                .filter((b): b is Banner => !!b)
            : banners;
          return chosen.length ? { ...section, banners: chosen } : null;
        }
        case 'categoryTiles':
          return categories.length
            ? {
                ...section,
                categories: categories.slice(0, section.props.limit),
              }
            : null;
        case 'featuredProducts': {
          const pool =
            section.props.source === 'featured'
              ? catalog.filter((item) => item.isFeatured)
              : catalog;
          const products = sortCatalog(
            pool,
            section.props.source === 'newest' ? 'newest' : 'featured',
          ).slice(0, section.props.limit);
          return products.length ? { ...section, products } : null;
        }
        case 'promoBanner':
          return {
            ...section,
            banner: bannerById.get(section.props.bannerId) ?? null,
          };
        case 'brandStory':
          return section;
      }
    });

  return resolved.filter((s): s is ResolvedSection => s !== null);
}
