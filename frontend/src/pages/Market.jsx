import MarketList from '../components/MarketList.jsx';
import CoinChart from '../components/CoinChart.jsx';
import { useParams } from 'react-router-dom';

export default function Market() {
  const { coinId } = useParams();
  return <section className="card"><h2>Crypto market</h2><p className="muted small">Live reference prices for BTC, ETH, SOL, BNB, XRP, ADA, and DOGE. These prices are informational and do not mean the assets are available to send from this wallet. CWT has no market price.</p>{coinId ? <CoinChart coinId={coinId} /> : <MarketList />}</section>;
}
