import type { CSSProperties, ReactNode } from 'react';
import { storeFonts } from '@/features/theme/fonts';
import type { ThemeConfig } from '@/features/theme/schema';
import { tokensToCssVars } from '@/features/theme/tokens';
import { cn } from '@/lib/utils';
import type { StoreContext, TemplateDefinition } from '@/templates/contract';
import { CartDrawer } from './cart-drawer';
import { CartHydrator } from './cart-hydrator';
import { StoreProvider } from './store-provider';

/**
 * Root of every storefront page: turns the theme into CSS variables and font
 * classes, provides the store to client components, and renders the
 * template's layout around the page.
 */
export function StoreRoot({
  store,
  theme,
  template,
  children,
}: {
  store: StoreContext;
  theme: ThemeConfig;
  template: TemplateDefinition;
  children: ReactNode;
}) {
  const fonts = storeFonts(theme.tokens.fonts);
  const style = {
    ...tokensToCssVars(theme.tokens),
    ...fonts.style,
  } as CSSProperties;
  const { Layout } = template;

  return (
    <div
      className={cn(
        fonts.className,
        'flex min-h-dvh flex-col bg-store-bg font-store-body text-store-text antialiased',
      )}
      style={style}
      data-template={template.key}
    >
      <StoreProvider
        store={{
          id: store.id,
          name: store.name,
          whatsappNumber: store.whatsappNumber,
          basePath: store.basePath,
        }}
      >
        <CartHydrator />
        <Layout store={store}>{children}</Layout>
        <CartDrawer />
      </StoreProvider>
    </div>
  );
}
