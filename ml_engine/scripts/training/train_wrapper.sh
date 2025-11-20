#!/bin/bash
# Wrapper script to fix libgomp ARM64 issue and train model

# Fix libgomp static TLS block error on ARM64
export LD_PRELOAD=/usr/lib/aarch64-linux-gnu/libgomp.so.1

# Activate virtual environment
source /root/AIFX_v2/ml_engine/venv/bin/activate

# Change to ml_engine directory
cd /root/AIFX_v2/ml_engine

# Run training script
python scripts/train_reversal_mode1.py --epochs 50 --batch_size 32

echo "Training completed!"
