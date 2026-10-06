@echo off
rem Credit Score Analyzer - one-command launcher (Windows)
rem Usage: run.bat          (starts everything and opens the browser)
rem        run.bat --build  (force-rebuild the frontend before starting)
setlocal enabledelayedexpansion
cd /d "%~dp0"
set PORT=8000
set URL=http://localhost:%PORT%
set VENV=.venv
set PY=%VENV%\Scripts\python.exe

echo === Checking Python environment... ===
if not exist "%PY%" (
    echo Creating virtual environment...
    py -3 -m venv "%VENV%" || python -m venv "%VENV%"
)
"%PY%" -c "import fastapi, xgboost, shap" 2>nul
if errorlevel 1 (
    echo Installing Python dependencies...
    "%PY%" -m pip install -q -r requirements.txt
)

echo === Checking frontend build... ===
if not exist "frontend\node_modules" (
    echo Installing npm dependencies...
    pushd frontend && call npm install --no-audit --no-fund && popd
)
if not exist "frontend\dist" (
    echo Building React app...
    pushd frontend && call npm run build && popd
)
if "%~1"=="--build" (
    echo Rebuilding React app...
    pushd frontend && call npm run build && popd
)

echo === Checking model artifacts... ===
if not exist "models\credit_model.joblib" (
    echo No trained model found - training now ^(one-time^)...
    "%PY%" train.py
)

echo === Checking local LLM ^(optional^)... ===
where ollama >nul 2>nul
if errorlevel 1 (
    echo Ollama not installed - memos will use cached demo texts.
) else (
    curl -s -m 2 http://localhost:11434/api/tags >nul 2>nul
    if errorlevel 1 (
        echo Starting Ollama...
        start /min "" ollama serve
        timeout /t 3 /nobreak >nul
    )
)

curl -s -m 2 %URL%/api/health >nul 2>nul
if not errorlevel 1 (
    echo === App is already running at %URL% - opening browser. ===
    start "" "%URL%"
    exit /b 0
)

echo === Starting server on %URL% ... ===
start /min "credit-score-api" "%PY%" -m uvicorn api.main:app --port %PORT%
for /l %%i in (1,1,30) do (
    curl -s -m 2 %URL%/api/health >nul 2>nul
    if not errorlevel 1 goto ready
    timeout /t 1 /nobreak >nul
)
echo Server failed to start - check the "credit-score-api" window for errors.
pause
exit /b 1

:ready
echo === Ready - opening %URL% ===
start "" "%URL%"
echo The API runs in a minimized window titled "credit-score-api" - close it to stop.
