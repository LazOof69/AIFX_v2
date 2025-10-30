#!/bin/bash
# Frontend Startup Script for AIFX_v2
# This script ensures Frontend starts correctly with proper configuration

set -e

echo "================================================"
echo "   AIFX_v2 Frontend Startup Script"
echo "================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Navigate to frontend directory
cd /root/AIFX_v2/frontend

# Check if .env exists
if [ ! -f .env ]; then
  echo -e "${YELLOW}⚠️  Warning: .env file not found${NC}"
  echo "Creating default .env file..."
  cat > .env << EOF
# API Configuration
VITE_API_URL=/api/v1
VITE_SOCKET_URL=ws://168.138.182.181
EOF
  echo -e "${GREEN}✅ .env file created${NC}"
fi

# Display current configuration
echo "Current Configuration:"
echo "---------------------"
cat .env
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}⚠️  node_modules not found. Running npm install...${NC}"
  npm install
  echo ""
fi

# Kill any existing Frontend processes
echo "Checking for existing Frontend processes..."
pkill -f "vite" 2>/dev/null && echo -e "${GREEN}✅ Killed existing vite process${NC}" || echo "No existing vite process"
echo ""

# Start Frontend
echo "Starting Frontend (Vite development server)..."
echo "This will run in the foreground. Press Ctrl+C to stop."
echo ""
echo "Access URLs:"
echo "  - Local:   http://localhost:5173"
echo "  - Network: http://168.138.182.181"
echo ""
echo "================================================"
echo ""

# Run vite
npm run dev
