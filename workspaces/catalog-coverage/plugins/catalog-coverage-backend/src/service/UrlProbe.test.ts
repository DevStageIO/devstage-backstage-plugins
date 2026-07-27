import { LoggerService, UrlReaderService } from '@backstage/backend-plugin-api';
import { NotFoundError } from '@backstage/errors';
import { UrlProbe } from './UrlProbe';

const noopLogger = (): LoggerService => ({
  child: () => noopLogger(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const fakeReader = (
  responses: Map<string, 'ok' | '404' | 'error'>,
): UrlReaderService => ({
  readUrl: jest.fn(async (url: string) => {
    const verdict = responses.get(url) ?? '404';
    if (verdict === 'ok') {
      return {
        buffer: async () =>
          Buffer.from('apiVersion: backstage.io/v1\nkind: Component\n'),
        etag: 'fake',
      } as ReturnType<UrlReaderService['readUrl']> extends Promise<infer T>
        ? T
        : never;
    }
    if (verdict === '404') throw new NotFoundError(`404 ${url}`);
    throw new Error(`other failure for ${url}`);
  }),
  readTree: jest.fn() as unknown as UrlReaderService['readTree'],
  search: jest.fn() as unknown as UrlReaderService['search'],
});

describe('UrlProbe', () => {
  it('returns invalid when UrlReader succeeds (file exists, but yielded no entities)', async () => {
    const url = 'https://github.com/org/repo/blob/main/catalog-info.yaml';
    const probe = new UrlProbe({
      urlReader: fakeReader(new Map([[url, 'ok']])),
      logger: noopLogger(),
    });
    const result = await probe.probe(url);
    expect(result.status).toBe('invalid');
  });

  it('returns missing when UrlReader returns 404', async () => {
    const url = 'https://github.com/org/repo/blob/main/catalog-info.yaml';
    const probe = new UrlProbe({
      urlReader: fakeReader(new Map([[url, '404']])),
      logger: noopLogger(),
    });
    const result = await probe.probe(url);
    expect(result.status).toBe('missing');
    expect(result.branchMismatch).toBeUndefined();
  });

  it('attaches branchMismatch hint when default_branch differs and file exists there', async () => {
    const url = 'https://github.com/org/repo/blob/main/catalog-info.yaml';
    const altUrl = 'https://github.com/org/repo/blob/master/catalog-info.yaml';
    const responses = new Map<string, 'ok' | '404' | 'error'>([
      [url, '404'],
      [altUrl, 'ok'],
    ]);
    const probe = new UrlProbe({
      urlReader: fakeReader(responses),
      logger: noopLogger(),
      fetchDefaultBranch: jest.fn().mockResolvedValue('master'),
    });
    const result = await probe.probe(url);
    expect(result.status).toBe('missing');
    expect(result.branchMismatch).toEqual({
      expectedBranch: 'main',
      actualDefaultBranch: 'master',
    });
  });

  it('does NOT add branchMismatch when default_branch equals expected', async () => {
    const url = 'https://github.com/org/repo/blob/main/catalog-info.yaml';
    const probe = new UrlProbe({
      urlReader: fakeReader(new Map([[url, '404']])),
      logger: noopLogger(),
      fetchDefaultBranch: jest.fn().mockResolvedValue('main'),
    });
    const result = await probe.probe(url);
    expect(result.branchMismatch).toBeUndefined();
  });

  it('caches results within TTL', async () => {
    const url = 'https://github.com/org/repo/blob/main/catalog-info.yaml';
    const reader = fakeReader(new Map([[url, '404']]));
    const probe = new UrlProbe({
      urlReader: reader,
      logger: noopLogger(),
      ttlMs: 60_000,
      now: () => 1_000,
    });
    await probe.probe(url);
    await probe.probe(url);
    expect(reader.readUrl).toHaveBeenCalledTimes(1);
  });

  it('re-fetches after TTL expiry', async () => {
    const url = 'https://github.com/org/repo/blob/main/catalog-info.yaml';
    const reader = fakeReader(new Map([[url, '404']]));
    let clock = 0;
    const probe = new UrlProbe({
      urlReader: reader,
      logger: noopLogger(),
      ttlMs: 1_000,
      now: () => clock,
    });
    clock = 0;
    await probe.probe(url);
    clock = 5_000;
    await probe.probe(url);
    expect(reader.readUrl).toHaveBeenCalledTimes(2);
  });

  it('does not retry on non-GitHub URLs even when fetchDefaultBranch is supplied', async () => {
    const url =
      'https://gitlab.example.com/team/svc/-/blob/main/catalog-info.yaml';
    const fetchDefaultBranch = jest.fn();
    const probe = new UrlProbe({
      urlReader: fakeReader(new Map([[url, '404']])),
      logger: noopLogger(),
      fetchDefaultBranch,
    });
    await probe.probe(url);
    expect(fetchDefaultBranch).not.toHaveBeenCalled();
  });
});
