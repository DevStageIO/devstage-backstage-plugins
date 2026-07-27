/**
 * HeuristicAnalyzer fixture tests.
 *
 * Each fixture directory under tests/fixtures/repos/<name>/ contains real
 * manifest files (package.json, Dockerfile, Cargo.toml) and expected-*.txt
 * files declaring the expected analyzer output. Tests mock global fetch to
 * serve fixture content without hitting the real GitHub API.
 */

import * as path from 'path';
import * as fs from 'fs';
import { HeuristicAnalyzer } from './HeuristicAnalyzer';

// Fixtures live at plugins/catalog-coverage-backend/tests/fixtures/repos/
// This test file is at src/services/ — resolve up two levels then into tests/
const FIXTURES_ROOT = path.resolve(__dirname, '../../tests/fixtures/repos');

/** Read a file from a fixture directory, returning null if absent. */
const readFixtureFile = (fixture: string, file: string): string | null => {
  const p = path.join(FIXTURES_ROOT, fixture, file);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : null;
};

/** Read the expected-*.txt value for a fixture. */
const readExpected = (fixture: string, key: string): string =>
  fs
    .readFileSync(
      path.join(FIXTURES_ROOT, fixture, `expected-${key}.txt`),
      'utf-8',
    )
    .trim();

type FetchMockSetup = {
  fixture: string;
};

/** Mock global.fetch to serve fixture files for GitHub API calls. */
const mockFetchForFixture = (setup: FetchMockSetup): jest.SpyInstance => {
  const { fixture } = setup;
  return jest
    .spyOn(global, 'fetch')
    .mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();

      // Repo metadata endpoint (no /contents/ in URL) — return 404 (no live GitHub)
      if (!url.includes('/contents/')) {
        return new Response(null, { status: 404 });
      }

      const FILE_MAP: Record<string, string> = {
        'package.json': 'package.json',
        Dockerfile: 'Dockerfile',
        'Cargo.toml': 'Cargo.toml',
      };

      for (const [urlSegment, fileName] of Object.entries(FILE_MAP)) {
        if (url.includes(`/contents/${urlSegment}`)) {
          const content = readFixtureFile(fixture, fileName);
          if (content === null) return new Response(null, { status: 404 });
          return new Response(content, { status: 200 });
        }
      }

      return new Response(null, { status: 404 });
    });
};

// ─── Fixture-driven test cases ────────────────────────────────────────────────

const FIXTURE_CASES: Array<{ fixture: string; repoName: string }> = [
  { fixture: 'ts-service', repoName: 'my-ts-service' },
  { fixture: 'ts-lib', repoName: 'my-ts-lib' },
  { fixture: 'rust-lib', repoName: 'my-rust-lib' },
  { fixture: 'empty', repoName: 'empty-repo' },
  { fixture: 'malicious-readme', repoName: 'malicious-readme' },
];

describe('HeuristicAnalyzer — fixture-driven tests', () => {
  let analyzer: HeuristicAnalyzer;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    analyzer = new HeuristicAnalyzer(undefined);
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
    jest.restoreAllMocks();
  });

  FIXTURE_CASES.forEach(({ fixture, repoName }) => {
    describe(`fixture: ${fixture}`, () => {
      beforeEach(() => {
        fetchSpy = mockFetchForFixture({ fixture });
      });

      it('produces the expected detectedType', async () => {
        const expectedType = readExpected(fixture, 'type');
        const { signals } = await analyzer.analyze('zentala', repoName);
        expect(signals.detectedType).toBe(expectedType);
      });

      it('produces a valid catalog-info.yaml skeleton', async () => {
        const { yaml } = await analyzer.analyze('zentala', repoName);
        expect(yaml).toContain('apiVersion: backstage.io/v1alpha1');
        expect(yaml).toContain('kind: Component');
      });

      it('includes the GitHub project-slug annotation', async () => {
        const { yaml } = await analyzer.analyze('zentala', repoName);
        expect(yaml).toContain(`github.com/project-slug: zentala/${repoName}`);
      });
    });
  });
});
