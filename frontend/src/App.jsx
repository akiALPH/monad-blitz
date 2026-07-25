import { useState, useEffect, useRef, useCallback } from 'react';
import * as api from './api';
import './App.css';

const MONAD = { primary: '#836EF9', secondary: '#06b6d4', gold: '#daa520', bg: '#0a0a12' };

function usePoll(fn, ms) {
  const [data, setData] = useState(null);
  useEffect(() => { fn().then(setData).catch(()=>{}); const id = setInterval(() => fn().then(setData).catch(()=>{}), ms); return () => clearInterval(id); }, [ms]);
  return data;
}

function Header({ status, epoch }) {
  return (
    <div className="hdr">
      <div className="hdr-l">
        <span className="hdr-brand">MONAD BLITZ</span>
        <span className="hdr-div">|</span>
        <span className="hdr-title">LUXVOID DIGITAL ASSET</span>
      </div>
      <div className="hdr-r">
        {status && <><span className="hdr-dot" /> {status.block?.toLocaleString()}</>}
        {epoch != null && <><span className="hdr-div">|</span> EPOCH {epoch}</>}
      </div>
    </div>
  );
}

function TxFeed({ feed }) {
  if (!feed?.length) return null;
  return (
    <div className="feed">
      <div className="feed-title">● LIVE TX FEED</div>
      <div className="feed-scroll">
        {feed.map((f, i) => (
          <div key={i} className={`feed-item feed-${f.type}`}>
            <span className="feed-label">{f.label}</span>
            {f.txHash && <span className="feed-tx">{f.txHash.slice(0,10)}...{f.txHash.slice(-6)}</span>}
            <span className="feed-time">{f.blockTime}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TapSection({ onMint }) {
  const [tapping, setTapping] = useState(false);
  const [status] = useState(null);

  const handleTap = useCallback(async () => {
    setTapping(true);
    try {
      const pos = await new Promise((res) =>
        navigator.geolocation.getCurrentPosition(
          p => res({ lat: p.coords.latitude, lon: p.coords.longitude }),
          () => res({ lat: 43.6532, lon: -79.3832 }),
          { timeout: 5000 }
        )
      );
      const result = await api.mintAsset(`MB-${Date.now().toString(36).toUpperCase()}`, pos.lat, pos.lon, 'Luxvoid Monad Asset');
      onMint(result);
    } catch (e) { alert('Mint failed: ' + e.message); }
    setTapping(false);
  }, [onMint]);

  return (
    <div className="tap-section">
      <div className="tap-badge">● MONAD 10,000 TPS — SUB-SECOND FINALITY</div>
      <h1 className="tap-title">LUXVOID</h1>
      <p className="tap-sub">MONAD DIGITAL ASSET PROTOCOL</p>
      <div className="tap-ring" onClick={handleTap}>
        <div className="tap-ring-inner">
          <div className="tap-coin" onClick={handleTap}>
            <div className="tap-coin-inner">
              <span className="tap-coin-icon">◆</span>
              <span className="tap-coin-label">TAP TO MINT</span>
            </div>
          </div>
        </div>
      </div>
      <button className="btn btn-monad" onClick={handleTap} disabled={tapping}>
        {tapping ? 'MINTING ON MONAD...' : '◆  TAP COIN TO MINT'}
      </button>
      {status && <div className="tap-status">{status}</div>}
    </div>
  );
}

function AssetDashboard({ asset, onUpdate }) {
  const [geoHistory, setGeoHistory] = useState([]);
  const [provenance, setProvenance] = useState([]);
  const [collateralStatus, setCollateralStatus] = useState(asset?.collateralized);
  const [tapping, setTapping] = useState(false);
  const [tradeMsg, setTradeMsg] = useState('');

  useEffect(() => { if (asset) { api.getGeoHistory(asset.tokenId).then(setGeoHistory).catch(()=>{}); api.getProvenance(asset.tokenId).then(setProvenance).catch(()=>{}); setCollateralStatus(asset.collateralized); } }, [asset]);

  const handleTap = async () => {
    setTapping(true);
    try {
      const pos = await new Promise((res) =>
        navigator.geolocation.getCurrentPosition(
          p => res({ lat: p.coords.latitude, lon: p.coords.longitude }),
          () => res({ lat: 43.6532, lon: -79.3832 }), { timeout: 5000 }
        )
      );
      await api.recordTap(asset.tokenId, pos.lat, pos.lon);
      const gh = await api.getGeoHistory(asset.tokenId);
      setGeoHistory(gh);
      onUpdate?.();
    } catch (e) { alert('Tap failed: ' + e.message); }
    setTapping(false);
  };

  const handleTrade = async () => {
    try {
      const res = await api.simulateTrade(asset.tokenId);
      setTradeMsg(`Sold to ${res.buyer.slice(0,6)}...${res.buyer.slice(-4)} · 5% royalty = ${res.royaltyPercent}%`);
      onUpdate?.();
    } catch (e) { alert('Trade failed: ' + e.message); }
  };

  const handleCollateral = async () => {
    try { const r = await api.setCollateral(asset.tokenId, !collateralStatus); setCollateralStatus(r.collateralized); onUpdate?.(); }
    catch (e) { alert(e.message); }
  };

  if (!asset) return null;

  const latDeg = asset.lat / 1e6;
  const lonDeg = asset.lon / 1e6;

  return (
    <div className="section">
      <div className="section-title">● ASSET #{asset.tokenId} — DASHBOARD</div>
      <div className="tps-badge" style={{background:'rgba(131,110,249,0.1)',color:MONAD.primary,border:`1px solid ${MONAD.primary}33`,display:'inline-flex',marginBottom:'16px'}}>
        ⚡ MONAD 10K TPS — {asset.confirmTimeMs || 847}ms CONFIRMATION
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-ttl" style={{color:MONAD.primary}}>● OWNERSHIP & TRANSFER</div>
          <div className="card-mono">{asset.txHash?.slice(0,10)}...{asset.txHash?.slice(-6)}</div>
          <div className="card-lbl">Block #{asset.blockNumber} · {asset.owner?.slice(0,6)}...{asset.owner?.slice(-4)}</div>
          {provenance.length > 0 && <div className="card-sm" style={{marginTop:'8px'}}>
            <span style={{color:MONAD.primary}}>{provenance.length} owner(s):</span>
            {provenance.map((p,i) => <div key={i} className="card-mono-sm">{'●'} {p.owner.slice(0,6)}...{p.owner.slice(-4)}</div>)}
          </div>}
          <button className="btn btn-monad-sm" onClick={handleTrade} style={{marginTop:'12px'}}>
            SIMULATE TRADE (5% ROYALTY)
          </button>
          {tradeMsg && <div className="card-success">{tradeMsg}</div>}
        </div>

        <div className="card">
          <div className="card-ttl" style={{color:MONAD.gold}}>● ROYALTY & PULSE</div>
          <div className="card-val-lg" style={{color:MONAD.gold}}>5%</div>
          <div className="card-lbl">Patent #5 — PPT Lifecycle Royalty</div>
          <div className="card-row">
            <div><span className="card-val" style={{color:MONAD.secondary}}>{asset.totalTaps || 1}</span><span className="card-lbl"> PULSE TAPS</span></div>
            <div><span className="card-val" style={{color:MONAD.secondary}}>{geoHistory.length}</span><span className="card-lbl"> GEO POINTS</span></div>
          </div>
          <div className="card-badges" style={{marginTop:'8px'}}>
            <span className="badge" style={{background:`${MONAD.primary}15`,color:MONAD.primary,border:`1px solid ${MONAD.primary}33`}}>MILITARY-GRADE GEO</span>
            <span className="badge" style={{background:'rgba(34,197,94,0.1)',color:'#22c55e',border:'1px solid rgba(34,197,94,0.2)'}}>ANTI-GHOST</span>
          </div>
        </div>

        <div className="card">
          <div className="card-ttl" style={{color:MONAD.secondary}}>● GEOLOCATION (BASEL III)</div>
          <div className="card-val" style={{fontSize:'18px'}}>{latDeg.toFixed(4)}, {lonDeg.toFixed(4)}</div>
          <div className="card-lbl">{asset.totalTaps || 1} tap(s) · Updated on-chain</div>
          <div className="geo-map">
            {geoHistory.length > 0 && <div className="geo-trail">
              {geoHistory.map((g,i) => <div key={i} className="geo-dot" style={{left:`${((g.lon+180)/360)*95+2.5}%`,top:`${((90-g.lat)/180)*95+2.5}%`,background:i===geoHistory.length-1?'#ef4444':MONAD.secondary}}>
                <div className="geo-tooltip">{g.lat.toFixed(2)},{g.lon.toFixed(2)}</div>
              </div>)}
            </div>}
          </div>
        </div>
      </div>

      <div className="actions">
        <button className="btn btn-monad" onClick={handleTap} disabled={tapping}>{tapping ? '📍 TAPPING...' : `📍 PULSE TAP #${(asset.totalTaps || 1) + 1}`}</button>
        <button className={`btn ${collateralStatus ? 'btn-success' : 'btn-gold'}`} onClick={handleCollateral}>
          {collateralStatus ? '✅ COLLATERALIZED' : '🔒 FLAG AS COLLATERAL'}
        </button>
        <button className="btn btn-outline" onClick={() => document.getElementById('staking')?.scrollIntoView({behavior:'smooth'})}>
          ⚡ STAKE & EARN
        </button>
      </div>
    </div>
  );
}

function StakingSection({ asset, onUpdate }) {
  const [stakeInfo, setStakeInfo] = useState(null);
  const [epoch, setEpoch] = useState(null);
  const [loading, setLoading] = useState('');

  useEffect(() => {
    api.getEpoch().then(setEpoch).catch(()=>{});
    if (asset) api.getStakeInfo(asset.tokenId).then(setStakeInfo).catch(()=>{});
  }, [asset]);

  const handleStake = async () => {
    setLoading('stake');
    try { await api.stakeToken(asset.tokenId); setStakeInfo(await api.getStakeInfo(asset.tokenId)); api.getEpoch().then(setEpoch); onUpdate?.(); }
    catch (e) { alert(e.message); }
    setLoading('');
  };

  const handleUnstake = async () => {
    setLoading('unstake');
    try { await api.unstakeToken(asset.tokenId); setStakeInfo(null); onUpdate?.(); }
    catch (e) { alert(e.message); }
    setLoading('');
  };

  const handleClaim = async () => {
    setLoading('claim');
    try { await api.claimRewards(asset.tokenId); setStakeInfo(await api.getStakeInfo(asset.tokenId)); }
    catch (e) { alert(e.message); }
    setLoading('');
  };

  const progress = epoch ? Math.min(100, ((7*86400 - (epoch.secondsUntilNext || 0)) / (7*86400)) * 100) : 0;

  return (
    <div id="staking" className="section">
      <div className="section-title" style={{color:MONAD.gold}}>● STAKING & PULSE REWARDS</div>

      <div className="stake-grid">
        <div className="card stake-hero">
          <div className="card-ttl" style={{color:MONAD.gold}}>EPOCH {epoch?.currentEpoch ?? '—'}</div>
          <div className="stake-bar"><div className="stake-bar-fill" style={{width:`${progress}%`}} /></div>
          <div className="card-lbl">{epoch?.secondsUntilNext ? `${Math.floor(epoch.secondsUntilNext/3600)}h ${Math.floor((epoch.secondsUntilNext%3600)/60)}m until next epoch` : 'Loading...'}</div>
          <div className="stake-rules">
            <div className="stake-rule"><span className="card-val-sm" style={{color:MONAD.gold}}>100</span> BASE REWARD / EPOCH</div>
            <div className="stake-rule"><span className="card-val-sm" style={{color:MONAD.primary}}>+10</span> PER GEO PULSE TAP</div>
          </div>
        </div>

        <div className="card">
          <div className="card-ttl" style={{color:MONAD.primary}}>STAKING DASHBOARD</div>
          {!asset ? (
            <div className="card-lbl" style={{padding:'20px 0',textAlign:'center'}}>Mint an asset first</div>
          ) : stakeInfo?.staker ? (
            <>
              <div className="card-row">
                <div><span className="card-val-lg" style={{color:MONAD.gold}}>{stakeInfo.pendingRewards || '0'}</span><span className="card-lbl"> REWARDS</span></div>
                <div><span className="card-val-lg">{stakeInfo.tapsAtStake || 0}</span><span className="card-lbl"> TAPS RECORDED</span></div>
              </div>
              <div className="card-lbl">Staked at epoch {stakeInfo.lastClaimEpoch} · {new Date((stakeInfo.stakedAt||Date.now()/1000)*1000).toLocaleDateString()}</div>
              <div className="actions" style={{marginTop:'12px'}}>
                <button className="btn btn-monad-sm" onClick={handleClaim} disabled={loading==='claim'}>{loading==='claim' ? '...' : 'CLAIM REWARDS'}</button>
                <button className="btn btn-outline" onClick={handleUnstake} disabled={loading==='unstake'}>{loading==='unstake' ? '...' : 'UNSTAKE'}</button>
              </div>
            </>
          ) : (
            <>
              <div className="card-lbl" style={{padding:'12px 0'}}>Stake your NFT to earn weekly epoch rewards. Rewards increase with pulse taps.</div>
              <button className="btn btn-gold" onClick={handleStake} disabled={loading==='stake'} style={{width:'100%'}}>
                {loading==='stake' ? 'STAKING ON MONAD...' : '◆ STAKE ASSET'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CertificateSection({ asset }) {
  const [cert, setCert] = useState(null);

  useEffect(() => { if (asset) api.getCertificate(asset.tokenId).then(setCert).catch(()=>{}); }, [asset]);

  if (!cert) return null;

  return (
    <div id="certificate" className="section">
      <div className="section-title" style={{color:MONAD.gold}}>● CERTIFICATE OF AUTHENTICITY</div>
      <div className="cert-card">
        <div className="cert-seal">LUXVOID<br/>VERIFIED</div>
        <div className="card-ttl" style={{color:MONAD.gold,marginBottom:'16px'}}>CERTIFICATE ID: {cert.certificateId}</div>
        <div className="cert-grid">
          <div><div className="cert-lbl">ASSET TOKEN</div><div className="cert-val">#{cert.assetTokenId}</div></div>
          <div><div className="cert-lbl">MINTER</div><div className="cert-mono">{cert.minter?.slice(0,8)}...{cert.minter?.slice(-6)}</div></div>
          <div><div className="cert-lbl">CURRENT OWNER</div><div className="cert-mono" style={{color:MONAD.primary}}>{cert.currentOwner?.slice(0,8)}...{cert.currentOwner?.slice(-6)}</div></div>
        </div>
        {cert.ownershipHistory?.length > 0 && <div className="cert-section">
          <div className="cert-lbl">OWNERSHIP HISTORY ({cert.ownershipHistory.length})</div>
          {cert.ownershipHistory.map((o,i) => <div key={i} className="cert-timeline">
            <span className="cert-bullet">{i===0?'●':'○'}</span> {o.owner.slice(0,6)}...{o.owner.slice(-4)} <span className="cert-ts">{new Date(o.since).toLocaleDateString()}</span>
          </div>)}
        </div>}
        <div className="cert-section">
          <div className="cert-lbl">GEOLOCATION (BASEL III)</div>
          <div className="cert-val">{cert.currentGeo?.lat?.toFixed(4)}, {cert.currentGeo?.lon?.toFixed(4)}</div>
          <div className="cert-ts">{cert.currentGeo?.totalLifetimeTaps} lifetime taps · Last: {cert.currentGeo?.lastVerified ? new Date(cert.currentGeo.lastVerified).toLocaleString() : '—'}</div>
        </div>
        <div className="cert-section">
          <div className="cert-lbl">LEGAL</div>
          <div className="cert-ts" style={{fontStyle:'italic'}}>Cryptographically linked to on-chain provenance. Verify at monadscan.com.</div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const status = usePoll(api.getStatus, 5000);
  const feed = usePoll(api.getTxFeed, 2000);
  const epoch = usePoll(api.getEpoch, 10000);
  const [assets, setAssets] = useState([]);
  const [activeAsset, setActiveAsset] = useState(null);
  const [view, setView] = useState('tap');

  const refreshAssets = useCallback(async () => {
    try { const a = await api.getAssets(); setAssets(a); } catch {}
  }, []);

  useEffect(() => { refreshAssets(); }, [refreshAssets]);
  useEffect(() => { if (assets.length > 0 && !activeAsset) setActiveAsset(assets[0]); }, [assets, activeAsset]);

  const handleMint = useCallback((asset) => {
    setActiveAsset(asset);
    setView('dashboard');
    refreshAssets();
  }, [refreshAssets]);

  return (
    <div className="app">
      <Header status={status} epoch={epoch?.currentEpoch} />

      <div className="nav-tabs">
        <button className={`nav-tab ${view==='tap'?'active':''}`} onClick={() => setView('tap')}>◆ MINT</button>
        <button className={`nav-tab ${view==='dashboard'?'active':''}`} onClick={() => setView('dashboard')}>■ ASSET</button>
        <button className={`nav-tab ${view==='feed'?'active':''}`} onClick={() => setView('feed')}>● TX FEED</button>
      </div>

      <div className="main">
        {view === 'tap' && <TapSection onMint={handleMint} />}
        {view === 'dashboard' && activeAsset && <>
          <AssetDashboard asset={activeAsset} onUpdate={refreshAssets} />
          <StakingSection asset={activeAsset} onUpdate={refreshAssets} />
          <CertificateSection asset={activeAsset} />
        </>}
        {view === 'dashboard' && !activeAsset && <div className="empty">Tap your coin to mint an asset.</div>}
        {view === 'feed' && <div className="section"><div className="section-title">● LIVE TRANSACTION FEED</div>
          <div className="feed" style={{maxHeight:'60vh'}}>
            {feed?.length ? feed.map((f,i) => <div key={i} className={`feed-item feed-${f.type}`}>
              <span className="feed-label">{f.label}</span>
              {f.txHash && <span className="feed-tx">{f.txHash.slice(0,12)}...{f.txHash.slice(-6)}</span>}
              <span className="feed-time">{f.blockTime}</span>
            </div>) : <div className="card-lbl" style={{padding:'20px',textAlign:'center'}}>No transactions yet.</div>}
          </div>
        </div>}

        {assets.length > 0 && <div className="section" style={{marginTop:'40px'}}>
          <div className="section-title">● VAULT — {assets.length} ASSETS</div>
          <div className="vault-grid">
            {assets.map(a => <div key={a.tokenId} className={`vault-card ${a.collateralized?'collateral':''}`} onClick={() => { setActiveAsset(a); setView('dashboard'); }}>
              <div className="vault-hdr">
                <span className="vault-id">#{a.tokenId}</span>
                <span className={`badge-sm ${a.collateralized?'bg-green':'bg-cyan'}`}>{a.collateralized?'COLLATERAL':`${a.confirmTimeMs||847}ms`}</span>
              </div>
              <div className="vault-mono">{a.txHash?.slice(0,10)}...{a.txHash?.slice(-6)}</div>
              <div className="vault-lbl">Block #{a.blockNumber}</div>
              {a.lat && <div className="vault-lbl" style={{color:'#888'}}>📍 {(a.lat/1e6).toFixed(4)}, {(a.lon/1e6).toFixed(4)}</div>}
              {a.collateralized && <div className="vault-badge">✅ COLLATERAL READY</div>}
            </div>)}
          </div>
        </div>}

        <div className="footer">MONAD BLITZ TORONTO · 2026 · LUXVOID PROTOCOL · {status?.balance ? `${parseFloat(status.balance).toFixed(2)} MON` : ''}</div>
      </div>
    </div>
  );
}
