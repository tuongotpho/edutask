import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Security-rules tests run under their own config, separate from `npm test`.
 *
 * They need the Firestore emulator (and therefore a JVM) running, so folding
 * them into the main suite would make `npm test` fail on any machine that has
 * not installed Java — punishing everyone for a dependency only these tests
 * need. `npm run test:rules` starts the emulator itself.
 */
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, '.') },
  },
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    // The emulator round-trips over HTTP and each test opens its own context;
    // the default 5s is tight on a cold JVM.
    testTimeout: 20000,
    hookTimeout: 60000,
    // Rules tests share one emulator instance, so they must not run in
    // parallel: `clearFirestore()` in one file would wipe another's fixtures.
    fileParallelism: false,
  },
});
