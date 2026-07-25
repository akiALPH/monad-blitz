# Monad Blitz Engine — Heartbeat Server

## Quick Start (any terminal)

```bash
# From anywhere — CMD:
C:\Users\akash\source\monad-blitz\backend\start.cmd

# From anywhere — PowerShell:
C:\Users\akash\source\monad-blitz\backend\start.ps1

# Or directly (one-shot):
cd C:\Users\akash\source\monad-blitz\backend
node server.cjs
```

## What's Here

| File | Purpose |
|------|---------|
| `server.cjs` | Main server — chdir to script dir, loads .env, all API endpoints |
| `start.cmd` | Windows CMD — double-click or run from any terminal. Auto-restarts on crash. |
| `start.ps1` | PowerShell watchdog — polls /health every 5s, restarts if down. Heartbeat. |
| `restart-if-down.cmd` | One-shot health check — run from scheduled task or manually to recover |
| `.env` | Configuration (wallet, RPC, contract addresses) |
| `server.log` | Auto-rotating log with timestamps |

## Recovery

If the server goes down:

```cmd
# Auto-recover (powershell watchdog, run once, keeps it alive):
start.ps1

# Manual restart:
start.cmd

# One-shot check + restart:
restart-if-down.cmd
```

## Health Check

```
GET http://localhost:3001/health
→ { "status": "ok", "uptime": 123, "pid": 12345, "port": 3001 }
```

The watchdog (`start.ps1`) polls this every 5 seconds. If it fails 3 times, the server is restarted.
