#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════
//  MONAD BLITZ — LUXVOID ENGINE :: Heartbeat Server
//  Rock solid. Works from any CWD. Auto-recover ready.
// ════════════════════════════════════════════════════════════════════

const FS = require('fs');
const PATH = require('path');

// ── Lock CWD to script location so paths always resolve ──
const ROOT = PATH.resolve(__dirname);
process.chdir(ROOT);

// ── Load .env before anything else ──
try { require('dotenv').config({ path: PATH.join(ROOT, '.env') }); } catch {}
// Also try parent .env
try { require('dotenv').config({ path: PATH.join(ROOT, '..', '.env') }); } catch {}

const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const crypto = require('crypto');

// ── Config (with rock-solid defaults) ──
const PORT         = parseInt(process.env.PORT || '3001', 10);
const RPC          = process.env.MONAD_RPC || 'https://testnet-rpc.monad.xyz';
const CHAIN_ID     = parseInt(process.env.MONAD_CHAIN_ID || '10143', 10);
const PRIVATE_KEY  = process.env.MONAD_PRIVATE_KEY || '';
const LOGFILE      = process.env.LOGFILE || PATH.join(ROOT, 'server.log');

// ── Logging ──
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { FS.appendFileSync(LOGFILE, line + '\n'); } catch {}
}
function err(msg) {
  const line = `[${new Date().toISOString()}] ❌ ${msg}`;
  console.error(line);
  try { FS.appendFileSync(LOGFILE, line + '\n'); } catch {}
}

// ── Global error handlers (never crash silently) ──
process.on('uncaughtException', (e) => {
  err(`UNCAUGHT: ${e.message}\n${e.stack}`);
  // Keep running — don't exit. Watchdog will restart if needed.
});
process.on('unhandledRejection', (reason) => {
  err(`UNHANDLED REJECTION: ${reason}`);
});

// ── Load contract addresses ──
let CONTRACT_ADDR = process.env.CONTRACT_ADDRESS || '';
let STAKING_ADDR  = process.env.STAKING_ADDRESS  || '';

function loadContractAddresses() {
  try {
    const depPath = PATH.join(ROOT, '..', 'deployed.json');
    if (!CONTRACT_ADDR && FS.existsSync(depPath))
      CONTRACT_ADDR = JSON.parse(FS.readFileSync(depPath, 'utf8')).address;
  } catch {}
  try {
    const stkPath = PATH.join(ROOT, '..', 'staking-deployed.json');
    if (!STAKING_ADDR && FS.existsSync(stkPath))
      STAKING_ADDR = JSON.parse(FS.readFileSync(stkPath, 'utf8')).address;
  } catch {}
}
loadContractAddresses();

// ── ABI definitions ──
const ASSET_ABI = [
  'function mintAsset(uint256,string,int32,int32,string) returns (uint256)',
  'function recordTap(uint256,int32,int32) returns (bool)',
  'function getCurrentGeo(uint256) view returns (int32,int32,uint64,uint256)',
  'function getGeoHistory(uint256) view returns ((int32,int32,uint64)[])',
  'function getOwnershipHistory(uint256) view returns ((address,uint64)[])',
  'function ownerOf(uint256) view returns (address)',
  'function isCollateralized(uint256) view returns (bool)',
  'function getTotalTaps(uint256) view returns (uint256)',
  'function royaltyInfo(uint256,uint256) view returns (address,uint256)',
  'function transferAsset(uint256,address)',
  'function setCollateralStatus(uint256,bool)',
  'function minter() view returns (address)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
];

const STAKING_ABI = [
  'function stake(uint256)',
  'function unstake(uint256)',
  'function claimRewards(uint256)',
  'function calculateRewards(uint256) view returns (uint256)',
  'function getStakeInfo(uint256) view returns (address,uint256,uint256,uint256,uint256)',
  'function getStakerTokens(address) view returns (uint256[])',
  'function currentEpoch() view returns (uint256)',
  'function totalStaked() view returns (uint256)',
  'function genesisEpoch() view returns (uint256)',
];

// ── Provider & Wallet ──
const provider = new ethers.JsonRpcProvider(RPC);
let wallet = null;
let assetContract = null;
let stakingContract = null;

function getWallet() {
  if (!wallet) {
    if (!PRIVATE_KEY) throw new Error('MONAD_PRIVATE_KEY not set. Check .env');
    wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  }
  return wallet;
}

function getAssetContract() {
  if (!assetContract) {
    if (!CONTRACT_ADDR) throw new Error('Asset contract address not loaded. Deploy first.');
    getWallet();
    assetContract = new ethers.Contract(CONTRACT_ADDR, ASSET_ABI, wallet);
  }
  return assetContract;
}

