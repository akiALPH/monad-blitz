<#
.SYNOPSIS
  Monad Blitz Engine — Heartbeat Watchdog
  Auto-restarts the backend if it crashes.
  Works from any terminal. Drop-in and run.
.DESCRIPTION
  Starts server.cjs with auto-recovery.
  Polls /health every 5 seconds. Restarts on failure.
  Also logs to server.log and console with timestamps.
#>

$ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServerPath = Join-Path $ScriptPath "server.cjs"
$LogFile    = Join-Path $ScriptPath "server.log"
$HealthUrl  = "http://localhost:3001/health"
$PollSec    = 5

Set-Location $ScriptPath

function Write-Log($msg) {
  $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
  Write-Host $line
  Add-Content -Path $LogFile -Value $line
}

function Start-Server {
  $global:proc = Start-Process -FilePath "node" -ArgumentList "`"$ServerPath`"" -NoNewWindow -PassThru -RedirectStandardOutput $LogFile -RedirectStandardError $LogFile
  Write-Log "PID: $($proc.Id) — started"
}

function Stop-Server {
  if ($global:proc -and !$global:proc.HasExited) {
    Stop-Process -Id $global:proc.Id -Force -ErrorAction SilentlyContinue
    Write-Log "PID: $($global:proc.Id) — stopped"
  }
}

# ── Trap Ctrl+C ──
$Script:running = $true
Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action { $Script:running = $false; Stop-Server } | Out-Null

Write-Log "═══════════════════════════════════════"
Write-Log " MONAD BLITZ — HEARTBEAT WATCHDOG"
Write-Log "═══════════════════════════════════════"
Write-Log " PID: $([System.Diagnostics.Process]::GetCurrentProcess().Id)"
Write-Log " Server: $ServerPath"
Write-Log " Poll: /health every ${PollSec}s"
Write-Log " Log: $LogFile"
Write-Log ""

Start-Server

while ($Script:running) {
  Start-Sleep -Seconds $PollSec

  if (!$global:proc -or $global:proc.HasExited) {
    Write-Log "⚠ SERVER DOWN — restarting..."
    Start-Server
    Start-Sleep -Seconds 2
    continue
  }

  try {
    $req = [System.Net.WebRequest]::Create($HealthUrl)
    $req.Timeout = 3000
    $resp = $req.GetResponse()
    $resp.Close()
  } catch {
    Write-Log "⚠ HEALTH CHECK FAILED — restarting..."
    Stop-Server
    Start-Sleep -Seconds 1
    Start-Server
  }
}

Write-Log "Watchdog exited."
