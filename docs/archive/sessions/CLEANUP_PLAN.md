# AIFX_v2 File Cleanup Plan

## Files to Delete

### 1. Root Level Test Files (3 files)
```
test_discord_notification.js
test_interaction_timing.js
test_interaction_timing_detailed.js
```
**Reason:** Temporary test files, duplicates exist in discord_bot/

### 2. Frontend Old Component Backups (2 files)
```
frontend/src/components/MarketOverview_Old.jsx
frontend/src/components/TradingView_Old.jsx
```
**Reason:** Backup files no longer needed

### 3. Backend Root Level Test Files (6 files)
```
backend/test-auth.js
backend/test-forex.js
backend/test-phase1-services.js
backend/test-server.js
backend/test_signal_format.js
backend/test-simple.js
```
**Reason:** Temporary test scripts, functionality now in proper test suites

### 4. Backend Script Tests (Keep organized scripts, remove redundant) (0 files)
**Keep:** All scripts in backend/scripts/ - these are useful utilities
**Keep:** backend/tests/ - proper test suites

### 5. Discord Bot Test Files (2 files)
```
discord_bot/test_features.js
discord_bot/test_interaction_diagnostic.js
```
**Reason:** Temporary diagnostic scripts

### 6. ML Engine Temporary Training Scripts (4 files)
```
ml_engine/quick_train.py
ml_engine/create_scaler.py
ml_engine/fix_model_compatibility.py
ml_engine/train_eurusd_test.py
```
**Reason:** One-time use scripts for fixing compatibility issues

### 7. ML Engine Test Scripts (3 files)
```
ml_engine/test_model_load.py
ml_engine/test_model_load2.py
ml_engine/api/test_deployment.py
```
**Reason:** Temporary validation scripts

### 8. Old ML Checkpoints (Keep only latest) (5 files to delete)
```
ml_engine/checkpoints/model_checkpoint_20251007_051314.h5
ml_engine/checkpoints/model_checkpoint_20251007_051722.h5
ml_engine/checkpoints/model_checkpoint_20251007_134908.h5
ml_engine/checkpoints/model_checkpoint_20251007_134915.h5
ml_engine/checkpoints/model_checkpoint_20251114_110946.h5
```
**Keep:** model_checkpoint_20251117_105508.h5 (latest)

### 9. Old Training Log Files (Clean up, keep recent) (12 files)
```
ml_engine/training_mode1.log
ml_engine/training_mode1_final.log
ml_engine/training_v2_eurusd.log
ml_engine/training_v2_eurusd_fixed.log
ml_engine/retraining.log
ml_engine/data_collection.log
ml_engine/logs/eurusd_training_20251007_051718.log
ml_engine/logs/eurusd_v2_extended_training_20251012_101452.log
ml_engine/logs/gbpusd_training_20251007_134801.log
ml_engine/logs/gbpusd_training_20251007_134904.log
ml_engine/logs/usdjpy_training_20251007_134824.log
ml_engine/logs/usdjpy_training_20251007_134911.log
```
**Keep:** training_output.log (most recent)
**Keep:** ml_server_new.log (current server log)

### 10. Duplicate ML Server Logs (1 file)
```
ml_engine/ml_server.log
```
**Keep:** ml_server_new.log (current)

### 11. Old Calendar Logs (2 files)
```
ml_engine/logs/calendar_history_20251008_124018.log
ml_engine/logs/cron_test.log
```
**Keep:** calendar_auto_update.log, cron.log (active)

### 12. Root Level Backend Log (1 file)
```
backend.log
```
**Reason:** Duplicate, logs are in backend/logs/

## Files to KEEP

### Important Files:
- ✅ system_health_test.sh - System health monitoring
- ✅ All files in backend/tests/unit/ - Unit tests
- ✅ All files in backend/scripts/ - Utility scripts
- ✅ ml_engine/api/ab_testing.py - A/B testing functionality
- ✅ backend/logs/*.log - Active log files
- ✅ discord_bot/logs/*.log - Active log files
- ✅ ml_engine/logs/ml_server_new.log - Current server log
- ✅ ml_engine/logs/cron.log - Active cron log
- ✅ ml_engine/training_output.log - Latest training log
- ✅ ml_engine/checkpoints/model_checkpoint_20251117_105508.h5 - Latest checkpoint

## Summary

**Total Files to Delete:** ~41 files
**Disk Space to Recover:** ~100-200 MB (mostly old model checkpoints and logs)

**Categories:**
- Test scripts: 18 files
- Old backups: 2 files
- Training scripts: 4 files
- Old checkpoints: 5 files
- Old logs: 12 files

## Safety Check

Before deletion:
1. ✅ All critical functionality tested
2. ✅ Latest models verified working
3. ✅ Active logs identified
4. ✅ Git commit history preserved
5. ✅ Backup documentation created