function getStakingContract() {
  if (!stakingContract) {
    if (!STAKING_ADDR) throw new Error('Staking contract address not loaded. Deploy first.');
    getWallet();
    stakingContract = new ethers.Contract(STAKING_ADDR, STAKING_ABI, wallet);
  }
  return stakingContract;
}

// ── In-memory stores ──
const assets = [];
const txFeed = [];
const epochTimer = { start: Date.now() };

function addToFeed(type, label, txHash, tokenId) {
  txFeed.unshift({
    type, label, txHash, tokenId,
    timestamp: new Date().toISOString(),
    blockTime: `${Date.now() - epochTimer.start}ms`,
  });
  if (txFeed.length > 100) txFeed.length = 100;
}

// ── Express app ──
const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));

// Health check (used by watchdog)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), pid: process.pid, port: PORT });
});

// ──────── API ROUTES ────────

app.get('/api/status', async (req, res) => {
  try {
    const w = getWallet();
    const [bal, block] = await Promise.all([provider.getBalance(w.address), provider.getBlockNumber()]);
    let epoch = 0, staked = 0, supply = 0, taps = 0;
    try { if (STAKING_ADDR) { const s = getStakingContract(); epoch = Number(await s.currentEpoch()); staked = Number(await s.totalStaked()); } } catch {}
    try { if (CONTRACT_ADDR) supply = Number(await getAssetContract().totalSupply()); } catch {}
    for (const a of assets) taps += a.totalTaps || 1;
    res.json({ status: 'online', chainId: CHAIN_ID, block, address: w.address, balance: ethers.formatEther(bal), contract: CONTRACT_ADDR, staking: STAKING_ADDR, assets: assets.length, epoch, staked, supply, totalTaps: taps });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/tx-feed', (req, res) => res.json(txFeed));

app.post('/api/mint', async (req, res) => {
  try {
    const { chipUid, lat, lon, name } = req.body;
    if (!chipUid) return res.status(400).json({ error: 'Missing chipUid' });
    const c = getAssetContract();
    const tokenId = ethers.toBigInt(ethers.keccak256(ethers.toUtf8Bytes(chipUid + Date.now()))) % 999999n;
    const latInt = Math.round(parseFloat(lat || '0') * 1e6);
    const lonInt = Math.round(parseFloat(lon || '0') * 1e6);
    const tx = await c.mintAsset(tokenId, chipUid, latInt, lonInt, JSON.stringify({ name: name || `Luxvoid #${tokenId}`, chipUid }));
    const st = Date.now();
    const receipt = await tx.wait();
    const asset = { tokenId: tokenId.toString(), chipUid, name: name || `Luxvoid #${tokenId}`, lat: latInt, lon: lonInt, txHash: tx.hash, blockNumber: receipt.blockNumber, confirmTimeMs: Date.now() - st, timestamp: new Date().toISOString(), collateralized: false, totalTaps: 1, owner: wallet.address, staked: false };
    assets.unshift(asset);
    addToFeed('mint', `Asset #${asset.tokenId} minted`, tx.hash, asset.tokenId);
    log(`MINT #${asset.tokenId} ${tx.hash} ${asset.confirmTimeMs}ms`);
    res.json(asset);
  } catch (e) { err(`MINT: ${e.message}`); res.status(500).json({ error: e.message }); }
});

app.get('/api/assets', (req, res) => res.json(assets));

app.post('/api/tap/:id', async (req, res) => {
  try {
    const { lat, lon } = req.body;
    if (lat === undefined || lon === undefined) return res.status(400).json({ error: 'Missing lat/lon' });
    const c = getAssetContract();
    const latInt = Math.round(parseFloat(lat) * 1e6);
    const lonInt = Math.round(parseFloat(lon) * 1e6);
    const tx = await c.recordTap(req.params.id, latInt, lonInt);
    const receipt = await tx.wait();
    const [geoLat, geoLon, ts, taps] = await c.getCurrentGeo(req.params.id);
    const idx = assets.findIndex(a => a.tokenId === req.params.id);
    if (idx !== -1) { assets[idx].lat = Number(geoLat); assets[idx].lon = Number(geoLon); assets[idx].totalTaps = Number(taps); }
    addToFeed('tap', `Asset #${req.params.id} tapped`, tx.hash, req.params.id);
    res.json({ success: true, tokenId: req.params.id, lat: Number(geoLat)/1e6, lon: Number(geoLon)/1e6, timestamp: Number(ts), totalTaps: Number(taps), txHash: tx.hash });
  } catch (e) { err(`TAP: ${e.message}`); res.status(e.message.includes('false') ? 400 : 500).json({ error: e.message.includes('false') ? 'Velocity check failed' : e.message }); }
});

app.get('/api/geo-history/:id', async (req, res) => {
  try {
    const h = await getAssetContract().getGeoHistory(req.params.id);
    res.json(h.map(x => ({ lat: Number(x.lat)/1e6, lon: Number(x.lon)/1e6, timestamp: new Date(Number(x.timestamp)*1000).toISOString() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/provenance/:id', async (req, res) => {
  try {
    const o = await getAssetContract().getOwnershipHistory(req.params.id);
    res.json(o.map(x => ({ owner: x.owner, timestamp: new Date(Number(x.timestamp)*1000).toISOString() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/transfer', async (req, res) => {
  try {
    const { tokenId, to } = req.body;
    if (!tokenId || !to) return res.status(400).json({ error: 'Missing tokenId or to' });
    const c = getAssetContract();
    const tx = await c.transferAsset(tokenId, to);
    await tx.wait();
    const idx = assets.findIndex(a => a.tokenId === tokenId);
    if (idx !== -1) assets[idx].owner = to;
    addToFeed('transfer', `Asset #${tokenId} transferred`, tx.hash, tokenId);
    res.json({ success: true, txHash: tx.hash });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/trade', async (req, res) => {
  try {
    const { tokenId } = req.body;
    if (!tokenId) return res.status(400).json({ error: 'Missing tokenId' });
    const c = getAssetContract();
    const randomAddr = ethers.Wallet.createRandom().address;
    const owner = await c.ownerOf(tokenId);
    const [, royaltyAmt] = await c.royaltyInfo(tokenId, 100000);
    const tx = await c.transferAsset(tokenId, randomAddr);
    const receipt = await tx.wait();
    const pk2 = process.env.DEMO_PRIVATE_KEY || '';
    if (pk2) {
      const w2 = new ethers.Wallet(pk2, provider);
      const c2 = new ethers.Contract(CONTRACT_ADDR, ASSET_ABI, w2);
      await c2.transferAsset(tokenId, wallet.address);
    }
    txFeed.unshift({ type: 'trade', label: `Trade: 5% royalty = ${Number(royaltyAmt)} basis pts`, txHash: tx.hash, tokenId, timestamp: new Date().toISOString(), buyer: randomAddr });
    res.json({ success: true, txHash: tx.hash, buyer: randomAddr, seller: owner, royaltyPercent: 5, royaltyAmount: Number(royaltyAmt) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/collateralize/:id', async (req, res) => {
  try {
    const c = getAssetContract();
    const tx = await c.setCollateralStatus(req.params.id, req.body.status !== false);
    await tx.wait();
    const idx = assets.findIndex(a => a.tokenId === req.params.id);
    if (idx !== -1) assets[idx].collateralized = req.body.status !== false;
    addToFeed('collateral', `Asset #${req.params.id} ${req.body.status !== false ? 'collateralized' : 'released'}`, tx.hash, req.params.id);
    res.json({ success: true, tokenId: req.params.id, collateralized: req.body.status !== false });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/royalty/:id', async (req, res) => {
  try {
    const [recv, amt] = await getAssetContract().royaltyInfo(req.params.id, 100000);
    res.json({ tokenId: req.params.id, receiver: recv, royaltyBps: 500, royaltyPercent: 5, exampleRoyalty: ethers.formatEther(amt) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/stake/:id', async (req, res) => {
  try {
    const s = getStakingContract();
    const tx = await s.stake(req.params.id);
    await tx.wait();
    const idx = assets.findIndex(a => a.tokenId === req.params.id);
    if (idx !== -1) assets[idx].staked = true;
    addToFeed('stake', `Asset #${req.params.id} staked`, tx.hash, req.params.id);
    res.json({ success: true, txHash: tx.hash });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/unstake/:id', async (req, res) => {
  try {
    const s = getStakingContract();
    const tx = await s.unstake(req.params.id);
    await tx.wait();
    const idx = assets.findIndex(a => a.tokenId === req.params.id);
    if (idx !== -1) assets[idx].staked = false;
    addToFeed('unstake', `Asset #${req.params.id} unstaked`, tx.hash, req.params.id);
    res.json({ success: true, txHash: tx.hash });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/claim/:id', async (req, res) => {
  try {
    const s = getStakingContract();
    const tx = await s.claimRewards(req.params.id);
    await tx.wait();
    addToFeed('claim', `Rewards claimed for #${req.params.id}`, tx.hash, req.params.id);
    res.json({ success: true, txHash: tx.hash });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/stake-info/:id', async (req, res) => {
  try {
    const s = getStakingContract();
    const [staker, stakedAt, lastClaimEpoch, pendingRewards, tapsAtStake] = await s.getStakeInfo(req.params.id);
    const epoch = await s.currentEpoch();
    res.json({ tokenId: req.params.id, staker, stakedAt: Number(stakedAt), lastClaimEpoch: Number(lastClaimEpoch), pendingRewards: pendingRewards.toString(), tapsAtStake: Number(tapsAtStake), currentEpoch: Number(epoch) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/epoch', async (req, res) => {
  try {
    const s = getStakingContract();
    const epoch = await s.currentEpoch();
    const genesis = Number(await s.genesisEpoch());
    const nextEpoch = genesis + (Number(epoch) + 1) * 604800;
    res.json({ currentEpoch: Number(epoch), genesisTimestamp: genesis, nextEpochTimestamp: nextEpoch, secondsUntilNext: nextEpoch - Math.floor(Date.now()/1000) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/certificate/:id', async (req, res) => {
  try {
    const a = getAssetContract();
    const [owner, geo, history, ownership, coll, taps] = await Promise.all([
      a.ownerOf(req.params.id), a.getCurrentGeo(req.params.id),
      a.getGeoHistory(req.params.id), a.getOwnershipHistory(req.params.id),
      a.isCollateralized(req.params.id), a.getTotalTaps(req.params.id),
    ]);
    const certId = crypto.createHash('sha256').update(`LV-CERT-${req.params.id}-${Date.now()}`).digest('hex').slice(0, 16).toUpperCase();
    res.json({
      certificateId: `LV-${certId}`, issuedAt: new Date().toISOString(),
      assetTokenId: req.params.id, minter: await a.minter(), currentOwner: owner,
      ownershipHistory: ownership.map(o => ({ owner: o.owner, since: new Date(Number(o.timestamp)*1000).toISOString() })),
      currentGeo: { lat: Number(geo.lat)/1e6, lon: Number(geo.lon)/1e6, lastVerified: new Date(Number(geo.timestamp)*1000).toISOString(), totalLifetimeTaps: Number(taps) },
      geoHistory: history.map(h => ({ lat: Number(h.lat)/1e6, lon: Number(h.lon)/1e6, timestamp: new Date(Number(h.timestamp)*1000).toISOString() })),
      collateralStatus: coll, royaltyBps: 500,
      verificationHash: crypto.createHash('sha256').update(`${req.params.id}${owner}${Date.now()}`).digest('hex'),
      blockchainVerification: `https://testnet.monadscan.com/token/${CONTRACT_ADDR}/instance/${req.params.id}`,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ──────── BOOT ────────
async function boot() {
  log('╔═══════════════════════════════════════╗');
  log('║  MONAD BLITZ — LUXVOID ENGINE         ║');
  log('╚═══════════════════════════════════════╝');
  log(`PID: ${process.pid}  CWD: ${ROOT}  Log: ${LOGFILE}`);

  try {
    getWallet();
    const [bal, block] = await Promise.all([provider.getBalance(wallet.address), provider.getBlockNumber()]);
    log(`Wallet: ${wallet.address}  Balance: ${ethers.formatEther(bal)} MON`);
    log(`Chain: ${CHAIN_ID}  Block: ${block}`);
    log(`Asset: ${CONTRACT_ADDR || '—'}  Staking: ${STAKING_ADDR || '—'}`);
    if (STAKING_ADDR) try { const s = getStakingContract(); log(`Epoch: ${Number(await s.currentEpoch())}  Staked: ${Number(await s.totalStaked())}`); } catch {}
    if (CONTRACT_ADDR) try { log(`Supply: ${Number(await getAssetContract().totalSupply())}`); } catch {}
  } catch (e) {
    err(`Boot warning: ${e.message} (server will still start, some features may be degraded)`);
  }

  app.listen(PORT, '0.0.0.0', () => {
    log(`🚀 LIVE  http://localhost:${PORT}  http://0.0.0.0:${PORT}`);
    log(`Health: http://localhost:${PORT}/health`);
  });
}

// ── Graceful shutdown ──
process.on('SIGINT', () => { log('SIGINT — shutting down'); process.exit(0); });
process.on('SIGTERM', () => { log('SIGTERM — shutting down'); process.exit(0); });

boot();
