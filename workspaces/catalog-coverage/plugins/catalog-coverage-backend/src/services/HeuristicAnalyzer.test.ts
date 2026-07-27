/**
 * Tests for HeuristicAnalyzer.
 *
 * Four fixture repos are defined as inline objects (not files on disk).
 * All GitHub fetch calls are intercepted via jest.spyOn(global, 'fetch').
 */

import { HeuristicAnalyzer } from './HeuristicAnalyzer';

// ─── Fixture content ─────────────────────────────────────────────────────────

const TS_SERVICE_PACKAGE_JSON = JSON.stringify({
  name: '@scope/my-service',
  bin: { 'my-service': './dist/index.js' },
  main: './dist/index.js',
});

const TS_LIB_PACKAGE_JSON = JSON.stringify({
  name: 'my-library',
  main: './dist/index.js',
  exports: { '.': './dist/index.js' },
});

const CARGO_TOML = `[package]
name = "my-rust-lib"
version = "0.1.0"
edition = "2021"
`;

const REPO_META_TS_SERVICE = {
  stargazers_count: 10,
  archived: false,
  default_branch: 'main',
};

const REPO_META_TS_LIB = {
  stargazers_count: 3,
  archived: false,
  default_branch: 'main',
};

const REPO_META_RUST = {
  stargazers_count: 0,
  archived: false,
  default_branch: 'main',
};

