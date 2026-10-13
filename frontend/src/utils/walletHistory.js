import { CWT_UNIT } from '../crychain/amounts.js';

export const HISTORY_WINDOWS = { '1H': 3_600_000, '1D': 86_400_000, '1W': 604_800_000, '1Y': 31_536_000_000 };

export function sampleBalanceHistory(history, duration, now = Date.now()) {
  const start = now - duration;
  const previous = history.filter((item) => item.timestamp < start).at(-1);
  const events = history.filter((item) => item.timestamp >= start).map((item) => ({ timestamp: item.timestamp, balance: item.balance / CWT_UNIT }));
  if (previous) events.unshift({ timestamp: start, balance: previous.balance / CWT_UNIT });
  if (!events.length) return Array(30).fill(history.at(-1)?.balance / CWT_UNIT || 0);
  return Array.from({ length: 30 }, (_, index) => {
    const timestamp = start + duration * index / 29;
    let current = events[0].balance;
    for (const event of events) { if (event.timestamp > timestamp) break; current = event.balance; }
    return current;
  });
}
