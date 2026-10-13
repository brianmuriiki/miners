import React from 'react';
import { createRoot } from 'react-dom/client';
import MinerApp from './MinerApp.jsx';
import './style.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><MinerApp /></React.StrictMode>);
