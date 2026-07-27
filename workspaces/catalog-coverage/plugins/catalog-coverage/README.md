# @devstage/backstage-plugin-catalog-coverage

Backstage **frontend** plugin that answers a question every adopter hits early:
_which of our repositories are actually in the catalog, and what is missing from
the ones that are not?_

It shows `catalog-info.yaml` coverage across the repositories your catalog
already knows about, and lets you **onboard** the missing ones — generating a
`catalog-info.yaml` and opening a pull request, without leaving the portal.

![The catalog coverage page: one row per repository, with catalog-info status, completeness score, and onboarding actions](https://raw.githubusercontent.com/DevStageIO/devstage-backstage-plugins/main/workspaces/catalog-coverage/docs/catalog-coverage.png)

Requires the backend plugin
[`@devstage/backstage-plugin-catalog-coverage-backend`](../catalog-coverage-backend/README.md),
which serves the data and performs every GitHub write. Installing only this
package gives you a page that cannot load.

## Contents

1. [What you get](#what-you-get)
2. [Install](#1-install)
3. [Frontend wiring](#2-frontend-wiring)
4. [Backend wiring](#3-backend-wiring)
5. [Configuration](#4-configuration)
6. [GitHub token](#5-github-token)
7. [Compatibility](#compatibility)
8. [Known limitations](#known-limitations)

## What you get

One row per repository projected from the catalog, showing:

- repo name (linked to GitHub) and org, visibility, stars/forks, description, topics
- `catalog-info.yaml` status: **Present** / **Missing** / **Invalid**
- a completeness score for present entities, with the specific fields that are absent
- default branch, last push, commit count

Filters: organization, catalog-info status, and repo-name search.

For a **Missing** repo, the row's actions let you:

- **Onboard via PR** — generate a `catalog-info.yaml` suggestion (heuristics, plus
  optional LLM enrichment served by the backend), edit it, and open a pull request
  on a `backstage-integration` branch.
- **Commit directly** — commit to the default branch, no PR. Off by default; see
  `allowDirectCommit` below.
- **Bulk onboard** — select several repos, preview each, and open the pull requests
  in one pass, with pause/resume and per-row progress.

Every write happens server-side and is gated by an owner allowlist — see
[GitHub token](#5-github-token) and the backend README.

## 1. Install

### Prerequisite: your app must use the legacy frontend system

This plugin is a legacy-frontend-system plugin (see [Compatibility](#compatibility)).
As of Backstage 1.53, `npx @backstage/create-app` scaffolds the **new** frontend system
by default — an `App.tsx` that calls `createApp({ features: [...] })`, with no
`<FlatRoutes>` and no `packages/app/src/components/Root/Root.tsx`. The wiring in §2
has nothing to attach to in such an app.

For a new app, pass `--legacy`:

```bash
npx @backstage/create-app@latest --legacy
```

An existing new-frontend-system app can in principle mount this page through
`@backstage/core-compat-api`, but that path is untested here — treat it as unsupported.

### Add the packages

Both, into their respective workspaces of your Backstage app:

```bash
yarn --cwd packages/app add @devstage/backstage-plugin-catalog-coverage
yarn --cwd packages/backend add @devstage/backstage-plugin-catalog-coverage-backend
```

## 2. Frontend wiring

Add the route in `packages/app/src/App.tsx`:

```tsx
import { CatalogCoveragePage } from '@devstage/backstage-plugin-catalog-coverage';

// inside <FlatRoutes>
<Route path="/catalog-coverage" element={<CatalogCoveragePage />} />;
```

And a sidebar entry in `packages/app/src/components/Root/Root.tsx`:

```tsx
import LibraryBooksIcon from '@material-ui/icons/LibraryBooks';

// inside <SidebarGroup label="Menu" icon={<MenuIcon />}>
<SidebarItem
  icon={LibraryBooksIcon}
  to="catalog-coverage"
  text="Catalog Coverage"
/>;
```

The page reads from `catalogApiRef`, which a standard `create-app` project
already provides — no extra API registration is needed.

## 3. Backend wiring

In `packages/backend/src/index.ts`:

```ts
backend.add(import('@devstage/backstage-plugin-catalog-coverage-backend'));
```

Full backend details — endpoints, how detection works, rate limiting — are in the
[backend README](../catalog-coverage-backend/README.md).

### Verify

```bash
yarn start
curl localhost:7007/api/catalog-coverage/health   # {"status":"ok"}
```

Then open <http://localhost:3000/catalog-coverage>.

**An empty table on a stock `create-app` project is the expected result, not a broken
install.** That template registers only local example files as catalog Locations, and
this plugin projects *registered Locations*, so it has nothing to report until a
discovery provider (`catalog.providers.github.*`) is configured. The header rendering
`0 / 0 — 0% covered` means the page and its backend are wired correctly.

## 4. Configuration

Everything lives under `catalogCoverage` in `app-config.yaml`. This block is the
complete surface — every key the plugin reads appears here, and every key is
optional. Where a built-in default exists it is named in the comment; the values
under `allowedOwners`, `defaultOwner` and `pr` are examples, not defaults.

```yaml
catalogCoverage:
  # GitHub token for projection, suggestions, and writes. See §5.
  token: ${GITHUB_TOKEN}

  # Owners (users/orgs) the write routes may target.
  # FAIL-CLOSED: absent or empty means EVERY write is denied with 403.
  allowedOwners:
    - my-org

  # Written as `spec.owner` in every generated catalog-info.yaml suggestion,
  # pre-fills the onboarding modal, and is unioned into the write allowlist
  # above. Leave it unset and suggestions carry a `TODO` owner for you to fill
  # in. `ref` is an entity name, not an entity ref: `platform-team`, not
  # `group:default/platform-team`.
  defaultOwner:
    kind: group
    ref: platform-team

  # Expose the "commit directly to the default branch" action (default: false).
  allowDirectCommit: false

  # When true (default), check branch protection on the target repo and hide
  # the direct-commit option where the default branch is protected.
  detectBranchProtection: true

  # Cap on simultaneous outbound GitHub requests during one coverage sweep.
  # Guards GitHub's secondary (parallelism) rate limit. Default: 8.
  maxConcurrency: 8

  # Overrides for the onboarding pull request message. Omit to use the
  # built-in text ("chore: register in Backstage catalog" plus a body linking
  # the catalog-info.yaml field reference).
  pr:
    title: 'chore: register in Backstage catalog'
    body: 'Adds a catalog-info.yaml so this repository appears in Backstage.'
```

Keys are declared in `config.d.ts` and shipped as the package's `configSchema`,
so `yarn backstage-cli config:check` validates them and `token` is redacted in
logs.

Two extra knobs are read from the environment rather than config, because they
are shared with other tooling: `OPENAI_API_KEY` / `OPENAI_BASE_URL` (enable LLM
enrichment of suggestions — without them the suggestions are heuristic only) and
`CATALOG_COVERAGE_CACHE_TTL_DAYS` (suggestion cache TTL, default 30).

### The allowlist is fail-closed — read this before filing a bug

If you configure nothing, the coverage table renders fine and **every onboarding
action returns `403`**. That is deliberate: onboarding writes a file into someone
else's repository, so the plugin refuses to guess who you meant. Put the orgs you
own in `allowedOwners` (and/or set `defaultOwner.ref`) to enable writes.

## 5. GitHub token

| What you want                                     | Scope needed                                             |
| ------------------------------------------------- | -------------------------------------------------------- |
| Coverage table for public repos                   | none (unauthenticated, heavily rate-limited)             |
| Coverage table without hitting rate limits        | `public_repo`                                            |
| Private repositories                              | `repo`                                                   |
| Onboarding via PR, direct commit, metadata writes | `repo` (fine-grained: Contents + Pull requests, `write`) |

Without a token the projection still works, but GitHub's unauthenticated limit
(60 requests/hour/IP) is reached almost immediately on any real org, and the
metadata columns — stars, last push, branch protection — come back empty. With a
token that lacks write scope, the table is complete and onboarding fails at the
point of writing, not before.

The plugin also falls back to the `GITHUB_TOKEN` environment variable when
`catalogCoverage.token` is unset, so an existing catalog-discovery token is
picked up automatically.

## Compatibility

| Plugin | Backstage      | Notes                                             |
| ------ | -------------- | ------------------------------------------------- |
| 0.1.x  | **1.51.0**     | Built and tested against 1.51.0; React 18, MUI v4 |

Supported range is the current Backstage minor plus one back. Older releases may
work and are not tested.

This plugin is built on the **legacy frontend system** and **Material-UI v4**
(`@material-ui/core`), matching Backstage's own components at 1.51. It has not
been ported to the new frontend system (`@backstage/frontend-plugin-api`).

## Known limitations

- **GitHub only.** Detection reads any `Location` your catalog holds, but every
  write path (onboarding, direct commit, metadata) is GitHub-specific. There is
  no GitLab or Bitbucket write support.
- **Polling, not webhooks.** Coverage reflects what the catalog knows at request
  time, with a 30-minute in-memory cache on the probe stage. A repo onboarded
  elsewhere appears once your catalog provider next discovers it.
- **The owner allowlist is the entire authorization model.** There is no
  per-user permission check — any portal user who can reach the page can onboard
  any repo in an allowed owner. If you need real authorization, keep
  `allowedOwners` narrow.
- **Registered Locations only.** A repository that no provider (e.g.
  `GithubEntityProvider`) has picked up and that is not in `catalog.locations`
  will not appear at all. It is not a GitHub crawler — it reports on what the
  catalog already knows.
- **Rate limiting is per-replica and in-memory.** It resets on restart and does
  not coordinate across horizontally-scaled backends.

### If the page reports 100% coverage and you know it should not

Check `validateLocationsExist` on your `catalog.providers.github.*` entries. With
`true`, the provider silently skips Locations whose file is missing — so the rows
the plugin exists to show never reach the catalog. The default (`false`) is what
you want here.

Note that a **static** `catalog.locations` entry cannot produce a `missing` row
either: a target that 404s never becomes a `Location` entity, so there is nothing
to project. Discovery has to come from a provider.

## Development

This plugin can be run without a host portal — see the
[workspace README](../../README.md).

```bash
yarn start   # from the workspace root: this plugin plus its backend
yarn test
yarn lint
```

## License

[Apache-2.0](https://github.com/DevStageIO/devstage-backstage-plugins/blob/main/LICENSE)
