const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// ═══ CONFIG ═══
const PORT = process.env.PORT || 3001;
const RPC = process.env.MONAD_RPC || 'https://testnet-rpc.monad.xyz';
const CHAIN_ID = parseInt(process.env.MONAD_CHAIN_ID || '10143');
const PRIVATE_KEY = process.env.MONAD_PRIVATE_KEY || '';

// Load deployed contract address
let CONTRACT_ADDR = process.env.CONTRACT_ADDRESS || '';
const deployedPath = path.join(__dirname, '..', 'deployed.json');
if (!CONTRACT_ADDR && fs.existsSync(deployedPath)) {
  try {
    CONTRACT_ADDR = JSON.parse(fs.readFileSync(deployedPath, 'utf8')).address;
  } catch {}
}

const CONTRACT_ABI = [
  "function mintAsset(uint256 tokenId, string calldata chipUid, int32 lat, int32 lon, string calldata metadataURI) external returns (uint256)",
  "function getAssetGeo(uint256 tokenId) external view returns (int32 lat, int32 lon, uint64 timestamp)",
  "function setCollateralStatus(uint256 tokenId, bool status) external",
  "function royaltyInfo(uint256, uint256 salePrice) external view returns (address, uint256)",
  "function transferAsset(uint256 tokenId, address to) external",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function balanceOf(address owner) external view returns (uint256)",
  "function tokenURI(uint256 tokenId) external view returns (string)",
  "function isCollateralized(uint256 tokenId) external view returns (bool)",
  "function minter() external view returns (address)",
  "function totalSupply() external view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "event CollateralStatusChanged(uint256 indexed tokenId, bool status)",
  "event AssetMinted(uint256 indexed tokenId, string chipUid, int32 lat, int32 lon, uint64 timestamp)",
];

// ═══ PROVIDER ═══
const provider = new ethers.JsonRpcProvider(RPC);
let wallet, contract;

function initWallet() {
  if (!PRIVATE_KEY) throw new Error('MONAD_PRIVATE_KEY not set');
  wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  return wallet;
}

function getContract() {
  if (!CONTRACT_ADDR) throw new Error('Contract not deployed. Run deploy.cjs first.');
  if (!wallet) initWallet();
  return new ethers.Contract(CONTRACT_ADDR, CONTRACT_ABI, wallet);
}

// ═══ IN-MEMORY REGISTRY ═══
const assets = [];

// ═══ APP ═══
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// ─── STATUS ───
app.get('/api/status', async (req, res) => {
  try {
    const w = wallet || initWallet();
    const balance = await provider.getBalance(w.address);
    const block = await provider.getBlockNumber();
    res.json({
      status: 'online',
      chainId: CHAIN_ID,
      block,
      address: w.address,
      balance: ethers.formatEther(balance),
      contract: CONTRACT_ADDR || null,
      assets: assets.length,
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
      description: 'Physical asset minted at Monad Blitz Toronto'
    });

    const tx = await contract.mintAsset(tokenId, chipUid, latInt, lonInt, metadataURI);
    const startTime = Date.now();
    const receipt = await tx.wait();
    const confirmTimeMs = Date.now() - startTime;

    const asset = {
      tokenId: tokenId.toString(),
      chipUid,
      lat: latInt,
      lon: lonInt,
      name: name || `Luxvoid Asset #${tokenId}`,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      confirmTimeMs,
      timestamp: new Date().toISOString(),
      collateralized: false,
    };
    assets.unshift(asset);

    console.log(`\n✅ MINTED #${asset.tokenId}`);
    console.log(`   TX: ${tx.hash}`);
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Confirmed: ${confirmTimeMs}ms`);

    res.json(asset);
  } catch (e) {
    console.error('❌ Mint error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── ASSETS ───
app.get('/api/assets', (req, res) => {
  res.json(assets);
});

// ─── TRANSFER ───
app.post('/api/transfer', async (req, res) => {
  try {
    const { tokenId, to } = req.body;
    if (!tokenId || !to) return res.status(400).json({ error: 'Missing tokenId or to' });

    const contract = getContract();
    const tx = await contract.transferAsset(tokenId, to);
    const receipt = await tx.wait();

    const idx = assets.findIndex(a => a.tokenId === tokenId.toString());
    if (idx !== -1) assets[idx].owner = to;

    res.json({ success: true, txHash: tx.hash, blockNumber: receipt.blockNumber });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── COLLATERALIZE ───
app.post('/api/collateralize/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const contract = getContract();

    const tx = await contract.setCollateralStatus(id, status !== false);
    const receipt = await tx.wait();

    const idx = assets.findIndex(a => a.tokenId === id);
    if (idx !== -1) assets[idx].collateralized = status !== false;

    res.json({ success: true, tokenId: id, collateralized: status !== false, txHash: tx.hash, blockNumber: receipt.blockNumber });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── ROYALTY ───
app.get('/api/royalty/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const contract = getContract();
    const result = await contract.royaltyInfo(id, 100000);
    res.json({
      tokenId: id,
      receiver: result[0],
      royaltyBps: 500,
      royaltyPercent: 5,
      exampleRoyalty: ethers.formatEther(result[1]),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══ START ═══
async function start() {
  try {
    initWallet();
    const bal = await provider.getBalance(wallet.address);
    console.log('╔═══════════════════════════════════════╗');
    console.log('║  Monad Blitz — Backend                ║');
    console.log('╚═══════════════════════════════════════╝');
    console.log(`   Wallet: ${wallet.address}`);
    console.log(`   Balance: ${ethers.formatEther(bal)} MON`);
    console.log(`   Contract: ${CONTRACT_ADDR || 'NOT DEPLOYED'}`);
    console.log(`   Chain ID: ${CHAIN_ID}`);
    console.log(`   Port: ${PORT}`);
    if (CONTRACT_ADDR) {
      const c = getContract();
      const minter = await c.minter();
      console.log(`   Minter: ${minter}`);
      const supply = await c.totalSupply();
      console.log(`   Total minted: ${supply.toString()}`);
    }
    console.log('');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server: http://localhost:${PORT}`);
    });
  } catch (e) {
    console.error('❌', e.message);
    process.exit(1);
  }
}

start();
