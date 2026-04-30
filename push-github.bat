@echo off
setlocal

cd /d "%~dp0"

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo This folder is not a Git repository.
  exit /b 1
)

git status --short
echo.

set "MSG=%~1"
if "%MSG%"=="" set "MSG=Update project"

git add -A
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "%MSG%"
) else (
  echo No changes to commit.
)

git push
exit /b %errorlevel%