const REPO_META_EMPTY = {
  stargazers_count: 0,
  archived: false,
  default_branch: 'main',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

type FetchSetup = {
  packageJson: string | null;
  dockerfile: boolean;
  cargoToml: string | null;
  meta: Record<string, unknown>;
};

const mockFetch = (setup: FetchSetup): jest.SpyInstance => {
  return jest
    .spyOn(global, 'fetch')
    .mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();

      // Repo metadata endpoint
      if (!url.includes('/contents/')) {
        return new Response(JSON.stringify(setup.meta), { status: 200 });
      }

      // File content endpoints
      if (url.includes('/contents/package.json')) {
        if (setup.packageJson === null) {
          return new Response(null, { status: 404 });
        }
        return new Response(setup.packageJson, { status: 200 });
      }
      if (url.includes('/contents/Dockerfile')) {
        return new Response(null, { status: setup.dockerfile ? 200 : 404 });
      }
      if (url.includes('/contents/Cargo.toml')) {
        if (setup.cargoToml === null) {
          return new Response(null, { status: 404 });
        }
        return new Response(setup.cargoToml, { status: 200 });
      }
      // Any other file (pyproject.toml, go.mod)
      return new Response(null, { status: 404 });
    });
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('HeuristicAnalyzer', () => {
  let analyzer: HeuristicAnalyzer;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    analyzer = new HeuristicAnalyzer(undefined);
  });

  afterEach(() => {
    if (fetchSpy) fetchSpy.mockRestore();
    jest.restoreAllMocks();
  });

  describe('TS service repo (Dockerfile + bin)', () => {
    beforeEach(() => {
      fetchSpy = mockFetch({
        packageJson: TS_SERVICE_PACKAGE_JSON,
        dockerfile: true,
        cargoToml: null,
        meta: REPO_META_TS_SERVICE,
      });
    });

    it('extracts name from package.json (strips scope)', async () => {
      const { signals } = await analyzer.analyze('zentala', 'my-service');
      expect(signals.detectedName).toBe('my-service');
    });

    it('detects type=service', async () => {
      const { signals } = await analyzer.analyze('zentala', 'my-service');
      expect(signals.detectedType).toBe('service');
    });

    it('detects lifecycle=experimental (not archived → safe default)', async () => {
      const { signals } = await analyzer.analyze('zentala', 'my-service');
      expect(signals.detectedLifecycle).toBe('experimental');
    });

    it('includes required annotations', async () => {
      const { yaml } = await analyzer.analyze('zentala', 'my-service');
      expect(yaml).toContain('github.com/project-slug: zentala/my-service');
      expect(yaml).toContain('backstage.io/source-location:');
    });

    it('does not include TODO comment for type', async () => {
      const { yaml } = await analyzer.analyze('zentala', 'my-service');
      expect(yaml).not.toContain('# TODO: pick one — service');
    });
  });

  describe('archived repo', () => {
    beforeEach(() => {
      fetchSpy = mockFetch({
        packageJson: null,
        dockerfile: false,
        cargoToml: null,
        meta: { stargazers_count: 42, archived: true, default_branch: 'main' },
      });
    });

    it('detects lifecycle=deprecated when archived', async () => {
      const { signals } = await analyzer.analyze('zentala', 'archived-repo');
      expect(signals.detectedLifecycle).toBe('deprecated');
    });

    it('emits deprecated in YAML', async () => {
      const { yaml } = await analyzer.analyze('zentala', 'archived-repo');
      expect(yaml).toContain('lifecycle: deprecated');
    });
  });

  describe('TS library repo (main+exports, no bin, no Dockerfile)', () => {
    beforeEach(() => {
      fetchSpy = mockFetch({
        packageJson: TS_LIB_PACKAGE_JSON,
        dockerfile: false,
        cargoToml: null,
        meta: REPO_META_TS_LIB,
      });
    });

    it('extracts name from package.json', async () => {
      const { signals } = await analyzer.analyze('zentala', 'my-library');
      expect(signals.detectedName).toBe('my-library');
    });

    it('detects type=library', async () => {
      const { signals } = await analyzer.analyze('zentala', 'my-library');
      expect(signals.detectedType).toBe('library');
    });

    it('detects lifecycle=experimental (stars<=5)', async () => {
      const { signals } = await analyzer.analyze('zentala', 'my-library');
      expect(signals.detectedLifecycle).toBe('experimental');
    });

    it('includes required annotations', async () => {
      const { yaml } = await analyzer.analyze('zentala', 'my-library');
      expect(yaml).toContain('github.com/project-slug: zentala/my-library');
    });
  });

  describe('Rust library (Cargo.toml only)', () => {
    beforeEach(() => {
      fetchSpy = mockFetch({
        packageJson: null,
        dockerfile: false,
        cargoToml: CARGO_TOML,
        meta: REPO_META_RUST,
      });
    });

    it('extracts name from Cargo.toml', async () => {
      const { signals } = await analyzer.analyze('zentala', 'my-rust-lib');
      expect(signals.detectedName).toBe('my-rust-lib');
    });

    it('type is ambiguous (no Dockerfile, no package.json)', async () => {
      const { signals } = await analyzer.analyze('zentala', 'my-rust-lib');
      expect(signals.detectedType).toBe('ambiguous');
    });

    it('includes TODO comment for type in YAML', async () => {
      const { yaml } = await analyzer.analyze('zentala', 'my-rust-lib');
      expect(yaml).toContain('# TODO: pick one — service|library|website');
    });

    it('includes required annotations', async () => {
      const { yaml } = await analyzer.analyze('zentala', 'my-rust-lib');
      expect(yaml).toContain('github.com/project-slug: zentala/my-rust-lib');
    });
  });

  describe('empty repo (no manifests)', () => {
    beforeEach(() => {
      fetchSpy = mockFetch({
        packageJson: null,
        dockerfile: false,
        cargoToml: null,
        meta: REPO_META_EMPTY,
      });
    });

    it('falls back to repo name', async () => {
      const { signals } = await analyzer.analyze('zentala', 'empty-repo');
      expect(signals.detectedName).toBe('empty-repo');
    });

    it('type is ambiguous', async () => {
      const { signals } = await analyzer.analyze('zentala', 'empty-repo');
      expect(signals.detectedType).toBe('ambiguous');
    });

    it('lifecycle is experimental (stars<=5)', async () => {
      const { signals } = await analyzer.analyze('zentala', 'empty-repo');
      expect(signals.detectedLifecycle).toBe('experimental');
    });

    it('includes required annotations', async () => {
      const { yaml } = await analyzer.analyze('zentala', 'empty-repo');
      expect(yaml).toContain('github.com/project-slug: zentala/empty-repo');
      expect(yaml).toContain('backstage.io/source-location:');
    });

    it('produces valid YAML structure', async () => {
      const { yaml } = await analyzer.analyze('zentala', 'empty-repo');
      expect(yaml).toContain('apiVersion: backstage.io/v1alpha1');
      expect(yaml).toContain('kind: Component');
      expect(yaml).toContain('owner: zentala');
    });
  });
});
