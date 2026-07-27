export interface Config {
  catalogCoverage?: {
    /**
     * GitHub token used for catalog projection, suggestions, and onboarding
     * writes. Prefer this over the legacy GITHUB_TOKEN env var.
     * @visibility secret
     */
    token?: string;
    /**
     * GitHub owners (users/orgs) that onboarding writes (onboard / commit-direct /
     * metadata) are allowed to target. Empty = all mutations denied (fail-closed).
     * @visibility backend
     */
    allowedOwners?: string[];
    /**
     * Maximum simultaneous outbound GitHub requests during a coverage sweep.
     * Guards GitHub's secondary (parallelism) rate limit on the shared token.
     * Defaults to 8.
     * @visibility backend
     */
    maxConcurrency?: number;
    /**
     * Allow creating catalog-info.yaml via direct commit (skipping a PR).
     * @visibility frontend
     */
    allowDirectCommit?: boolean;
    /**
     * When true, check branch protection on the target repo and disable the
     * direct-commit option if protection is active.
     * @visibility frontend
     */
    detectBranchProtection?: boolean;
    /**
     * Default owner to pre-fill in the onboarding modal and to seed the
     * onboarding allowlist.
     * @visibility frontend
     */
    defaultOwner?: {
      kind: string;
      ref: string;
    };
    /** Pull-request message template defaults for onboarding PRs. */
    pr?: {
      /** @visibility backend */
      title?: string;
      /** @visibility backend */
      body?: string;
    };
  };
}
