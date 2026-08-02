@echo off
title Watchword
cd /d "%~dp0"

echo.
echo   Starting Watchword...
echo.

where node >nul 2>nul
if %errorlevel% equ 0 (
    node serve.mjs
    goto :stopped
)

REM No Node, but Python ships with many school images.
where python >nul 2>nul
if %errorlevel% equ 0 (
    echo   Using Python. Opening http://localhost:8000
    echo   Press Ctrl+C to stop.
    echo.
    start "" http://localhost:8000
    python -m http.server 8000
    goto :stopped
)

echo   Neither Node.js nor Python was found on this computer.
echo.
echo   Watchword needs one of them to run locally, because browsers
echo   block index.html from loading its code straight off the disk.
echo.
echo   Easiest fix: play the online version instead - it needs nothing
echo   installed and works on Chromebooks too:
echo.
echo       https://audiophrases.github.io/Watchword/
echo.
echo   Otherwise install Node.js from https://nodejs.org and run this again.
echo.
pause
goto :eof

:stopped
echo.
echo   Watchword has stopped.
echo.
pause
