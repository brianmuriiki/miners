import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';

const PAIRS = [
  ['USD-KES', 'USD/KES · US dollar to Kenyan shilling'],
  ['EUR-USD', 'EUR/USD · Euro to US dollar'],
  ['GBP-USD', 'GBP/USD · British pound to US dollar'],
  ['USD-JPY', 'USD/JPY · US dollar to Japanese yen'],
  ['USD-CAD', 'USD/CAD · US dollar to Canadian dollar'],
  ['AUD-USD', 'AUD/USD · Australian dollar to US dollar'],
];
const PERIODS = ['1M', '3M', '6M', '1Y'];
const number = (value) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 6 });
const dateLabel = (date) => new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });

function RateChart({ data }) {
  const values = data.points.map((point) => point.rate);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = max === min ? Math.max(max * 0.002, 0.001) : (max - min) * 0.12;
  const low = Math.max(0, min - padding);
  const high = max + padding;
  const x = (index) => 52 + index / Math.max(values.length - 1, 1) * 686;
  const y = (value) => 18 + (high - value) / (high - low) * 188;
  const line = data.points.map((point, index) => `${index ? 'L' : 'M'}${x(index)},${y(point.rate)}`).join(' ');
  const area = `${line} L${x(values.length - 1)},220 L${x(0)},220 Z`;
  const ticks = [0, 1, 2, 3].map((step) => high - (high - low) * step / 3);
  const description = `${data.label}, ${data.period} daily reference rates. From ${dateLabel(data.points[0].date)} at ${number(values[0])} ${data.quote} per ${data.base} to ${dateLabel(data.updatedAt)} at ${number(values.at(-1))}. Range ${number(min)} to ${number(max)}.`;

  return <>
    <div className="forex-chart-wrap">
      <svg className="forex-chart" viewBox="0 0 760 250" role="img" aria-label={description}>
        <defs><linearGradient id="forex-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".28" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></linearGradient></defs>
        {ticks.map((tick, index) => <g key={index}>
          <line x1="52" x2="738" y1={18 + index * 188 / 3} y2={18 + index * 188 / 3} stroke="var(--border)" strokeDasharray="4 5" />
          <text x="44" y={22 + index * 188 / 3} textAnchor="end" fill="var(--muted)" fontSize="11">{number(tick)}</text>
        </g>)}
        <path d={area} fill="url(#forex-fill)" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        <text x="52" y="244" fill="var(--muted)" fontSize="11">{dateLabel(data.points[0].date)}</text>
        <text x="738" y="244" textAnchor="end" fill="var(--muted)" fontSize="11">{dateLabel(data.updatedAt)}</text>
      </svg>
    </div>
    <details className="forex-data"><summary>View daily chart data</summary>
      <div className="market-scroll"><table className="mkt"><caption className="sr-only">Daily {data.base} to {data.quote} reference rates</caption>
        <thead><tr><th scope="col">Date</th><th scope="col">{data.quote} per {data.base}</th></tr></thead>
        <tbody>{data.points.map((point) => <tr key={point.date}><td>{dateLabel(point.date)}</td><td>{number(point.rate)}</td></tr>)}</tbody>
      </table></div>
    </details>
  </>;
}

export default function Forex() {
  const [pair, setPair] = useState('USD-KES');
  const [period, setPeriod] = useState('3M');
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setData(null);
    api.forexHistory(pair, period)
      .then((result) => { if (active) setData(result); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [pair, period, refresh]);

  const stats = useMemo(() => {
    if (!data?.points?.length) return null;
    const first = data.points[0];
    const latest = data.points.at(-1);
    const change = first.rate === 0 ? 0 : (latest.rate / first.rate - 1) * 100;
    const rates = data.points.map((point) => point.rate);
    return { latest, change, min: Math.min(...rates), max: Math.max(...rates) };
  }, [data]);

  return <section className="card forex-page" aria-labelledby="forex-title">
    <div><h2 id="forex-title">Forex reference rates</h2><p className="muted small">Daily central-bank and official-source reference rates. These are not live trading quotes and may not match a provider’s buy or sell price.</p></div>
    <div className="forex-controls">
      <label>Currency pair<select value={pair} onChange={(event) => setPair(event.target.value)}>
        {PAIRS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select></label>
      <div><span className="control-label" id="forex-period-label">History</span><div className="tabs" role="group" aria-labelledby="forex-period-label">
        {PERIODS.map((item) => <button key={item} type="button" aria-pressed={period === item} className={period === item ? 'tab on' : 'tab'} onClick={() => setPeriod(item)}>{item}</button>)}
      </div></div>
      <button type="button" className="btn ghost" onClick={() => setRefresh((value) => value + 1)} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
    </div>
    {loading && <p className="muted" role="status">Loading daily exchange-rate history…</p>}
    {error && <div><p className="error" role="alert">{error}</p><button type="button" className="btn ghost" onClick={() => setRefresh((value) => value + 1)}>Retry</button></div>}
    {data && stats && <>
      <div className="forex-summary" aria-label="Selected exchange-rate summary">
        <div><span className="muted small">Latest reference</span><strong>{number(stats.latest.rate)} <small>{data.quote} per {data.base}</small></strong><span className="muted small">{dateLabel(data.updatedAt)}</span></div>
        <div><span className="muted small">Change over period</span><strong className={stats.change >= 0 ? 'pos' : 'negative'}>{stats.change > 0 ? '+' : ''}{stats.change.toFixed(2)}%</strong><span className="muted small">{data.period}</span></div>
        <div><span className="muted small">Period range</span><strong>{number(stats.min)} – {number(stats.max)}</strong><span className="muted small">{data.quote} per {data.base}</span></div>
      </div>
      <RateChart data={data} />
      <p className="muted small">Source: {data.source}. Latest available observation: {dateLabel(data.updatedAt)}. {data.points.length} observations.</p>
    </>}
  </section>;
}
