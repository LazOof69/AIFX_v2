#!/bin/bash
export LD_PRELOAD=/root/AIFX_v2/ml_engine/venv/lib/python3.9/site-packages/scikit_learn.libs/libgomp-d22c30c5.so.1.0.0
cd /root/AIFX_v2/ml_engine
source venv/bin/activate
exec python api/ml_server.py
