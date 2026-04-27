@echo off
setlocal

echo ==============================
echo  MOT Sprint 0 Initializer
echo ==============================
echo.
echo This will:
echo  1. Run preflight check
echo  2. Open AGENTS.md, CLAUDE.md, .ai/harness.md and agent-prompts/06_sprint0_codex.md
echo  3. Start Codex with the Sprint 0 prompt
echo.
echo Make sure you are inside the MOT project root.
echo.
set /p CONFIRM=Continue? (Y/N):

if /I NOT "%CONFIRM%"=="Y" (
  echo Cancelled.
  exit /b
)

call "%~dp0preflight-check.bat"

echo.
echo Opening reference docs in default editor...
start "" "AGENTS.md"
start "" "CLAUDE.md"
start "" ".ai\harness.md"
start "" "agent-prompts\06_sprint0_codex.md"

echo.
echo ==============================
echo  Now starting Codex (GPT-5.5)
echo ==============================
echo Paste the prompt body from agent-prompts/06_sprint0_codex.md
echo Specify: "Current step: T1" (or whichever you are at).
echo.

codex --model gpt-5.5

endlocal
pause
