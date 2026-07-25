import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAssets, setCollateral } from '../api';

const LTV_OPTIONS = [30, 50, 60, 70, 80];
const ASSET_VALUE = 2500; // $2,500 notional per asset

export default function Collateral() {
  const navigate = useNavigate();
  const [assets, setAssets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [ltv, setLtv] = useState(70);
  const [borrowAmount, setBorrowAmount] = useState(0);

  useEffect(() => {
    getAssets().then(all => {
      setAssets(all);
      if (all.length > 0) setSelectedId(all[0].tokenId);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const eligibleCount = assets.filter(a => a.collateralized).length || 1;
    setBorrowAmount(eligibleCount * ASSET_VALUE * (ltv / 100));
  }, [ltv, assets]);

  const handleCollateralize = async (tokenId) => {
    try {
      await setCollateral(tokenId, true);
      const updated = await getAssets();
      setAssets(updated);
    } catch (e) {
      alert('Failed: ' + e.message);
    }
  };

  const eligible = assets.filter(a => a.collateralized);
  const pending = assets.filter(a => !a.collateralized);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', padding: '24px' }}>
      {/* HEADER */}
      <div className="header">
        <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>
          DEFI COLLATERAL POOL
        </div>
        <div className="header-links">
          <a href="/">TAP</a>
          <a href="/vault">VAULT</a>
        </div>
      </div>

      {/* BRAZIL B3 NARRATIVE */}
      <div style={{
        maxWidth: '800px', margin: '24px auto',
        padding: '16px 20px',
        background: 'rgba(34,197,94,0.05)',
        border: '1px solid rgba(34,197,94,0.15)',
        borderRadius: '12px',
        fontSize: '12px', color: '#22c55e',
        textAlign: 'center',
      }}>
        <strong>● BRAZIL B3 STOCK EXCHANGE</strong> — Dairy farm tokenized 10 cows as R$100K loan collateral.
        Luxvoid provides the physical proof layer B3 is missing.
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '24px', maxWidth: '960px', margin: '0 auto',
      }}>
        {/* LEFT: POOL STATS */}
        <div>
          <div className="dash-card">
            <div className="dash-card-title">● POOL STATS</div>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#fff' }}>
                {eligible.length}
              </div>
              <div style={{ fontSize: '12px', color: '#888' }}>
                Assets collateralized
              </div>
            </div>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#22c55e' }}>
                ${borrowAmount.toLocaleString()}
              </div>
              <div style={{ fontSize: '12px', color: '#888' }}>
                Total borrow power at {ltv}% LTV
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>
                Loan-to-Value Ratio
              </div>
              <input
                type="range"
                className="ltv-slider"
                min="30" max="80" step="10"
                value={ltv}
                onChange={e => setLtv(parseInt(e.target.value))}
              />
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: '11px', color: '#666', marginTop: '4px',
              }}>
                {LTV_OPTIONS.map(v => (
                  <span key={v} style={{ color: ltv === v ? '#06b6d4' : '#666' }}>{v}%</span>
                ))}
              </div>
            </div>

            {/* INTEREST RATE */}
            <div style={{ marginTop: '20px' }}>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>
                Est. Interest Rate
              </div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#f59e0b' }}>
                {ltv <= 50 ? '4.2%' : ltv <= 70 ? '6.8%' : '9.5%'} APR
              </div>
            </div>

            <div style={{ marginTop: '20px' }}>
              <div className="tps-badge cyan" style={{ display: 'inline-flex', marginRight: '8px' }}>
                MONAD 10K TPS
              </div>
              <div className="tps-badge green" style={{ display: 'inline-flex' }}>
                ZERO ORACLE
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: ASSET LIST */}
        <div>
          <div className="dash-card">
            <div className="dash-card-title">● YOUR ASSETS</div>

            {eligible.length > 0 && (
              <>
                <div style={{ fontSize: '11px', color: '#22c55e', marginBottom: '12px', letterSpacing: '1px' }}>
                  COLLATERALIZED ({eligible.length})
                </div>
                {eligible.map(a => (
                  <div key={a.tokenId} style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    background: 'rgba(34,197,94,0.05)',
                    border: '1px solid rgba(34,197,94,0.15)',
                    borderRadius: '8px', marginBottom: '8px',
                    fontSize: '13px',
                  }}>
                    <span>#{a.tokenId}</span>
                    <span style={{ color: '#22c55e' }}>
                      ${(ASSET_VALUE * ltv / 100).toLocaleString()} borrow
                    </span>
                  </div>
                ))}
              </>
            )}

            {pending.length > 0 && (
              <>
                <div style={{
                  fontSize: '11px', color: '#888', marginTop: pending.length > 0 ? '16px' : 0,
                  marginBottom: '12px', letterSpacing: '1px',
                }}>
                  READY TO COLLATERALIZE ({pending.length})
                </div>
                {pending.map(a => (
                  <div key={a.tokenId} style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '8px', marginBottom: '8px',
                    fontSize: '13px',
                  }}>
                    <span>#{a.tokenId}</span>
                    <button
                      className="btn btn-gold"
                      onClick={() => handleCollateralize(a.tokenId)}
                      style={{ padding: '4px 12px', fontSize: '11px' }}
                    >
                      COLLATERALIZE
                    </button>
                  </div>
                ))}
              </>
            )}

            {assets.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666', fontSize: '13px' }}>
                No assets found. Tap your coin first.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* NAV */}
      <div style={{ textAlign: 'center', marginTop: '32px' }}>
        <button className="btn btn-outline" onClick={() => navigate('/')}>
          ← TAP NEW ASSET
        </button>
      </div>
    </div>
  );
}
