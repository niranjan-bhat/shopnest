import { describe, expect, it } from 'vitest';
import { SALES_PHONE, SALES_PHONE_LABEL, salesLink } from './site';

describe('sales contact', () => {
  it('opens a chat with the sales number and a ready message', () => {
    const url = new URL(salesLink);
    expect(url.origin + url.pathname).toBe('https://wa.me/919632531541');
    expect(url.searchParams.get('text')).toContain('online store');
  });

  it('shows the number it opens', () => {
    expect(SALES_PHONE_LABEL.replace(/ /g, '')).toBe(SALES_PHONE);
  });
});
