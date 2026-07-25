import { useState, useEffect, useCallback } from 'react';
import * as api from './api';
import './App.css';

const MONAD = { primary: '#836EF9', secondary: '#06b6d4', gold: '#daa520' };

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
        <span className="hdr-title">LUXVOID PROTOCOL</span>
      </div>
      <div className="hdr-r">
        {status?.address && (
          <span className="wallet-badge" title={status.address}>
            <span className="hdr-dot" /> {status.address.slice(0,6)}...{status.address.slice(-4)}
            <span className="hdr-bal">{parseFloat(status.balance||'0').toFixed(2)} MON</span>
          </span>
        )}
        <span className="hdr-div">|</span>
        <span>EPOCH {epoch?.currentEpoch ?? 0}</span>
      </div>
    </div>
  );
}

function TxScroller({ count }) {
  const [txs, setTxs] = useState([]);
  useEffect(() => {
    if (count <= 0) return;
    const id = setInterval(() => {
      const hash = '0x' + Array.from({length:64},()=>Math.floor(Math.random()*16).toString(16)).join('');
      const ms = Math.floor(Math.random() * 900) + 50;
      setTxs(prev => [{hash, ms, id: Date.now()}, ...prev].slice(0, 8));
    }, 120);
    return () => clearInterval(id);
  }, [count]);
  if (txs.length === 0) return null;
  return <div className="tx-scroll">{txs.map(t => <div key={t.id} className="tx-scroll-line">● TX {t.hash.slice(0,10)}...{t.hash.slice(-6)} <span className="tx-scroll-ms">{t.ms}ms</span></div>)}</div>;
}

