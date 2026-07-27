/**
 * Unit tests for useCommitDirectHandler (part of usePageHandlers).
 *
 * Verifies the request → confirm/cancel → write state machine that gates the
 * single-row "Commit directly" action behind a confirmation step (E015-T04).
 */
import { renderHook, act } from '@testing-library/react';
import { useCommitDirectHandler } from './usePageHandlers';
import { CatalogCoverageApi } from '../../api/CatalogCoverageApi';

const mockApi: Partial<jest.Mocked<CatalogCoverageApi>> = {
  commitDirectRepo: jest.fn(),
};

const mockErrorApi = { post: jest.fn() };

describe('useCommitDirectHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockApi.commitDirectRepo as jest.Mock).mockResolvedValue({
      link: 'https://github.com/org/repo/blob/main/catalog-info.yaml',
    });
    jest.spyOn(window, 'open').mockImplementation(() => null);
  });

  const setup = () =>
    renderHook(() =>
      useCommitDirectHandler(mockApi as CatalogCoverageApi, mockErrorApi as any),
    );

  it('requestCommitDirect sets confirmTarget and issues no write', () => {
    const { result } = setup();

    act(() => {
      result.current.requestCommitDirect('org', 'repo', 'main');
    });

    expect(result.current.confirmTarget).toEqual({
      owner: 'org',
      repo: 'repo',
      branch: 'main',
    });
    expect(mockApi.commitDirectRepo).not.toHaveBeenCalled();
  });

  it('cancelCommitDirect clears confirmTarget and issues no write', () => {
    const { result } = setup();

    act(() => {
      result.current.requestCommitDirect('org', 'repo', 'main');
    });
    act(() => {
      result.current.cancelCommitDirect();
    });

    expect(result.current.confirmTarget).toBeNull();
    expect(mockApi.commitDirectRepo).not.toHaveBeenCalled();
  });

  it('confirmCommitDirect performs exactly one write with the expected args', async () => {
    const { result } = setup();

    act(() => {
      result.current.requestCommitDirect('org', 'repo', 'main');
    });
    await act(async () => {
      await result.current.confirmCommitDirect('apiVersion: v1');
    });

    expect(mockApi.commitDirectRepo).toHaveBeenCalledTimes(1);
    expect(mockApi.commitDirectRepo).toHaveBeenCalledWith(
      'org',
      'repo',
      'apiVersion: v1',
    );
    expect(result.current.confirmTarget).toBeNull();
  });

  it('confirmCommitDirect is a no-op when there is no pending target', async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.confirmCommitDirect('apiVersion: v1');
    });

    expect(mockApi.commitDirectRepo).not.toHaveBeenCalled();
  });

  it('reports errors via errorApi and clears the in-flight state on failure', async () => {
    (mockApi.commitDirectRepo as jest.Mock).mockRejectedValue(
      new Error('403 forbidden'),
    );
    const { result } = setup();

    act(() => {
      result.current.requestCommitDirect('org', 'repo', 'main');
    });
    await act(async () => {
      await result.current.confirmCommitDirect('apiVersion: v1');
    });

    expect(mockErrorApi.post).toHaveBeenCalledTimes(1);
    expect(result.current.committingRepos.has('org/repo')).toBe(false);
  });
});
