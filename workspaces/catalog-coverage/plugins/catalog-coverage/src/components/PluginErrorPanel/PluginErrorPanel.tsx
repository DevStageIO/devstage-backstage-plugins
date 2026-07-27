import React from 'react';
import { ErrorPanel } from '@backstage/core-components';
import { DevErrorPanel } from './DevErrorPanel';
import { classifyError, PluginErrorPanelProps } from './classifyError';

export type { PluginErrorPanelProps };

/**
 * Renders an error panel appropriate for the current environment.
 *
 * In development: custom panel with friendly classification + technical details accordion.
 * In production: Backstage native ErrorPanel with classified title and friendly description.
 */
export const PluginErrorPanel: React.FC<PluginErrorPanelProps> = ({
  error,
}) => {
  if (process.env.NODE_ENV !== 'production') {
    return <DevErrorPanel error={error} />;
  }
  const { title, description } = classifyError(error);
  const wrapped = new Error(description);
  // Preserve original stack so the copy button captures real trace info
  if (error instanceof Error && error.stack) {
    wrapped.stack = error.stack;
  }
  return <ErrorPanel error={wrapped} title={title} />;
};
