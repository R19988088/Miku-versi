@echo off
setlocal

set "REPO_DIR=%~dp0"
set "REPO_DIR=%REPO_DIR:~0,-1%"
set "SAFE_DIR=%REPO_DIR:\=/%"

echo Script folder: %REPO_DIR%
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo Git is not installed or not in PATH.
  goto fail
)

echo Registering Git safe.directory: %SAFE_DIR%
git config --global --add safe.directory "%SAFE_DIR%"
if errorlevel 1 goto fail
echo.

git -C "%REPO_DIR%" rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo This folder is not a Git repository:
  echo %REPO_DIR%
  echo.
  git -C "%REPO_DIR%" rev-parse --is-inside-work-tree
  goto fail
)

git -C "%REPO_DIR%" config user.name "R19988088"
if errorlevel 1 goto fail
git -C "%REPO_DIR%" config user.email "deo.r@qq.com"
if errorlevel 1 goto fail

git -C "%REPO_DIR%" remote get-url origin >nul 2>&1
if errorlevel 1 (
  echo Missing Git remote: origin.
  goto fail
)

git -C "%REPO_DIR%" status --short
echo.

set "MSG=%~1"
if "%MSG%"=="" set "MSG=Update project"

git -C "%REPO_DIR%" add -A
if errorlevel 1 goto fail

git -C "%REPO_DIR%" diff --cached --quiet
if errorlevel 1 (
  git -C "%REPO_DIR%" commit -m "%MSG%"
  if errorlevel 1 goto fail
) else (
  echo No changes to commit.
)

echo.
echo Pushing to origin/main so GitHub Actions can run...
git -C "%REPO_DIR%" push -u origin HEAD:main
if errorlevel 1 goto fail

echo.
echo Done. Check GitHub Actions:
echo https://github.com/R19988088/Miku-versi/actions
echo.
pause
exit /b 0

:fail
echo.
echo Failed. Error code: %errorlevel%
echo The window is staying open so you can read the Git error above.
echo.
pause
exit /b 1
