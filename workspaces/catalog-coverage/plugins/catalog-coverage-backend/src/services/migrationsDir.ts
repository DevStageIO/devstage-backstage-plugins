import { resolvePackagePath } from '@backstage/backend-plugin-api';

/**
 * Absolute path to the knex migration directory shipped with this package.
 *
 * Resolved from the package root rather than `__dirname`, which in a bundled
 * backend build is `dist/`. The directory lives at the package root — not under
 * `src/` — because `files` only publishes built output, and knex must be able
 * to load the migrations at runtime from an installed package (E015-T08).
 *
 * Production and tests both import this constant so the two can never drift:
 * a CWD-relative path in the test suite is what previously hid the fact that
 * production was resolving a directory that is never shipped.
 */
export const MIGRATIONS_DIR = resolvePackagePath(
  '@devstage/backstage-plugin-catalog-coverage-backend',
  'migrations',
);
