@echo off
title LUXVOID MONAD BLITZ — DEMO LAUNCHER
cls
echo.
echo  ============================================
echo    LUXVOID - MONAD BLITZ DEMO
echo    Enterprise Launch Sequence
echo  ============================================
echo.
echo  Step 1: Starting backend on port 3001...
echo.
start "MONAD ENGINE" cmd /c "C:\Users\akash\source\monad-blitz\monad.cmd"
timeout /t 8 /nobreak >nul
echo.
echo  Step 2: Creating public tunnel...
echo  Your demo will be available at the URL below.
echo.
start "PUBLIC TUNNEL" cmd /c "npx localtunnel --port 3001"
echo.
echo  ============================================
echo    DEMO IS LIVE
echo  ============================================
echo.
echo  Local URL:    http://localhost:3001/
echo  Tunnel URL:   Check the tunnel window above
echo.
echo  Press any key to stop both services...
pause >nul
taskkill /f /fi "WINDOWTITLE eq MONAD ENGINE*" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq PUBLIC TUNNEL*" >nul 2>&1
echo.
echo  Demo stopped.
pause
