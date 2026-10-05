@echo off
cd /d "%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-and-run.ps1"
if errorlevel 1 (
  echo.
  echo Setup did not finish. Do not use the app yet.
  pause
)
