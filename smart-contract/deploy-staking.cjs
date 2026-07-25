const solc = require('solc');
const { ethers } = require('../backend/node_modules/ethers');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', 'backend', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim(); if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('='); if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

const RPC = process.env.MONAD_RPC || 'https://testnet-rpc.monad.xyz';
const CHAIN_ID = parseInt(process.env.MONAD_CHAIN_ID || '10143');
const PRIVATE_KEY = process.env.MONAD_PRIVATE_KEY || '';

function compileContract() {
  const source = fs.readFileSync(path.join(__dirname, 'MonadBlitzStaking.sol'), 'utf8');
  const input = {
    language: 'Solidity',
    sources: { 'MonadBlitzStaking.sol': { content: source } },
    settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const contract = output.contracts['MonadBlitzStaking.sol']['MonadBlitzStaking'];
  if (!contract) {
    console.error('❌ Compilation failed:', JSON.stringify(output.errors, null, 2));
    process.exit(1);
  }
  return { abi: contract.abi, bytecode: '0x' + contract.evm.bytecode.object };
}

async function main() {
  console.log('╔═══════════════════════════════════════╗');
  console.log('║  Deploy MonadBlitzStaking              ║');
  console.log('╚═══════════════════════════════════════╝');

  if (!PRIVATE_KEY) { console.error('❌ Set MONAD_PRIVATE_KEY'); process.exit(1); }

  const deployedMain = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'deployed.json'), 'utf8'));
  const ASSET_CONTRACT = deployedMain.address;
  console.log(`   Asset contract: ${ASSET_CONTRACT}`);

  console.log('\n🔧 Compiling staking contract...');
  const { abi, bytecode } = compileContract();
  console.log(`   Bytecode: ${(bytecode.length/2).toLocaleString()} bytes`);

  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  console.log(`   Deployer: ${wallet.address}`);
  const balance = await provider.getBalance(wallet.address);
  console.log(`   Balance: ${ethers.formatEther(balance)} MON`);

  console.log('\n🔧 Deploying...');
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const contract = await factory.deploy(ASSET_CONTRACT);
  await contract.waitForDeployment();
  const addr = await contract.getAddress();

  console.log(`\n✅ Staking deployed: ${addr}`);
  console.log(`   Explorer: https://testnet.monadscan.com/address/${addr}`);

  const out = { address: addr, abi, assetContract: ASSET_CONTRACT, chainId: CHAIN_ID, deployedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(__dirname, '..', 'staking-deployed.json'), JSON.stringify(out, null, 2));
  console.log(`\n📝 Saved to staking-deployed.json`);
}

main().catch(e => { console.error('\n❌', e.message); process.exit(1); });
