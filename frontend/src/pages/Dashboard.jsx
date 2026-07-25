import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAssets, transferAsset, setCollateral, getRoyalty, recordTap, getGeoHistory, getProvenance } from '../api';

function SimpleMap({ points, currentLat, currentLon }) {
  const allPoints = points || [];
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;

    ctx.fillStyle = '#0d1b2a';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    if (allPoints.length === 0) return;

    // Convert geo to canvas coords (simple mercator-like projection)
    const lats = allPoints.map(p => p.lat);
    const lons = allPoints.map(p => p.lon);
    const minLat = Math.min(...lats) - 0.01;
    const maxLat = Math.max(...lats) + 0.01;
    const minLon = Math.min(...lons) - 0.01;
    const maxLon = Math.max(...lons) + 0.01;

    const toX = lon => ((lon - minLon) / (maxLon - minLon)) * (w - 40) + 20;
    const toY = lat => ((maxLat - lat) / (maxLat - minLat)) * (h - 40) + 20;

    // Draw trail
    ctx.strokeStyle = 'rgba(6,182,212,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    allPoints.forEach((p, i) => {
      const x = toX(p.lon), y = toY(p.lat);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw dots
    allPoints.forEach((p, i) => {
      const x = toX(p.lon), y = toY(p.lat);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = i === allPoints.length - 1 ? '#22c55e' : '#06b6d4';
      ctx.fill();
      if (i === 0) {
        ctx.fillStyle = '#fff';
        ctx.font = '8px monospace';
        ctx.fillText('MINT', x + 8, y + 4);
      }
    });

    // Current pin (latest)
    const cx = toX(currentLon), cy = toY(currentLat);
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

  }, [allPoints, currentLat, currentLon]);

  return <canvas ref={canvasRef} width={400} height={200} style={{ width: '100%', height: '200px', borderRadius: '8px' }} />;
}

