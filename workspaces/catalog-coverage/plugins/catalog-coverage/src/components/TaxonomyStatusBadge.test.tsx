import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  TaxonomyStatusBadge,
  TaxonomyStatusBadgeProps,
} from './TaxonomyStatusBadge';

const renderBadge = (props: Partial<TaxonomyStatusBadgeProps> = {}) =>
  render(<TaxonomyStatusBadge status={{ kind: 'Discovered' }} {...props} />);

describe('TaxonomyStatusBadge', () => {
  describe('chip rendering', () => {
    it('renders Discovered chip', () => {
      renderBadge({ status: { kind: 'Discovered' } });
      expect(
        screen.getByTestId('taxonomy-status-badge-discovered'),
      ).toBeInTheDocument();
    });

    it('renders Issues chip', () => {
      renderBadge({ status: { kind: 'Issues', issues: [] } });
      expect(
        screen.getByTestId('taxonomy-status-badge-issues'),
      ).toBeInTheDocument();
    });

    it('renders Missing chip', () => {
      renderBadge({ status: { kind: 'Missing' } });
      expect(
        screen.getByTestId('taxonomy-status-badge-missing'),
      ).toBeInTheDocument();
    });

    it('renders Excluded chip', () => {
      renderBadge({ status: { kind: 'Excluded' } });
      expect(
        screen.getByTestId('taxonomy-status-badge-excluded'),
      ).toBeInTheDocument();
    });

    it('renders Waiting chip', () => {
      renderBadge({ status: { kind: 'Waiting' } });
      expect(
        screen.getByTestId('taxonomy-status-badge-waiting'),
      ).toBeInTheDocument();
    });
  });

  describe('drawer open/close', () => {
    it('opens drawer when chip is clicked', async () => {
      const user = userEvent.setup();
      renderBadge({ status: { kind: 'Missing' } });
      expect(
        screen.queryByRole('region', { name: 'Status detail' }),
      ).not.toBeInTheDocument();
      await user.click(screen.getByTestId('taxonomy-status-badge-missing'));
      expect(
        screen.getByRole('region', { name: 'Status detail' }),
      ).toBeInTheDocument();
    });

    it('closes drawer on backdrop click', async () => {
      const user = userEvent.setup();
      renderBadge({ status: { kind: 'Missing' } });
      await user.click(screen.getByTestId('taxonomy-status-badge-missing'));
      expect(
        screen.getByRole('region', { name: 'Status detail' }),
      ).toBeInTheDocument();
      // Click the MUI Drawer backdrop
      const backdrop = document.querySelector(
        '.MuiBackdrop-root',
      ) as HTMLElement;
      if (backdrop) await user.click(backdrop);
      expect(
        screen.queryByRole('region', { name: 'Status detail' }),
      ).not.toBeInTheDocument();
    });

    it('closes drawer on Escape key press', async () => {
      const user = userEvent.setup();
      renderBadge({ status: { kind: 'Missing' } });
      await user.click(screen.getByTestId('taxonomy-status-badge-missing'));
      expect(
        screen.getByRole('region', { name: 'Status detail' }),
      ).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(
        screen.queryByRole('region', { name: 'Status detail' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('drawer content', () => {
    it('shows Missing onboard hint in drawer', async () => {
      const user = userEvent.setup();
      renderBadge({ status: { kind: 'Missing' } });
      await user.click(screen.getByTestId('taxonomy-status-badge-missing'));
      expect(
        screen.getByText('Click Onboard to add catalog-info.yaml'),
      ).toBeInTheDocument();
    });

    it('shows Excluded skip reason in drawer', async () => {
      const user = userEvent.setup();
      renderBadge({ status: { kind: 'Excluded' } });
      await user.click(screen.getByTestId('taxonomy-status-badge-excluded'));
      expect(
        screen.getByText('This repository is excluded from onboarding'),
      ).toBeInTheDocument();
    });

    it('lists individual issues in drawer for Issues status', async () => {
      const user = userEvent.setup();
      renderBadge({
        status: {
          kind: 'Issues',
          issues: [
            {
              kind: 'branch-mismatch',
              message: 'Expected main, got master',
              field: 'branch',
            },
          ],
        },
      });
      await user.click(screen.getByTestId('taxonomy-status-badge-issues'));
      expect(screen.getByText('Expected main, got master')).toBeInTheDocument();
    });

    it('shows Discovered detail in drawer', async () => {
      renderBadge({ status: { kind: 'Discovered' } });
      fireEvent.click(screen.getByTestId('taxonomy-status-badge-discovered'));
      expect(
        screen.getByText('catalog-info.yaml found and valid.'),
      ).toBeInTheDocument();
    });

    it('shows Waiting detail in drawer', async () => {
      const user = userEvent.setup();
      renderBadge({ status: { kind: 'Waiting' } });
      await user.click(screen.getByTestId('taxonomy-status-badge-waiting'));
      expect(
        screen.getByText(
          'A pull request is open — waiting for review and merge.',
        ),
      ).toBeInTheDocument();
    });
  });
});
