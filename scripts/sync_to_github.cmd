@echo off
setlocal
title SGOU Database - Production Sync
color 0A

echo ================================================================
echo  SGOU Academic Database — 1-Click Production Sync
echo  Target: D:\Github\sgou-slm-database
echo ================================================================
echo.

python "%~dp0sync_to_github.py"

if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Synchronization completed cleanly.
) else (
    color 0C
    echo [ERROR] Synchronization encountered an issue. Exit code: %ERRORLEVEL%
)

echo.
echo Press any key to close this window...
pause >nul
