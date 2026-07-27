import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from '@testing-library/react';
import { Table, TableBody } from '@material-ui/core';
import { InlineExpandRow } from './InlineExpandRow';
import { ChildEntity } from '../data/types';

// --- helpers ----------------------------------------------------------------

const CHILD_A: ChildEntity = {
  entityRef: 'component:default/svc-a',
  kind: 'Component',
  type: 'service',
  name: 'svc-a',
  score: 80,
};

const CHILD_B: ChildEntity = {
  entityRef: 'api:default/api-b',
  kind: 'API',
  type: 'openapi',
  name: 'api-b',
};

type RenderOpts = {
  repoKey?: string;
  children?: Array<ChildEntity>;
};

const renderRow = ({
  repoKey = 'zentala/my-repo',
  children = [CHILD_A],
}: RenderOpts = {}) =>
  render(
    <Table>
      <TableBody>
        <InlineExpandRow
          repoKey={repoKey}
          rowContent={<td>repo-name</td>}
          colSpan={5}
          children={children}
        />
      </TableBody>
    </Table>,
  );

// Clear sessionStorage before each test to ensure isolation
beforeEach(() => {
  sessionStorage.clear();
});

// --- tests ------------------------------------------------------------------

describe('InlineExpandRow', () => {
  it('renders the chevron toggle button', () => {
    renderRow();
    expect(screen.getByTestId('inline-expand-chevron')).toBeInTheDocument();
  });

  it('starts collapsed (child table not visible)', () => {
    renderRow();
    // MUI Collapse hides via CSS/height when not yet triggered — content unmounts with unmountOnExit
    expect(
      screen.queryByTestId('inline-expand-child-table'),
    ).not.toBeInTheDocument();
  });

  it('expands when chevron is clicked', async () => {
    renderRow();
    act(() => {
      fireEvent.click(screen.getByTestId('inline-expand-chevron'));
    });
    await waitFor(() => {
      expect(
        screen.getByTestId('inline-expand-child-table'),
      ).toBeInTheDocument();
    });
    expect(screen.getByTestId('inline-expand-section-label')).toHaveTextContent(
      'Backstage catalog entities registered from this repo',
    );
  });

  it('collapses again when chevron is clicked a second time', async () => {
    renderRow();
    const chevron = screen.getByTestId('inline-expand-chevron');

    act(() => {
      fireEvent.click(chevron); // expand
    });
    await waitFor(() => {
      expect(
        screen.getByTestId('inline-expand-child-table'),
      ).toBeInTheDocument();
    });

    act(() => {
      fireEvent.click(chevron); // collapse
    });
    // After collapsing, MUI Collapse hides the content (CSS-driven). The Collapse state
    // (isExpanded) flips immediately; the transition unmounts children after 300ms.
    // Verify the aria-expanded state reflects collapse immediately.
    expect(chevron).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders all child rows when expanded', async () => {
    renderRow({ children: [CHILD_A, CHILD_B] });
    act(() => {
      fireEvent.click(screen.getByTestId('inline-expand-chevron'));
    });
    await waitFor(() => {
      const childRows = screen.getAllByTestId('child-component-row');
      expect(childRows).toHaveLength(2);
    });
  });

  it('shows empty placeholder when children array is empty', async () => {
    renderRow({ children: [] });
    act(() => {
      fireEvent.click(screen.getByTestId('inline-expand-chevron'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('inline-expand-empty')).toHaveTextContent(
        'No child entities registered yet',
      );
    });
    expect(
      screen.queryByTestId('inline-expand-child-table'),
    ).not.toBeInTheDocument();
  });

  describe('keyboard interaction', () => {
    it('toggles expand on Enter key', async () => {
      renderRow();
      const chevron = screen.getByTestId('inline-expand-chevron');
      act(() => {
        fireEvent.keyDown(chevron, { key: 'Enter' });
      });
      await waitFor(() => {
        expect(
          screen.getByTestId('inline-expand-child-table'),
        ).toBeInTheDocument();
      });
    });

    it('toggles expand on Space key', async () => {
      renderRow();
      const chevron = screen.getByTestId('inline-expand-chevron');
      act(() => {
        fireEvent.keyDown(chevron, { key: ' ' });
      });
      await waitFor(() => {
        expect(
          screen.getByTestId('inline-expand-child-table'),
        ).toBeInTheDocument();
      });
    });

    it('does not toggle on other keys', () => {
      renderRow();
      const chevron = screen.getByTestId('inline-expand-chevron');
      act(() => {
        fireEvent.keyDown(chevron, { key: 'Tab' });
      });
      expect(
        screen.queryByTestId('inline-expand-child-table'),
      ).not.toBeInTheDocument();
    });
  });

  describe('sessionStorage persistence', () => {
    it('persists expanded state to sessionStorage on expand', () => {
      renderRow({ repoKey: 'zentala/persist-test' });
      act(() => {
        fireEvent.click(screen.getByTestId('inline-expand-chevron'));
      });
      const stored = JSON.parse(
        sessionStorage.getItem('catalog-coverage.expanded') ?? '[]',
      );
      expect(stored).toContain('zentala/persist-test');
    });

    it('removes key from sessionStorage on collapse', () => {
      renderRow({ repoKey: 'zentala/collapse-test' });
      const chevron = screen.getByTestId('inline-expand-chevron');
      act(() => {
        fireEvent.click(chevron); // expand
      });
      act(() => {
        fireEvent.click(chevron); // collapse
      });
      const stored = JSON.parse(
        sessionStorage.getItem('catalog-coverage.expanded') ?? '[]',
      );
      expect(stored).not.toContain('zentala/collapse-test');
    });

    it('loads expanded state from sessionStorage on mount', async () => {
      // Pre-seed sessionStorage as if a previous render had expanded the row
      sessionStorage.setItem(
        'catalog-coverage.expanded',
        JSON.stringify(['zentala/pre-expanded']),
      );
      renderRow({ repoKey: 'zentala/pre-expanded' });
      // The row should start expanded without clicking the chevron
      await waitFor(() => {
        expect(
          screen.getByTestId('inline-expand-child-table'),
        ).toBeInTheDocument();
      });
    });
  });

  it('passes aria-expanded attribute to chevron button', async () => {
    renderRow();
    const chevron = screen.getByTestId('inline-expand-chevron');
    expect(chevron).toHaveAttribute('aria-expanded', 'false');
    act(() => {
      fireEvent.click(chevron);
    });
    await waitFor(() => {
      expect(chevron).toHaveAttribute('aria-expanded', 'true');
    });
  });
});
