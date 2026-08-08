import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    // Mirrors the `@/*` alias from tsconfig.json so tests import modules the
    // same way the app does.
    alias: { '@': path.resolve(import.meta.dirname, '.') },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Security-rules tests need the Firestore emulator (and a JVM), so they run
    // under `npm run test:rules` with their own config. Excluding them keeps
    // `npm test` runnable on a machine without Java.
    exclude: ['tests/rules/**'],
  },
});
