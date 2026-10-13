import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Auth from './pages/Auth.jsx';
import AccountRecovery from './pages/AccountRecovery.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Send from './pages/Send.jsx';
import Receive from './pages/Receive.jsx';
import Transactions from './pages/Transactions.jsx';
import TransactionDetail from './pages/TransactionDetail.jsx';
import Blockchain from './pages/Blockchain.jsx';
import Portfolio from './pages/Portfolio.jsx';
import Help from './pages/Help.jsx';
import Settings from './pages/Settings.jsx';
import Market from './pages/Market.jsx';
import News from './pages/News.jsx';
import Trade from './pages/Trade.jsx';
import BuyCrypto from './pages/BuyCrypto.jsx';
import Rewards from './pages/Rewards.jsx';
const Forex = lazy(() => import('./pages/Forex.jsx'));
const Web3Wallet = lazy(() => import('./pages/Web3Wallet.jsx'));

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <p className="center muted">Loading your session…</p>;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

export default function App() {
  const { user } = useAuth();
  return <Routes>
    <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Auth mode="login" />} />
    <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <Auth mode="register" />} />
    <Route path="/verify-email" element={<AccountRecovery mode="verify" />} />
    <Route path="/forgot-password" element={<AccountRecovery mode="forgot" />} />
    <Route path="/reset-password" element={<AccountRecovery mode="reset" />} />
    <Route path="/web3" element={<Suspense fallback={<p className="center muted">Loading Web3 mode…</p>}><Web3Wallet /></Suspense>} />
    <Route element={<Protected />}>
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/send" element={<Send />} />
        <Route path="/receive" element={<Receive />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/transactions/:id" element={<TransactionDetail />} />
        <Route path="/blockchain" element={<Blockchain />} />
        <Route path="/market" element={<Market />} />
        <Route path="/market/:coinId" element={<Market />} />
        <Route path="/trade" element={<Trade />} />
        <Route path="/buy" element={<BuyCrypto />} />
        <Route path="/rewards" element={<Rewards />} />
        <Route path="/forex" element={<Suspense fallback={<p className="center muted">Loading forex graphs…</p>}><Forex /></Suspense>} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/news" element={<News />} />
        <Route path="/help" element={<Help />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Route>
    <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
  </Routes>;
}
