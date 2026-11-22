import type { TemplateDefinition } from '../contract';
import { SilkContactPage } from './contact-page';
import { SilkContentPage } from './content-page';
import { SilkLayout } from './layout';
import {
  SilkCartPage,
  SilkCategoryPage,
  SilkCheckoutPage,
  SilkHomePage,
  SilkProductPage,
} from './pages';

/**
 * "Silk": an editorial template for sarees and ethnic wear. Serif headings,
 * full-bleed imagery, generous whitespace. Colours, fonts, corner radius and
 * section order all come from the store's theme config.
 */
export const silkTemplate: TemplateDefinition = {
  key: 'silk',
  name: 'Silk',
  description: 'Editorial layout for sarees, ethnic wear and boutiques.',
  sections: [
    'hero',
    'categoryTiles',
    'featuredProducts',
    'promoBanner',
    'brandStory',
  ],
  Layout: SilkLayout,
  HomePage: SilkHomePage,
  CategoryPage: SilkCategoryPage,
  ProductPage: SilkProductPage,
  CartPage: SilkCartPage,
  CheckoutPage: SilkCheckoutPage,
  ContactPage: SilkContactPage,
  ContentPage: SilkContentPage,
};
