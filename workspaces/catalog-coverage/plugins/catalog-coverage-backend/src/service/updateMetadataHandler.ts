import { Request, Response } from 'express';
import {
  GITHUB_API,
  makeGithubHeaders,
  readGithubJson,
} from './githubClient';

/**
 * Returns a PATCH /repos/:owner/:repo/metadata handler that updates description
 * and/or topics on GitHub. The GitHub token is resolved by the router
 * (config-first, env fallback) and injected here.
 */
export const createUpdateMetadataHandler =
  (defaults: { token?: string } = {}) =>
  async (req: Request, res: Response): Promise<void> => {
    const { owner, repo } = req.params;
    const { description, topics } = req.body as {
      description?: string;
      topics?: string[];
    };

    if (typeof description !== 'string' && !Array.isArray(topics)) {
      res.status(400).json({ error: 'description or topics is required' });
      return;
    }

    const token = defaults.token;
    if (!token) {
      res
        .status(500)
        .json({ error: 'GITHUB_TOKEN not configured on the server' });
      return;
    }

    // Server-side topics validation
    if (Array.isArray(topics)) {
      if (topics.length > 20) {
        res.status(400).json({ error: 'GitHub allows max 20 topics' });
        return;
      }
      const invalid = topics.find(
        t => !/^[a-z0-9][a-z0-9-]*$/.test(t) || t.length > 50,
      );
      if (invalid) {
        res.status(400).json({
          error: `Invalid topic: "${invalid}". Lowercase letters, numbers and hyphens only.`,
        });
        return;
      }
    }

    const h = makeGithubHeaders(token);

    let finalDescription: string | null = description ?? null;
    let finalTopics: string[] = topics ?? [];

    // Update description via PATCH /repos/{owner}/{repo}
    if (typeof description === 'string') {
      const patchRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, {
        method: 'PATCH',
        headers: h,
        body: JSON.stringify({ description }),
      });
      const updated = await readGithubJson<{ description: string | null }>(
        res,
        patchRes,
        'Failed to update description',
      );
      if (!updated) return;
      finalDescription = updated.description;
    }

    // Update topics via separate PUT endpoint (GitHub requires this)
    if (Array.isArray(topics)) {
      const topicsRes = await fetch(
        `${GITHUB_API}/repos/${owner}/${repo}/topics`,
        {
          method: 'PUT',
          headers: {
            ...h,
            // Required by GitHub topics API
            Accept: 'application/vnd.github.mercy-preview+json',
          },
          body: JSON.stringify({ names: topics }),
        },
      );
      const updated = await readGithubJson<{ names: string[] }>(
        res,
        topicsRes,
        'Failed to update topics',
      );
      if (!updated) return;
      finalTopics = updated.names;
    }

    res.json({ description: finalDescription, topics: finalTopics });
  };
