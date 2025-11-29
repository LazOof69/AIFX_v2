#!/bin/bash

# ML Engine Startup Script with libgomp fix for ARM64
# This script starts the ML Engine API server with proper environment

cd /root/AIFX_v2/ml_engine

# Set LD_PRELOAD to avoid TLS memory allocation error with scikit-learn
export LD_PRELOAD=/root/AIFX_v2/ml_engine/venv/lib/python3.9/site-packages/scikit_learn.libs/libgomp-d22c30c5.so.1.0.0

# Activate Python 3.9 virtual environment
source venv/bin/activate

# Start ML Engine API server
python api/ml_server.py
