$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServerPath = Join-Path $ScriptDir "server.cjs"
$WatchLog   = Join-Path $ScriptDir "watchdog.log"
$HealthUrl  = "http://localhost:3001/health"
$PollSec    = 5

Set-Location $ScriptDir

function Log($msg) {
  $t = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  $line = "[$t] $msg"
  Write-Host $line
  try { Add-Content -Path $WatchLog -Value $line } catch {}
}

function StartServer {
  $global:proc = Start-Process -FilePath "node" -ArgumentList $ServerPath -NoNewWindow -PassThru
  Log "SERVER STARTED -- PID: $($global:proc.Id)"
  Start-Sleep -Seconds 2
}

function StopServer {
  if ($global:proc -and !$global:proc.HasExited) {
    Stop-Process -Id $global:proc.Id -Force -ErrorAction SilentlyContinue
    Log "SERVER STOPPED -- PID: $($global:proc.Id)"
  }
}

Log "========================================"
Log " MONAD BLITZ - HEARTBEAT WATCHDOG"
Log "========================================"
Log " Script dir: $ScriptDir"
Log " Server:     $ServerPath"
Log " Watch:      /health every ${PollSec}s"
Log " Log:        $WatchLog"
Log " Working:    $(Get-Location)"
Log ""

StartServer

try {
  while ($true) {
    Start-Sleep -Seconds $PollSec

    if (!$global:proc -or $global:proc.HasExited) {
      Log "WARNING SERVER CRASHED - restarting..."
      StartServer
      continue
    }

    $ok = $false
    try {
      $req = [System.Net.WebRequest]::Create($HealthUrl)
      $req.Timeout = 3000
      $resp = $req.GetResponse()
      if ($resp.StatusCode -eq 200) { $ok = $true }
      $resp.Close()
    } catch {}

    if (!$ok) {
      Log "WARNING HEALTH CHECK FAILED - restarting..."
      StopServer
      Start-Sleep -Seconds 2
      StartServer
    }
  }
}
finally {
  StopServer
  Log "Watchdog exited."
}