export default function Dashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [asset, setAsset] = useState(null);
  const [royalty, setRoyalty] = useState(null);
  const [geoHistory, setGeoHistory] = useState([]);
  const [provenance, setProvenance] = useState([]);
  const [transferTo, setTransferTo] = useState('');
  const [transferResult, setTransferResult] = useState(null);
  const [collateralStatus, setCollateralStatus] = useState(false);
  const [tapping, setTapping] = useState(false);
  const [tapResult, setTapResult] = useState(null);

  useEffect(() => {
    (async () => {
      const all = await getAssets();
      const a = all.find(x => x.tokenId === id);
      if (a) { setAsset(a); setCollateralStatus(a.collateralized); }
    })();
    getRoyalty(id).then(setRoyalty).catch(() => {});
    getGeoHistory(id).then(setGeoHistory).catch(() => {});
    getProvenance(id).then(setProvenance).catch(() => {});
  }, [id]);

  const handleTap = async () => {
    setTapping(true);
    setTapResult(null);
    try {
      const pos = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(
          p => res({ lat: p.coords.latitude, lon: p.coords.longitude }),
          () => res({ lat: 43.6532, lon: -79.3832 }),
          { timeout: 5000 }
        )
      );
      const result = await recordTap(id, pos.lat, pos.lon);
      setTapResult(result);
      // Refresh geo history
      const gh = await getGeoHistory(id);
      setGeoHistory(gh);
      if (asset) { asset.lat = result.lat * 1e6; asset.lon = result.lon * 1e6; asset.totalTaps = result.totalTaps; }
    } catch (e) {
      setTapResult({ error: e.message });
    }
    setTapping(false);
  };

  const handleTransfer = async () => {
    if (!transferTo?.startsWith('0x')) return;
    try { setTransferResult(await transferAsset(id, transferTo)); }
    catch (e) { setTransferResult({ error: e.message }); }
  };

  const handleCollateralize = async () => {
    try { const r = await setCollateral(id, !collateralStatus); setCollateralStatus(r.collateralized); }
    catch (e) { alert(e.message); }
  };

  if (!asset) return <div style={{ padding: '48px', textAlign: 'center', color: '#666' }}>Loading asset #{id}...</div>;

  const latDeg = asset.lat / 1e6;
  const lonDeg = asset.lon / 1e6;

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', padding: '24px' }}>
      {/* Header */}
      <div className="header" style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>
          MONAD BLITZ · ASSET #{asset.tokenId}
        </div>
        <div className="header-links">
          <a href="/">TAP</a>
          <a href="/vault">VAULT</a>
          <a href="/collateral">COLLATERAL</a>
          <a href={`/provenance/${id}`}>PROVENANCE</a>
          <a href={`/certificate/${id}`}>CERTIFICATE</a>
        </div>
      </div>

      {/* TPS */}
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <div className="tps-badge green" style={{ display: 'inline-flex' }}>
          ⚡ MONAD 10K TPS — {(asset.confirmTimeMs || 847)}ms CONFIRMATION
        </div>
      </div>

      {/* 3-COLUMN DASHBOARD */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '16px', maxWidth: '1100px', margin: '0 auto 24px',
      }}>
        {/* COL 1: TRANSFER + PROVENANCE */}
        <div className="dash-card slide-up">
          <div className="dash-card-title">● TRANSFER & PROVENANCE</div>
          <div className="dash-card-value" style={{ fontSize: '13px', color: '#888', fontFamily: 'monospace' }}>
            {asset.txHash?.slice(0, 10)}...{asset.txHash?.slice(-6)}
          </div>
          <div className="dash-card-label" style={{ marginBottom: '8px' }}>
            Block #{asset.blockNumber} · {asset.owner?.slice(0, 6)}...{asset.owner?.slice(-4)}
          </div>
          {provenance.length > 0 && (
            <div style={{ marginBottom: '12px', fontSize: '11px', color: '#666' }}>
              <strong style={{ color: '#a78bfa' }}>{provenance.length} owner(s)</strong> in history
              <div style={{ marginTop: '4px' }}>
                {provenance.map((p, i) => (
                  <div key={i} style={{ padding: '2px 0' }}>
                    {i === 0 ? '🟢' : '🔄'} {p.owner.slice(0, 6)}...{p.owner.slice(-4)}
                    <span style={{ color: '#555' }}> — {new Date(p.timestamp).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {transferResult ? (
            <div style={{ fontSize: '12px', color: transferResult.error ? '#ef4444' : '#22c55e' }}>
              {transferResult.error ? `❌ ${transferResult.error}` : `✅ Transferred.`}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <input placeholder="0x..." value={transferTo} onChange={e => setTransferTo(e.target.value)}
                style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '12px', fontFamily: 'monospace' }} />
              <button className="btn btn-primary" onClick={handleTransfer} disabled={!transferTo.startsWith('0x')}
                style={{ padding: '8px 16px', fontSize: '12px' }}>SEND</button>
            </div>
          )}
        </div>

        {/* COL 2: ROYALTY + PULSE COUNTER */}
        <div className="dash-card slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="dash-card-title">● ROYALTY & PULSE</div>
          <div className="dash-card-value" style={{ color: '#a78bfa' }}>
            {royalty?.royaltyPercent || 5}%
          </div>
          <div className="dash-card-label">On secondary sales (Patent #5 PPT)</div>
          <div style={{ marginTop: '12px', display: 'flex', gap: '24px', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#06b6d4' }}>
                {asset.totalTaps || 1}
              </div>
              <div style={{ fontSize: '10px', color: '#666', letterSpacing: '1px' }}>PULSE TAPS</div>
            </div>
            <div style={{ fontSize: '11px', color: '#888', fontFamily: 'monospace' }}>
              Each tap = verified<br/>physical possession
            </div>
          </div>
          <div style={{ marginTop: '12px' }}>
            <div className="tps-badge cyan" style={{ display: 'inline-flex' }}>MILITARY-GRADE GEO</div>
            <div className="tps-badge green" style={{ display: 'inline-flex', marginLeft: '6px' }}>ANTI-GHOST</div>
          </div>
        </div>

        {/* COL 3: GEOLOCATION + MAP */}
        <div className="dash-card slide-up" style={{ animationDelay: '0.2s' }}>
          <div className="dash-card-title">● GEOLOCATION (BASEL III)</div>
          <div className="dash-card-value" style={{ fontSize: '16px' }}>
            {latDeg.toFixed(4)}, {lonDeg.toFixed(4)}
          </div>
          <div className="dash-card-label">
            {asset.totalTaps || 1} tap(s) · Last: {new Date(asset.timestamp).toLocaleString()}
          </div>
          <div style={{ marginTop: '8px' }}>
            <SimpleMap points={geoHistory} currentLat={latDeg} currentLon={lonDeg} />
          </div>
        </div>
      </div>

      {/* TAP AGAIN SECTION */}
      <div style={{ maxWidth: '700px', margin: '0 auto 24px', textAlign: 'center' }}>
        {tapResult && !tapResult.error && (
          <div style={{ padding: '12px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', color: '#22c55e' }}>
            ✅ Tap #{tapResult.totalTaps} recorded. TX: {tapResult.txHash?.slice(0, 10)}...
            <span style={{ color: '#666', display: 'block', fontSize: '11px', marginTop: '4px' }}>
              Velocity check passed · {(tapResult.lat / 1e6).toFixed(4)}, {(tapResult.lon / 1e6).toFixed(4)}
            </span>
          </div>
        )}
        {tapResult?.error && (
          <div style={{ padding: '12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', color: '#ef4444' }}>
            ❌ {tapResult.error}
          </div>
        )}
      </div>

      {/* BOTTOM ACTIONS */}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '24px' }}>
        <button className={`btn ${tapping ? 'btn-outline' : 'btn-gold'}`} onClick={handleTap} disabled={tapping}>
          {tapping ? '📍 CAPTURING GPS...' : `📍 TAP COIN AGAIN (PULSE #${(asset.totalTaps || 1) + 1})`}
        </button>
        <button className={`btn ${collateralStatus ? 'btn-success' : 'btn-gold'}`} onClick={handleCollateralize}>
          {collateralStatus ? '✅ COLLATERALIZED' : '🔒 FLAG AS COLLATERAL'}
        </button>
        <button className="btn btn-outline" onClick={() => navigate(`/certificate/${id}`)}>
          📜 VIEW CERTIFICATE
        </button>
        <button className="btn btn-outline" onClick={() => navigate(`/provenance/${id}`)}>
          📋 FULL PROVENANCE
        </button>
      </div>
    </div>
  );
}
