import NewsFeed from '../components/NewsFeed.jsx';

export default function News() {
  return <section className="card"><h2>Crypto news</h2><p className="muted small">Headlines provided by CoinDesk. Selecting a headline opens the publisher's article.</p><NewsFeed /></section>;
}
