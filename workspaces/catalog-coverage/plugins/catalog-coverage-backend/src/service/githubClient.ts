/** Shared GitHub REST API client utilities for catalog-coverage-backend handlers. */

import { Response as ExpressResponse } from 'express';

export const GITHUB_API = 'https://api.github.com';

export type GhHeaders = {
  Authorization: string;
  Accept: string;
  'X-GitHub-Api-Version': string;
  'Content-Type': string;
};

export const makeGithubHeaders = (token: string): GhHeaders => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'Content-Type': 'application/json',
});

/** Build read-only GitHub API headers (no Content-Type). Token is optional. */
export const buildReadHeaders = (token?: string): Record<string, string> => {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
};

/**
 * Read a GitHub API response, forwarding a failure to the client as GitHub's
 * own status plus its `message` field.
 *
 * The three onboarding handlers each repeated this map-status-and-message block
 * once per call; going through here keeps their error responses identical.
 *
 * @returns the parsed body on success, or `undefined` once the error response
 * has been written — callers must return immediately in that case.
 */
export const readGithubJson = async <T>(
  res: ExpressResponse,
  response: Response,
  fallbackError: string,
): Promise<T | undefined> => {
  if (!response.ok) {
    // GitHub answers some failures with an empty body; those still map to the
    // fallback rather than throwing out of the handler.
    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    res.status(response.status).json({ error: body.message ?? fallbackError });
    return undefined;
  }
  return (await response.json()) as T;
};
