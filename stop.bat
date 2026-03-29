@echo off
echo Stopping TabAware...

taskkill /f /im node.exe >nul 2>nul

echo Done.
pause