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

let CONTRACT_ADDR = process.env.CONTRACT_ADDRESS || '';
const deployedPath = path.join(__dirname, '..', 'deployed.json');
if (!CONTRACT_ADDR && fs.existsSync(deployedPath)) {
  try { CONTRACT_ADDR = JSON.parse(fs.readFileSync(deployedPath, 'utf8')).address; } catch {}
}

const CONTRACT_ABI = [
  "function mintAsset(uint256 tokenId, string calldata chipUid, int32 lat, int32 lon, string calldata metadataURI) external returns (uint256)",
  "function recordTap(uint256 tokenId, int32 lat, int32 lon) external returns (bool)",
  "function getCurrentGeo(uint256 tokenId) external view returns (int32 lat, int32 lon, uint64 timestamp, uint256 totalTaps)",
  "function getGeoHistory(uint256 tokenId) external view returns ((int32,int32,uint64)[])",
  "function getOwnershipHistory(uint256 tokenId) external view returns ((address,uint64)[])",
  "function setCollateralStatus(uint256 tokenId, bool status) external",
  "function royaltyInfo(uint256, uint256 salePrice) external view returns (address, uint256)",
  "function transferAsset(uint256 tokenId, address to) external",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function balanceOf(address owner) external view returns (uint256)",
  "function tokenURI(uint256 tokenId) external view returns (string)",
  "function isCollateralized(uint256 tokenId) external view returns (bool)",
  "function getTotalTaps(uint256 tokenId) external view returns (uint256)",
  "function minter() external view returns (address)",
  "function totalSupply() external view returns (uint256)",
];

const provider = new ethers.JsonRpcProvider(RPC);
let wallet, contract;

function initWallet() {
  if (!PRIVATE_KEY) throw new Error('MONAD_PRIVATE_KEY not set');
  wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  return wallet;
}

function getContract() {
  if (!CONTRACT_ADDR) throw new Error('Contract not deployed');
  if (!wallet) initWallet();
  return new ethers.Contract(CONTRACT_ADDR, CONTRACT_ABI, wallet);
}

const assets = [];

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));

