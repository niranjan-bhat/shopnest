import type { ComponentType, ReactNode } from 'react';
import type { CategorySummary } from '@/features/catalog/types';
import type {
  CategoryPageData,
  ProductPageData,
} from '@/features/storefront/pages';
import type { ResolvedSection } from '@/features/storefront/home';
import type { StoreContact } from '@/features/tenants/settings';
import type { Branding, SectionType } from '@/features/theme/schema';

/**
 * Everything a template knows about the store it is rendering. Templates get
 * data only through these props; they never query the database.
 */
export type StoreContext = {
  id: string;
  slug: string;
  name: string;
  whatsappNumber: string;
  /** Address, phone, email and hours, where the merchant gave them. */
  contact: StoreContact;
  branding: Branding;
  announcement: string | null;
  /**
   * Prefix for store links. "/sites/<slug>" in Phase 1; "" once proxy.ts
   * serves stores on their own hostnames (Phase 2).
   */
  basePath: string;
  /** For navigation menus. */
  categories: CategorySummary[];
};

export type StoreLayoutProps = { store: StoreContext; children: ReactNode };
export type HomePageProps = {
  store: StoreContext;
  sections: ResolvedSection[];
};
export type CategoryPageProps = { store: StoreContext } & CategoryPageData;
export type ProductPageProps = { store: StoreContext } & ProductPageData;
export type StorePageProps = { store: StoreContext };

export type TemplateDefinition = {
  key: string;
  name: string;
  description: string;
  /** Section types this template can render; others are skipped. */
  sections: readonly SectionType[];
  Layout: ComponentType<StoreLayoutProps>;
  HomePage: ComponentType<HomePageProps>;
  CategoryPage: ComponentType<CategoryPageProps>;
  ProductPage: ComponentType<ProductPageProps>;
  CartPage: ComponentType<StorePageProps>;
  CheckoutPage: ComponentType<StorePageProps>;
  /** How to reach the store: address, hours, WhatsApp, phone, email. */
  ContactPage: ComponentType<StorePageProps>;
};
