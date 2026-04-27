@echo off
setlocal

echo ==============================
echo  ROLLBACK TOOL (uncommitted)
echo ==============================

echo.
echo Current git status:
git status

echo.
echo This will discard uncommitted changes in the working tree.
echo (committed changes are NOT touched)
echo.
set /p CONFIRM=Type YES to continue:

if NOT "%CONFIRM%"=="YES" (
  echo Cancelled.
  pause
  exit /b
)

git restore .
git clean -fd

echo.
echo Rollback complete.
git status

echo.
echo NOTE:
echo  - To revert a committed change, use: git revert ^<hash^>
echo  - To roll back DB migrations, run the corresponding down SQL manually.
echo.

endlocal
pause
