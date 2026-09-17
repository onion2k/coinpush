import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // A test here plays the real machine, and a minute of it steps fifteen hundred coins a hundred and twenty
    // times a second: the longest take four or five seconds on the machine they were written on, and three times
    // that on a CI runner, which the default five seconds failed six of. Long enough for the slowest with room to
    // spare, and short enough that a test that has truly hung still says so.
    testTimeout: 30_000,
  },
});
