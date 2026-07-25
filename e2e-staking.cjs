const { ethers } = require('./backend/node_modules/ethers');
const fs = require('fs');

const RPC = 'https://testnet-rpc.monad.xyz';
const deployed = JSON.parse(fs.readFileSync('./deployed.json','utf8'));
const stakingDeployed = JSON.parse(fs.readFileSync('./staking-deployed.json','utf8'));
const ASSET_CONTRACT = deployed.address;
const STAKING_CONTRACT = stakingDeployed.address;
const PK = process.env.MONAD_PRIVATE_KEY || fs.readFileSync('./backend/.env','utf8').split('\n').find(l=>l.startsWith('MONAD_PRIVATE_KEY')).split('=')[1].trim();

const ABI = [
  'function stake(uint256)',
  'function unstake(uint256)',
  'function claimRewards(uint256)',
  'function calculateRewards(uint256) view returns (uint256)',
  'function getStakeInfo(uint256) view returns (address,uint256,uint256,uint256,uint256)',
  'function currentEpoch() view returns (uint256)',
  'function totalStaked() view returns (uint256)',
];

const ASSET_ABI = [
  'function getTotalTaps(uint256) view returns (uint256)',
  'function ownerOf(uint256) view returns (address)',
  'function transferAsset(uint256,address)',
  'function mintAsset(uint256,string,int32,int32,string) returns (uint256)',
  'function totalSupply() view returns (uint256)',
];

(async () => {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);
  const asset = new ethers.Contract(ASSET_CONTRACT, ASSET_ABI, wallet);
  const staking = new ethers.Contract(STAKING_CONTRACT, ABI, wallet);

  console.log('═══════════════════════════════════════');
  console.log('  E2E STAKING TEST');
  console.log('═══════════════════════════════════════\n');

  // Check staking contract state
  const epoch = await staking.currentEpoch();
  const totalStaked = await staking.totalStaked();
  console.log('Epoch:', Number(epoch));
  console.log('Total staked:', Number(totalStaked));

  // Get existing asset or mint new one
  const supply = Number(await asset.totalSupply());
  let tokenId;
  if (supply > 0) {
    // Use existing
    tokenId = 525072; // known token from earlier test
  } else {
    const hash = require('crypto').createHash('sha256').update('STAKING-TEST-'+Date.now()).digest();
    tokenId = (BigInt('0x'+hash.subarray(0,8).toString('hex')) % 999999n) + 1n;
    console.log('\nMinting test token #'+tokenId+'...');
    const tx = await asset.mintAsset(tokenId, 'STAKING-TEST', 43653200, -79383200, '{}');
    await tx.wait();
  }
  console.log('Token ID:', tokenId.toString());

  // Check owner
  const owner = await asset.ownerOf(tokenId);
  console.log('Owner:', owner);
  if (owner !== wallet.address) {
    // Transfer back
    const DEMO_PK = '0xe0c7a668b8f0c5b592ff31c61444c4eba13fd668bf2458b0651230709bda7baa';
    const w2 = new ethers.Wallet(DEMO_PK, provider);
    const c2 = new ethers.Contract(ASSET_CONTRACT, ASSET_ABI, w2);
    console.log('Transferring back to minter...');
    const tx = await c2.transferAsset(tokenId, wallet.address);
    await tx.wait();
  }

  // Stake
  console.log('\nStaking...');
  const tx1 = await staking.stake(tokenId);
  await tx1.wait();
  console.log('✅ Staked. TX:', tx1.hash);
  console.log('   Monadscan: https://testnet.monadscan.com/tx/' + tx1.hash);

  // Check stake info
  const info = await staking.getStakeInfo(tokenId);
  console.log('Staker:', info[0]);
  console.log('Pending rewards:', info[3].toString());
  console.log('Taps at stake:', Number(info[4]));

  // Unstake
  console.log('\nUnstaking...');
  const tx2 = await staking.unstake(tokenId);
  await tx2.wait();
  console.log('✅ Unstaked. TX:', tx2.hash);

  // Everything worked
  console.log('\n═══════════════════════════════════════');
  console.log('  ✅ STAKING TEST PASSED');
  console.log('═══════════════════════════════════════');
  console.log('Asset contract:', ASSET_CONTRACT);
  console.log('Staking contract:', STAKING_CONTRACT);
  console.log('Stake TX:', tx1.hash);
  console.log('Unstake TX:', tx2.hash);
})().catch(e => { console.error('\n❌', e.message); process.exit(1); });
