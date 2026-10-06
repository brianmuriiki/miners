import { useEffect, useState } from 'react';
import './App.css';

function App() {
  const [status, setStatus] = useState('loading');
  const [blockchain, setBlockchain] = useState(null);

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/health');
        const data = await response.json();
        setStatus(data.status);
      } catch (error) {
        setStatus('offline');
      }
    };

    const loadBlockchain = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/blockchain');
        const data = await response.json();
        setBlockchain(data);
      } catch (error) {
        setBlockchain({ error: 'Blockchain unavailable' });
      }
    };

    loadStatus();
    loadBlockchain();
  }, []);

  return (
    <main className="wallet-shell">
      <section className="wallet-card">
        <div className="brand-row">
          <div className="brand-mark">C</div>
          <div>
            <p className="eyebrow">Wallet status</p>
            <h1>CryWallet</h1>
          </div>
        </div>

        <div className="balance-box">
          <span>Portfolio</span>
          <strong>$12,480.35</strong>
          <small>+2.14% today</small>
        </div>

        <div className="status-panel">
          <div>
            <p>API</p>
            <strong>{status}</strong>
          </div>
          <div>
            <p>Chain</p>
            <strong>{blockchain?.length ?? 0} blocks</strong>
          </div>
        </div>

        {blockchain && !blockchain.error && (
          <div className="block-panel">
            <p>Latest block hash</p>
            <code>{blockchain.chain?.[blockchain.chain.length - 1]?.hash}</code>
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
