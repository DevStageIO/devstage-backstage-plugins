import { ResponseError } from '@backstage/errors';
import { classifyError } from './classifyError';

const makeResponseError = async (status: number): Promise<ResponseError> => {
  const response = new Response(
    JSON.stringify({
      error: { message: `HTTP ${status}`, name: 'ServerError' },
    }),
    { status, headers: { 'content-type': 'application/json' } },
  );
  return ResponseError.fromResponse(response);
};

describe('classifyError', () => {
  describe('network failures', () => {
    it('classifies Chrome/Edge "Failed to fetch" as Backend not available', () => {
      const result = classifyError(new TypeError('Failed to fetch'));
      expect(result.title).toBe('Backend not available');
      expect(result.description).toContain('yarn start:backend');
    });

    it('classifies Firefox NetworkError as Backend not available', () => {
      const result = classifyError(
        new TypeError('NetworkError when attempting to fetch resource.'),
      );
      expect(result.title).toBe('Backend not available');
    });

    it('classifies Safari "Load failed" as Backend not available', () => {
      const result = classifyError(new TypeError('Load failed'));
      expect(result.title).toBe('Backend not available');
    });

    it('classifies "The network connection was lost" as Backend not available', () => {
      const result = classifyError(
        new TypeError('The network connection was lost.'),
      );
      expect(result.title).toBe('Backend not available');
    });

    it('returns "No network connection" when navigator.onLine is false', () => {
      const original = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        value: false,
      });
      try {
        const result = classifyError(new TypeError('Failed to fetch'));
        expect(result.title).toBe('No network connection');
        expect(result.description).toContain('offline');
      } finally {
        Object.defineProperty(navigator, 'onLine', {
          configurable: true,
          value: original,
        });
      }
    });
  });

  describe('HTTP errors via ResponseError', () => {
    it('returns "Authentication error" for HTTP 401', async () => {
      const result = classifyError(await makeResponseError(401));
      expect(result.title).toBe('Authentication error');
      expect(result.description).toContain('API tokens');
    });

    it('returns "Authentication error" for HTTP 403', async () => {
      const result = classifyError(await makeResponseError(403));
      expect(result.title).toBe('Authentication error');
    });

    it('returns "Server error" for HTTP 500', async () => {
      const result = classifyError(await makeResponseError(500));
      expect(result.title).toBe('Server error (HTTP 500)');
      expect(result.description).toContain('backend logs');
    });

    it('returns "Server error" for HTTP 503', async () => {
      const result = classifyError(await makeResponseError(503));
      expect(result.title).toBe('Server error (HTTP 503)');
    });

    it('returns "Request failed" for HTTP 404', async () => {
      const result = classifyError(await makeResponseError(404));
      expect(result.title).toBe('Request failed (HTTP 404)');
    });
  });

  describe('fallback', () => {
    it('returns "Unexpected error" for a generic Error', () => {
      const result = classifyError(new Error('something broke'));
      expect(result.title).toBe('Unexpected error');
      expect(result.description).toBe('something broke');
    });

    it('returns "Unexpected error" with stringified value for non-Error', () => {
      const result = classifyError('raw string error');
      expect(result.title).toBe('Unexpected error');
      expect(result.description).toBe('raw string error');
    });

    it('handles null gracefully', () => {
      const result = classifyError(null);
      expect(result.title).toBe('Unexpected error');
      expect(result.description).toBe('null');
    });

    it('handles undefined gracefully', () => {
      const result = classifyError(undefined);
      expect(result.title).toBe('Unexpected error');
      expect(result.description).toBe('undefined');
    });
  });
});
