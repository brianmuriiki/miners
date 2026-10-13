export const PAPER_STARTING_CASH_CENTS = 1_000_000;
const QUANTITY_SCALE = 100_000_000;

export function readPaperTrades(storageKey) {
  const saved = localStorage.getItem(storageKey);
  if (saved === null) return [];
  const trades = JSON.parse(saved);
  if (!Array.isArray(trades) || trades.length > 2_000) throw new Error('Saved paper trade history is invalid.');
  return trades.filter((trade) => trade && typeof trade.id === 'string'
    && typeof trade.coinId === 'string' && typeof trade.symbol === 'string'
    && (trade.side === 'buy' || trade.side === 'sell')
    && Number.isSafeInteger(trade.quantityAtoms) && trade.quantityAtoms > 0
    && Number.isFinite(trade.priceUsd) && trade.priceUsd > 0
    && Number.isSafeInteger(trade.totalCents) && trade.totalCents > 0
    && typeof trade.createdAt === 'string');
}

export function paperAccount(trades, coinId) {
  let cashCents = PAPER_STARTING_CASH_CENTS;
  let heldAtoms = 0;
  for (const trade of trades) {
    cashCents += trade.side === 'buy' ? -trade.totalCents : trade.totalCents;
    if (trade.coinId === coinId) heldAtoms += trade.side === 'buy' ? trade.quantityAtoms : -trade.quantityAtoms;
  }
  return { cashCents, heldAtoms: Math.max(0, heldAtoms) };
}

export function parseCents(value) {
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ''] = value.trim().split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function parseQuantityAtoms(value) {
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,8})?$/.test(value.trim())) return null;
  const [whole, fraction = ''] = value.trim().split('.');
  const atoms = Number(whole) * QUANTITY_SCALE + Number(fraction.padEnd(8, '0'));
  return Number.isSafeInteger(atoms) ? atoms : null;
}

export function quantityFromCents(cents, priceUsd) {
  if (!Number.isSafeInteger(cents) || cents <= 0 || !Number.isFinite(priceUsd) || priceUsd <= 0) return null;
  const atoms = Math.floor((cents / 100 / priceUsd) * QUANTITY_SCALE);
  return Number.isSafeInteger(atoms) && atoms > 0 ? atoms : null;
}

export function quoteCents(quantityAtoms, priceUsd) {
  if (!Number.isSafeInteger(quantityAtoms) || quantityAtoms <= 0 || !Number.isFinite(priceUsd) || priceUsd <= 0) return null;
  const cents = Math.round((quantityAtoms / QUANTITY_SCALE) * priceUsd * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export function formatQuantity(atoms, maximumFractionDigits = 8) {
  return (atoms / QUANTITY_SCALE).toLocaleString(undefined, { maximumFractionDigits });
}
