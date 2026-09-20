@echo off
title Findora Smart Lock Ecosystem Launcher
color 0A

echo ========================================================
echo        STARTING FINDORA SMART LOCK ECOSYSTEM
echo ========================================================
echo.

echo [1/2] Starting Backend (API + ESP32 Port 8000 + Telegram Bot)...
start "Findora Backend (API + ESP32 + Telegram)" cmd /k "cd findora-backend && npm run dev"

timeout /t 3 /nobreak >nul

echo [2/2] Starting Frontend Web Application (Port 5173)...
start "Findora Frontend (React/Vite)" cmd /k "cd findora-frontend && npm run dev"

timeout /t 2 /nobreak >nul

echo.
echo ========================================================
echo                     ALL SYSTEMS LIVE!
echo ========================================================
echo   - Web App UI:      http://localhost:5173/lockers
echo   - Backend Server:  http://localhost:3001
echo   - ESP32 Port:      Port 8000 (/api/v1/box/verify-otp)
echo   - Telegram Bot:    @smartLostandFoundbot (Native)
echo ========================================================
echo.
echo Opening browser to Smart Lockers Dashboard in 3 seconds...
timeout /t 3 /nobreak >nul
start http://localhost:5173/lockers

pause
