@echo off
echo.
echo ================================
echo    Starting Aiba PM
echo ================================
echo.

REM Kill any existing processes on ports 3001, 5173, 5174
echo Cleaning up ports...
node kill-ports.js

echo.
echo Starting backend and frontend servers...
echo.

REM Start both servers using concurrently
npm run dev

echo.
echo Note: Press Ctrl+C to stop all servers
echo.
