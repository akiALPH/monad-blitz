require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const RPC = process.env.MONAD_RPC || 'https://testnet-rpc.monad.xyz';
const CHAIN_ID = parseInt(process.env.MONAD_CHAIN_ID || '10143');
const PRIVATE_KEY = process.env.MONAD_PRIVATE_KEY || '';

// Load contract addresses
let CONTRACT_ADDR = process.env.CONTRACT_ADDRESS || '';
let STAKING_ADDR = process.env.STAKING_ADDRESS || '';
const deployedPath = path.join(__dirname, '..', 'deployed.json');
const stakingPath = path.join(__dirname, '..', 'staking-deployed.json');
if (!CONTRACT_ADDR && fs.existsSync(deployedPath)) {
  try { CONTRACT_ADDR = JSON.parse(fs.readFileSync(deployedPath, 'utf8')).address; } catch {}
}
if (!STAKING_ADDR && fs.existsSync(stakingPath)) {
  try { STAKING_ADDR = JSON.parse(fs.readFileSync(stakingPath, 'utf8')).address; } catch {}
}

// ABI definitions
const ASSET_ABI = [
  "function mintAsset(uint256,string,int32,int32,string) returns (uint256)",
  "function recordTap(uint256,int32,int32) returns (bool)",
  "function getCurrentGeo(uint256) view returns (int32,int32,uint64,uint256)",
  "function getGeoHistory(uint256) view returns ((int32,int32,uint64)[])",
  "function getOwnershipHistory(uint256) view returns ((address,uint64)[])",
  "function ownerOf(uint256) view returns (address)",
  "function isCollateralized(uint256) view returns (bool)",
  "function getTotalTaps(uint256) view returns (uint256)",
  "function royaltyInfo(uint256,uint256) view returns (address,uint256)",
  "function transferAsset(uint256,address)",
  "function setCollateralStatus(uint256,bool)",
  "function minter() view returns (address)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];

const STAKING_ABI = [
  "function stake(uint256)",
  "function unstake(uint256)",
  "function claimRewards(uint256)",
  "function calculateRewards(uint256) view returns (uint256)",
  "function getStakeInfo(uint256) view returns (address,uint256,uint256,uint256,uint256)",
  "function getStakerTokens(address) view returns (uint256[])",
  "function currentEpoch() view returns (uint256)",
  "function totalStaked() view returns (uint256)",
  "function genesisEpoch() view returns (uint256)",
];

const provider = new ethers.JsonRpcProvider(RPC);
let wallet, assetContract, stakingContract;

function initWallet() {
  if (!PRIVATE_KEY) throw new Error('MONAD_PRIVATE_KEY not set');
  wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  return wallet;
}

function getAssetContract() {
  if (!CONTRACT_ADDR) throw new Error('Asset contract not deployed');
  if (!wallet) initWallet();
  return new ethers.Contract(CONTRACT_ADDR, ASSET_ABI, wallet);
}

function getStakingContract() {
  if (!STAKING_ADDR) throw new Error('Staking contract not deployed');
  if (!wallet) initWallet();
  return new ethers.Contract(STAKING_ADDR, STAKING_ABI, wallet);
}

// In-memory stores
const assets = [];
const txFeed = [];
const epochTimer = { start: Date.now() };

function addToFeed(type, label, txHash, tokenId) {
  txFeed.unshift({
    type, label, txHash, tokenId,
    timestamp: new Date().toISOString(),
    blockTime: `${(Date.now() - epochTimer.start)}ms`,
  });
  if (txFeed.length > 50) txFeed.length = 50;
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));

