import {
  activeFilterCount,
  catalogFacets,
  filterCatalog,
  parseCatalogFilters,
  sortCatalog,
  type CatalogFacets,
  type CatalogFilters,
} from '@/features/catalog/filter';
import {
  getCategoryBySlug,
  getProductBySlug,
  listCatalogItems,
} from '@/features/catalog/queries';
import type {
  CategorySummary,
  ProductCardData,
  ProductDetail,
} from '@/features/catalog/types';

export type CategoryPageData = {
  category: CategorySummary;
  products: ProductCardData[];
  /** Products in the category before filtering. */
  totalInCategory: number;
  facets: CatalogFacets;
  filters: CatalogFilters;
  activeFilters: number;
};

export async function loadCategoryPage(
  tenantId: string,
  slug: string,
  searchParams: Record<string, string | string[] | undefined>,
): Promise<CategoryPageData | null> {
  const [category, catalog] = await Promise.all([
    getCategoryBySlug(tenantId, slug),
    listCatalogItems(tenantId),
  ]);
  if (!category) return null;

  const inCategory = catalog.filter((item) =>
    item.categorySlugs.includes(slug),
  );
  const filters = parseCatalogFilters(searchParams);
  return {
    category,
    products: filterCatalog(inCategory, filters),
    totalInCategory: inCategory.length,
    facets: catalogFacets(inCategory),
    filters,
    activeFilters: activeFilterCount(filters),
  };
}

export type ProductPageData = {
  product: ProductDetail;
  related: ProductCardData[];
};

const RELATED_LIMIT = 4;

export async function loadProductPage(
  tenantId: string,
  slug: string,
): Promise<ProductPageData | null> {
  const [product, catalog] = await Promise.all([
    getProductBySlug(tenantId, slug),
    listCatalogItems(tenantId),
  ]);
  if (!product) return null;

  const categorySlugs = new Set(product.categories.map((c) => c.slug));
  const related = sortCatalog(
    catalog.filter(
      (item) =>
        item.id !== product.id &&
        item.categorySlugs.some((s) => categorySlugs.has(s)),
    ),
    'featured',
  ).slice(0, RELATED_LIMIT);

  return { product, related };
}

/** Category and product slugs to prerender for a store. */
export async function listStorePaths(tenantId: string): Promise<{
  categories: string[];
  products: string[];
}> {
  const catalog = await listCatalogItems(tenantId);
  return {
    categories: [...new Set(catalog.flatMap((item) => item.categorySlugs))],
    products: catalog.map((item) => item.slug),
  };
}
