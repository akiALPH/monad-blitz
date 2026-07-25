@echo off
title LUXVOID STUDIO - GO LIVE
cd /d "C:\Users\akash\source\monad-blitz"
cls
echo.
echo  ============================================
echo    LUXVOID STUDIO - GO LIVE
echo    Cloudflare Tunnel Enterprise Setup
echo  ============================================
echo.
echo  This will wire luxvoid.studio to your local server.
echo.
echo  Step 1: Start the engine on port 3001
echo.
start "MONAD ENGINE" cmd /c "monad.cmd"
timeout /t 8 /nobreak >nul
echo.
echo  Step 2: Login to Cloudflare (opens browser)
echo.
start "" "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel login
echo.
echo  A browser window will open. Login to Cloudflare.
echo  After login, come back here and press any key...
echo.
pause >nul
echo.
echo  Step 3: Create tunnel for luxvoid.studio
echo.
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel create monad-blitz
echo.
echo  Step 4: Route domain to tunnel
echo.
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel route dns monad-blitz luxvoid.studio
echo.
echo  ============================================
echo    LUXVOID STUDIO IS LIVE
echo  ============================================
echo.
echo  Open https://luxvoid.studio in your browser.
echo.
echo  To stop: press Ctrl+C in the mono engine window.
echo.
pause
