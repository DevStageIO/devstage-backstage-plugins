# @devstage/backstage-plugin-catalog-coverage-backend

Backend for the [`catalog-coverage`](../catalog-coverage/README.md) frontend
plugin. It projects Backstage catalog `Location` entities into per-repository
`catalog-info.yaml` coverage rows, generates onboarding suggestions, and performs
the GitHub writes.

Install it together with the frontend plugin — neither is useful alone.

## 1. Install

```bash
yarn --cwd packages/backend add @devstage/backstage-plugin-catalog-coverage-backend
```

## 2. Wiring

In `packages/backend/src/index.ts`:

```ts
backend.add(import('@devstage/backstage-plugin-catalog-coverage-backend'));
```

It uses the standard backend services (`database`, `urlReader`, `auth`,
`httpRouter`, `rootConfig`) plus the catalog service, so it needs
`@backstage/plugin-catalog-backend` registered — which a standard `create-app`
project already does.

Building a **custom Docker image**? A workspace plugin has to be copied into the
production stage explicitly; a plugin installed from npm, as here, needs nothing
extra.

## 3. Configuration

The full `catalogCoverage` block is documented once, in the
[frontend README](../catalog-coverage/README.md#4-configuration) — both packages
read the same namespace. The keys this package reads directly:

| Key                               | Purpose                                                                                                        |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `catalogCoverage.token`           | GitHub token for projection, suggestions, and writes. Falls back to the `GITHUB_TOKEN` env var.                |
| `catalogCoverage.allowedOwners`   | Owners the write routes may target. Unioned with `defaultOwner.ref`. **Empty or absent ⇒ every write 403s.**    |
| `catalogCoverage.defaultOwner`    | `spec.owner` in generated suggestions; also seeds the write allowlist and the onboarding modal. Unset ⇒ `TODO`. |
| `catalogCoverage.maxConcurrency`  | Cap on simultaneous outbound GitHub requests per sweep. Default 8.                                             |
| `catalogCoverage.pr.title`/`body` | Override the onboarding pull-request message.                                                                  |

`allowDirectCommit` and `detectBranchProtection` are frontend-facing; the backend
serves them to the UI but does not change behaviour on them. Direct commits are
authorized by the same owner allowlist as everything else.

Also read from the environment: `OPENAI_API_KEY` / `OPENAI_BASE_URL` (LLM
enrichment of suggestions; without them suggestions stay heuristic) and
`CATALOG_COVERAGE_CACHE_TTL_DAYS` (suggestion cache TTL, default 30).

## How detection works

Two-stage projection over data the catalog already has — no scanner, no
scheduler, no crawl of GitHub.

1. **Catalog join.** For every `Location` entity, find non-Location entities
   whose `backstage.io/managed-by-origin-location` annotation matches
   `Location.spec.target`. A Location with ≥1 matched child is `present`.
2. **UrlReader probe** — only for unmatched Locations. Read the target URL to
   tell `missing` (404) from `invalid` (200, but the catalog produced no
   entities). On a 404 against a `https://github.com/.../blob/<branch>/...` URL
   it optionally retries against the repo's GitHub `default_branch`; if the file
   exists there the row stays `missing` but carries a `branchMismatch` hint.

Stage-2 results are cached in memory with a 30-minute TTL keyed on `spec.target`,
matching the usual `GithubEntityProvider` discovery cadence.

**Consequence worth knowing:** a repository no provider has discovered, and that
is not in `catalog.locations`, does not appear at all. This plugin reports on
what the catalog knows, not on what exists in your GitHub org.

## Endpoints

All routes are served under `/api/catalog-coverage`.

| Method | Path                                | Returns / effect                                                         |
| ------ | ----------------------------------- | ------------------------------------------------------------------------ |
| GET    | `/health`                           | `{ status: 'ok' }`                                                       |
| GET    | `/repos`                            | `{ repos: Repo[], summary: {...} }`                                      |
| GET    | `/repos/:host/:org/:repo/:path*`    | A single `Repo` with per-child completeness breakdown.                   |
| GET    | `/suggestions/:owner/:repo`         | Generated `catalog-info.yaml` suggestion (rate-limited).                 |
| GET    | `/suggestions?refs=o/r,o2/r2`       | Batch suggestions (rate-limited).                                        |
| POST   | `/suggestions/:owner/:repo/refresh` | Force re-analysis (per-repo cooldown + global caps).                     |
| POST   | `/repos/:owner/:repo/onboard`       | **Write** — branch + commit + PR. Owner-allowlisted, YAML-validated.     |
| POST   | `/repos/:owner/:repo/commit-direct` | **Write** — commit to default branch. Owner-allowlisted, YAML-validated. |
| PATCH  | `/repos/:owner/:repo/metadata`      | **Write** — update GitHub description/topics. Owner-allowlisted.         |

`/repos` accepts optional query params `org`, `status`
(`present` / `missing` / `invalid`), and `q` (substring match on repo name).

## Authorization

The three write routes are gated by an **owner allowlist**: a request is rejected
`403` unless `:owner` appears in `catalogCoverage.allowedOwners` or matches
`catalogCoverage.defaultOwner.ref`.

**The allowlist is fail-closed.** Configure nothing and every write is denied —
the coverage table still renders, and onboarding returns `403`. Onboarding writes
a file into a repository, so the plugin refuses to infer permission it was not
given.

Submitted YAML is validated against the Backstage entity schema (`400` on
failure) and request bodies are capped at 256 kB.

This is the whole authorization model — there is no per-user permission check. Any
portal user who can reach the page can onboard any repo under an allowed owner.
Keep `allowedOwners` narrow, or put the page behind your own access control.

> **Rate limiting is in-memory and per-replica.** It resets on restart and does
> not coordinate across horizontally-scaled backends. Sufficient for a
> single-replica self-hosted portal; not a distributed limiter.

## Compatibility

| Plugin | Backstage  | Notes                                       |
| ------ | ---------- | ------------------------------------------- |
| 0.1.x  | **1.51.0** | Built and tested against 1.51.0; Node 22/24 |

Supported range is the current Backstage minor plus one back. Older releases may
work and are not tested.

## Development

Runs standalone, without a host portal — see the
[workspace README](../../README.md).

```bash
yarn start   # from the workspace root: this backend plus the frontend plugin
yarn test
yarn lint
```

## License

[Apache-2.0](https://github.com/DevStageIO/devstage-backstage-plugins/blob/main/LICENSE)
