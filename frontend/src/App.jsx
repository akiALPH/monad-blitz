import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Terminal from './pages/Terminal';
import Dashboard from './pages/Dashboard';
import Vault from './pages/Vault';
import Collateral from './pages/Collateral';
import './App.css';

export default function App() {
  return (
    <Router>
      <div className="app">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/terminal" element={<Terminal />} />
          <Route path="/dashboard/:id" element={<Dashboard />} />
          <Route path="/vault" element={<Vault />} />
          <Route path="/collateral" element={<Collateral />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}
