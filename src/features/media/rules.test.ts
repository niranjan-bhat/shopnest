import { describe, expect, it } from 'vitest';
import {
  brandingKey,
  fitWithin,
  isBrandingKey,
  isProductImageKey,
  MAX_IMAGE_BYTES,
  productImageKey,
  uploadRequestSchema,
} from './rules';

const tenant = '00000001-0000-4000-8000-000000000001';
const product = '00000001-0003-4000-8000-000000000001';
const image = '0b0f6a2e-4c1d-4e3a-9b7f-1a2b3c4d5e6f';

describe('fitWithin', () => {
  it('shrinks the longest side to the limit, keeping the shape', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 });
  });

  it('never enlarges small images', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

describe('product image keys', () => {
  it('builds keys under the store and product', () => {
    expect(productImageKey(tenant, product, image, 'image/webp')).toBe(
      `tenants/${tenant}/products/${product}/${image}.webp`,
    );
  });

  it('accepts only this product’s keys', () => {
    const key = productImageKey(tenant, product, image, 'image/jpeg');
    expect(isProductImageKey(key, tenant, product)).toBe(true);
    const otherProduct = '00000001-0003-4000-8000-000000000002';
    expect(isProductImageKey(key, tenant, otherProduct)).toBe(false);
    for (const bad of [
      `tenants/${tenant}/products/${product}/../x.webp`,
      `tenants/${tenant}/products/${product}/${image}.png`,
      `tenants/${tenant}/products/${product}/1.webp`,
      `https://evil.example/tenants/${tenant}/products/${product}/${image}.webp`,
    ]) {
      expect(isProductImageKey(bad, tenant, product)).toBe(false);
    }
  });
});

describe('uploadRequestSchema', () => {
  it('limits types and sizes', () => {
    const request = (type: string, size: number) =>
      uploadRequestSchema.safeParse({
        productId: product,
        files: [{ type, size }],
      }).success;
    expect(request('image/webp', 300_000)).toBe(true);
    expect(request('image/png', 300_000)).toBe(false);
    expect(request('image/webp', MAX_IMAGE_BYTES + 1)).toBe(false);
  });
});

describe('branding keys', () => {
  it('builds and recognises logo, favicon and banner keys', () => {
    const logo = brandingKey(tenant, 'logo', image, 'image/png');
    expect(logo).toBe(`tenants/${tenant}/branding/logo-${image}.png`);
    expect(isBrandingKey(logo, tenant, 'logo')).toBe(true);
    expect(isBrandingKey(logo, tenant, 'favicon')).toBe(false);

    const banner = brandingKey(tenant, 'banner', image, 'image/jpeg');
    expect(banner).toBe(`tenants/${tenant}/banners/${image}.jpg`);
    expect(isBrandingKey(banner, tenant, 'banner')).toBe(true);

    const otherStore = '00000002-0000-4000-8000-000000000001';
    expect(isBrandingKey(logo, otherStore, 'logo')).toBe(false);
    expect(
      isBrandingKey(`tenants/${tenant}/branding/logo-1.png`, tenant, 'logo'),
    ).toBe(false);
  });
});
