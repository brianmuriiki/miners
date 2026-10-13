import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutGrid, BarChart3, Briefcase, ArrowLeftRight, Send, Download, LineChart, Boxes, Globe, Newspaper, HelpCircle, Settings, MoreHorizontal, Gift, ShoppingCart } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import RightPanel from './RightPanel.jsx';
import SearchBox from './SearchBox.jsx';

const links = [
  ['/dashboard', 'Dashboard', LayoutGrid], ['/market', 'Market', BarChart3], ['/buy', 'Buy Crypto', ShoppingCart], ['/trade', 'Trade', ArrowLeftRight], ['/rewards', 'Rewards', Gift], ['/portfolio', 'Portfolio', Briefcase],
  ['/send', 'Send', Send], ['/receive', 'Receive', Download], ['/transactions', 'Transactions', ArrowLeftRight], ['/forex', 'Forex', LineChart], ['/blockchain', 'Blockchain', Boxes], ['/web3', 'Web3', Globe],
  ['/news', 'News', Newspaper], ['/help', 'Help', HelpCircle], ['/settings', 'Setting', Settings],
];
const mobileLinks = links.filter(([to]) => ['/dashboard', '/send', '/receive', '/transactions'].includes(to));
const moreLinks = links.filter(([to]) => !mobileLinks.some(([mobileTo]) => mobileTo === to));

export default function Layout() {
  const { user } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  return <div className="app"><div className="frame">
    <aside className="side">
      <div className="brand"><span className="logo">C</span>CryWallet</div>
      <nav aria-label="Main navigation">{links.map(([to, label, Icon]) => <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'navlink active' : 'navlink'}><Icon size={18} />{label}</NavLink>)}</nav>
    </aside>
    <main className="content">
      <header className="top"><h1>Hi, {user.username}</h1><SearchBox /></header>
      <Outlet />
    </main>
    <RightPanel />
  </div>
  <nav className="mobile-nav" aria-label="Quick navigation">
    {mobileLinks.map(([to, label, Icon]) => <NavLink key={to} to={to} aria-label={label} onClick={() => setMoreOpen(false)} className={({ isActive }) => isActive ? 'mobile-navlink active' : 'mobile-navlink'}><Icon size={19} /><span>{label}</span></NavLink>)}
    <button className={moreOpen ? 'mobile-navlink active' : 'mobile-navlink'} aria-expanded={moreOpen} aria-controls="mobile-more-menu" onClick={() => setMoreOpen((open) => !open)}><MoreHorizontal size={19} /><span>More</span></button>
  </nav>
  {moreOpen && <nav id="mobile-more-menu" className="mobile-more" aria-label="More navigation">
    {moreLinks.map(([to, label, Icon]) => <NavLink key={to} to={to} className="navlink" onClick={() => setMoreOpen(false)}><Icon size={18} />{label}</NavLink>)}
  </nav>}
  </div>;
}
