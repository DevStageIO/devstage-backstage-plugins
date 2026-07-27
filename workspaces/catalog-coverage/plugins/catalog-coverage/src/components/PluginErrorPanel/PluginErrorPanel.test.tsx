import { render, screen } from '@testing-library/react';
import {
  MockErrorApi,
  TestApiProvider,
  mockApis,
} from '@backstage/test-utils';
import { translationApiRef } from '@backstage/core-plugin-api/alpha';
import { errorApiRef } from '@backstage/core-plugin-api';
import { ResponseError } from '@backstage/errors';
import { PluginErrorPanel } from './PluginErrorPanel';

// Dev path (NODE_ENV=test routes to DevErrorPanel — same as development)
describe('PluginErrorPanel (dev mode)', () => {
  it('renders the classified title', () => {
    render(<PluginErrorPanel error={new TypeError('Failed to fetch')} />);
    expect(screen.getByText('Backend not available')).toBeInTheDocument();
  });

  it('renders the classified description', () => {
    render(<PluginErrorPanel error={new TypeError('Failed to fetch')} />);
    expect(screen.getByText(/yarn start:backend/)).toBeInTheDocument();
  });

  it('renders "Technical details" accordion label', () => {
    render(<PluginErrorPanel error={new Error('boom')} />);
    expect(screen.getByText('Technical details')).toBeInTheDocument();
  });

  it('shows error.message as description for unknown errors', () => {
    render(<PluginErrorPanel error={new Error('something went wrong')} />);
    expect(screen.getByText('something went wrong')).toBeInTheDocument();
  });

  it('renders without crashing for non-Error value', () => {
    render(<PluginErrorPanel error="raw string error" />);
    expect(screen.getByText('Unexpected error')).toBeInTheDocument();
    expect(screen.getAllByText('raw string error').length).toBeGreaterThan(0);
  });
});

// Production path (Backstage native ErrorPanel with translationApiRef)
describe('PluginErrorPanel (production mode)', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'production',
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalNodeEnv,
      configurable: true,
    });
  });

  // Backstage's own ErrorPanel renders a CopyTextButton, which resolves
  // errorApiRef — so the production path needs it even though nothing here
  // posts an error.
  const renderInProd = (error: unknown) =>
    render(
      <TestApiProvider
        apis={[
          [translationApiRef, mockApis.translation()],
          [errorApiRef, new MockErrorApi()],
        ]}
      >
        <PluginErrorPanel error={error} />
      </TestApiProvider>,
    );

  // Backstage's WarningPanel prefixes the title with the severity, so the
  // heading reads "Error: Backend not available" in a single text node —
  // these assertions match on the classified part, not the whole string.
  it('renders classified title for network error', () => {
    renderInProd(new TypeError('Failed to fetch'));
    expect(screen.getByText(/Backend not available/)).toBeInTheDocument();
  });

  it('renders friendly description for network error', () => {
    renderInProd(new TypeError('Failed to fetch'));
    expect(screen.getByText(/yarn start:backend/)).toBeInTheDocument();
  });

  it('renders classified title for unexpected error', () => {
    renderInProd(new Error('boom'));
    expect(screen.getByText(/Unexpected error/)).toBeInTheDocument();
  });

  it('handles non-Error value without crashing', () => {
    renderInProd('raw string error');
    expect(screen.getByText(/Unexpected error/)).toBeInTheDocument();
  });

  it('renders "Authentication error" title for HTTP 401', async () => {
    const error = await ResponseError.fromResponse(
      new Response('Unauthorized', { status: 401 }),
    );
    renderInProd(error);
    expect(screen.getByText(/Authentication error/)).toBeInTheDocument();
  });

  it('renders friendly description for HTTP 401', async () => {
    const error = await ResponseError.fromResponse(
      new Response('Unauthorized', { status: 401 }),
    );
    renderInProd(error);
    expect(
      screen.getByText(/Check that required API tokens are configured/),
    ).toBeInTheDocument();
  });

  it('renders "Server error" title for HTTP 500', async () => {
    const error = await ResponseError.fromResponse(
      new Response('Internal Server Error', { status: 500 }),
    );
    renderInProd(error);
    expect(screen.getByText(/Server error \(HTTP 500\)/)).toBeInTheDocument();
  });
});