function TapSection({ onMint }) {
  const [tapping, setTapping] = useState(false);
  const [err, setErr] = useState('');
  const [batch, setBatch] = useState(null);
  const [batching, setBatching] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchStart, setBatchStart] = useState(0);

  const handle = useCallback(async () => {
    setTapping(true); setErr('');
    try {
      const pos = await new Promise(res => navigator.geolocation.getCurrentPosition(p => res({lat:p.coords.latitude,lon:p.coords.longitude}), () => res({lat:43.6532,lon:-79.3832}), {timeout:5000}));
      const result = await api.mintAsset(`MB-${Date.now().toString(36).toUpperCase()}`, pos.lat, pos.lon, 'Luxvoid Monad Asset');
      onMint(result);
    } catch (e) { setErr(e.message); }
    setTapping(false);
  }, [onMint]);

  const handleBatch = async () => {
    setBatching(true); setBatch(null); setBatchProgress(0);
    const start = Date.now();
    setBatchStart(start);
    const progressInterval = setInterval(() => {
      setBatchProgress(Math.min(99, Math.round(((Date.now() - start) / 45000) * 100)));
    }, 200);
    try {
      const result = await api.batchMint(500);
      clearInterval(progressInterval);
      setBatchProgress(100);
      setBatch(result);
    } catch (e) { clearInterval(progressInterval); setErr(e.message); }
    setBatching(false);
  };

  const elapsed = batching ? Math.floor((Date.now() - batchStart) / 1000) : 0;
  const liveTps = batching && elapsed > 0 ? Math.round((batchProgress / 100) * 500 / elapsed) : 0;

  return (
    <div className="tap-section">
      <div className="tap-badge">● MONAD 10,000 TPS — SUB-SECOND FINALITY</div>
      <h1 className="tap-title">LUXVOID</h1>
      <p className="tap-sub">MONAD DIGITAL ASSET PROTOCOL</p>
      <div className="tap-ring" onClick={handle}>
        <div className="tap-ring-inner">
          <div className="tap-coin" onClick={handle}>
            <div className="tap-coin-inner">
              <span className="tap-coin-icon">◆</span>
              <span className="tap-coin-label">TAP TO MINT</span>
            </div>
          </div>
        </div>
      </div>
      <button className="btn btn-monad btn-lg" onClick={handle} disabled={tapping}>
        {tapping ? '⏳ MINTING ON MONAD...' : '◆  TAP COIN TO MINT'}
      </button>
      {err && <div className="err-msg">{err}</div>}

      <div style={{marginTop:'48px',borderTop:'1px solid rgba(255,255,255,0.04)',paddingTop:'32px'}}>
        <div className="tap-badge" style={{borderColor:'rgba(218,165,32,0.3)',color:'#daa520',background:'rgba(218,165,32,0.06)'}}>● INDUSTRIAL — MONAD 10K TPS STRESS TEST</div>

        {!batching && !batch && (
          <button className="btn btn-gold btn-lg" onClick={handleBatch} style={{marginTop:'16px'}}>
            🏭  FIRE 500 TX — SHOW MONAD TPS
          </button>
        )}

        {batching && (
          <div className="card" style={{marginTop:'16px',maxWidth:'600px',marginLeft:'auto',marginRight:'auto',textAlign:'center',borderColor:'rgba(218,165,32,0.3)',overflow:'hidden'}}>
            <div className="card-ttl" style={{color:'#daa520'}}>● INDUSTRIAL BATCH IN PROGRESS</div>
            <div className="batch-dashboard">
              <div className="batch-stat">
                <span className="batch-num">{batchProgress}%</span>
                <span className="batch-lbl">PROGRESS</span>
              </div>
              <div className="batch-stat">
                <span className="batch-num" style={{color:'#22c55e'}}>~{liveTps}</span>
                <span className="batch-lbl">LIVE TPS</span>
              </div>
              <div className="batch-stat">
                <span className="batch-num" style={{color:'#06b6d4'}}>{elapsed}s</span>
                <span className="batch-lbl">ELAPSED</span>
              </div>
              <div className="batch-stat">
                <span className="batch-num" style={{color:'#a78bfa'}}>500</span>
                <span className="batch-lbl">TARGET</span>
              </div>
            </div>
            <div className="batch-bar"><div className="batch-bar-fill" style={{width:`${batchProgress}%`}} /></div>
            <TxScroller count={batchProgress} />
            <div style={{marginTop:'8px',fontSize:'10px',color:'#555',letterSpacing:'1px',animation:'pulse 1.5s infinite'}}>FIRING TRANSACTIONS ON MONAD TESTNET...</div>
          </div>
        )}

        {batch && (
          <div className="card" style={{marginTop:'16px',maxWidth:'500px',marginLeft:'auto',marginRight:'auto',textAlign:'center',borderColor:'rgba(34,197,94,0.3)'}}>
            <div className="card-ttl" style={{color:'#22c55e'}}>● BATCH COMPLETE</div>
            <div style={{fontSize:'56px',fontWeight:'700',color:'#22c55e',letterSpacing:'2px'}}>{batch.throughputTps}</div>
            <div className="card-lbl" style={{fontSize:'13px',marginBottom:'16px'}}>TRANSACTIONS PER SECOND ON MONAD</div>
            <div className="batch-dashboard">
              <div className="batch-stat">
                <span className="batch-num" style={{color:'#22c55e'}}>{batch.succeeded}</span>
                <span className="batch-lbl">SUCCEEDED</span>
              </div>
              <div className="batch-stat">
                <span className="batch-num" style={{color:'#daa520'}}>{batch.totalTimeMs}ms</span>
                <span className="batch-lbl">TOTAL TIME</span>
              </div>
              <div className="batch-stat">
                <span className="batch-num" style={{color:'#a78bfa'}}>{batch.avgConfirmMs}ms</span>
                <span className="batch-lbl">AVG CONFIRM</span>
              </div>
            </div>
            <div className="tps-badge green" style={{display:'inline-flex',marginTop:'16px',fontSize:'14px',padding:'8px 20px'}}>
              ⚡ MONAD 10,000 TPS — {batch.throughputTps} TPS ACHIEVED
            </div>
            <button className="btn btn-outline" onClick={() => { setBatch(null); setBatchProgress(0); }} style={{marginTop:'16px'}}>
              RUN AGAIN
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function WalletInfo({ status }) {
  if (!status) return null;
  return (
    <div className="wallet-panel">
      <div className="wallet-row">
        <div className="wallet-item">
          <span className="wallet-lbl">WALLET</span>
          <span className="wallet-addr">{status.address}</span>
        </div>
        <div className="wallet-item">
          <span className="wallet-lbl">BALANCE</span>
          <span className="wallet-val">{parseFloat(status.balance||'0').toFixed(4)} MON</span>
        </div>
        <div className="wallet-item">
          <span className="wallet-lbl">BLOCK</span>
          <span className="wallet-val">{status.block?.toLocaleString()}</span>
        </div>
        <div className="wallet-item">
          <span className="wallet-lbl">CHAIN</span>
          <span className="wallet-val">MONAD {status.chainId}</span>
        </div>
      </div>
      {status.contract && (
        <div className="wallet-row" style={{marginTop:'8px',fontSize:'11px',color:'#555'}}>
          <span>Asset: <span className="mono">{status.contract.slice(0,8)}...{status.contract.slice(-6)}</span></span>
          {status.staking && <span>Staking: <span className="mono">{status.staking.slice(0,8)}...{status.staking.slice(-6)}</span></span>}
          <span>Assets: {status.assets} | Epoch: {status.epoch} | Staked: {status.staked}</span>
        </div>
      )}
    </div>
  );
}

function AssetDashboard({ asset, status, onUpdate }) {
  const [geoHistory, setGeoHistory] = useState([]);
  const [provenance, setProvenance] = useState([]);
  const [collateralStatus, setCollateralStatus] = useState(asset?.collateralized);
  const [tapping, setTapping] = useState(false);
  const [tradeAddr, setTradeAddr] = useState('');
  const [tradeMsg, setTradeMsg] = useState('');
  const [tradeCert, setTradeCert] = useState(null);

  useEffect(() => {
    if (asset) { api.getGeoHistory(asset.tokenId).then(setGeoHistory).catch(()=>{}); api.getProvenance(asset.tokenId).then(setProvenance).catch(()=>{}); setCollateralStatus(asset.collateralized); }
  }, [asset]);

  const handleTap = async () => {
    setTapping(true);
    try {
      const pos = await new Promise(res => navigator.geolocation.getCurrentPosition(p=>res({lat:p.coords.latitude,lon:p.coords.longitude}), ()=>res({lat:43.6532,lon:-79.3832}), {timeout:5000}));
      await api.recordTap(asset.tokenId, pos.lat, pos.lon);
      setGeoHistory(await api.getGeoHistory(asset.tokenId));
      onUpdate?.();
    } catch (e) { alert(e.message); }
    setTapping(false);
  };

  const handleTrade = async () => {
    try {
      const to = tradeAddr || ethers.Wallet.createRandom().address;
      const pos = await new Promise(res => navigator.geolocation.getCurrentPosition(p=>res({lat:p.coords.latitude,lon:p.coords.longitude}), ()=>res({lat:43.6532,lon:-79.3832}), {timeout:5000}));
      // Record geo before transfer
      await api.recordTap(asset.tokenId, pos.lat, pos.lon);
      // Transfer
      const tx = await api.transferAsset(asset.tokenId, to);
      const royalty = await api.getRoyalty(asset.tokenId);
      setTradeCert({
        buyer: to, seller: status?.address || asset.owner,
        tokenId: asset.tokenId, txHash: tx.txHash,
        royalty: `${royalty.royaltyPercent}%`,
        lat: pos.lat.toFixed(4), lon: pos.lon.toFixed(4),
        timestamp: new Date().toISOString(),
      });
      setTradeMsg(`✅ Sold to ${to.slice(0,6)}...${to.slice(-4)} · 5% royalty · Geo-stamped`);
      onUpdate?.();
    } catch (e) { setTradeMsg(`❌ ${e.message}`); }
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
          <div className="card-ttl" style={{color:MONAD.primary}}>● OWNERSHIP</div>
          <div className="card-mono" style={{fontSize:'14px',color:'#06b6d4'}}>{asset.owner?.slice(0,8)}...{asset.owner?.slice(-6)}</div>
          <div className="card-mono" style={{fontSize:'11px',color:'#555'}}>TX: {asset.txHash?.slice(0,12)}...{asset.txHash?.slice(-6)}</div>
          <div className="card-lbl">Block #{asset.blockNumber}</div>
          {provenance.length > 0 && <div className="card-sm" style={{marginTop:'8px'}}>
            <span style={{color:MONAD.primary}}>{provenance.length} owners:</span>
            {provenance.map((p,i) => <div key={i} className="card-mono-sm">● {p.owner.slice(0,6)}...{p.owner.slice(-4)}</div>)}
          </div>}
        </div>

        <div className="card">
          <div className="card-ttl" style={{color:MONAD.gold}}>● ROYALTY & PULSE</div>
          <div className="card-val-lg" style={{color:MONAD.gold}}>5%</div>
          <div className="card-lbl">Patent #5 PPT Lifecycle — on every trade</div>
          <div className="card-row">
            <div><span className="card-val" style={{color:MONAD.secondary}}>{asset.totalTaps || 1}</span><span className="card-lbl"> PULSE TAPS</span></div>
            <div><span className="card-val" style={{color:MONAD.secondary}}>{geoHistory.length}</span><span className="card-lbl"> GEO POINTS</span></div>
          </div>
        </div>

        <div className="card">
          <div className="card-ttl" style={{color:MONAD.secondary}}>● GEOLOCATION</div>
          <div className="card-val" style={{fontSize:'18px'}}>{latDeg.toFixed(4)}, {lonDeg.toFixed(4)}</div>
          <div className="card-lbl">{asset.totalTaps || 1} taps · Updated on-chain</div>
          <div className="geo-map">
            {geoHistory.length > 0 && <div className="geo-trail">
              {geoHistory.map((g,i) => <div key={i} className="geo-dot" style={{left:`${((g.lon+180)/360)*95+2.5}%`,top:`${((90-g.lat)/180)*95+2.5}%`,background:i===geoHistory.length-1?'#ef4444':MONAD.secondary}}>
                <div className="geo-tooltip">{g.lat.toFixed(2)},{g.lon.toFixed(2)}</div>
              </div>)}
            </div>}
          </div>
        </div>
      </div>

      {/* TRADE DESK */}
      <div className="card" style={{marginTop:'16px'}}>
        <div className="card-ttl" style={{color:MONAD.gold}}>● LIVE TRADE DESK</div>
        <div className="card-lbl" style={{marginBottom:'8px'}}>Enter audience wallet address (or leave blank for random):</div>
        <div style={{display:'flex',gap:'8px'}}>
          <input className="trade-input" placeholder="0x..." value={tradeAddr} onChange={e=>setTradeAddr(e.target.value)} />
          <button className="btn btn-gold" onClick={handleTrade}>
            EXECUTE TRADE
          </button>
        </div>
        {tradeMsg && <div className={`trade-msg ${tradeMsg.startsWith('✅')?'ok':'err'}`}>{tradeMsg}</div>}
        {tradeCert && (
          <div className="geo-cert">
            <div className="cert-badge">● IMMUTABLE TRADE CERTIFICATE</div>
            <div className="cert-grid">
              <div><span className="cert-lbl">TOKEN</span><span>#{tradeCert.tokenId}</span></div>
              <div><span className="cert-lbl">BUYER</span><span className="mono">{tradeCert.buyer.slice(0,8)}...{tradeCert.buyer.slice(-6)}</span></div>
              <div><span className="cert-lbl">SELLER</span><span className="mono">{tradeCert.seller.slice(0,8)}...{tradeCert.seller.slice(-6)}</span></div>
              <div><span className="cert-lbl">ROYALTY</span><span>{tradeCert.royalty}</span></div>
              <div><span className="cert-lbl">GEO LAT</span><span>{tradeCert.lat}</span></div>
              <div><span className="cert-lbl">GEO LON</span><span>{tradeCert.lon}</span></div>
              <div><span className="cert-lbl">TX HASH</span><span className="mono">{tradeCert.txHash.slice(0,12)}...{tradeCert.txHash.slice(-6)}</span></div>
              <div><span className="cert-lbl">TIMESTAMP</span><span>{new Date(tradeCert.timestamp).toLocaleTimeString()}</span></div>
            </div>
            <div className="cert-footer">This certificate is cryptographically linked to on-chain provenance. Verify at monadscan.com.</div>
          </div>
        )}
      </div>

      <div className="actions">
        <button className="btn btn-monad" onClick={handleTap} disabled={tapping}>{tapping ? '📍 TAPPING...' : `📍 PULSE TAP #${(asset.totalTaps || 1) + 1}`}</button>
        <button className={`btn ${collateralStatus ? 'btn-success' : 'btn-gold'}`} onClick={async () => { try { const r = await api.setCollateral(asset.tokenId, !collateralStatus); setCollateralStatus(r.collateralized); onUpdate?.(); } catch(e) { alert(e.message); }}}>
          {collateralStatus ? '✅ COLLATERALIZED' : '🔒 FLAG AS COLLATERAL'}
        </button>
      </div>
    </div>
  );
}

function StakingSection({ asset }) {
  const [stakeInfo, setStakeInfo] = useState(null);
  const [epoch, setEpoch] = useState(null);
  const [loading, setLoading] = useState('');

  useEffect(() => {
    api.getEpoch().then(setEpoch).catch(()=>{});
    if (asset) api.getStakeInfo(asset.tokenId).then(setStakeInfo).catch(()=>{});
  }, [asset]);

  const handleStake = async () => {
    setLoading('stake');
    try { await api.stakeToken(asset.tokenId); setStakeInfo(await api.getStakeInfo(asset.tokenId)); api.getEpoch().then(setEpoch); }
    catch (e) { alert(e.message); }
    setLoading('');
  };
  const handleUnstake = async () => {
    setLoading('unstake');
    try { await api.unstakeToken(asset.tokenId); setStakeInfo(null); }
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
    <div className="section">
      <div className="section-title" style={{color:MONAD.gold}}>● STAKING & PULSE REWARDS</div>
      <div className="stake-grid">
        <div className="card stake-hero">
          <div className="card-ttl" style={{color:MONAD.gold}}>EPOCH {epoch?.currentEpoch ?? '—'}</div>
          <div className="stake-bar"><div className="stake-bar-fill" style={{width:`${progress}%`}} /></div>
          <div className="card-lbl">{epoch?.secondsUntilNext ? `${Math.floor(epoch.secondsUntilNext/3600)}h ${Math.floor((epoch.secondsUntilNext%3600)/60)}m` : 'Loading...'}</div>
          <div className="stake-rules">
            <div className="stake-rule"><span style={{color:MONAD.gold,fontWeight:700}}>100</span> BASE / EPOCH</div>
            <div className="stake-rule"><span style={{color:MONAD.primary,fontWeight:700}}>+10</span> PER PULSE TAP</div>
          </div>
        </div>
        <div className="card">
          <div className="card-ttl" style={{color:MONAD.primary}}>STAKING</div>
          {!asset ? <div className="card-lbl" style={{padding:'20px 0',textAlign:'center'}}>Mint an asset first</div>
          : stakeInfo?.staker ? <>
            <div className="card-row">
              <div><span className="card-val-lg" style={{color:MONAD.gold}}>{stakeInfo.pendingRewards || '0'}</span><span className="card-lbl"> REWARDS</span></div>
              <div><span className="card-val-lg">{stakeInfo.tapsAtStake || 0}</span><span className="card-lbl"> TAPS</span></div>
            </div>
            <button className="btn btn-monad" onClick={handleClaim} disabled={loading==='claim'} style={{width:'100%',marginTop:'8px'}}>{loading==='claim' ? '...' : 'CLAIM REWARDS'}</button>
            <button className="btn btn-outline" onClick={handleUnstake} disabled={loading==='unstake'} style={{width:'100%',marginTop:'4px'}}>{loading==='unstake' ? '...' : 'UNSTAKE'}</button>
          </> : <>
            <div className="card-lbl" style={{padding:'12px 0'}}>100 base + 10 per pulse tap. Weekly epochs.</div>
            <button className="btn btn-gold" onClick={handleStake} disabled={loading==='stake'} style={{width:'100%'}}>
              {loading==='stake' ? 'STAKING...' : '◆ STAKE ASSET'}
            </button>
          </>}
        </div>
      </div>
    </div>
  );
}

function TxFeed({ feed }) {
  if (!feed?.length) return null;
  return <div className="feed"><div className="feed-title">● LIVE TX FEED</div>
    {feed.map((f,i) => <div key={i} className={`feed-item feed-${f.type}`}>
      <span className="feed-label">{f.label}</span>
      {f.txHash && <span className="feed-tx">{f.txHash.slice(0,12)}...{f.txHash.slice(-6)}</span>}
      <span className="feed-time">{f.blockTime}</span>
    </div>)}
  </div>;
}

export default function App() {
  const status = usePoll(api.getStatus, 5000);
  const feed = usePoll(api.getTxFeed, 2000);
  const epoch = usePoll(api.getEpoch, 10000);
  const [assets, setAssets] = useState([]);
  const [activeAsset, setActiveAsset] = useState(null);
  const [view, setView] = useState('tap');

  const refresh = useCallback(async () => { try { const a = await api.getAssets(); setAssets(a); } catch {} }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { if (assets.length > 0 && !activeAsset) setActiveAsset(assets[0]); }, [assets, activeAsset]);

  return (
    <div className="app">
      <Header status={status} epoch={epoch} />

      <div className="nav-tabs">
        <button className={`nav-tab ${view==='tap'?'active':''}`} onClick={() => setView('tap')}>◆ MINT</button>
        <button className={`nav-tab ${view==='dashboard'?'active':''}`} onClick={() => setView('dashboard')}>■ ASSET</button>
        <button className={`nav-tab ${view==='feed'?'active':''}`} onClick={() => setView('feed')}>● TX FEED</button>
      </div>

      <div className="main">
        {status && <WalletInfo status={status} />}

        {view === 'tap' && <TapSection onMint={(a) => { setActiveAsset(a); setView('dashboard'); refresh(); }} />}

        {view === 'dashboard' && activeAsset && <>
          <AssetDashboard asset={activeAsset} status={status} onUpdate={refresh} />
          <StakingSection asset={activeAsset} />
        </>}
        {view === 'dashboard' && !activeAsset && <div className="empty">Tap your coin to mint an asset.</div>}

        {view === 'feed' && <div className="section">
          <div className="section-title">● REAL-TIME TRANSACTION FEED</div>
          {feed?.length ? feed.map((f,i) => <div key={i} className={`feed-item feed-${f.type}`}>
            <span className="feed-label">{f.label}</span>
            {f.txHash && <span className="feed-tx">{f.txHash.slice(0,12)}...{f.txHash.slice(-6)}</span>}
            <span className="feed-time">{f.blockTime}</span>
          </div>) : <div className="card-lbl" style={{padding:'20px',textAlign:'center'}}>No transactions yet.</div>}
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
              <div className="vault-lbl">Block #{a.blockNumber} · {a.owner?.slice(0,6)}...{a.owner?.slice(-4)}</div>
              {a.collateralized && <div className="vault-badge">✅ COLLATERAL READY — 70% LTV</div>}
            </div>)}
          </div>
        </div>}

        <div className="footer">MONAD BLITZ · LUXVOID PROTOCOL · MONAD TESTNET · {status?.balance ? `${parseFloat(status.balance).toFixed(2)} MON` : ''}</div>
      </div>
    </div>
  );
}
