Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Oaktree Agent - Local Development Launcher" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Start Backend
Write-Host "Starting Backend (Cloudflare Worker)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; npm run dev -- --remote --persist-to=../.d1-data"

# Start Frontend
Write-Host "Starting Frontend (Astro)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev -- --persist-to=../.d1-data"

Write-Host "`nBoth services are starting in new windows."
Write-Host "- Backend: http://localhost:8787"
Write-Host "- Frontend: http://localhost:4321"
Write-Host "`nPress any key to exit this launcher..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
