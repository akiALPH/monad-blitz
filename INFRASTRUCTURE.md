# LUXVOID MONAD BLITZ — Enterprise Infrastructure

## One-Command Demo

Open a **REAL PowerShell window** (not the chat) and type:

```powershell
monad
```

This starts the backend + frontend server on port 3001. Open http://localhost:3001/ in your browser.

## Public URL for luxvoid.studio

Open a **SECOND PowerShell window** and type:

```powershell
npx localtunnel --port 3001
```

This gives you a URL like `https://some-id.loca.lt/`. Anyone can access your demo at that URL.

For luxvoid.studio: set a CNAME in Cloudflare pointing to the localtunnel URL.

## Permanent Infrastructure

### Option A: Windows Service (most stable)
```powershell
# From PowerShell as Administrator:
New-Service -Name "MonadEngine" -BinaryPathName "C:\Users\akash\source\monad-blitz\backend\node.exe C:\Users\akash\source\monad-blitz\backend\server.cjs" -StartupType Automatic
Start-Service -Name "MonadEngine"
```

### Option B: Docker (after Docker Desktop settles)
```powershell
cd C:\Users\akash\source\monad-blitz
docker compose up -d
```

### Option C: Scheduled Task (auto-start on login)
```powershell
# From PowerShell:
$action = New-ScheduledTaskAction -Execute "C:\Users\akash\source\monad-blitz\start-demo.cmd"
$trigger = New-ScheduledTaskTrigger -AtLogOn
Register-ScheduledTask -TaskName "MonadEngine" -Action $action -Trigger $trigger
```

## Architecture

```
Your Browser → http://localhost:3001/
                   │
            ┌──────┴──────┐
            │  server.cjs  │  ← Express.js (Node 22)
            │  port 3001   │
            └──────┬──────┘
                   │
        ┌──────────┼──────────┐
        │          │          │
   Frontend    Monad RPC   Contracts
   (React)    testnet      on-chain
   /frontend   .xyz        0x22D0...
   /dist                   0x1D3a...
```

## Monitoring

```powershell
# Check port is listening
netstat -ano | findstr :3001

# View server logs
Get-Content "C:\Users\akash\source\monad-blitz\backend\server.log" -Tail 20 -Wait

# Health check
curl http://localhost:3001/health
```
