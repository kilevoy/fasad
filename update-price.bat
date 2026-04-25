@echo off
setlocal

cd /d "%~dp0"

echo.
echo ==========================================
echo  Facade calculator price update
echo ==========================================
echo.

set "DEFAULT_PRICE="
if exist "%~dp0..\price.xlsx" set "DEFAULT_PRICE=%~dp0..\price.xlsx"
if "%DEFAULT_PRICE%"=="" (
  for %%F in ("%~dp0..\*.xlsx") do (
    if "%DEFAULT_PRICE%"=="" set "DEFAULT_PRICE=%%~fF"
  )
)
set "PRICE_FILE=%~1"

if "%PRICE_FILE%"=="" (
  echo Enter path to Excel price file.
  echo You can drag and drop .xlsx file into this window and press Enter.
  if not "%DEFAULT_PRICE%"=="" (
    echo If empty, default file will be used:
    echo %DEFAULT_PRICE%
  )
  echo.
  set /p "PRICE_FILE=Price file: "
)

if "%PRICE_FILE%"=="" set "PRICE_FILE=%DEFAULT_PRICE%"
set "PRICE_FILE=%PRICE_FILE:"=%"

if "%PRICE_FILE%"=="" (
  echo.
  echo ERROR: no default .xlsx file found near project folder.
  echo Put price.xlsx or any .xlsx file into parent folder, or drag file into this window.
  echo.
  pause
  exit /b 1
)

if not exist "%PRICE_FILE%" (
  echo.
  echo ERROR: file not found:
  echo %PRICE_FILE%
  echo.
  pause
  exit /b 1
)

echo.
echo Step 1/4. Import price:
echo %PRICE_FILE%
echo.
call npm run price:import -- "%PRICE_FILE%"
if errorlevel 1 goto error

echo.
echo Step 2/4. Build check...
call npm run build
if errorlevel 1 goto error

echo.
echo Step 3/4. Lint check...
call npm run lint
if errorlevel 1 goto error

echo.
echo Step 4/4. Publish to GitHub...
git add public/price.json
if errorlevel 1 goto error

git commit -m "Update shared price list"
if errorlevel 1 (
  echo.
  echo No price changes to commit, or git commit failed.
  echo Current git status:
  git status --short
  echo.
  pause
  exit /b 0
)

git push origin main
if errorlevel 1 goto error

echo.
echo ==========================================
echo  Done. Price was pushed to GitHub.
echo  GitHub Pages usually updates in 1-3 minutes.
echo  https://kilevoy.github.io/fasad/
echo ==========================================
echo.
pause
exit /b 0

:error
echo.
echo ==========================================
echo  ERROR. Update stopped.
echo  Check the message above.
echo ==========================================
echo.
pause
exit /b 1
