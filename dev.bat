@echo off
SETLOCAL

echo ==========================================
echo Oaktree Agent - Local Development Launcher
echo ==========================================

:: Start Backend
echo Starting Backend (Cloudflare Worker)...
start "Oaktree Backend" cmd /c "cd backend && npm run dev -- --remote --persist-to=../.d1-data"

:: Start Frontend
echo Starting Frontend (Astro)...
start "Oaktree Frontend" cmd /c "cd frontend && npm run dev -- --persist-to=../.d1-data"

echo.
echo Both services are starting in new windows.
echo - Backend: http://localhost:8787
echo - Frontend: http://localhost:4321
echo.
pause
