import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: vi.fn() }));

const { numberSearch, parseOrderListFilter } = await import('./dashboard');

describe('numberSearch', () => {
  it('matches an order number or part of a phone number', () => {
    expect(numberSearch('1001')).toBe(
      'order_number.eq.1001,customer_phone.like.*1001*',
    );
    expect(numberSearch('#1001')).toBe(
      'order_number.eq.1001,customer_phone.like.*1001*',
    );
  });

  it('matches a whole phone number however it is typed', () => {
    expect(numberSearch('+91 98765 43210')).toBe(
      'customer_phone.like.*9876543210*',
    );
    expect(numberSearch('98765-43210')).toBe(
      'customer_phone.like.*9876543210*',
    );
  });

  it('leaves names to the name search', () => {
    expect(numberSearch('Asha')).toBeNull();
    expect(numberSearch('  ')).toBeNull();
  });
});

describe('parseOrderListFilter', () => {
  it('reads the URL, falling back to all orders on page 1', () => {
    expect(
      parseOrderListFilter({ status: 'pending', q: ' Asha ', page: '2' }),
    ).toEqual({
      status: 'pending',
      search: 'Asha',
      page: 2,
    });
    expect(parseOrderListFilter({ status: 'odd', page: '-3' })).toEqual({
      status: 'all',
      search: '',
      page: 1,
    });
  });
});
