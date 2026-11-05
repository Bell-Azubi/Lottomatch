import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['src/test/setup.ts'],
      restoreMocks: true,
      unstubGlobals: true,
      testTimeout: 15_000,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/**/*.test.{ts,tsx}',
          'src/test/**',
          'src/main.tsx',
          'src/**/*.d.ts',
          'src/env.ts',
        ],
        reporter: ['text-summary', 'json-summary', 'html', 'lcov'],
        thresholds: {
          lines: 85,
          branches: 85,
          functions: 85,
          statements: 85,
          'src/domain/**': { lines: 95, branches: 95, functions: 95, statements: 95 },
        },
      },
    },
  }),
);