// ─── STATUS ───
app.get('/api/status', async (req, res) => {
  try {
    const w = wallet || initWallet();
    const [balance, block] = await Promise.all([provider.getBalance(w.address), provider.getBlockNumber()]);
    let epoch = 0, staked = 0, supply = 0, totalTaps = 0;
    if (STAKING_ADDR) {
      try { const s = getStakingContract(); epoch = Number(await s.currentEpoch()); staked = Number(await s.totalStaked()); } catch {}
    }
    if (CONTRACT_ADDR) {
      try { const a = getAssetContract(); supply = Number(await a.totalSupply()); } catch {}
      for (const as of assets) { totalTaps += as.totalTaps || 1; }
    }
    res.json({ status: 'online', chainId: CHAIN_ID, block, address: w.address, balance: ethers.formatEther(balance), contract: CONTRACT_ADDR, staking: STAKING_ADDR, assets: assets.length, epoch, staked, supply, totalTaps });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── TX FEED ───
app.get('/api/tx-feed', (req, res) => res.json(txFeed));

// ─── MINT ───
app.post('/api/mint', async (req, res) => {
  try {
    const { chipUid, lat, lon, name } = req.body;
    if (!chipUid) return res.status(400).json({ error: 'Missing chipUid' });
    const contract = getAssetContract();
    const tokenId = ethers.toBigInt(ethers.keccak256(ethers.toUtf8Bytes(chipUid + Date.now()))) % 999999n;
    const latInt = Math.round(parseFloat(lat || '0') * 1e6);
    const lonInt = Math.round(parseFloat(lon || '0') * 1e6);
    const metadataURI = JSON.stringify({ name: name || `Luxvoid #${tokenId}`, chipUid });

    const tx = await contract.mintAsset(tokenId, chipUid, latInt, lonInt, metadataURI);
    const st = Date.now();
    const receipt = await tx.wait();
    const confirmTimeMs = Date.now() - st;

    const asset = { tokenId: tokenId.toString(), chipUid, name: name || `Luxvoid #${tokenId}`, lat: latInt, lon: lonInt, txHash: tx.hash, blockNumber: receipt.blockNumber, confirmTimeMs, timestamp: new Date().toISOString(), collateralized: false, totalTaps: 1, owner: wallet.address, staked: false };
    assets.unshift(asset);
    addToFeed('mint', `Asset #${asset.tokenId} minted`, tx.hash, asset.tokenId);
    console.log(`✅ MINT #${asset.tokenId} ${tx.hash} ${confirmTimeMs}ms`);
    res.json(asset);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/assets', (req, res) => res.json(assets));

// ─── TAP (GEO UPDATE) ───
app.post('/api/tap/:id', async (req, res) => {
  try {
    const { lat, lon } = req.body;
    if (lat === undefined || lon === undefined) return res.status(400).json({ error: 'Missing lat/lon' });
    const contract = getAssetContract();
    const latInt = Math.round(parseFloat(lat) * 1e6);
    const lonInt = Math.round(parseFloat(lon) * 1e6);
    const tx = await contract.recordTap(req.params.id, latInt, lonInt);
    const receipt = await tx.wait();
    const [geoLat, geoLon, ts, taps] = await contract.getCurrentGeo(req.params.id);
    const idx = assets.findIndex(a => a.tokenId === req.params.id);
    if (idx !== -1) { assets[idx].lat = Number(geoLat); assets[idx].lon = Number(geoLon); assets[idx].totalTaps = Number(taps); }
    addToFeed('tap', `Asset #${req.params.id} tapped (geo updated)`, tx.hash, req.params.id);
    res.json({ success: true, tokenId: req.params.id, lat: Number(geoLat)/1e6, lon: Number(geoLon)/1e6, timestamp: Number(ts), totalTaps: Number(taps), txHash: tx.hash });
  } catch (e) {
    if (e.message.includes('false')) return res.status(400).json({ error: 'Velocity check failed' });
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/geo-history/:id', async (req, res) => {
  try {
    const contract = getAssetContract();
    const history = await contract.getGeoHistory(req.params.id);
    res.json(history.map(h => ({ lat: Number(h.lat)/1e6, lon: Number(h.lon)/1e6, timestamp: new Date(Number(h.timestamp)*1000).toISOString() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/provenance/:id', async (req, res) => {
  try {
    const contract = getAssetContract();
    const ownership = await contract.getOwnershipHistory(req.params.id);
    res.json(ownership.map(o => ({ owner: o.owner, timestamp: new Date(Number(o.timestamp)*1000).toISOString() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── TRANSFER ───
app.post('/api/transfer', async (req, res) => {
  try {
    const { tokenId, to } = req.body;
    if (!tokenId || !to) return res.status(400).json({ error: 'Missing tokenId or to' });
    const contract = getAssetContract();
    const tx = await contract.transferAsset(tokenId, to);
    const receipt = await tx.wait();
    const idx = assets.findIndex(a => a.tokenId === tokenId);
    if (idx !== -1) assets[idx].owner = to;
    addToFeed('transfer', `Asset #${tokenId} transferred`, tx.hash, tokenId);
    res.json({ success: true, txHash: tx.hash });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── TRADE SIMULATION ───
app.post('/api/trade', async (req, res) => {
  try {
    const { tokenId } = req.body;
    if (!tokenId) return res.status(400).json({ error: 'Missing tokenId' });
    const contract = getAssetContract();
    const randomAddr = ethers.Wallet.createRandom().address;
    const owner = await contract.ownerOf(tokenId);
    const [, royaltyAmt] = await contract.royaltyInfo(tokenId, 100000);
    const tx = await contract.transferAsset(tokenId, randomAddr);
    const receipt = await tx.wait();
    // Transfer back to minter
    const pk2 = process.env.DEMO_PRIVATE_KEY || '';
    if (pk2) {
      const w2 = new ethers.Wallet(pk2, provider);
      const c2 = new ethers.Contract(CONTRACT_ADDR, ASSET_ABI, w2);
      await c2.transferAsset(tokenId, wallet.address);
      txFeed.push({ type: 'trade', label: `Trade settled: 5% royalty = ${Number(royaltyAmt)/100}% of sale`, txHash: tx.hash, tokenId, timestamp: new Date().toISOString(), buyer: randomAddr, royaltyPercent: 5 });
    }
    res.json({ success: true, txHash: tx.hash, buyer: randomAddr, seller: owner, royaltyPercent: 5, royaltyAmount: Number(royaltyAmt) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── COLLATERALIZE ───
app.post('/api/collateralize/:id', async (req, res) => {
  try {
    const contract = getAssetContract();
    const tx = await contract.setCollateralStatus(req.params.id, req.body.status !== false);
    await tx.wait();
    const idx = assets.findIndex(a => a.tokenId === req.params.id);
    if (idx !== -1) assets[idx].collateralized = req.body.status !== false;
    addToFeed('collateral', `Asset #${req.params.id} ${req.body.status !== false ? 'collateralized' : 'released'}`, tx.hash, req.params.id);
    res.json({ success: true, tokenId: req.params.id, collateralized: req.body.status !== false });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/royalty/:id', async (req, res) => {
  try {
    const contract = getAssetContract();
    const [recv, amt] = await contract.royaltyInfo(req.params.id, 100000);
    res.json({ tokenId: req.params.id, receiver: recv, royaltyBps: 500, royaltyPercent: 5, exampleRoyalty: ethers.formatEther(amt) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── STAKING ───
app.post('/api/stake/:id', async (req, res) => {
  try {
    const s = getStakingContract();
    const tx = await s.stake(req.params.id);
    const receipt = await tx.wait();
    const info = await s.getStakeInfo(req.params.id);
    const idx = assets.findIndex(a => a.tokenId === req.params.id);
    if (idx !== -1) assets[idx].staked = true;
    addToFeed('stake', `Asset #${req.params.id} staked`, tx.hash, req.params.id);
    res.json({ success: true, txHash: tx.hash, epoch: Number(info.lastClaimEpoch) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/unstake/:id', async (req, res) => {
  try {
    const s = getStakingContract();
    const tx = await s.unstake(req.params.id);
    const receipt = await tx.wait();
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

// ─── CERTIFICATE ───
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

// ═══ START ═══
async function start() {
  try {
    initWallet();
    const [bal, block] = await Promise.all([provider.getBalance(wallet.address), provider.getBlockNumber()]);
    console.log('╔═══════════════════════════════════════╗');
    console.log('║  MONAD BLITZ — LUXVOID ENGINE         ║');
    console.log('╚═══════════════════════════════════════╝');
    console.log(`   Wallet: ${wallet.address}`);
    console.log(`   Balance: ${ethers.formatEther(bal)} MON`);
    console.log(`   Asset:   ${CONTRACT_ADDR || '—'}`);
    console.log(`   Staking: ${STAKING_ADDR || '—'}`);
    console.log(`   Chain:   ${CHAIN_ID} · Block: ${block}`);
    if (STAKING_ADDR) {
      const s = getStakingContract();
      console.log(`   Epoch:   ${Number(await s.currentEpoch())} · Staked: ${Number(await s.totalStaked())}`);
    }
    if (CONTRACT_ADDR) {
      console.log(`   Supply:  ${Number(await getAssetContract().totalSupply())}`);
    }
    app.listen(PORT, '0.0.0.0', () => console.log(`\n🚀 http://localhost:${PORT}`));
  } catch (e) { console.error('❌', e.message); }
}

start();
