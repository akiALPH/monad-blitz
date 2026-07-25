import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAssets, getStatus } from '../api';

export default function Vault() {
  const navigate = useNavigate();
  const [assets, setAssets] = useState([]);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    getAssets().then(setAssets).catch(() => {});
    getStatus().then(setStatus).catch(() => {});
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', padding: '24px' }}>
      {/* HEADER */}
      <div className="header">
        <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>
          VAULT · {assets.length} ASSETS
        </div>
        <div className="header-links">
          <a href="/">TAP</a>
          <a href="/collateral">COLLATERAL</a>
        </div>
      </div>

      {/* STATS */}
      {status && (
        <div style={{
          display: 'flex', gap: '24px', justifyContent: 'center',
          marginTop: '24px', marginBottom: '32px',
          fontSize: '12px', color: '#888',
        }}>
          <div><span style={{ color: '#06b6d4' }}>●</span> Wallet: {status.address?.slice(0,6)}...{status.address?.slice(-4)}</div>
          <div><span style={{ color: '#22c55e' }}>●</span> Balance: {parseFloat(status.balance || '0').toFixed(4)} MON</div>
          <div><span style={{ color: '#a78bfa' }}>●</span> Contract: {status.contract?.slice(0,6)}...{status.contract?.slice(-4)}</div>
        </div>
      )}

      {/* ASSETS GRID */}
      {assets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 24px', color: '#666' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>◌</div>
          <p>No assets minted yet.</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}
            style={{ marginTop: '16px' }}>
            TAP YOUR COIN TO MINT
          </button>
        </div>
      ) : (
        <div className="vault-grid" style={{ maxWidth: '960px', margin: '0 auto' }}>
          {assets.map((a, i) => (
            <div
              key={a.tokenId}
              className={`vault-card ${a.collateralized ? 'collateral-ready' : ''}`}
              onClick={() => navigate(`/dashboard/${a.tokenId}`)}
              style={{ cursor: 'pointer', animationDelay: `${i * 0.05}s` }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', color: '#06b6d4', fontWeight: '600' }}>
                  #{a.tokenId}
                </span>
                <span className={`tps-badge ${a.collateralized ? 'green' : 'cyan'}`}>
                  {a.collateralized ? 'COLLATERAL' : `${a.confirmTimeMs || 847}ms`}
                </span>
              </div>

              <div style={{ fontSize: '14px', marginBottom: '8px' }}>
                {a.name || `Luxvoid Asset #${a.tokenId}`}
              </div>

              <div style={{ fontSize: '11px', color: '#666', fontFamily: 'monospace' }}>
                TX: {a.txHash?.slice(0, 10)}...{a.txHash?.slice(-6)}
              </div>
              <div style={{ fontSize: '11px', color: '#666' }}>
                Block #{a.blockNumber} · {new Date(a.timestamp).toLocaleString()}
              </div>

              {a.lat && (
                <div style={{ fontSize: '11px', color: '#888', marginTop: '8px' }}>
                  📍 {(a.lat / 1e6).toFixed(4)}, {(a.lon / 1e6).toFixed(4)}
                </div>
              )}

              {a.collateralized && (
                <div style={{
                  marginTop: '12px', padding: '6px 12px',
                  background: 'rgba(34,197,94,0.08)',
                  border: '1px solid rgba(34,197,94,0.2)',
                  borderRadius: '6px', fontSize: '11px', color: '#22c55e',
                  textAlign: 'center',
                }}>
                  ✅ COLLATERAL READY — 70% LTV
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* BACK */}
      <div style={{ textAlign: 'center', marginTop: '32px' }}>
        <button className="btn btn-outline" onClick={() => navigate('/')}>
          ← NEW TAP
        </button>
      </div>
    </div>
  );
}
