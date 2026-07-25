@echo off
echo ============================================
echo   MONAD - Install System Command
echo ============================================
echo.
echo  Installing monad command permanently...
echo.
copy /Y "%~dp0monad.cmd" "%LOCALAPPDATA%\Microsoft\WindowsApps\monad.cmd" >nul
echo  [1/2] Copied to: %%LOCALAPPDATA%%\Microsoft\WindowsApps\monad.cmd
echo  [2/2] WindowsApps is already in PATH - ready to go.
echo.
echo  Done! Close and reopen any terminal.
echo.
echo  Now type:  monad
echo.
echo  From any directory, any terminal.
echo  Auto-healing watchdog included.
echo.
pause
