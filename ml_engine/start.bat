@echo off
REM AIFX_v2 ML Engine Startup Script for Windows

echo 🚀 Starting AIFX_v2 ML Engine...

REM Check if virtual environment exists
if not exist "venv\" (
    echo 📦 Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
echo 🔌 Activating virtual environment...
call venv\Scripts\activate.bat

REM Install/Update dependencies
echo 📚 Installing dependencies...
pip install -r requirements.txt --quiet

REM Create necessary directories
echo 📁 Creating directories...
if not exist "saved_models\" mkdir saved_models
if not exist "checkpoints\" mkdir checkpoints
if not exist "logs\" mkdir logs
if not exist "metrics\" mkdir metrics
if not exist "backups\" mkdir backups

REM Copy .env if not exists
if not exist ".env" (
    echo ⚙️  Creating .env file...
    copy .env.example .env
)

REM Start the server
echo ✅ Starting ML API server...
echo 📊 API will be available at: http://localhost:8000
echo 📖 API docs at: http://localhost:8000/docs
echo.

python api\ml_server.py

pause