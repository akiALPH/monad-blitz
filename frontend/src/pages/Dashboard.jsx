import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAssets, transferAsset, setCollateral, getRoyalty } from '../api';

export default function Dashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [asset, setAsset] = useState(null);
  const [royalty, setRoyalty] = useState(null);
  const [transferTo, setTransferTo] = useState('');
  const [transferResult, setTransferResult] = useState(null);
  const [collateralStatus, setCollateralStatus] = useState(false);

  useEffect(() => {
    getAssets().then(all => {
      const a = all.find(x => x.tokenId === id);
      if (a) {
        setAsset(a);
        setCollateralStatus(a.collateralized);
      }
    });
    getRoyalty(id).then(setRoyalty).catch(() => {});
  }, [id]);

  const handleTransfer = async () => {
    if (!transferTo || !transferTo.startsWith('0x')) return;
    try {
      const res = await transferAsset(id, transferTo);
      setTransferResult(res);
    } catch (e) {
      setTransferResult({ error: e.message });
    }
  };

  const handleCollateralize = async () => {
    try {
      const res = await setCollateral(id, !collateralStatus);
      setCollateralStatus(res.collateralized);
    } catch (e) {
      alert('Failed: ' + e.message);
    }
  };

  if (!asset) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: '#666' }}>
        Loading asset #{id}...
      </div>
    );
  }

  const latDeg = asset.lat / 1e6;
  const lonDeg = asset.lon / 1e6;

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', padding: '24px' }}>
      {/* NAV */}
      <div className="header">
        <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>
          MONAD BLITZ · ASSET #{asset.tokenId}
        </div>
        <div className="header-links">
          <a href="/">TAP</a>
          <a href="/vault">VAULT</a>
          <a href="/collateral">COLLATERAL</a>
        </div>
      </div>

      {/* TPS BADGE */}
      <div style={{ textAlign: 'center', marginTop: '24px', marginBottom: '32px' }}>
        <div className="tps-badge green" style={{ display: 'inline-flex' }}>
          ⚡ MONAD 10K TPS — CONFIRMED IN {asset.confirmTimeMs || 847}ms
        </div>
      </div>

      {/* 3-COLUMN DASHBOARD */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '16px',
        maxWidth: '960px',
        margin: '0 auto 32px',
      }}>
        {/* COL 1: TRANSFER */}
        <div className="dash-card slide-up">
          <div className="dash-card-title">● TRANSFER</div>
          <div className="dash-card-value" style={{ fontSize: '13px', color: '#888', fontFamily: 'monospace' }}>
            {asset.txHash?.slice(0, 10)}...{asset.txHash?.slice(-6)}
          </div>
          <div className="dash-card-label" style={{ marginBottom: '16px' }}>
            Block #{asset.blockNumber} · {new Date(asset.timestamp).toLocaleTimeString()}
          </div>

          {transferResult ? (
            <div style={{ fontSize: '13px', color: transferResult.error ? '#ef4444' : '#22c55e' }}>
              {transferResult.error
                ? `❌ ${transferResult.error}`
                : `✅ Transferred. TX: ${transferResult.txHash?.slice(0, 10)}...`}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                placeholder="0x..."
                value={transferTo}
                onChange={e => setTransferTo(e.target.value)}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(0,0,0,0.3)', color: '#fff',
                  fontSize: '12px', fontFamily: 'monospace',
                }}
              />
              <button className="btn btn-primary" onClick={handleTransfer}
                disabled={!transferTo.startsWith('0x')}
                style={{ padding: '8px 16px', fontSize: '12px' }}>
                SEND
              </button>
            </div>
          )}
        </div>

        {/* COL 2: ROYALTY */}
        <div className="dash-card slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="dash-card-title">● ROYALTY</div>
          <div className="dash-card-value" style={{ color: '#a78bfa' }}>
            {royalty?.royaltyPercent || 5}%
          </div>
          <div className="dash-card-label">On secondary sales</div>
          <div style={{ marginTop: '12px', fontSize: '12px', color: '#666', fontFamily: 'monospace' }}>
            Receiver: {royalty?.receiver
              ? `${royalty?.receiver.slice(0, 6)}...${royalty?.receiver.slice(-4)}`
              : (import.meta.env.VITE_MINTER_ADDR || '0x596e...')
            }
          </div>
          <div style={{ marginTop: '8px' }}>
            <div className="tps-badge cyan" style={{ display: 'inline-flex' }}>
              PATENT #5 — PPT LIFECYCLE
            </div>
          </div>
        </div>

        {/* COL 3: GEO */}
        <div className="dash-card slide-up" style={{ animationDelay: '0.2s' }}>
          <div className="dash-card-title">● GEOLOCATION</div>
          <div className="dash-card-value" style={{ fontSize: '18px' }}>
            {latDeg.toFixed(4)}, {lonDeg.toFixed(4)}
          </div>
          <div className="dash-card-label">
            Stamped on-chain at block #{asset.blockNumber}
          </div>
          <div className="simple-map" style={{ marginTop: '12px' }}>
            <div className="map-pin" style={{
              left: `${((lonDeg + 180) / 360) * 100}%`,
              top: `${((90 - latDeg) / 180) * 100}%`,
            }} />
          </div>
        </div>
      </div>

      {/* COLLATERAL ACTION */}
      <div style={{ textAlign: 'center', marginTop: '24px' }}>
        <button
          className={`btn ${collateralStatus ? 'btn-success' : 'btn-gold'}`}
          onClick={handleCollateralize}
        >
          {collateralStatus
            ? '✅ COLLATERALIZED — READY FOR DEFI'
            : '🔒 FLAG AS COLLATERAL'
          }
        </button>
        <div style={{ marginTop: '12px' }}>
          <button
            className="btn btn-outline"
            onClick={() => navigate('/collateral')}
            style={{ marginRight: '8px' }}
          >
            VIEW COLLATERAL POOL
          </button>
          <button className="btn btn-outline" onClick={() => navigate('/vault')}>
            VAULT
          </button>
        </div>
      </div>
    </div>
  );
}
