@echo off
title MONAD ENGINE — LUXVOID PROTOCOL
cd /d "%~dp0backend"
echo.
echo  ╔═══════════════════════════════════════╗
echo  ║   MONAD BLITZ — LUXVOID ENGINE        ║
echo  ║   Enterprise Heartbeat System         ║
echo  ╚═══════════════════════════════════════╝
echo.
echo  Starting backend + watchdog...
echo  Ctrl+C to stop.
echo.
echo  Demo URL:  http://localhost:3001/
echo  Health:    http://localhost:3001/health
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0backend\start.ps1"
