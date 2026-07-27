import { Request, Response } from 'express';
import {
  GITHUB_API,
  makeGithubHeaders,
  readGithubJson,
} from './githubClient';
import { SchemaValidator } from '../services/SchemaValidator';

const FILE_PATH = 'catalog-info.yaml';
const FALLBACK_MESSAGE = 'chore: add catalog-info.yaml';

export type CommitDirectHandlerOptions = {
  message?: string;
  /** GitHub token resolved from config/env by the router. */
  token?: string;
  /** Validates the submitted YAML against the Backstage entity schema. */
  validator?: SchemaValidator;
};

/**
 * Returns a POST /repos/:owner/:repo/commit-direct handler.
 * Commits catalog-info.yaml directly to the default branch without creating a PR.
 * Use only when branch protection is absent on the target repository.
 */
export const createCommitDirectHandler =
  (defaults: CommitDirectHandlerOptions = {}) =>
  async (req: Request, res: Response): Promise<void> => {
    const { owner, repo } = req.params;
    const { yaml: fileContent, message: commitMessage } = req.body as {
      yaml?: string;
      message?: string;
    };

    if (!fileContent) {
      res.status(400).json({ error: 'yaml is required' });
      return;
    }

    const validation = defaults.validator?.validate(fileContent);
    if (validation && !validation.valid) {
      res.status(400).json({
        error: 'Submitted YAML is not a valid Backstage entity',
        details: validation.errors,
      });
      return;
    }

    const token = defaults.token;
    if (!token) {
      res
        .status(500)
        .json({ error: 'GITHUB_TOKEN not configured on the server' });
      return;
    }

    try {
      const h = makeGithubHeaders(token);
      const message = commitMessage ?? defaults.message ?? FALLBACK_MESSAGE;

      // 1. Get default branch
      const repoInfoRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, {
        headers: h,
      });
      const repoInfo = await readGithubJson<{ default_branch: string }>(
        res,
        repoInfoRes,
        'Failed to fetch repo info',
      );
      if (!repoInfo) return;
      const { default_branch: defaultBranch } = repoInfo;

      // 2. Check if catalog-info.yaml already exists (need SHA to update)
      let existingFileSha: string | undefined;
      const existingRes = await fetch(
        `${GITHUB_API}/repos/${owner}/${repo}/contents/${FILE_PATH}?ref=${defaultBranch}`,
        { headers: h },
      );
      if (existingRes.ok) {
        existingFileSha = ((await existingRes.json()) as { sha: string }).sha;
      }

      // 3. Create or update file on default branch
      const filePayload: Record<string, string> = {
        message,
        content: Buffer.from(fileContent).toString('base64'),
        branch: defaultBranch,
      };
      if (existingFileSha) filePayload.sha = existingFileSha;

      const fileRes = await fetch(
        `${GITHUB_API}/repos/${owner}/${repo}/contents/${FILE_PATH}`,
        { method: 'PUT', headers: h, body: JSON.stringify(filePayload) },
      );
      const commit = await readGithubJson<{ content: { html_url: string } }>(
        res,
        fileRes,
        'Failed to commit file',
      );
      if (!commit) return;

      const { content: fileData } = commit;
      res.json({
        link:
          fileData?.html_url ??
          `https://github.com/${owner}/${repo}/blob/${defaultBranch}/${FILE_PATH}`,
      });
    } catch (err: unknown) {
      const errMessage =
        err instanceof Error
          ? err.message
          : 'Unexpected error during direct commit';
      if (!res.headersSent) {
        res.status(500).json({ error: errMessage });
      }
    }
  };
