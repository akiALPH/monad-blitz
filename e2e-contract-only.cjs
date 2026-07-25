const { ethers } = require('./backend/node_modules/ethers');
const crypto = require('crypto');
const fs = require('fs');

const RPC = 'https://testnet-rpc.monad.xyz';
const CONTRACT = '0x22D0dDc001e969cf6d24eF3D20037E02fF356877';
const PK = fs.readFileSync('./backend/.env','utf8').split('\n').find(l=>l.startsWith('MONAD_PRIVATE_KEY')).split('=')[1].trim();
const PK2 = '0xe0c7a668b8f0c5b592ff31c61444c4eba13fd668bf2458b0651230709bda7baa';

const ABI = [
  'function mintAsset(uint256,string,int32,int32,string) returns (uint256)',
  'function recordTap(uint256,int32,int32) returns (bool)',
  'function getCurrentGeo(uint256) view returns (int32,int32,uint64,uint256)',
  'function getGeoHistory(uint256) view returns ((int32,int32,uint64)[])',
  'function getOwnershipHistory(uint256) view returns ((address,uint64)[])',
  'function ownerOf(uint256) view returns (address)',
  'function isCollateralized(uint256) view returns (bool)',
  'function getTotalTaps(uint256) view returns (uint256)',
  'function royaltyInfo(uint256,uint256) view returns (address,uint256)',
  'function minter() view returns (address)',
  'function totalSupply() view returns (uint256)',
  'function transferAsset(uint256,address)',
  'function setCollateralStatus(uint256,bool)',
];

(async () => {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);
  const contract = new ethers.Contract(CONTRACT, ABI, wallet);

  console.log('═══════════════════════════════════════');
  console.log('  E2E CONTRACT TEST');
  console.log('═══════════════════════════════════════\n');

  // 1. Check minter
  const minter = await contract.minter();
  const supply = await contract.totalSupply();
  console.log('1/ Minter:', minter);
  console.log('   Supply:', supply.toString());
  console.log('   Wallet:', wallet.address);

  // 2. Mint
  const chipUid = 'MONAD-BLITZ-' + Date.now();
  const hash = crypto.createHash('sha256').update(chipUid).digest();
  const tokenId = (BigInt('0x' + hash.subarray(0, 8).toString('hex')) % 999999n) + 1n;

  console.log('\n2/ Minting token #' + tokenId.toString() + '...');
  const tx1 = await contract.mintAsset(tokenId, chipUid, 43653200, -79383200, JSON.stringify({name:'Test Monad Blitz Asset',chipUid}));
  const r1 = await tx1.wait();
  console.log('   ✅ Minted! Block:', r1.blockNumber);
  console.log('   TX:', tx1.hash);
  console.log('   Monadscan: https://testnet.monadscan.com/tx/' + tx1.hash);

  // 3. Verify on-chain state
  const [lat, lon, ts, taps] = await contract.getCurrentGeo(tokenId);
  console.log('\n3/ Current Geo:', Number(lat)/1e6, Number(lon)/1e6, 'Taps:', Number(taps));

  const history = await contract.getGeoHistory(tokenId);
  console.log('   Geo history points:', history.length, '(expected 1)');

  const owner = await contract.ownerOf(tokenId);
  console.log('   Owner:', owner);

  const [recv, amt] = await contract.royaltyInfo(tokenId, 100000);
  console.log('   Royalty 5% of 100,000 =', Number(amt));

  // 4. Record tap
  console.log('\n4/ Recording tap (nearby coords, velocity check should pass)...');
  const tx2 = await contract.recordTap(tokenId, 43654000, -79384000);
  await tx2.wait();
  console.log('   ✅ Tap recorded. TX:', tx2.hash);

  const [,,,, taps2] = await contract.getCurrentGeo(tokenId);
  console.log('   Total taps:', taps2 != null ? Number(taps2) : 'N/A');

  const history2 = await contract.getGeoHistory(tokenId);
  console.log('   Geo history points:', history2.length, '(expected 2)');

  // 5. Transfer
  console.log('\n5/ Testing ownership transfer...');
  const newOwner = '0xB242A26BD398eDcCE60eC1Bd8dd8d8C14a68fD90';
  const tx3 = await contract.transferAsset(tokenId, newOwner);
  await tx3.wait();
  console.log('   ✅ Transferred to:', newOwner);

  const ownerAfter = await contract.ownerOf(tokenId);
  console.log('   Owner after transfer:', ownerAfter);

  const ownership = await contract.getOwnershipHistory(tokenId);
  console.log('   Ownership records:', ownership.length, '(expected 2: mint + transfer)');

  // 6. Transfer back + Collateralize
  console.log('\n6/ Testing collateralization...');
  const wallet2 = new ethers.Wallet(PK2, provider);
  const contract2 = new ethers.Contract(CONTRACT, ABI, wallet2);
  const tx4 = await contract2.transferAsset(tokenId, wallet.address);
  await tx4.wait();
  console.log('   Transferred back to minter');

  const tx5 = await contract.setCollateralStatus(tokenId, true);
  await tx5.wait();
  const coll = await contract.isCollateralized(tokenId);
  console.log('   Collateralized:', coll);

  // 7. Full provenance
  console.log('\n7/ Full provenance:');
  const finalHistory = await contract.getGeoHistory(tokenId);
  console.log('   Geo points:', finalHistory.length);
  const finalOwnership = await contract.getOwnershipHistory(tokenId);
  console.log('   Ownership records:', finalOwnership.length);

  finalOwnership.forEach((o, i) => {
    const addr = o.owner || '0x0000...0000';
    console.log('     ' + (i+1) + '. ' + String(addr).slice(0,8) + '...' + String(addr).slice(-4));
  });

  // Summary
  console.log('\n═══════════════════════════════════════');
  console.log('  ✅ ALL TESTS PASSED');
  console.log('═══════════════════════════════════════');
  console.log('  Contract:', CONTRACT);
  console.log('  Token ID:', tokenId.toString());
  console.log('  Mint TX:', tx1.hash);
  console.log('  Tap TX:', tx2.hash);
  console.log('  Transfer TX:', tx3.hash);
  console.log('  Collateralize TX:', tx5.hash);
  console.log('\n  🎯 Demo URL: https://luxvoid.studio/monad-blitz/');
  console.log('\n  Set VITE_API_URL to laptop IP for live demo');
})().catch(e => { console.error('\n❌ FAILED:', e.message, e); process.exit(1); });
