// Mock ai SDK and HeuristicFetchers before imports
jest.mock('ai', () => ({ generateObject: jest.fn() }));
jest.mock('@ai-sdk/openai', () => ({
  createOpenAI: jest
    .fn()
    .mockReturnValue(jest.fn().mockReturnValue('mocked-model')),
}));
jest.mock('./HeuristicFetchers', () => {
  const actual = jest.requireActual('./HeuristicFetchers');
  return {
    ...actual,
    fetchReadmeExcerpt: jest.fn(),
  };
});

import { generateObject } from 'ai';
import { fetchReadmeExcerpt, RepoMeta } from './HeuristicFetchers';
import { LLMAnalyzer, LlmEnrichment } from './LLMAnalyzer';

const makeRepoMeta = (overrides?: Partial<RepoMeta>): RepoMeta => ({
  stars: 5,
  archived: false,
  defaultBranch: 'main',
  topics: ['typescript', 'backstage'],
  description: 'A developer portal plugin',
  pushedAt: null,
  ...overrides,
});

const MOCK_ENRICHMENT: LlmEnrichment = {
  description: 'A Backstage plugin for developer portals.',
  type: 'library',
  lifecycle: 'development',
  tags: ['typescript', 'backstage', 'developer-portal'],
};

describe('LLMAnalyzer', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    jest.clearAllMocks();
    (generateObject as jest.Mock).mockResolvedValue({
      object: MOCK_ENRICHMENT,
    });
    (fetchReadmeExcerpt as jest.Mock).mockResolvedValue(
      '# My Plugin\nThis is a Backstage plugin for developer portals.',
    );
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_BASE_URL;
  });

  it('returns enrichment result from generateObject', async () => {
    const analyzer = new LLMAnalyzer('gh-token');
    const result = await analyzer.enrich(
      'zentala',
      'my-plugin',
      makeRepoMeta(),
    );

    expect(result).toEqual(MOCK_ENRICHMENT);
  });

  it('passes README excerpt to generateObject prompt', async () => {
    const analyzer = new LLMAnalyzer('gh-token');
    await analyzer.enrich('zentala', 'my-plugin', makeRepoMeta());

    const callArgs = (generateObject as jest.Mock).mock.calls[0][0];
    expect(callArgs.prompt).toContain(
      '# My Plugin\nThis is a Backstage plugin for developer portals.',
    );
  });

  it('includes description and topics in prompt', async () => {
    const analyzer = new LLMAnalyzer('gh-token');
    const meta = makeRepoMeta({
      description: 'A developer portal plugin',
      topics: ['typescript', 'backstage'],
    });
    await analyzer.enrich('zentala', 'my-plugin', meta);

    const callArgs = (generateObject as jest.Mock).mock.calls[0][0];
    expect(callArgs.prompt).toContain('A developer portal plugin');
    expect(callArgs.prompt).toContain('typescript, backstage');
  });

  it('uses "No README found." when fetchReadmeExcerpt returns null', async () => {
    (fetchReadmeExcerpt as jest.Mock).mockResolvedValue(null);
    const analyzer = new LLMAnalyzer('gh-token');
    await analyzer.enrich('zentala', 'no-readme', makeRepoMeta());

    const callArgs = (generateObject as jest.Mock).mock.calls[0][0];
    expect(callArgs.prompt).toContain('No README found.');
  });

  it('uses "none" for topics when topics array is empty', async () => {
    const analyzer = new LLMAnalyzer('gh-token');
    const meta = makeRepoMeta({ topics: [] });
    await analyzer.enrich('zentala', 'my-repo', meta);

    const callArgs = (generateObject as jest.Mock).mock.calls[0][0];
    expect(callArgs.prompt).toContain('GitHub topics: none');
  });

  it('uses "not provided" for description when null', async () => {
    const analyzer = new LLMAnalyzer('gh-token');
    const meta = makeRepoMeta({ description: null });
    await analyzer.enrich('zentala', 'my-repo', meta);

    const callArgs = (generateObject as jest.Mock).mock.calls[0][0];
    expect(callArgs.prompt).toContain('GitHub description: not provided');
  });

  it('includes tags instruction in prompt', async () => {
    const analyzer = new LLMAnalyzer('gh-token');
    await analyzer.enrich('zentala', 'my-plugin', makeRepoMeta());

    const callArgs = (generateObject as jest.Mock).mock.calls[0][0];
    expect(callArgs.prompt).toContain('tags');
    expect(callArgs.prompt).toContain('lowercase kebab-case');
  });

  it('passes abortSignal with timeout to generateObject', async () => {
    const analyzer = new LLMAnalyzer('gh-token');
    await analyzer.enrich('zentala', 'my-plugin', makeRepoMeta());

    const callArgs = (generateObject as jest.Mock).mock.calls[0][0];
    expect(callArgs.abortSignal).toBeDefined();
  });

  it('fetches README with the github token', async () => {
    const analyzer = new LLMAnalyzer('my-github-token');
    await analyzer.enrich('zentala', 'my-plugin', makeRepoMeta());

    expect(fetchReadmeExcerpt).toHaveBeenCalledWith(
      'zentala',
      'my-plugin',
      'my-github-token',
    );
  });
});
