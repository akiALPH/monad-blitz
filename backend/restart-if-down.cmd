@echo off
cd /d "%~dp0"
echo [%date% %time%] Checking backend health...
curl -s http://localhost:3001/health >nul 2>&1
if errorlevel 1 (
    echo [%date% %time%] Server is DOWN. Restarting...
    start "" cmd /c "cd /d "%~dp0" && node server.cjs"
    echo [%date% %time%] Restart initiated.
) else (
    echo [%date% %time%] Server is OK.
)
