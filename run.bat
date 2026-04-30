@echo off
setlocal
cd /d "%~dp0"
set "PORT=4173"

where node >nul 2>nul
if %errorlevel%==0 (
  echo Starting Miku-versi at http://localhost:%PORT%/
  start "" "http://localhost:%PORT%/"
  node src\server.js
  goto :eof
)

where py >nul 2>nul
if %errorlevel%==0 (
  echo Starting Miku-versi at http://localhost:%PORT%/
  start "" "http://localhost:%PORT%/"
  py -m http.server %PORT% -d src
  goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
  echo Starting Miku-versi at http://localhost:%PORT%/
  start "" "http://localhost:%PORT%/"
  python -m http.server %PORT% -d src
  goto :eof
)

echo Node.js or Python is required to run the local web server.
pause
