import { describe, expect, it } from 'vitest';
import { r2EnvSchema } from './env';
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
      parseEnv(r2EnvSchema, { R2_SECRET_ACCESS_KEY: secret }, 'R2');
      expect.unreachable();
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('R2_BUCKET');
      expect(message).not.toContain(secret);
    }
  });

  it.each(['/mock-media', 'https://pub-0123abcd.r2.dev'])(
    'accepts %s as the media base',
    (base) => {
      const env = { ...validPublic, NEXT_PUBLIC_MEDIA_BASE_URL: base };
      expect(() => parseEnv(publicEnvSchema, env, 'public')).not.toThrow();
    },
  );

  it.each(['mock-media', 'javascript:alert(1)', '/a b'])(
    'rejects %s as the media base',
    (base) => {
      const env = { ...validPublic, NEXT_PUBLIC_MEDIA_BASE_URL: base };
      expect(() => parseEnv(publicEnvSchema, env, 'public')).toThrow(
        /NEXT_PUBLIC_MEDIA_BASE_URL/,
      );
    },
  );
});
