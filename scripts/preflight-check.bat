@echo off
setlocal

echo ==============================
echo  MOT PREFLIGHT CHECK
echo ==============================

echo.
echo [1] Git status
git status

echo.
echo [2] Current branch
git branch --show-current

echo.
echo [3] Last 5 commits
git log --oneline -5

echo.
echo [4] Node version
node -v

echo.
echo [5] pnpm version
pnpm -v

echo.
echo [6] Environment variables sanity (NEXT_PUBLIC_SUPABASE_URL set?)
if exist ".env.local" (
  findstr /B "NEXT_PUBLIC_SUPABASE_URL" .env.local >nul 2>&1
  if errorlevel 1 (
    echo   [WARN] .env.local exists but NEXT_PUBLIC_SUPABASE_URL not set
  ) else (
    echo   [OK] .env.local has NEXT_PUBLIC_SUPABASE_URL
  )
) else (
  echo   [WARN] .env.local missing — copy from .env.example
)

echo.
echo [7] Available pnpm scripts
pnpm run

echo.
echo [8] Forbidden phrases in elder screens (should be 0 hits)
echo Searching app\(device)\* for "기록되었습니다", "저장합니다", "도와드릴까요" ...
findstr /S /C:"기록되었습니다" /C:"저장합니다" /C:"도와드릴까요" /C:"힘내세요" "app\(device)" 2>nul
if errorlevel 1 (
  echo   [OK] no forbidden phrases
) else (
  echo   [BLOCK] forbidden phrases found above
)

echo.
echo ==============================
echo  CHECK COMPLETE
echo ==============================
pause
endlocal
