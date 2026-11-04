batch
@echo off
title Oracle EBS Intelligence Hub — First Time Setup
color 0B
echo.
echo ================================================
echo   Oracle EBS Intelligence Hub v6.0
echo   First Time Setup
echo ================================================
echo.
REM Navigate to project root
cd /d "%~dp0"
REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found.
    echo [ERROR] Download from https://www.python.org/downloads/
    echo [ERROR] Make sure to check "Add Python to PATH" during install
    pause
    exit /b 1
)
echo [INFO] Python found:
python --version
echo.
REM Create virtual environment
echo [INFO] Creating virtual environment...
python -m venv venv
if errorlevel 1 (
    echo [ERROR] Failed to create virtual environment
    pause
    exit /b 1
)
echo [INFO] Virtual environment created successfully
echo.
REM Activate virtual environment
echo [INFO] Activating virtual environment...
call venv\Scripts\activate.bat
REM Upgrade pip
echo [INFO] Upgrading pip...
python -m pip install --upgrade pip --quiet
REM Install backend dependencies
echo [INFO] Installing backend dependencies...
pip install -r backend\requirements.txt
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)
echo.
echo [INFO] Dependencies installed successfully
echo.
REM Setup .env if not exists
if not exist "backend\.env" (
    echo [INFO] Creating backend\.env from template...
    copy "backend\.env.example" "backend\.env"
    echo.
    echo ================================================
    echo   ACTION REQUIRED
    echo ================================================
    echo.
    echo   Please open backend\.env and fill in:
    echo.
    echo   ICA_WORKFLOW_URL = your ICA workflow URL
    echo   ICA_API_KEY      = your ICA API key
    echo   ICA_CONTEXT_ID   = your context ID
    echo.
    echo   File location:
    echo   %~dp0backend\.env
    echo.
) else (
    echo [INFO] backend\.env already exists - skipping
)
echo.
echo ================================================
echo   Setup Complete
echo ================================================
echo.
echo   Next Steps:
echo   1. Update backend\.env with your ICA credentials
echo   2. Run start-all.bat to launch everything
echo   3. Open http://localhost:8080/oracle-ebs-intelligence-hub.html
echo.
pause