batch
@echo off
title Oracle EBS Intelligence Hub - ICA Test
color 0E
echo.
echo ================================================
echo   ICA Integration Test Suite
echo ================================================
echo.
echo TEST 1 - Health Check
echo ------------------------------------------------
curl -s http://localhost:8000/health
echo.
echo.
echo TEST 2 - AP Reports
echo ------------------------------------------------
curl -s -X POST http://localhost:8000/api/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"message\": \"Which reports are available for Accounts Payable?\"}"
echo.
echo.
echo TEST 3 - SQL Compliance
echo ------------------------------------------------
curl -s -X POST http://localhost:8000/api/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"message\": \"What SQL rules apply to ap_invoices_all?\"}"
echo.
echo.
echo TEST 4 - Column Mapping
echo ------------------------------------------------
curl -s -X POST http://localhost:8000/api/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"message\": \"What does Supplier Name map to in EBS?\"}"
echo.
echo.
echo TEST 5 - P2P Process
echo ------------------------------------------------
curl -s -X POST http://localhost:8000/api/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"message\": \"Explain the P2P process in Oracle EBS\"}"
echo.
echo.
echo ================================================
echo   Tests Complete
echo ================================================
echo   source ica_live     = ICA fully working
echo   source local_fallback = ICA not connected
echo ================================================
echo.
pause
