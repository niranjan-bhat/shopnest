import { describe, expect, it } from 'vitest';
import {
  canMove,
  holdsStock,
  NEXT_STATUSES,
  ORDER_STATUSES,
  stockNote,
} from './status';

describe('order status', () => {
  it('moves one step forward at a time', () => {
    expect(canMove('pending', 'confirmed')).toBe(true);
    expect(canMove('confirmed', 'packed')).toBe(true);
    expect(canMove('packed', 'shipped')).toBe(true);
    expect(canMove('shipped', 'delivered')).toBe(true);
    expect(canMove('pending', 'shipped')).toBe(false);
    expect(canMove('delivered', 'pending')).toBe(false);
  });

  it('can be cancelled until it ships, and not reopened', () => {
    const cancellable = ORDER_STATUSES.filter((s) => canMove(s, 'cancelled'));
    expect(cancellable).toEqual(['pending', 'confirmed', 'packed']);
    expect(NEXT_STATUSES.cancelled).toEqual([]);
  });

  it('holds stock from confirmed until delivered or cancelled', () => {
    expect(ORDER_STATUSES.filter(holdsStock)).toEqual([
      'confirmed',
      'packed',
      'shipped',
    ]);
  });
});

describe('stockNote', () => {
  it('says how many are left, and flags a shortage', () => {
    expect(stockNote({ kind: 'tracked', available: 5 }, 2)).toEqual({
      text: '5 in stock',
      short: false,
    });
    expect(stockNote({ kind: 'tracked', available: 2 }, 2)).toEqual({
      text: '2 in stock',
      short: false,
    });
    expect(stockNote({ kind: 'tracked', available: 1 }, 2)).toEqual({
      text: 'Only 1 in stock',
      short: true,
    });
    expect(stockNote({ kind: 'tracked', available: 0 }, 1)).toEqual({
      text: 'Out of stock',
      short: true,
    });
  });

  it('covers untracked and deleted items', () => {
    expect(stockNote({ kind: 'untracked' }, 3).short).toBe(false);
    expect(stockNote({ kind: 'gone' }, 1)).toEqual({
      text: 'No longer in your catalogue',
      short: true,
    });
  });
});
