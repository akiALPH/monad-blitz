@echo off
echo ╔═══════════════════════════════════════╗
echo ║  MONAD — Install System Command       ║
echo ╚═══════════════════════════════════════╝
echo.
set "MONAD_HOME=%~dp0"
echo  Installing monad command from: %MONAD_HOME%
echo.
setx MONAD_HOME "%MONAD_HOME%" >nul
for %%I in ("%MONAD_HOME%") do set "MONAD_SHORT=%%~dI%%~pI"
echo  Adding to system PATH...
setx PATH "%PATH%;%MONAD_HOME%" >nul
echo.
echo  ✅ DONE. Close and reopen any terminals.
echo.
echo  Now just type:  monad
echo.
echo  From any directory, any terminal.
echo  Auto-healing watchdog included.
echo.
pause
