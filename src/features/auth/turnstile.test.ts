import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const env = { secret: 'secret', site: 'site' };
vi.mock('@/lib/env', () => ({
  getServerEnv: () => ({ TURNSTILE_SECRET_KEY: env.secret }),
}));
vi.mock('@/lib/env.public', () => ({
  getPublicEnv: () => ({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: env.site }),
}));
const { passedBotCheck } = await import('./turnstile');

const fetchMock = vi.fn();
beforeEach(() => {
  env.secret = 'secret';
  env.site = 'site';
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('passedBotCheck', () => {
  it('is off without keys', async () => {
    env.secret = '';
    expect(await passedBotCheck(null, null)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a missing answer without asking Cloudflare', async () => {
    expect(await passedBotCheck(null, null)).toBe(false);
    expect(await passedBotCheck('', null)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("follows Cloudflare's verdict", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ success: true }));
    expect(await passedBotCheck('token', '49.36.10.2')).toBe(true);
    fetchMock.mockResolvedValueOnce(
      Response.json({
        success: false,
        'error-codes': ['timeout-or-duplicate'],
      }),
    );
    expect(await passedBotCheck('token', null)).toBe(false);
  });

  it('lets people in when Cloudflare is down', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    expect(await passedBotCheck('token', null)).toBe(true);
    fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }));
    expect(await passedBotCheck('token', null)).toBe(true);
  });
});
