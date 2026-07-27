export interface Config {
  catalogCoverage?: {
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
     * Default owner to pre-fill in the onboarding modal.
     * @visibility frontend
     */
    defaultOwner?: {
      /**
       * @visibility frontend
       */
      kind: string;
      /**
       * @visibility frontend
       */
      ref: string;
    };
  };
}
