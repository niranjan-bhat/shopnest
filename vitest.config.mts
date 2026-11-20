import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Run through `npm test` (scripts/vitest.mjs), which fixes a Windows
// drive-letter issue before Vitest starts.
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Resolves the "@/*" alias from tsconfig.json (built into Vite 8).
    tsconfigPaths: true,
    alias: {
      // `server-only` throws outside a React Server environment; tests run
      // server modules directly, so swap it for an empty module.
      'server-only': fileURLToPath(
        new URL('./src/test/server-only.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Next.js loads .env files itself; tests must not depend on a developer's
    // .env.local, so they get fixed public values instead.
    env: {
      NODE_ENV: 'test',
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      NEXT_PUBLIC_MEDIA_BASE_URL: '/mock-media',
      NEXT_PUBLIC_ROOT_DOMAIN: 'localhost:3000',
    },
  },
});
