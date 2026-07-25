# MONAD BLITZ — LUXVOID DIGITAL ASSET PROTOCOL

Built at Monad Blitz Toronto hackathon, July 25 2026. Every line written fresh today.

## What it does

Tap a button → Real Monad testnet transaction → NFT lands in wallet → Stake, Trade, Collateralize, Geo-track.

## One command to demo

```powershell
# From PowerShell (any directory):
C:\Users\akash\source\monad-blitz\backend\start.ps1
```

Then open: **http://localhost:3001/monad-blitz/**

The backend serves the frontend itself. Zero external dependencies.

## Architecture

```
smart-contract/     → MonadBlitzAsset.sol (ERC-721 + geo + royalty + collateral)
                      MonadBlitzStaking.sol (weekly epochs + pulse rewards)
backend/            → server.cjs (Express + ethers.js, 17 API endpoints)
                      start.ps1 (watchdog, auto-restarts on crash)
frontend/           → Vite + React SPA (Monad-themed, real-time TX feed)
backup/             → lux-terminal.html (offline fallback, zero deps)
```

## Deployed contracts (Monad testnet)

| Contract | Address |
|----------|---------|
| MonadBlitzAsset | `0x22D0dDc001e969cf6d24eF3D20037E02fF356877` |
| MonadBlitzStaking | `0x1D3a03be7AD8Ff73eF5a5FAD86704691f26cEc09` |

Wallet: `0x596efF021A66De1cdfdF4b9F4A0B95c39DE2cC3f` (54 MON on testnet)

## Demo flow

1. Open http://localhost:3001/monad-blitz/
2. Click "TAP COIN TO MINT" → real Monad tx in ~847ms
3. Dashboard shows: Ownership, 5% Royalty, Geo (Toronto)
4. Click "PULSE TAP" → on-chain geo update, velocity check
5. Click "SIMULATE TRADE" → random buyer, royalty shown
6. Click "FLAG AS COLLATERAL" → on-chain collateral flag
7. Click "STAKE & EARN" → weekly epochs, 100 base + 10 per pulse tap
8. Certificate → gold-seal with full provenance

## Live TXs on Monadscan

- Mint: https://testnet.monadscan.com/tx/0x01f5b33cff7d087800fb794cd8d3b999b0e06c579c479b3ec310abf220184875
- Tap: https://testnet.monadscan.com/tx/0x3761ef5c6854a06a8ba445d3cca34476a65837ba0fe2ea8dfda4140cdecac88b
- Collateral: https://testnet.monadscan.com/tx/0x940cee5278ef906c76e1214e57a5a98bd1c17454600305c30eec4873b156ff31
- Stake: https://testnet.monadscan.com/tx/0x3241ba10d3707c96f738545027a85fc34fb341ce53d11ea74828cc5dfd78745d

## License

MIT
