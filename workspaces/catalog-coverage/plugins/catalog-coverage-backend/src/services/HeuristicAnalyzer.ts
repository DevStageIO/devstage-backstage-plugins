/**
 * HeuristicAnalyzer: generates a catalog-info.yaml skeleton from GitHub repo
 * metadata by inspecting common manifest files (package.json, Dockerfile,
 * Cargo.toml). Phase 1 — no LLM, pure heuristics.
 *
 * Fetch utilities and YAML helpers live in HeuristicFetchers.ts to keep this
 * file under the 250-line limit.
 */

import {
  buildYaml,
  fetchFile,
  fetchRepoMeta,
  parseCargoName,
  parsePackageName,
  RepoMeta,
  toKebab,
} from './HeuristicFetchers';

/** Signals collected about the repo during analysis. */
export type AnalyzerSignals = {
  hasDockerfile: boolean;
  hasPackageJson: boolean;
  packageJsonBin: boolean;
  packageJsonMain: boolean;
  packageJsonExports: boolean;
  hasCargo: boolean;
  hasPyproject: boolean;
  hasGoMod: boolean;
  stars: number | undefined;
  archived: boolean;
  defaultBranch: string | undefined;
  detectedName: string | undefined;
  detectedType: string | 'ambiguous';
  detectedLifecycle: string;
};

/** Determine component type from collected signals. */
const detectType = (signals: AnalyzerSignals): string | 'ambiguous' => {
  if (signals.hasDockerfile) return 'service';
  if (signals.packageJsonBin) return 'service';
  if (
    signals.packageJsonMain &&
    signals.packageJsonExports &&
    !signals.packageJsonBin
  )
    return 'library';
  return 'ambiguous';
};

/** Determine lifecycle from repo metadata. */
const detectLifecycle = (meta: RepoMeta | null): string => {
  if (meta?.archived) return 'deprecated';
  return 'experimental'; // safe default; LLM enrichment handles the rest
};

/** Parse package.json signals (bin, main, exports). */
const parsePackageSignals = (
  raw: string,
): { bin: boolean; main: boolean; exports: boolean; name?: string } => {
  try {
    const pkg = JSON.parse(raw) as Record<string, unknown>;
    return {
      bin: Boolean(pkg.bin),
      main: Boolean(pkg.main),
      exports: Boolean(pkg.exports),
      name: parsePackageName(raw),
    };
  } catch {
    return { bin: false, main: false, exports: false };
  }
};

/**
 * HeuristicAnalyzer inspects a GitHub repository and generates a
 * catalog-info.yaml skeleton with prefilled fields where confident
 * and `# TODO` comments where the heuristic is ambiguous.
 */
export class HeuristicAnalyzer {
  private readonly token: string | undefined;

  constructor(token?: string) {
    this.token = token;
  }

  /**
   * Analyze a GitHub repo and return a YAML skeleton plus the raw signals
   * that were used to produce it.
   */
  async analyze(
    owner: string,
    repo: string,
  ): Promise<{ yaml: string; signals: AnalyzerSignals }> {
    const [packageJsonRaw, dockerfileRaw, cargoRaw, meta] = await Promise.all([
      fetchFile(owner, repo, 'package.json', this.token),
      fetchFile(owner, repo, 'Dockerfile', this.token),
      fetchFile(owner, repo, 'Cargo.toml', this.token),
      fetchRepoMeta(owner, repo, this.token),
    ]);

    const pkgSignals = packageJsonRaw
      ? parsePackageSignals(packageJsonRaw)
      : undefined;
    const hasCargo = cargoRaw !== null;
    const cargoName = cargoRaw ? parseCargoName(cargoRaw) : undefined;

    const signals: AnalyzerSignals = {
      hasDockerfile: dockerfileRaw !== null,
      hasPackageJson: packageJsonRaw !== null,
      packageJsonBin: pkgSignals?.bin ?? false,
      packageJsonMain: pkgSignals?.main ?? false,
      packageJsonExports: pkgSignals?.exports ?? false,
      hasCargo,
      hasPyproject: false,
      hasGoMod: false,
      stars: meta?.stars,
      archived: meta?.archived ?? false,
      defaultBranch: meta?.defaultBranch,
      detectedName: undefined,
      detectedType: 'ambiguous',
      detectedLifecycle: 'experimental',
    };

    const rawName = pkgSignals?.name ?? cargoName ?? repo;
    signals.detectedName = toKebab(rawName);
    signals.detectedType = detectType(signals);
    signals.detectedLifecycle = detectLifecycle(meta);

    const yamlStr = buildYaml(
      owner,
      repo,
      signals.detectedName,
      signals.detectedType,
      signals.detectedLifecycle,
    );

    return { yaml: yamlStr, signals };
  }
}
