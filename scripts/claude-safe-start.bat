@echo off
setlocal

set /p TASKNAME=Enter task name (e.g. analyze-payment-flow, plan-monthly-chapter):

if "%TASKNAME%"=="" (
  echo Task name required.
  pause
  exit /b 1
)

echo.
echo Creating safe branch: claude/%TASKNAME%
git checkout -b claude/%TASKNAME%
if errorlevel 1 (
  echo Branch creation failed. Maybe it exists already? Try a different name.
  pause
  exit /b 1
)

echo.
echo Running preflight check...
call "%~dp0preflight-check.bat"

echo.
echo ==============================
echo  Starting Claude Code (Opus 4.7)
echo ==============================
echo Reminder: read CLAUDE.md, .ai/harness.md, docs/PRODUCT.md before answering.
echo.

claude

endlocal
pause
