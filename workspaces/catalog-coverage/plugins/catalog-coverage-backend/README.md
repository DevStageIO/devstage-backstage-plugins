# @devstage/backstage-plugin-catalog-coverage-backend

Backend for the [`catalog-coverage`](../catalog-coverage) frontend plugin.
Projects Backstage catalog `Location` entities into per-repo `catalog-info.yaml`
coverage rows. No own database, no scanner, no scheduler.

## How detection works

Two-stage projection over data the catalog already has:

1. **Catalog join.** For every `Location` entity, find non-Location entities
   whose `backstage.io/managed-by-origin-location` annotation matches
   `Location.spec.target`. Locations with ≥1 matched child are reported as
   `present`.
2. **UrlReader probe (only for unmatched Locations).** Read the target URL
   via `UrlReaderService` to distinguish `missing` (404) from `invalid`
   (200 but the catalog still produced no entities). On 404 against a
   `https://github.com/.../blob/<branch>/...` URL, optionally retry against
   the repo's GitHub `default_branch`; if the file exists there, the row
   stays `missing` but is annotated with a `branchMismatch` hint.

Stage-2 results are cached in-memory with a 30-minute TTL keyed by
`spec.target`, matching the typical `GithubEntityProvider` discovery cadence.

## Scope

Same as the frontend plugin: registered Locations only. A repo not picked up
by any provider and not in `catalog.locations` will not appear in the
projection. This is intentional — the plugin reports on what the catalog
already knows about, not what could exist on GitHub.

## Endpoints

All routes live under `/api/catalog-coverage`.

| Method | Path                                | Returns / effect                                                         |
| ------ | ----------------------------------- | ------------------------------------------------------------------------ |
| GET    | `/health`                           | `{ status: 'ok' }`                                                       |
| GET    | `/repos`                            | `{ repos: Repo[], summary: {...} }`                                      |
| GET    | `/repos/:host/:org/:repo/:path*`    | A single `Repo` with per-child completeness breakdown.                   |
| GET    | `/suggestions/:owner/:repo`         | Generated `catalog-info.yaml` suggestion (rate-limited).                 |
| GET    | `/suggestions?refs=o/r,o2/r2`       | Batch suggestions (rate-limited).                                        |
| POST   | `/suggestions/:owner/:repo/refresh` | Force re-analysis (rate-limited: per-repo cooldown + global caps).       |
| POST   | `/repos/:owner/:repo/onboard`       | **Write** — branch + commit + PR. Owner-allowlisted, YAML-validated.     |
| POST   | `/repos/:owner/:repo/commit-direct` | **Write** — commit to default branch. Owner-allowlisted, YAML-validated. |
| PATCH  | `/repos/:owner/:repo/metadata`      | **Write** — update GitHub description/topics. Owner-allowlisted.         |

`/repos` accepts the optional query params `org`, `status`
(`present` / `missing` / `invalid`), and `q` (substring match on repo name).

### Authorization (writes)

The three write routes are gated by an **owner allowlist** — a request is
rejected `403` unless `:owner` is in `catalogCoverage.allowedOwners` (or
matches `catalogCoverage.defaultOwner.ref`). The allowlist is **fail-closed**:
with none configured, all writes are denied. Submitted YAML is validated against
the Backstage entity schema (`400` on failure) and request bodies are capped at
256 kB. Rationale + the deferred full-RBAC option:
[ADR 019](../../.arch/ADR/019-onboarding-owner-allowlist.md).

## Wiring

In `packages/backend/src/index.ts`:

```ts
backend.add(import('@devstage/backstage-plugin-catalog-coverage-backend'));
```

Dockerfile wiring is required for production builds — see
[`.claude/rules/docker-backend-plugin.md`](../../.claude/rules/docker-backend-plugin.md).

## Configuration

Config keys are declared in `config.d.ts` (`configSchema`), so
`backstage-cli config:check` validates them and the token is redacted in logs.

```yaml
catalogCoverage:
  token: ${GITHUB_TOKEN} # GitHub token for projection, suggestions, and writes (secret)
  allowedOwners: # owners the write routes may target (fail-closed if empty)
    - zentala
  defaultOwner: # also seeds the write allowlist
    kind: group
    ref: zentala
  allowDirectCommit: false # frontend: expose the commit-direct action
  detectBranchProtection: true # frontend: disable direct commit on protected branches
  pr:
    title: 'chore: register in Backstage catalog' # onboarding PR title default
    body: '...' # onboarding PR body default
```

| Key                                                            | Purpose                                                                                                                                              |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalogCoverage.token`                                        | GitHub token. Falls back to the `GITHUB_TOKEN` env var. Without a token, projection still works but writes/suggestions that call GitHub are limited. |
| `catalogCoverage.allowedOwners`                                | Owners the write routes may target. Union with `defaultOwner.ref`. Empty ⇒ all writes 403.                                                           |
| `catalogCoverage.defaultOwner`                                 | Pre-fills the onboarding owner and seeds the allowlist.                                                                                              |
| `catalogCoverage.allowDirectCommit` / `detectBranchProtection` | Frontend behavior (read by the frontend plugin).                                                                                                     |
| `catalogCoverage.pr.title` / `.body`                           | Default onboarding PR message.                                                                                                                       |

Also read from the environment: `OPENAI_API_KEY` / `OPENAI_BASE_URL` (enable LLM
enrichment of suggestions) and `CATALOG_COVERAGE_CACHE_TTL_DAYS` (suggestion
cache TTL, default 30).

> **Rate limiting is in-memory and per-replica** — it resets on restart and does
> not coordinate across horizontally-scaled backends. Sufficient for a
> single-replica self-hosted portal; not a distributed limiter.
