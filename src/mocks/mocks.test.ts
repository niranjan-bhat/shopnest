import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mockDb } from './index';

const PUBLIC_MEDIA = join(process.cwd(), 'public', 'mock-media');

describe('mock data', () => {
  it('has two active stores with unique slugs and hostnames', () => {
    expect(mockDb.tenants).toHaveLength(2);
    expect(new Set(mockDb.tenants.map((t) => t.slug)).size).toBe(2);
    expect(new Set(mockDb.tenant_domains.map((d) => d.hostname)).size).toBe(2);
  });

  it('uses unique ids in every table', () => {
    for (const rows of [
      mockDb.categories,
      mockDb.products,
      mockDb.product_variants,
      mockDb.product_images,
      mockDb.banners,
    ]) {
      expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    }
  });

  it('keeps every child row in the same tenant as its parent', () => {
    const productTenant = new Map(
      mockDb.products.map((p) => [p.id, p.tenant_id]),
    );
    const categoryTenant = new Map(
      mockDb.categories.map((c) => [c.id, c.tenant_id]),
    );
    for (const row of [...mockDb.product_variants, ...mockDb.product_images]) {
      expect(row.tenant_id).toBe(productTenant.get(row.product_id));
    }
    for (const row of mockDb.product_categories) {
      expect(row.tenant_id).toBe(productTenant.get(row.product_id));
      expect(row.tenant_id).toBe(categoryTenant.get(row.category_id));
    }
  });

  it('gives every product at least one variant and integer paise prices', () => {
    for (const product of mockDb.products) {
      const variants = mockDb.product_variants.filter(
        (v) => v.product_id === product.id,
      );
      expect(variants.length).toBeGreaterThan(0);
      if (product.price_mode === 'fixed') {
        expect(Number.isSafeInteger(product.price_paise)).toBe(true);
      } else {
        expect(product.price_paise).toBeNull();
      }
    }
  });

  it('stores R2 keys, never URLs, and every key has a generated image', () => {
    const keys = [
      ...mockDb.product_images.map((i) => i.r2_key),
      ...mockDb.categories.map((c) => c.image_key).filter((k) => k !== null),
      ...mockDb.banners.map((b) => b.image_key),
    ];
    for (const key of keys) {
      expect(key).toMatch(/^tenants\/[0-9a-f-]+\//);
      expect(
        existsSync(join(PUBLIC_MEDIA, key)),
        `missing ${key}; run npm run mock:media`,
      ).toBe(true);
    }
  });
});
