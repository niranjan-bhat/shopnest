import { describe, expect, it } from 'vitest';
import { serverEnvSchema } from './env';
import { parseEnv, publicEnvSchema } from './env.public';

const validPublic = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  NEXT_PUBLIC_MEDIA_BASE_URL: 'https://media.example.com',
  NEXT_PUBLIC_ROOT_DOMAIN: 'localhost:3000',
};

describe('parseEnv', () => {
  it('accepts a complete public env', () => {
    expect(parseEnv(publicEnvSchema, validPublic, 'public')).toEqual(
      validPublic,
    );
  });

  it('names missing and malformed keys', () => {
    const run = () =>
      parseEnv(
        publicEnvSchema,
        { ...validPublic, NEXT_PUBLIC_SUPABASE_URL: 'not a url' },
        'public',
      );
    expect(run).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it('never echoes secret values in errors', () => {
    const secret = 'super-secret-value';
    try {
      parseEnv(
        serverEnvSchema,
        { SUPABASE_SERVICE_ROLE_KEY: secret },
        'server',
      );
      expect.unreachable();
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('R2_BUCKET');
      expect(message).not.toContain(secret);
    }
  });
});
