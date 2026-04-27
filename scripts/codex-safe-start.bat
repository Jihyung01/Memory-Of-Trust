@echo off
setlocal

set /p TASKNAME=Enter task name (e.g. fix-login-error, feat-monthly-chapter):

if "%TASKNAME%"=="" (
  echo Task name required.
  pause
  exit /b 1
)

echo.
echo Creating safe branch: codex/%TASKNAME%
git checkout -b codex/%TASKNAME%
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
echo  Starting Codex (GPT-5.5)
echo ==============================
echo Reminder: read AGENTS.md and .ai/harness.md before any change.
echo.

codex --model gpt-5.5

endlocal
pause
