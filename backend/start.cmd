@echo off
title MONAD BLITZ ENGINE — LUXVOID
cd /d "%~dp0"
echo [%date% %time%] Starting Monad Blitz Engine...
echo Log: server.log
echo.

:restart
node server.cjs >> server.log 2>&1
echo [%date% %time%] Server exited. Restarting in 3 seconds...
choice /t 3 /d y /n >nul
goto restart
