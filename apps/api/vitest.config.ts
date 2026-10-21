import { defineConfig } from 'vitest/config';
import { existsSync } from 'node:fs';
if (existsSync('../../.env')) process.loadEnvFile('../../.env');
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    pool: 'threads',
    fileParallelism: false,
    maxWorkers: 1,
    hookTimeout: 60000,
    testTimeout: 60000,
  },
});
