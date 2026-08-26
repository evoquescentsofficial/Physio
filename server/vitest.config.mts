import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The money rules live in ../shared and are consumed by both the API and the client,
    // so that is where the tests that protect them belong.
    include: ['src/**/*.test.ts', '../shared/**/*.test.ts'],
    environment: 'node',
  },
});
