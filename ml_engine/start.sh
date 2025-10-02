#!/bin/bash

# AIFX_v2 ML Engine Startup Script

echo "🚀 Starting AIFX_v2 ML Engine..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔌 Activating virtual environment..."
source venv/bin/activate

# Install/Update dependencies
echo "📚 Installing dependencies..."
pip install -r requirements.txt --quiet

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p saved_models checkpoints logs metrics backups

# Copy .env if not exists
if [ ! -f ".env" ]; then
    echo "⚙️  Creating .env file..."
    cp .env.example .env
fi

# Start the server
echo "✅ Starting ML API server..."
echo "📊 API will be available at: http://localhost:8000"
echo "📖 API docs at: http://localhost:8000/docs"
echo ""

python api/ml_server.py