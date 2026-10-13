import { formatUnits, parseUnits } from 'ethers';

export const CWT_UNIT = 100_000_000;
export const formatCwt = (baseUnits) => {
  const [whole, fraction] = formatUnits(BigInt(baseUnits || 0), 8).split('.');
  const trimmed = fraction?.replace(/0+$/, '');
  return trimmed ? `${whole}.${trimmed}` : whole;
};
export const parseCwt = (value) => {
  const units = parseUnits(value, 8);
  if (units <= 0n || units > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Amount must be positive and within the safe account limit.');
  return Number(units);
};

export const parseCwtFee = (value) => {
  const units = parseUnits(value, 8);
  if (units < 0n || units > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Fee must be nonnegative and within the safe account limit.');
  return Number(units);
};
