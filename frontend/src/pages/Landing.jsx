import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Landing() {
  const navigate = useNavigate();
  const [pulse, setPulse] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/status`)
      .then(r => r.json())
      .then(setStatus)
      .catch(() => setStatus({ status: 'offline' }));
  }, []);

  const handleTap = () => {
    setPulse(true);
    setTimeout(() => navigate('/terminal'), 600);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      textAlign: 'center',
      background: 'radial-gradient(ellipse at center, #0d0d1a 0%, #0a0a0f 100%)',
    }}>
      {/* STATUS BAR */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        display: 'flex', justifyContent: 'space-between',
        padding: '12px 24px', fontSize: '11px', color: '#666',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        <span>
          {status
            ? <><span style={{ color: '#22c55e' }}>●</span> {status.contract ? 'CONTRACT LIVE' : 'SETUP MODE'}</>
            : <><span style={{ color: '#f59e0b' }}>◌</span> CONNECTING...</>
          }
        </span>
        <span>MONAD TESTNET · 10K TPS</span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        {/* B3 BRAZIL HEADLINE */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '6px 14px', borderRadius: '20px',
          background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)',
          fontSize: '11px', color: '#22c55e', marginBottom: '32px',
          letterSpacing: '0.5px',
        }}>
          <span>●</span> BREAKING: BRAZIL B3 ACCEPTS TOKENIZED COWS AS COLLATERAL
        </div>

        {/* TITLE */}
        <h1 style={{
          fontSize: '48px', fontWeight: '300', color: '#fff',
          marginBottom: '8px', letterSpacing: '2px',
        }}>
          LUXVOID
        </h1>
        <p style={{
          fontSize: '16px', color: '#888', marginBottom: '48px',
          fontFamily: 'SF Mono, Fira Code, monospace',
        }}>
          Physical → Digital → Collateral
        </p>

        {/* COIN */}
        <motion.div
          className="coin-container"
          onClick={handleTap}
          animate={pulse ? { scale: [1, 0.95, 1.1, 0.9, 1] } : {}}
          transition={{ duration: 0.5 }}
          style={{ display: 'inline-block' }}
        >
          <div className="coin">
            <div className="coin-inner">
              <div style={{ fontSize: '10px', opacity: 0.6 }}>NFC</div>
              <div style={{ fontSize: '18px', color: '#1a1a2e' }}>●</div>
              <div style={{ fontSize: '10px', opacity: 0.6 }}>SEALED IN METAL</div>
            </div>
          </div>
        </motion.div>

        <p style={{
          marginTop: '24px', fontSize: '14px', color: '#06b6d4',
          cursor: 'pointer', transition: 'opacity 0.3s',
        }}
          onClick={handleTap}
        >
          [ TAP COIN TO INITIALIZE ]
        </p>
      </motion.div>

      {/* FOOTER */}
      <div style={{
        position: 'fixed', bottom: '24px',
        fontSize: '11px', color: '#444',
        textAlign: 'center',
      }}>
        {status?.balance
          ? `WALLET: ${status.address?.slice(0,6)}...${status.address?.slice(-4)} · ${parseFloat(status.balance).toFixed(4)} MON`
          : 'MONAD BLITZ TORONTO · 2026'
        }
      </div>
    </div>
  );
}
