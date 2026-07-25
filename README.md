# Monad Blitz — Luxvoid Protocol

**Physical → Digital → Collateral.** NFC chips in metal → Monad testnet → DeFi-ready.

Built at [Monad Blitz Toronto](https://lu.ma/MonadBlitzTO) hackathon, July 2026.

## Structure

```
smart-contract/   ── MonadBlitzAsset.sol + deploy.cjs
backend/          ── Express API server (port 3001)
frontend/         ── Vite + React SPA
backup/           ── lux-terminal.html (offline fallback)
```

## Quick Start

### 1. Deploy Contract

```bash
# Get testnet MON first: https://faucet.monad.xyz/
node smart-contract/deploy.cjs
# Saves contract address to deployed.json
```

### 2. Start Backend

```bash
cd backend
node server.cjs
# API at http://localhost:3001
```

### 3. Start Frontend (dev)

```bash
cd frontend
npm run dev
# App at http://localhost:5173/monad-blitz/
```

### 4. Production Build

```bash
cd frontend
npm run build
# Output in frontend/dist/ — deploy to any static host
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/status | Backend + wallet state |
| POST | /api/mint | Mint asset on Monad testnet |
| GET | /api/assets | List all minted assets |
| POST | /api/transfer | Transfer ownership |
| POST | /api/collateralize/:id | Toggle collateral status |
| GET | /api/royalty/:id | Get royalty info |

## Demo Flow

1. Open `luxvoid.studio/monad-blitz/`
2. Tap the gold coin button (simulates NFC tap)
3. Watch terminal log: NFC detect → GPS lock → Monad mint
4. View 3-pillar dashboard: Transfer + Royalty + Geo
5. Flag asset as collateral
6. View collateral pool with LTV calculator

## Backup

If backend is offline, open `backup/lux-terminal.html` in Chrome. Full simulated demo, zero dependencies.

## License

MIT
