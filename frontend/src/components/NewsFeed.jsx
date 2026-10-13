import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function NewsFeed({ compact = false }) {
  const [feed, setFeed] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { setFeed(await api.news()); setError(''); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  if (loading && !feed) return <p className="muted">Loading CoinDesk headlines…</p>;
  if (error && !feed) return <div><p className="error" role="alert">{error}</p><button className="btn ghost" onClick={load}>Retry</button></div>;
  const articles = compact ? feed.articles.slice(0, 3) : feed.articles;
  return <div className="news-feed">
    <div className="row between"><span className="muted small">Live headlines · {feed.source} · updated {new Date(feed.updatedAt).toLocaleTimeString()}</span><button className="btn ghost small" onClick={load} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button></div>
    {articles.map((article) => <a className="news-item news-link" href={article.url} key={article.url} target="_blank" rel="noopener noreferrer">
      <span className="news-copy"><strong>{article.title}</strong><span className="muted small">{new Date(article.publishedAt).toLocaleString()}</span></span><span aria-hidden="true">↗</span>
    </a>)}
    {compact && <Link className="small" to="/news">More news</Link>}
    {error && <p className="error small" role="alert">Refresh failed: {error}</p>}
  </div>;
}
