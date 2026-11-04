@echo off
title Oracle EBS Intelligence Hub — Frontend
color 0B
echo.
echo ================================================
echo   Oracle EBS Intelligence Hub v6.0
echo   Starting Frontend...
echo ================================================
echo.
cd /d "%~dp0"
echo [INFO] Frontend running on http://localhost:8080
echo [INFO] Press Ctrl+C to stop
echo.
start "" "http://localhost:8080/oracle-ebs-intelligence-hub.html"
python -m http.server 8080 --bind 127.0.0.1
pause