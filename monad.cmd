@echo off
title MONAD ENGINE - LUXVOID PROTOCOL
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

:restart
echo [%date% %time%] Starting engine...
node server.cjs
echo [%date% %time%] Server stopped. Restarting in 3 seconds...
ping -n 4 127.0.0.1 >nul
goto restart