// ─── STATUS ───
app.get('/api/status', async (req, res) => {
  try {
    const w = wallet || initWallet();
    const [balance, block] = await Promise.all([
      provider.getBalance(w.address),
      provider.getBlockNumber(),
    ]);
    let totalTaps = 0, totalCollateralized = 0, minterAddr = null;
    if (CONTRACT_ADDR) {
      try {
        const c = getContract();
        minterAddr = await c.minter();
        for (const a of assets) {
          try {
            const info = await c.getCurrentGeo(a.tokenId);
            totalTaps += Number(info.totalTaps);
            const coll = await c.isCollateralized(a.tokenId);
            if (coll) totalCollateralized++;
          } catch {}
        }
      } catch {}
    }
    res.json({
      status: 'online', chainId: CHAIN_ID, block,
      address: w.address, balance: ethers.formatEther(balance),
      contract: CONTRACT_ADDR || null, assets: assets.length,
      totalTaps, totalCollateralized, minter: minterAddr,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── MINT ───
app.post('/api/mint', async (req, res) => {
  try {
    const { chipUid, lat, lon, name } = req.body;
    if (!chipUid) return res.status(400).json({ error: 'Missing chipUid' });
    const contract = getContract();
    const tokenId = ethers.toBigInt(ethers.keccak256(ethers.toUtf8Bytes(chipUid + Date.now()))) % BigInt(999999);
    const latInt = Math.round(parseFloat(lat || '0') * 1e6);
    const lonInt = Math.round(parseFloat(lon || '0') * 1e6);
    const metadataURI = JSON.stringify({
      name: name || `Luxvoid Asset #${tokenId}`,
      chipUid,
      description: 'Physical asset minted at Monad Blitz Toronto',
    });

    const tx = await contract.mintAsset(tokenId, chipUid, latInt, lonInt, metadataURI);
    const startTime = Date.now();
    const receipt = await tx.wait();
    const confirmTimeMs = Date.now() - startTime;

    const asset = {
      tokenId: tokenId.toString(), chipUid, name: name || `Luxvoid Asset #${tokenId}`,
      lat: latInt, lon: lonInt,
      txHash: tx.hash, blockNumber: receipt.blockNumber,
      confirmTimeMs, timestamp: new Date().toISOString(),
      collateralized: false, totalTaps: 1, owner: (await contract.ownerOf(tokenId)),
    };
    assets.unshift(asset);
    console.log(`\n✅ MINTED #${asset.tokenId} TX:${tx.hash} ${confirmTimeMs}ms`);
    res.json(asset);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── ASSETS ───
app.get('/api/assets', (req, res) => res.json(assets));

// ─── TAP (Update Geo) ───
app.post('/api/tap/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { lat, lon } = req.body;
    if (lat === undefined || lon === undefined)
      return res.status(400).json({ error: 'Missing lat/lon' });
    const contract = getContract();
    const latInt = Math.round(parseFloat(lat) * 1e6);
    const lonInt = Math.round(parseFloat(lon) * 1e6);
    const tx = await contract.recordTap(id, latInt, lonInt);
    const receipt = await tx.wait();

    const [geoLat, geoLon, ts, taps] = await contract.getCurrentGeo(id);
    const idx = assets.findIndex(a => a.tokenId === id);
    if (idx !== -1) {
      assets[idx].lat = Number(geoLat); assets[idx].lon = Number(geoLon);
      assets[idx].totalTaps = Number(taps);
    }
    console.log(`\n📍 TAP #${id} — TX:${tx.hash} — taps:${taps} — (${Number(geoLat)/1e6}, ${Number(geoLon)/1e6})`);
    res.json({
      success: true, tokenId: id,
      lat: Number(geoLat), lon: Number(geoLon),
      timestamp: Number(ts), totalTaps: Number(taps),
      txHash: tx.hash, blockNumber: receipt.blockNumber,
    });
  } catch (e) {
    // Check if velocity check failed
    if (e.message.includes('false')) {
      return res.status(400).json({ error: 'Velocity check failed — impossible travel distance detected' });
    }
    res.status(500).json({ error: e.message });
  }
});

// ─── GEO HISTORY ───
app.get('/api/geo-history/:id', async (req, res) => {
  try {
    const contract = getContract();
    const history = await contract.getGeoHistory(req.params.id);
    const result = history.map(h => ({
      lat: Number(h.lat) / 1e6,
      lon: Number(h.lon) / 1e6,
      timestamp: new Date(Number(h.timestamp) * 1000).toISOString(),
    }));
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PROVENANCE (Ownership History) ───
app.get('/api/provenance/:id', async (req, res) => {
  try {
    const contract = getContract();
    const ownership = await contract.getOwnershipHistory(req.params.id);
    const result = ownership.map(o => ({
      owner: o.owner,
      timestamp: new Date(Number(o.timestamp) * 1000).toISOString(),
    }));
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── TRANSFER ───
app.post('/api/transfer', async (req, res) => {
  try {
    const { tokenId, to } = req.body;
    if (!tokenId || !to) return res.status(400).json({ error: 'Missing tokenId or to' });
    const contract = getContract();
    const tx = await contract.transferAsset(tokenId, to);
    const receipt = await tx.wait();
    const idx = assets.findIndex(a => a.tokenId === tokenId);
    if (idx !== -1) assets[idx].owner = to;
    res.json({ success: true, txHash: tx.hash, blockNumber: receipt.blockNumber });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── COLLATERALIZE ───
app.post('/api/collateralize/:id', async (req, res) => {
  try {
    const contract = getContract();
    const tx = await contract.setCollateralStatus(req.params.id, req.body.status !== false);
    const receipt = await tx.wait();
    const idx = assets.findIndex(a => a.tokenId === req.params.id);
    if (idx !== -1) assets[idx].collateralized = req.body.status !== false;
    res.json({ success: true, tokenId: req.params.id, collateralized: req.body.status !== false, txHash: tx.hash, blockNumber: receipt.blockNumber });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── ROYALTY ───
app.get('/api/royalty/:id', async (req, res) => {
  try {
    const contract = getContract();
    const result = await contract.royaltyInfo(req.params.id, 100000);
    res.json({ tokenId: req.params.id, receiver: result[0], royaltyBps: 500, royaltyPercent: 5, exampleRoyalty: ethers.formatEther(result[1]) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── CERTIFICATE (military-grade with PandaDoc-style proof) ───
app.get('/api/certificate/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const contract = getContract();
    const [owner, geo, history, ownership, uri, coll, taps] = await Promise.all([
      contract.ownerOf(id),
      contract.getCurrentGeo(id),
      contract.getGeoHistory(id),
      contract.getOwnershipHistory(id),
      contract.tokenURI(id),
      contract.isCollateralized(id),
      contract.getTotalTaps(id),
    ]);

    const certId = crypto.createHash('sha256').update(`LUXVOID-CERT-${id}-${Date.now()}`).digest('hex').slice(0, 16).toUpperCase();
    const verificationHash = crypto.createHash('sha256').update(`${id}${owner}${Number(geo.timestamp)}`).digest('hex');

    const cert = {
      certificateId: `LV-${certId}`,
      issuedAt: new Date().toISOString(),
      assetTokenId: id,
      minter: await contract.minter(),
      currentOwner: owner,
      ownershipHistory: ownership.map(o => ({
        owner: o.owner, since: new Date(Number(o.timestamp) * 1000).toISOString(),
      })),
      currentGeo: {
        lat: Number(geo.lat) / 1e6, lon: Number(geo.lon) / 1e6,
        lastVerified: new Date(Number(geo.timestamp) * 1000).toISOString(),
        totalLifetimeTaps: Number(taps),
      },
      geoHistory: history.map(h => ({
        lat: Number(h.lat) / 1e6, lon: Number(h.lon) / 1e6,
        timestamp: new Date(Number(h.timestamp) * 1000).toISOString(),
      })),
      collateralStatus: coll,
      royaltyBps: 500,
      metadata: uri,
      verificationHash,
      blockchainVerification: `https://testnet.monadscan.com/token/${CONTRACT_ADDR}/instance/${id}`,
      issuedBy: 'Luxvoid Protocol — Monad Blitz',
      legalDisclaimer: 'This certificate is cryptographically linked to on-chain provenance. Verify at monadscan.com.',
    };
    res.json(cert);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══ START ═══
async function start() {
  try {
    initWallet();
    const [bal, block] = await Promise.all([
      provider.getBalance(wallet.address),
      provider.getBlockNumber(),
    ]);
    console.log('╔═══════════════════════════════════════╗');
    console.log('║  Monad Blitz — Backend v2              ║');
    console.log('╚═══════════════════════════════════════╝');
    console.log(`   Wallet: ${wallet.address}`);
    console.log(`   Balance: ${ethers.formatEther(bal)} MON`);
    console.log(`   Contract: ${CONTRACT_ADDR || 'NOT DEPLOYED'}`);
    console.log(`   Chain: ${CHAIN_ID} · Block: ${block}`);
    console.log(`   Port: ${PORT}`);
    if (CONTRACT_ADDR) {
      const c = getContract();
      const minter = await c.minter();
      const supply = await c.totalSupply();
      console.log(`   Minter: ${minter} · Supply: ${supply}`);
    }
    app.listen(PORT, '0.0.0.0', () => console.log(`\n🚀 Server: http://localhost:${PORT}`));
  } catch (e) {
    console.error('❌', e.message);
    process.exit(1);
  }
}

start();
