# DevStage Backstage plugins

Open-source [Backstage](https://backstage.io) plugins published under the
[`@devstage`](https://www.npmjs.com/org/devstage) npm scope.

## Plugins

| Workspace                                          | Packages                                                                 | Status  |
| -------------------------------------------------- | ------------------------------------------------------------------------ | ------- |
| [`catalog-coverage`](workspaces/catalog-coverage/) | `@devstage/backstage-plugin-catalog-coverage`, `…-catalog-coverage-backend` | Unreleased |

`catalog-coverage` answers a question every Backstage adopter hits early: _which of our
repositories are actually in the catalog, and what is missing from the ones that are not?_
It scans a GitHub organisation for `catalog-info.yaml`, reports coverage, and can onboard a
repository by opening a pull request with a generated entity file.

## Repository layout

Each plugin family lives in its own self-contained workspace under `workspaces/`, following
the [`backstage/community-plugins`](https://github.com/backstage/community-plugins) model.
A workspace pins its own Backstage version and dependencies, so it stays portable enough to
graduate to a repository of its own later.

```
workspaces/<topic>/
├── backstage.json     # the Backstage release this workspace targets
├── package.json       # private workspace root
└── plugins/           # the published packages
```

There is deliberately **no repository-level `package.json`**: a workspace is installed and
built on its own, and nothing outside it needs to resolve.

## Working on a workspace

Requires Node 22 (see `.nvmrc`) and Yarn 4.

```bash
cd workspaces/catalog-coverage
yarn install
yarn tsc
yarn lint:all
yarn test
yarn build:api-reports
```

`report.api.md` next to each package is the reviewable record of its public API. It is
generated, committed, and checked in CI — a change to an exported symbol shows up as a diff
there, so regenerate it in the same commit that changes the API.

## Releasing

Releases run on [changesets](https://github.com/changesets/changesets). Every pull request
that changes a published package carries a changeset; merging the generated
`Version Packages` pull request is what publishes. Nothing is published from a laptop.

```bash
cd workspaces/catalog-coverage
yarn changeset
```

## Contributing

Issues and pull requests are welcome. Note that plugin source is currently developed in a
private portal repository and mirrored here one-way per release — so a change accepted here
is applied upstream and returns in the next sync. The first contribution that needs a code
change in this repository is the trigger for moving development here outright.

## License

[Apache-2.0](LICENSE)
