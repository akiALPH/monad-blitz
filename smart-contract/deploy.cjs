const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Load .env manually
const envPath = path.join(__dirname, '..', 'backend', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

const RPC = process.env.MONAD_RPC || 'https://testnet-rpc.monad.xyz';
const CHAIN_ID = parseInt(process.env.MONAD_CHAIN_ID || '10143');
const PRIVATE_KEY = process.env.MONAD_PRIVATE_KEY || '';

async function main() {
  console.log('╔═══════════════════════════════════════╗');
  console.log('║  Deploy MonadBlitzAsset                ║');
  console.log('╚═══════════════════════════════════════╝');

  if (!PRIVATE_KEY) {
    console.error('❌ Set MONAD_PRIVATE_KEY in .env');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  console.log(`   Deployer: ${wallet.address}`);
  console.log(`   Chain ID: ${CHAIN_ID}`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`   Balance: ${ethers.formatEther(balance)} MON`);

  if (balance === 0n) {
    console.error('\n❌ Zero balance. Get testnet MON:');
    console.error('   1. Go to https://faucet.monad.xyz/');
    console.error(`   2. Enter: ${wallet.address}`);
    console.error('   3. Get testnet MON (connect X or Discord for more)');
    process.exit(1);
  }

  const solSource = fs.readFileSync(
    path.join(__dirname, 'MonadBlitzAsset.sol'),
    'utf8'
  );

  const factory = new ethers.ContractFactory(
    [
      "constructor()",
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
    ],
    solSource,
    wallet
  );

  console.log('\n🔧 Deploying MonadBlitzAsset...');
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  const addr = await contract.getAddress();

  console.log(`\n✅ Deployed: ${addr}`);
  console.log(`   Explorer: https://testnet.monadscan.com/address/${addr}`);

  const out = { address: addr, chainId: CHAIN_ID, rpc: RPC, deployedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(__dirname, '..', 'deployed.json'), JSON.stringify(out, null, 2));
  console.log(`\n📝 Saved to deployed.json`);
}

main().catch(e => {
  console.error('\n❌ Deploy failed:', e.message);
  process.exit(1);
});
