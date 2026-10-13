import { Link } from 'react-router-dom';

export default function Help() {
  return <section className="card help-page"><h2>Help &amp; learning guide</h2>
    <details open><summary>What is CryChain?</summary><p>CryChain is CryWallet's educational blockchain. Mine CWT, send transactions, and inspect blocks to see how hashes and confirmations work. CWT has no monetary value.</p></details>
    <details><summary>Why are balances confirmed and available?</summary><p>Confirmed is the value recorded in mined blocks. Available subtracts outgoing transactions that are still pending.</p></details>
    <details><summary>How do I receive CWT?</summary><p>Copy your CryChain address from the dashboard and share it with another CryChain wallet.</p></details>
    <details><summary>How do referral rewards work?</summary><p>Share your referral link from Rewards. When a referred account verifies its email, you can receive a 100 CWT bonus by mining a block. Each referred wallet can earn the bonus once.</p><p><Link to="/rewards">Open Rewards</Link></p></details>
    <details><summary>Where is my CryChain recovery phrase stored?</summary><p>Your private key stays in this browser's encrypted keystore. CryWallet only receives your public key and signed transactions. Save the recovery phrase shown at registration; losing both the browser keystore and phrase means losing access to that wallet.</p></details>
    <details><summary>What is Web3 mode?</summary><p>Web3 mode connects to Ethereum Sepolia. Use test ETH only; wallet signing happens in your browser.</p><p><Link to="/web3">Open Web3 mode</Link></p></details>
    <details><summary>Where do market, forex, and news data come from?</summary><p>Crypto market reference prices come from CoinPaprika, daily forex reference rates come from Frankfurter, and headlines come from CoinDesk's RSS feed. Forex graphs are not intraday trading quotes. Data can be delayed or unavailable if a provider is down.</p><p><Link to="/forex">View forex graphs</Link></p></details>
    <details><summary>Can I connect an exchange account?</summary><p>No. CryWallet currently shows only its own Learn and Sepolia wallet modes; it does not connect to Coinbase, Binance, or other exchange accounts.</p></details>
  </section>;
}
