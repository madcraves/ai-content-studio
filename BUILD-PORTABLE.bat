@echo off
setlocal
cd /d "%~dp0"
title AI Content Studio - Portable x64 Builder

echo =====================================================
echo       AI Content Studio - Portable x64 Builder
echo =====================================================
echo.
echo This local build helper needs Node.js on THIS build computer.
echo End-user computers do NOT need Node.js to run the finished EXE.
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed on this build computer.
  echo For a build without installing Node.js locally, follow:
  echo BUILD-PORTABLE-VIA-GITHUB.md
  echo.
  start "" "%~dp0BUILD-PORTABLE-VIA-GITHUB.md"
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Repair the Node.js installation on this build computer.
  pause
  exit /b 1
)
echo Installing project dependencies...
call npm install
if errorlevel 1 goto failed
echo.
echo Building Windows x64 portable EXE...
call npm run dist:portable
if errorlevel 1 goto failed
echo.
echo Build complete. Output: %~dp0release\portable\
if exist "%~dp0release\portable" start "" "%~dp0release\portable"
pause
exit /b 0
:failed
echo.
echo Build failed. Use BUILD-PORTABLE-VIA-GITHUB.md for a cloud Windows build.
pause
exit /b 1
