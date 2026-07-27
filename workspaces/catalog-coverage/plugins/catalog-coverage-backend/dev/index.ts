/**
 * Standalone dev backend for `catalog-coverage-backend`.
 *
 * Boots the smallest backend the plugin can actually work against: the catalog
 * (whose `Location` entities are the plugin's entire input) and the plugin
 * itself. No Postgres, no docker-compose, no IPC patch — see the workspace
 * `app-config.yaml` for the in-memory SQLite and the static locations.
 *
 * Run with `yarn start` from the workspace root, or `yarn start` in this
 * package to boot the backend alone.
 */
import { createBackend } from '@backstage/backend-defaults';

const backend = createBackend();

backend.add(import('@backstage/plugin-catalog-backend'));
backend.add(import('../src'));

backend.start();
