#!/bin/bash

# Fix for libgomp static TLS block error on ARM64
export LD_PRELOAD=/usr/lib/aarch64-linux-gnu/libgomp.so.1

# Activate virtual environment
source /root/AIFX_v2/ml_engine/venv/bin/activate

# Start uvicorn server
cd /root/AIFX_v2/ml_engine
uvicorn api.ml_server:app --reload --host 0.0.0.0 --port 8000
