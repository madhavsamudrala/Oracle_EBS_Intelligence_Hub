@echo off
title Oracle EBS Intelligence Hub — Full Stack
color 0A
echo.
echo ================================================
echo   Oracle EBS Intelligence Hub v6.0
echo   Starting All Services
echo ================================================
echo.
cd /d "%~dp0"
if not exist "backend\.env" (
    echo [WARN] backend\.env not found - chat will use local answers only.
    echo [WARN] Run configure-secrets.bat first to connect the ICA agent.
    echo.
)
echo [INFO] Starting Backend...
start "EBS Backend" cmd /k "call venv\Scripts\activate.bat && cd backend && uvicorn app.main:app --reload --port 8000 --host 127.0.0.1"
echo [INFO] Waiting for backend to start...
timeout /t 5 /nobreak >nul
echo [INFO] Starting Frontend...
start "EBS Frontend" cmd /k "python -m http.server 8080 --bind 127.0.0.1"
echo [INFO] Waiting for frontend to start...
timeout /t 3 /nobreak >nul
echo.
echo ================================================
echo   All Services Started
echo ================================================
echo.
echo   Frontend : http://localhost:8080/oracle-ebs-intelligence-hub.html
echo   Backend  : http://localhost:8000
echo   API Docs : http://localhost:8000/docs
echo   Health   : http://localhost:8000/health
echo.
start "" "http://localhost:8080/oracle-ebs-intelligence-hub.html"
echo [INFO] Press any key to close this window
pause >nul