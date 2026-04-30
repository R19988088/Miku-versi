@echo off
setlocal

set "REPO_DIR=%~dp0"
set "REPO_DIR=%REPO_DIR:~0,-1%"
set "BACKUP_DIR=%REPO_DIR%\backup"

for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "STAMP=%%I"
set "ZIP_FILE=%BACKUP_DIR%\miku-versi-minimal-%STAMP%.zip"

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

echo Backup target:
echo %ZIP_FILE%
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$root='%REPO_DIR%';" ^
  "$zip='%ZIP_FILE%';" ^
  "$items=@('.github','scripts','src','.gitignore','capacitor.config.json','package.json','push-github.bat','run.bat','backup-minimal.bat');" ^
  "$paths=$items | ForEach-Object { Join-Path $root $_ } | Where-Object { Test-Path $_ };" ^
  "Compress-Archive -Path $paths -DestinationPath $zip -Force"

if errorlevel 1 goto fail

echo.
echo Done.
pause
exit /b 0

:fail
echo.
echo Backup failed. Error code: %errorlevel%
pause
exit /b 1
