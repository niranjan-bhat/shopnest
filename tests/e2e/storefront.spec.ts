import { expect, test, type Page } from '@playwright/test';
import { randomMobile } from './helpers';
import { store } from './urls';

/** Stops WhatsApp navigation and returns the pre-filled message text. */
async function captureWhatsApp(page: Page): Promise<() => Promise<string>> {
  await page.route('https://wa.me/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/plain', body: 'whatsapp' }),
  );
  return async () => {
    await page.waitForURL(/^https:\/\/wa\.me\//);
    const url = new URL(page.url());
    return url.searchParams.get('text') ?? '';
  };
}

/**
 * Opens a store page and waits until it has hydrated (CartHydrator marks
 * <html data-hydrated>): a click before that does nothing, which made these
 * tests flaky when the machine was busy.
 */
async function openStore(page: Page, url: string) {
  await page.goto(url);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
}

async function fillCheckout(page: Page, phone = randomMobile()) {
  await page.getByLabel('Full name').fill('Asha Rao');
  await page.getByLabel('Mobile number').fill(phone);
  await page.getByLabel('Address', { exact: true }).fill('12 MG Road');
  await page.getByLabel('City').fill('Bengaluru');
  await page.getByLabel('PIN code').fill('560001');
  await page.getByLabel('State').selectOption('Karnataka');
  return phone;
}

test.describe('storefront', () => {
  test('saree store: add to bag and check out on WhatsApp', async ({
    page,
  }) => {
    const whatsappText = await captureWhatsApp(page);
    await openStore(
      page,
      store('saree-demo', '/p/ruby-temple-border-kanjivaram'),
    );
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Ruby Temple-Border Kanjivaram',
      }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Increase quantity' }).click();
    await page.getByRole('button', { name: 'Add to bag' }).click();

    const drawer = page.getByRole('dialog', { name: /Your bag/ });
    await expect(drawer).toBeVisible();
    await expect(page.getByTestId('cart-count')).toHaveText('2');
    await drawer.getByRole('link', { name: 'Checkout' }).click();

    await expect(page).toHaveURL(store('saree-demo', '/checkout'));
    await page.getByRole('button', { name: 'Place order on WhatsApp' }).click();
    await expect(page.getByText('Enter your name')).toBeVisible();

    const phone = await fillCheckout(page);
    await page.getByRole('button', { name: 'Place order on WhatsApp' }).click();

    const text = await whatsappText();
    expect(page.url()).toContain('https://wa.me/910000000001');
    expect(text).toContain('Hello Tara Weaves');
    // The order is saved first, so the message carries its number.
    expect(text).toMatch(/I'd like to place an order \(#\d+\):/);
    expect(text).toContain(
      '1. Ruby Temple-Border Kanjivaram × 2, ₹24,500 each',
    );
    expect(text).toContain('Total: ₹49,000');
    expect(text).toContain(`Phone: +91 ${phone}`);
    expect(text).toContain('12 MG Road, Bengaluru, Karnataka 560001');
  });

  test('boutique: size must be chosen and sold-out sizes are disabled', async ({
    page,
  }) => {
    const whatsappText = await captureWhatsApp(page);
    await openStore(page, store('boutique-demo', '/p/ikat-co-ord'));

    await page.getByRole('button', { name: 'Add to bag' }).click();
    await expect(page.getByText('Please choose a size.')).toBeVisible();

    await page.getByRole('button', { name: 'Rust', exact: true }).click();
    await expect(
      page.getByRole('button', { name: /XL \(sold out\)/ }),
    ).toBeDisabled();
    await page.getByRole('button', { name: 'M', exact: true }).click();
    await page.getByRole('button', { name: 'Add to bag' }).click();
    await expect(page.getByTestId('cart-count')).toHaveText('1');

    // The cart survives a reload (localStorage) and is per store.
    await openStore(page, store('boutique-demo', '/cart'));
    await expect(page.locator('main').getByTestId('cart-line')).toHaveCount(1);
    await expect(page.locator('main').getByTestId('cart-line')).toContainText(
      'Rust · M',
    );
    await openStore(page, store('saree-demo', '/cart'));
    await expect(
      page.locator('main').getByText('Your bag is empty.'),
    ).toBeVisible();

    await openStore(page, store('boutique-demo', '/checkout'));
    await fillCheckout(page);
    await page.getByRole('button', { name: 'Place order on WhatsApp' }).click();
    const text = await whatsappText();
    expect(text).toContain('Ikat Co-ord Set (Rust · M) × 1, ₹3,990 each');
    expect(text).toContain('Total: ₹3,990');
  });

  test('price-on-request items make the total provisional', async ({
    page,
  }) => {
    await openStore(page, store('saree-demo', '/p/bridal-peacock-kanjivaram'));
    await expect(page.getByText('Price on request').first()).toBeVisible();
    await page.getByRole('button', { name: 'Add to bag' }).click();
    await openStore(page, store('saree-demo', '/cart'));
    await expect(
      page.getByText(/Includes items priced on request/),
    ).toBeVisible();
  });

  test('category filters and sorting update the URL and results', async ({
    page,
  }) => {
    await openStore(page, store('saree-demo', '/c/soft-silk'));
    const cards = page.locator('main article');
    await expect(cards).toHaveCount(3);

    await page.goto(
      store('saree-demo', '/c/soft-silk?inStock=1&sort=price-asc'),
    );
    await expect(cards).toHaveCount(2);
    await expect(cards.first()).toContainText('Teal Zari-Butta Soft Silk');

    await openStore(page, store('saree-demo', '/c/soft-silk?price=10k-25k'));
    await expect(
      page.getByText('Nothing matches these filters.'),
    ).toBeVisible();
  });

  test('filter controls submit on change', async ({ page, isMobile }) => {
    await openStore(page, store('saree-demo', '/c/soft-silk'));
    if (isMobile) await page.getByRole('button', { name: /^Filters/ }).click();
    await page.getByLabel('In stock only').check();
    await expect(page).toHaveURL(/inStock=1/);
    await expect(page.locator('main article')).toHaveCount(2);
    if (isMobile)
      await page.getByRole('button', { name: /^Show 2 results/ }).click();

    await page.getByRole('combobox').selectOption('price-desc');
    await expect(page).toHaveURL(/sort=price-desc/);
    await expect(page).toHaveURL(/inStock=1/);
    await expect(page.locator('main article').first()).toContainText(
      'Lavender Soft Silk',
    );
  });

  test('two stores, one template, different themes', async ({ page }) => {
    const themeOf = async (path: string) => {
      await page.goto(path);
      return page.locator('[data-template]').evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          template: el.getAttribute('data-template'),
          primary: style.getPropertyValue('--store-primary').trim(),
          radius: style.getPropertyValue('--store-radius').trim(),
        };
      });
    };
    const saree = await themeOf(store('saree-demo'));
    const boutique = await themeOf(store('boutique-demo'));
    expect(saree.template).toBe('silk');
    expect(boutique.template).toBe('silk');
    expect(saree.primary).not.toBe(boutique.primary);
    expect(saree.radius).not.toBe(boutique.radius);
  });

  test('draft products and unknown pages are not shown', async ({ page }) => {
    await openStore(page, store('saree-demo', '/p/unreleased-paithani'));
    await expect(
      page.getByRole('heading', { name: "We couldn't find that page" }),
    ).toBeVisible();
    await page.goto(store('no-such-store'));
    await expect(
      page.getByRole('heading', { name: 'Page not found' }),
    ).toBeVisible();
  });
});
