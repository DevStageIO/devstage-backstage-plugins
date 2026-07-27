import { render, screen } from '@testing-library/react';
import { TypeChip, TypeChipProps } from './TypeChip';

const renderChip = (accountType: TypeChipProps['accountType']) =>
  render(<TypeChip accountType={accountType} />);

describe('TypeChip', () => {
  it('renders "Personal" label for User accountType', () => {
    renderChip('User');
    expect(screen.getByText('Personal')).toBeInTheDocument();
  });

  it('renders "Org" label for Organization accountType', () => {
    renderChip('Organization');
    expect(screen.getByText('Org')).toBeInTheDocument();
  });

  it('renders nothing for Unknown accountType', () => {
    const { container } = renderChip('Unknown');
    expect(container.firstChild).toBeNull();
  });

  it('has correct data-testid for User', () => {
    renderChip('User');
    expect(screen.getByTestId('type-chip-user')).toBeInTheDocument();
  });

  it('has correct data-testid for Organization', () => {
    renderChip('Organization');
    expect(screen.getByTestId('type-chip-organization')).toBeInTheDocument();
  });
});
