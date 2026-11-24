import { describe, expect, it } from 'vitest';
import { formatDay, isOverdue, todayInIndia } from './dates';
import { parseLimits, paymentSchema, planSchema, usageText } from './schema';

const plan = {
  name: ' Starter ',
  setupFee: '0',
  monthlyFee: '₹999',
  maxProducts: '100',
  maxTeam: '',
  isActive: true,
  allTemplates: true,
  templates: [],
};
const payment = {
  storeId: 'a0000000-0000-4000-8000-000000000000',
  paymentId: 'c0000000-0000-4000-8000-000000000000',
  amount: '2,997.50',
  paidOn: '2026-11-23',
  method: 'upi',
  months: '3',
  reference: '',
};

describe('days', () => {
  it('takes the day in India', () => {
    expect(todayInIndia(new Date('2026-11-23T18:29:00Z'))).toBe('2026-11-23');
    expect(todayInIndia(new Date('2026-11-23T18:31:00Z'))).toBe('2026-11-24');
  });

  it('shows a day as that day everywhere', () => {
    expect(formatDay('2026-11-23')).toBe('23 Nov 2026');
  });

  it('is overdue the day after it is due', () => {
    expect(isOverdue('2026-11-23', '2026-11-23')).toBe(false);
    expect(isOverdue('2026-11-23', '2026-11-24')).toBe(true);
    expect(isOverdue(null, '2026-11-24')).toBe(false);
  });
});

describe('planSchema', () => {
  it('turns rupees into paise and an empty limit into none', () => {
    expect(planSchema.parse(plan)).toEqual({
      name: 'Starter',
      setupFee: 0,
      monthlyFee: 99900,
      maxProducts: 100,
      maxTeam: null,
      isActive: true,
      allTemplates: true,
      templates: [],
    });
  });

  it('needs a template unless it offers them all', () => {
    const some = { ...plan, allTemplates: false };
    expect(planSchema.safeParse(some).success).toBe(false);
    expect(planSchema.safeParse({ ...some, templates: ['silk'] }).success).toBe(
      true,
    );
  });

  it.each(['0', '-1', '1.5', 'ten'])('refuses the limit %s', (maxTeam) => {
    expect(planSchema.safeParse({ ...plan, maxTeam }).success).toBe(false);
  });

  it('refuses a fee that is not an amount', () => {
    expect(planSchema.safeParse({ ...plan, monthlyFee: '' }).success).toBe(
      false,
    );
  });
});

describe('paymentSchema', () => {
  it('reads a payment', () => {
    expect(paymentSchema.parse(payment)).toMatchObject({
      amount: 299750,
      months: 3,
    });
  });

  it.each([
    { amount: '0' },
    { months: '37' },
    { months: '-1' },
    { paidOn: '23/11/2026' },
    { method: 'cheque' },
  ])('refuses %o', (change) => {
    expect(paymentSchema.safeParse({ ...payment, ...change }).success).toBe(
      false,
    );
  });
});

describe('limits', () => {
  it('treats missing and malformed limits as none', () => {
    expect(parseLimits({ products: 5 })).toEqual({ products: 5, team: null });
    expect(parseLimits('x')).toEqual({ products: null, team: null });
  });

  it('describes usage', () => {
    expect(usageText(3, 10)).toBe('3 of 10');
    expect(usageText(3, null)).toBe('3');
  });
});
