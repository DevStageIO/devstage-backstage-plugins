# catalog-coverage workspace

Home of the `catalog-coverage` plugin pair.

| Package                                                                                | Role                                                    |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| [`@devstage/backstage-plugin-catalog-coverage`](plugins/catalog-coverage/README.md)     | Frontend page, filters, onboarding UI                   |
| [`@devstage/backstage-plugin-catalog-coverage-backend`](plugins/catalog-coverage-backend/README.md) | Coverage projection, suggestions, GitHub writes |

**Installing these into your own Backstage app?** Start with the
[frontend README](plugins/catalog-coverage/README.md) — it covers install,
wiring, and the full config block. This file is for working on the plugins.

## Running the plugins without a portal

One command boots the frontend plugin against its own backend. No Postgres, no
`docker-compose`, no host app:

```bash
cd workspaces/catalog-coverage
yarn install
yarn start
```

Frontend on <http://localhost:3000/catalog-coverage>, backend on
<http://localhost:7007>. The harness reads [`app-config.yaml`](app-config.yaml)
in this directory: in-memory SQLite, plus a public repository registered as a
catalog Location so the page has a real row to render.

That row is `present`. A static `catalog.locations` entry cannot produce a
`missing` one — a target that 404s never becomes a `Location` entity, so nothing
reaches the projection. Use `?mock=1` (below) to see the
`missing` and `invalid` states, or point the harness at a real
`catalog.providers.github.*` block.

Set `GITHUB_TOKEN` before starting to exercise anything that talks to GitHub —
metadata columns, suggestions, and onboarding. Without it the table still
renders, from the catalog alone.

Two things worth knowing about the harness:

- **The frontend harness registers `catalogApiRef` itself.** `createDevApp` ships
  no catalog API, but the coverage table enriches its rows from the catalog. A
  real host app already provides it, so this registration lives only in
  `plugins/catalog-coverage/dev/`.
- **`?mock=1`** on the page URL
  (<http://localhost:3000/catalog-coverage?mock=1>) runs against fixtures
  instead of the backend — useful offline, and the only way to see `missing` and
  `invalid` rows without a discovery provider. The default is the real client on
  purpose: a harness that never calls the backend cannot catch a contract break
  between the two packages.

  It is a query param rather than an env var because `backstage-cli` replaces
  `process.env.X` at build time and forwards nothing but its own allowlist —
  `process` does not exist in the browser bundle at all, so an env-var toggle
  compiles to `undefined === 'true'` and silently never fires.

## Checks

```bash
yarn tsc
yarn lint:all
yarn test
yarn build:all
yarn build:api-reports
```

`report.api.md` next to each package is the reviewable record of its public API.
It is generated, committed, and verified in CI — regenerate it in the same commit
that changes an exported symbol, or CI fails on the drift.

Note that `backstage-cli` sets jest's `rootDir` to `src/`. The frontend package
overrides `jest.roots` so the harness test under `dev/` is actually collected —
without that override a test outside `src/` is silently never run.

## Releasing

Every pull request that changes a published package carries a changeset:

```bash
yarn changeset
```

Merging the generated `Version Packages` pull request is what publishes. See the
[repository README](../../README.md#releasing).
