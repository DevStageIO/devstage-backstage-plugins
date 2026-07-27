import { NextFunction, Request, Response } from 'express';

/**
 * Owner allowlist guard for the mutating routes (onboard / commit-direct /
 * metadata). Collapses the blast radius from "every repo the server PAT can
 * reach" down to "explicitly allowed GitHub owners" — the core mitigation for
 * E014 release-blocker #1 (unauthenticated mutating endpoints).
 *
 * Fail-closed: with an empty allowlist ALL mutations are rejected with a
 * remediation message. The operator opts in by setting
 * `catalogCoverage.allowedOwners` (or `catalogCoverage.defaultOwner.ref`).
 */
export const createOwnerGuard =
  (allowedOwners: ReadonlyArray<string>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const { owner } = req.params;

    if (allowedOwners.length === 0) {
      res.status(403).json({
        error:
          'Onboarding writes are disabled: no allowed owners configured. ' +
          'Set catalogCoverage.allowedOwners (or catalogCoverage.defaultOwner.ref) in app-config to enable.',
      });
      return;
    }

    const isAllowed = allowedOwners.some(
      o => o.toLowerCase() === owner?.toLowerCase(),
    );
    if (!isAllowed) {
      res.status(403).json({
        error: `Owner "${owner}" is not in the onboarding allowlist.`,
      });
      return;
    }

    next();
  };
