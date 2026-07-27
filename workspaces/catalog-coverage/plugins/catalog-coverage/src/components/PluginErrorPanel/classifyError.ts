import { ResponseError } from '@backstage/errors';

/** Props shared by PluginErrorPanel and DevErrorPanel. */
export interface PluginErrorPanelProps {
  error: unknown;
}

/** Maps an unknown error value to a human-readable title and description. */
export type ErrorClassification = {
  title: string;
  description: string;
};

const NETWORK_FAILURE_RE =
  /failed to fetch|networkerror when attempting to fetch|load failed|the network connection was lost/i;

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Classifies an unknown error into a user-friendly title + description pair. */
export function classifyError(error: unknown): ErrorClassification {
  if (error instanceof TypeError && NETWORK_FAILURE_RE.test(error.message)) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return {
        title: 'No network connection',
        description: 'Your device is offline. Reconnect and retry.',
      };
    }
    return {
      title: 'Backend not available',
      description:
        'The Backstage backend is not running. Start it with `yarn start:backend`.',
    };
  }

  if (error instanceof ResponseError) {
    const status = error.response.status;
    if (status === 401 || status === 403) {
      return {
        title: 'Authentication error',
        description:
          'Access denied. Check that required API tokens are configured.',
      };
    }
    if (status >= 500) {
      return {
        title: `Server error (HTTP ${status})`,
        description: 'The backend returned an error. Check the backend logs.',
      };
    }
    return {
      title: `Request failed (HTTP ${status})`,
      description: messageOf(error),
    };
  }

  return {
    title: 'Unexpected error',
    description: messageOf(error),
  };
}
