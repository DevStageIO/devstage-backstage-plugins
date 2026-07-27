// Workspace root config. It is deliberately NOT `@backstage/cli/config/eslint-factory`:
// that factory is package-level and demands a `backstage.role`, which a workspace root
// has no business declaring. Each plugin under `plugins/*` uses the factory itself.
module.exports = {
  root: true,
  ignorePatterns: ['dist-types/', 'node_modules/'],
};
