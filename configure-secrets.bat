@echo off
title Oracle EBS Intelligence Hub - Configure Secrets
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0configure-secrets.ps1"
echo.
pause
