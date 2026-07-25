@echo off
title MONAD ENGINE — LUXVOID PROTOCOL
cd /d "C:\Users\akash\source\monad-blitz\backend"
cls
echo.
echo  ============================================
echo    MONAD BLITZ - LUXVOID ENGINE
echo    Enterprise Heartbeat System
echo  ============================================
echo.
echo  Demo URL:  http://localhost:3001/
echo  Health:    http://localhost:3001/health
echo  Ctrl+C to stop.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\akash\source\monad-blitz\backend\start.ps1"
