@echo off
title Oracle EBS Intelligence Hub — Backend
color 0A
echo.
echo ================================================
echo   Oracle EBS Intelligence Hub v6.0
echo   Starting Backend...
echo ================================================
echo.
cd /d "%~dp0"
call venv\Scripts\activate.bat
cd backend
uvicorn app.main:app --reload --port 8000 --host 127.0.0.1
pause