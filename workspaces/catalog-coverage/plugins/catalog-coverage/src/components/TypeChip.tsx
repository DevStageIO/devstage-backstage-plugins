/**
 * TypeChip — renders a small MUI Chip indicating whether the GitHub account
 * owner is a personal user ("Personal") or an organization ("Org").
 *
 * Returns null for `Unknown` so the cell stays empty.
 * Size: small, variant: outlined.
 */
import { Chip } from '@material-ui/core';

export type AccountType = 'User' | 'Organization' | 'Unknown';

export interface TypeChipProps {
  accountType: AccountType;
}

const LABEL: Record<Exclude<AccountType, 'Unknown'>, string> = {
  User: 'Personal',
  Organization: 'Org',
};

/**
 * Small outlined chip for User or Organization accounts.
 * Hidden (returns null) when accountType is Unknown.
 */
export const TypeChip = ({ accountType }: TypeChipProps) => {
  if (accountType === 'Unknown') return null;
  return (
    <Chip
      size="small"
      variant="outlined"
      label={LABEL[accountType]}
      data-testid={`type-chip-${accountType.toLowerCase()}`}
    />
  );
};
