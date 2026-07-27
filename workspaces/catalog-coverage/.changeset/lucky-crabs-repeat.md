---
'@devstage/backstage-plugin-catalog-coverage': patch
---

Move `@material-ui/lab` and `react-use` from `peerDependencies` to `dependencies`. A
stock `create-app` `packages/app` provides neither, so as peers they resolved to nothing
in a fresh consumer install. Neither is an app-level singleton, so a private copy is
harmless.
