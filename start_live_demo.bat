@echo off
title CommunityPulse Live Demo Launcher
echo ========================================================
echo   Starting CommunityPulse AI Live Demo (3 Portals)
echo ========================================================
echo.
set PATH=C:\Program Files\nodejs;C:\Program Files (x86)\cloudflared;%PATH%

start "Backend Server (Port 3000)" cmd /k "cd backend && npm.cmd run dev"
timeout /t 3 /nobreak >nul
start "Frontend Vite Server (Port 5173)" cmd /k "cd frontend && npm.cmd run dev -- --host"
timeout /t 3 /nobreak >nul
start "Cloudflare Live Public Tunnel" cmd /k "cloudflared tunnel --url http://localhost:5173"

echo.
echo All 3 services launched!
echo Access Portals:
echo   - Admin Command Center : http://localhost:5173/
echo   - Volunteer Field Portal: http://localhost:5173/volunteer
echo   - Citizen Distress Portal: http://localhost:5173/report
echo.
pause
