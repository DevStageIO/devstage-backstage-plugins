import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AiBadgeRow } from './AiBadgeRow';

const ENRICHMENT = {
  description: 'A test service',
  type: 'service' as const,
  lifecycle: 'experimental' as const,
};

describe('AiBadgeRow', () => {
  it('renders nothing when neither enrichment nor llmError', () => {
    const { container } = render(
      <AiBadgeRow refreshing={false} onRefresh={jest.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders AI chip when enrichment is present', () => {
    render(
      <AiBadgeRow
        enrichment={ENRICHMENT}
        refreshing={false}
        onRefresh={jest.fn()}
      />,
    );
    expect(screen.getByText('AI generated')).toBeInTheDocument();
  });

  it('renders refresh button with correct aria-label when enrichment present', () => {
    render(
      <AiBadgeRow
        enrichment={ENRICHMENT}
        refreshing={false}
        onRefresh={jest.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: /regenerate ai suggestion/i }),
    ).toBeInTheDocument();
  });

  it('calls onRefresh when refresh button clicked', async () => {
    const onRefresh = jest.fn();
    render(
      <AiBadgeRow
        enrichment={ENRICHMENT}
        refreshing={false}
        onRefresh={onRefresh}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: /regenerate ai suggestion/i }),
    );
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('disables refresh button while refreshing', () => {
    render(
      <AiBadgeRow enrichment={ENRICHMENT} refreshing onRefresh={jest.fn()} />,
    );
    expect(
      screen.getByRole('button', { name: /regenerate ai suggestion/i }),
    ).toBeDisabled();
  });

  it('renders warning when llmError is present (no chip, no refresh)', () => {
    render(
      <AiBadgeRow
        llmError="quota exceeded"
        refreshing={false}
        onRefresh={jest.fn()}
      />,
    );
    expect(
      screen.getByText(/ai unavailable — heuristic suggestion/i),
    ).toBeInTheDocument();
    expect(screen.queryByText('AI generated')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /regenerate/i }),
    ).not.toBeInTheDocument();
  });
});
