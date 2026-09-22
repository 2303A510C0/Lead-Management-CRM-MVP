@echo off
cd /d "%~dp0"
echo.
echo Starting Gharpayy LeadOps...
echo Open http://localhost:3000 in your browser.
echo Press Ctrl+C in this window to stop the server.
echo.
start "" http://localhost:3000
node backend\server.js
pause
