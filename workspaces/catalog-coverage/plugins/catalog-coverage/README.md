# @devstage/backstage-plugin-catalog-coverage

Backstage **frontend** plugin that shows `catalog-info.yaml` coverage across the
GitHub repositories known to your catalog, and lets you **onboard** missing
repos (create `catalog-info.yaml` via a pull request or a direct commit).

Mounts at `/catalog-coverage` and adds a "Catalog-info Coverage" entry under
the Tools sidebar submenu. Pairs with the backend plugin
[`@devstage/backstage-plugin-catalog-coverage-backend`](../catalog-coverage-backend/README.md),
which serves the data and performs the GitHub writes.

## What it shows

One row per repository projected from the catalog, with:

- repo name (link to GitHub) + org, visibility, stars/forks, description, topics
- `catalog-info.yaml` status: **Present** / **Missing** / **Invalid**
- for onboarding: taxonomy status (Discovered / Missing / Waiting / Issues / Excluded)
- default branch, last push, commit count

Filters: organization dropdown + catalog-info status + repo-name search.

## Onboarding

For a **Missing** repo, actions in the row let you:

- **Onboard via PR** — generates a `catalog-info.yaml` suggestion (heuristic +
  optional LLM enrichment, served by the backend), lets you edit it, and opens a
  PR on the `backstage-integration` branch.
- **Commit directly** — commits `catalog-info.yaml` to the default branch (no PR).
  Off by default; enable with `catalogCoverage.allowDirectCommit: true`.
- **Bulk onboard** — select multiple repos, preview, and open PRs in one pass
  (with pause/resume and per-row progress).

All writes are performed server-side and are gated by an **owner allowlist**
(see the backend README / [ADR 019](../../.arch/ADR/019-onboarding-owner-allowlist.md)).

## Install & wiring

```bash
yarn workspace app add @devstage/backstage-plugin-catalog-coverage
```

Register the route in `packages/app/src/App.tsx`:

```tsx
import { CatalogCoveragePage } from '@devstage/backstage-plugin-catalog-coverage';
// ...
<Route path="/catalog-coverage" element={<CatalogCoveragePage />} />;
```

Then install and wire the [backend plugin](../catalog-coverage-backend/README.md).

## Configuration (`app-config.yaml`)

```yaml
catalogCoverage:
  allowDirectCommit: false # allow commit-to-default-branch onboarding (default false)
  detectBranchProtection: true # disable direct commit when the branch is protected
  defaultOwner: # pre-fills the owner field + seeds the onboarding allowlist
    kind: group
    ref: zentala
```

Config keys are declared in `config.d.ts` (`configSchema`), so `backstage-cli
config:check` validates them and secrets are redacted. Backend-only keys
(`token`, `allowedOwners`) are documented in the backend README.

## Scope — catalog projection, not a GitHub crawler

This plugin projects what Backstage already knows (Locations + entities). A repo
that no provider (e.g. `GithubEntityProvider`) has picked up will not appear.
For "Missing" detection, ensure `validateLocationsExist: false` (default) on your
`catalog.providers.github.*` entries — with `true`, Locations for missing files
are skipped and the page would falsely report 100% coverage.

## Dev

```bash
yarn workspace @devstage/backstage-plugin-catalog-coverage start   # standalone dev app
yarn workspace @devstage/backstage-plugin-catalog-coverage test    # jest
yarn workspace @devstage/backstage-plugin-catalog-coverage lint
```
