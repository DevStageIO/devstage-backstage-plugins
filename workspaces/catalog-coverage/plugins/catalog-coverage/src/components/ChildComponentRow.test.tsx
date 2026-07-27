import { render, screen, fireEvent } from '@testing-library/react';
import { Table, TableBody } from '@material-ui/core';
import { ChildComponentRow } from './ChildComponentRow';

/**
 * Wraps ChildComponentRow in a proper table structure required by MUI.
 */
const renderRow = (props: Parameters<typeof ChildComponentRow>[0]) =>
  render(
    <Table>
      <TableBody>
        <ChildComponentRow {...props} />
      </TableBody>
    </Table>,
  );

const BASE_PROPS = {
  entityRef: 'component:default/my-service',
  kind: 'Component',
  type: 'service',
  name: 'my-service',
};

describe('ChildComponentRow', () => {
  it('renders the entity name', () => {
    renderRow(BASE_PROPS);
    expect(screen.getByTestId('child-entity-name')).toHaveTextContent(
      'my-service',
    );
  });

  it('renders the entity ref', () => {
    renderRow(BASE_PROPS);
    expect(screen.getByTestId('child-entity-ref')).toHaveTextContent(
      'component:default/my-service',
    );
  });

  it('renders kind and type label', () => {
    renderRow(BASE_PROPS);
    expect(screen.getByText('Component/service')).toBeInTheDocument();
  });

  it('shows score when provided', () => {
    renderRow({ ...BASE_PROPS, score: 87 });
    expect(screen.getByTestId('child-entity-score')).toHaveTextContent('87%');
  });

  it('shows dash when score is absent', () => {
    renderRow(BASE_PROPS); // no score
    expect(screen.getByTestId('child-entity-score-absent')).toHaveTextContent(
      '—',
    );
    expect(screen.queryByTestId('child-entity-score')).not.toBeInTheDocument();
  });

  it('renders the actions cell', () => {
    renderRow(BASE_PROPS);
    expect(screen.getByTestId('child-actions-cell')).toBeInTheDocument();
  });

  it('calls onOpenCatalog when catalog button clicked', () => {
    const onOpenCatalog = jest.fn();
    renderRow({ ...BASE_PROPS, onOpenCatalog });
    fireEvent.click(screen.getByRole('button', { name: /open in catalog/i }));
    expect(onOpenCatalog).toHaveBeenCalledWith('component:default/my-service');
  });

  it('calls onViewSource when source button clicked', () => {
    const onViewSource = jest.fn();
    const sourceUrl =
      'https://github.com/zentala/my-service/blob/main/catalog-info.yaml';
    renderRow({ ...BASE_PROPS, onViewSource, sourceUrl });
    fireEvent.click(screen.getByRole('button', { name: /view source file/i }));
    expect(onViewSource).toHaveBeenCalledWith(sourceUrl);
  });

  it('does not render source button when sourceUrl is absent', () => {
    const onViewSource = jest.fn();
    renderRow({ ...BASE_PROPS, onViewSource }); // no sourceUrl
    expect(
      screen.queryByRole('button', { name: /view source/i }),
    ).not.toBeInTheDocument();
  });
});
