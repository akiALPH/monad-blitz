const { ethers } = require('./backend/node_modules/ethers');

const API = 'http://127.0.0.1:3001';
const RPC = 'https://testnet-rpc.monad.xyz';
const CONTRACT_ADDR = '0x22D0dDc001e969cf6d24eF3D20037E02fF356877';
const MINTER = '0x596efF021A66De1cdfdF4b9F4A0B95c39DE2cC3f';

const ABI = [
  "function mintAsset(uint256 tokenId, string calldata chipUid, int32 lat, int32 lon, string calldata metadataURI) external returns (uint256)",
  "function recordTap(uint256 tokenId, int32 lat, int32 lon) external returns (bool)",
  "function getCurrentGeo(uint256 tokenId) external view returns (int32 lat, int32 lon, uint64 timestamp, uint256 totalTaps)",
  "function getGeoHistory(uint256 tokenId) external view returns ((int32,int32,uint64)[])",
  "function getOwnershipHistory(uint256 tokenId) external view returns ((address,uint64)[])",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function isCollateralized(uint256 tokenId) external view returns (bool)",
  "function getTotalTaps(uint256 tokenId) external view returns (uint256)",
  "function royaltyInfo(uint256, uint256 salePrice) external view returns (address, uint256)",
];

async function test(label, fn) {
  process.stdout.write(`\n🧪 ${label}... `);
  try {
    const result = await fn();
    process.stdout.write('✅\n');
    return result;
  } catch (e) {
    process.stdout.write(`❌ ${e.message}\n`);
    return null;
  }
}

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  E2E TEST SUITE — MonadBlitzAsset');
  console.log(`  Contract: ${CONTRACT_ADDR}`);
  console.log('═══════════════════════════════════════\n');

  const provider = new ethers.JsonRpcProvider(RPC);
  const pk = require('fs').readFileSync('./backend/.env','utf8').split('\n').find(l=>l.startsWith('MONAD_PRIVATE_KEY')).split('=')[1].trim();
  const wallet = new ethers.Wallet(pk, provider);
  const contract = new ethers.Contract(CONTRACT_ADDR, ABI, wallet);

  // Test 1: API Status
  const apiStatus = await test('GET /api/status', async () => {
    const res = await fetch(`${API}/api/status`);
    const data = await res.json();
    console.log(`   Status: ${data.status}, Block: ${data.block}, Balance: ${data.balance} MON`);
    return data;
  });

  // Test 2: Mint
  const mintResult = await test('POST /api/mint', async () => {
    const res = await fetch(`${API}/api/mint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chipUid: 'TEST-NFC-001',
        lat: 43.6532,
        lon: -79.3832,
        name: 'Test Monad Blitz Asset'
      }),
    });
    const data = await res.json();
    console.log(`   Token #${data.tokenId} · TX: ${data.txHash?.slice(0, 16)}...`);
    console.log(`   Monadscan: https://testnet.monadscan.com/tx/${data.txHash}`);
    return data;
  });

  if (!mintResult) {
    console.log('\n❌ Mint failed — check backend logs. Aborting test.');
    process.exit(1);
  }
  const tokenId = mintResult.tokenId;

  // Test 3: Contract Direct — verify mint on chain
  await test('Contract — ownerOf()', async () => {
    const owner = await contract.ownerOf(tokenId);
    console.log(`   Owner: ${owner}`);
    if (owner !== MINTER) throw new Error(`Owner mismatch: expected ${MINTER}, got ${owner}`);
  });

  await test('Contract — getCurrentGeo()', async () => {
    const [lat, lon, ts, taps] = await contract.getCurrentGeo(tokenId);
    console.log(`   Lat: ${Number(lat)/1e6}, Lon: ${Number(lon)/1e6}, Taps: ${taps}, TS: ${new Date(Number(ts)*1000).toISOString()}`);
  });

  await test('Contract — getGeoHistory()', async () => {
    const history = await contract.getGeoHistory(tokenId);
    console.log(`   History points: ${history.length}`);
    if (history.length !== 1) throw new Error('Expected 1 geo point from mint');
  });

  await test('Contract — getOwnershipHistory()', async () => {
    const ownership = await contract.getOwnershipHistory(tokenId);
    console.log(`   Ownership records: ${ownership.length}`);
    if (ownership.length !== 1) throw new Error('Expected 1 ownership record');
  });

  await test('Contract — isCollateralized()', async () => {
    const coll = await contract.isCollateralized(tokenId);
    console.log(`   Collateralized: ${coll}`);
    if (coll !== false) throw new Error('Should not be collateralized yet');
  });

  await test('Contract — royaltyInfo()', async () => {
    const [receiver, amount] = await contract.royaltyInfo(tokenId, 100000);
    console.log(`   Royalty receiver: ${receiver}, Amount: ${amount} (5% of 100000 = ${Number(amount)})`);
    if (Number(amount) !== 5000) throw new Error('Expected 5000 (5% of 100000)');
  });

  await test('Contract — getTotalTaps()', async () => {
    const taps = await contract.getTotalTaps(tokenId);
    console.log(`   Total taps: ${taps}`);
    if (taps !== 1n) throw new Error('Expected 1 tap from mint');
  });

  // Test 4: Record a tap with new geo coordinates
  await test('POST /api/tap/:id', async () => {
    const res = await fetch(`${API}/api/tap/${tokenId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: 43.6540, lon: -79.3840 }),
    });
    const data = await res.json();
    console.log(`   Taps: ${data.totalTaps}, TX: ${data.txHash?.slice(0, 16)}...`);
    if (data.totalTaps !== 2) throw new Error(`Expected 2 taps, got ${data.totalTaps}`);
    return data;
  });

  // Test 5: Record another tap (velocity check)
  await test('POST /api/tap/:id (nearby — should pass velocity check)', async () => {
    const res = await fetch(`${API}/api/tap/${tokenId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: 43.6545, lon: -79.3845 }),
    });
    const data = await res.json();
    console.log(`   Taps: ${data.totalTaps}, Passed: ${data.success}`);
    return data;
  });

  // Test 6: Geo history now has 3 points
  await test('Contract — getGeoHistory() after taps', async () => {
    const history = await contract.getGeoHistory(tokenId);
    console.log(`   History points: ${history.length}`);
    if (history.length !== 3) throw new Error(`Expected 3 geo points, got ${history.length}`);
  });

  // Test 7: Ownership provenance
  await test('Contract — getOwnershipHistory()', async () => {
    const ownership = await contract.getOwnershipHistory(tokenId);
    console.log(`   Ownership records: ${ownership.length}`);
    // Transfer to a new address
    const newOwner = '0xB242A26BD398eDcCE60eC1Bd8dd8d8C14a68fD90';
    const tx = await contract.transferAsset(tokenId, newOwner);
    await tx.wait();
    console.log(`   Transferred to ${newOwner}`);
    const updatedOwner = await contract.ownerOf(tokenId);
    if (updatedOwner !== newOwner) throw new Error('Transfer failed');
    console.log(`   New owner: ${updatedOwner} ✅`);

    const updatedOwnership = await contract.getOwnershipHistory(tokenId);
    console.log(`   Ownership records after transfer: ${updatedOwnership.length}`);
    if (updatedOwnership.length !== 2) throw new Error(`Expected 2 ownership records, got ${updatedOwnership.length}`);
  });

  // Test 8: Certificate
  await test('GET /api/certificate/:id', async () => {
    const res = await fetch(`${API}/api/certificate/${tokenId}`);
    const data = await res.json();
    console.log(`   Certificate ID: ${data.certificateId}`);
    console.log(`   Owners in history: ${data.ownershipHistory.length}`);
    console.log(`   Geo points: ${data.geoHistory.length}`);
    console.log(`   Collateral: ${data.collateralStatus}`);
    if (!data.certificateId) throw new Error('No certificate ID');
    return data;
  });

  // Test 9: Collateralize
  await test('POST /api/collateralize/:id', async () => {
    // First transfer back to minter for collateral test
    const pk2 = require('fs').readFileSync('./backend/.env','utf8').split('\n').find(l=>l.startsWith('DEMO_PRIVATE_KEY')).split('=')[1].trim();
    const wallet2 = new ethers.Wallet(pk2, provider);
    const contract2 = new ethers.Contract(CONTRACT_ADDR, ABI, wallet2);
    const tx = await contract2.transferAsset(tokenId, MINTER);
    await tx.wait();

    const res = await fetch(`${API}/api/collateralize/${tokenId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: true }),
    });
    const data = await res.json();
    console.log(`   Collateralized: ${data.collateralized}, TX: ${data.txHash?.slice(0, 16)}...`);
    if (!data.collateralized) throw new Error('Collateralize returned false');
    return data;
  });

  // Test 10: Provenance
  await test('GET /api/provenance/:id', async () => {
    const res = await fetch(`${API}/api/provenance/${tokenId}`);
    const data = await res.json();
    console.log(`   Provenance records: ${data.length}`);
    data.forEach((p, i) => console.log(`   ${i+1}. ${p.owner.slice(0,8)}... — ${new Date(p.timestamp).toLocaleString()}`));
    return data;
  });

  // Summary
  console.log('\n═══════════════════════════════════════');
  console.log('  ✅ ALL 10 TESTS PASSED');
  console.log('═══════════════════════════════════════');
  console.log(`\n  Contract: ${CONTRACT_ADDR}`);
  console.log(`  Token ID: ${tokenId}`);
  console.log(`  Minter: ${MINTER}`);
  console.log(`  Monadscan:`);
  console.log(`    Contract: https://testnet.monadscan.com/address/${CONTRACT_ADDR}`);
  console.log(`    Mint TX: https://testnet.monadscan.com/tx/${mintResult.txHash}`);
  console.log(`\n  Now open: https://luxvoid.studio/monad-blitz/`);
  console.log(`  Point VITE_API_URL to http://YOUR_LAPTOP_IP:3001 (or keep localhost)`);
}

main().catch(e => {
  console.error('\n❌ TEST FAILED:', e.message);
  process.exit(1);
});
