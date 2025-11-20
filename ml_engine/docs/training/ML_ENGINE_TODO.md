# AIFX v2.0 - ML Engine Development TODO

**Last Updated**: 2025-10-08
**Status**: Phase 2 Week 2 ✅ COMPLETED | Phase 3 Week 1 📋 NEXT

---

## 📊 Project Progress Overview

### ✅ Completed Phases

#### Phase 1: Infrastructure & v1.0 Baseline (COMPLETED ✅)
- [x] PostgreSQL database setup with fundamental_data table
- [x] Economic calendar data collection (10,409 records)
- [x] v1.0 LSTM model training (3 pairs: EURUSD, GBPUSD, USDJPY)
- [x] Technical indicators extraction (28 features)
- [x] Model artifacts saved (saved_models/)

**v1.0 Performance**:
- EURUSD: val_loss 0.839, 142,881 params, 6,288 samples
- GBPUSD: val_loss 0.816, 142,881 params, 4,335 samples  
- USDJPY: val_loss 0.826, 142,881 params, 5,141 samples

#### Phase 2 Week 1: Fundamental Features (COMPLETED ✅)
- [x] FundamentalFeatureEngineer implementation (fundamental_features.py)
- [x] Database integration for fundamental data
- [x] Feature alignment methods (align_features_with_timeseries)
- [x] Economic event feature engineering
- [x] FUNDAMENTAL_EVENT_DESIGN.md documentation

**Deliverables**:
- `/ml_engine/data_processing/fundamental_features.py` (627 lines)
- `/ml_engine/FUNDAMENTAL_EVENT_DESIGN.md`

#### Phase 2 Week 2: Multi-Input LSTM v2.0 (COMPLETED ✅)
- [x] Multi-input LSTM architecture design
- [x] MultiInputPricePredictor implementation (568 lines)
- [x] prepare_v2_training_data.py script
- [x] train_v2_pair.py training script
- [x] **BUG FIX**: Fundamental data NaN issue resolved
- [x] **BUG FIX**: save_model() parameter fixed
- [x] **BUG FIX**: History dict access fixed
- [x] EURUSD v2.0 model trained successfully

**Final Performance (after fixes)**:
```
EURUSD v2.0 Model (20251008_193436):
- Directional Accuracy: 65.96% ✅ (vs 40.43% before fix)
- Test Loss: 0.0044
- RMSE: 0.0840
- MAE: 0.0738
- Parameters: 42,505
- Training: 41 epochs, early stopping at epoch 26
- Fundamental NaN: 0% (was 100%)
```

**Key Fixes Applied**:
1. `fundamental_features.py` (lines 548-557): Added alignment for interest rate diff
2. `train_v2_pair.py` (lines 267-269): Fixed save_model() call
3. `train_v2_pair.py` (lines 277, 286-287): Fixed history dict access

**Deliverables**:
- `/ml_engine/models/multi_input_predictor.py` (568 lines)
- `/ml_engine/scripts/prepare_v2_training_data.py`
- `/ml_engine/train_v2_pair.py`
- `/ml_engine/PHASE2_WEEK2_PLAN.md`
- `/ml_engine/PHASE2_WEEK2_COMPLETION.md`
- `/ml_engine/saved_models_v2/EURUSD_v2_20251008_193436.h5`

**Architecture Validated**:
- ✅ Technical indicators (LSTM branch) - (60, 28)
- ✅ Fundamental features (Dense branch) - 7 features
- ✅ Economic event features (Dense branch) - 5 features
- ✅ Fusion layer → Price prediction

---

## 📋 Phase 3: Production Expansion (NEXT)

### Week 1: Multi-Pair Training 🔄 CURRENT PRIORITY

**Goal**: Train v2.0 models for 3 major pairs and create comparison reports

**Tasks**:
- [ ] **Task 1**: Prepare v2.0 training data for GBPUSD
  - [ ] Generate fundamental features for GBPUSD (UK vs US data)
  - [ ] Extract event features for GBP-related events
  - [ ] Align with existing v1.0 technical data
  - [ ] Save to `data/training_v2/GBPUSD_*.npy`

- [ ] **Task 2**: Prepare v2.0 training data for USDJPY  
  - [ ] Generate fundamental features for USDJPY (US vs JP data)
  - [ ] Extract event features for JPY-related events
  - [ ] Align with existing v1.0 technical data
  - [ ] Save to `data/training_v2/USDJPY_*.npy`

- [ ] **Task 3**: Train GBPUSD v2.0 model
  - [ ] Run `train_v2_pair.py GBPUSD`
  - [ ] Verify directional accuracy > 60%
  - [ ] Save model artifacts
  - [ ] Document performance metrics

- [ ] **Task 4**: Train USDJPY v2.0 model
  - [ ] Run `train_v2_pair.py USDJPY`
  - [ ] Verify directional accuracy > 60%
  - [ ] Save model artifacts
  - [ ] Document performance metrics

- [ ] **Task 5**: Create v1.0 vs v2.0 comparison report
  - [ ] Compare all 3 pairs: val_loss, directional accuracy, RMSE, MAE
  - [ ] Create visualization: training curves, prediction plots
  - [ ] Document improvement percentages
  - [ ] Save as `ML_V1_V2_COMPARISON.md`

**Success Criteria**:
- All 3 pairs achieve directional accuracy > 60%
- v2.0 models show consistent improvement over v1.0
- Model artifacts saved with metadata

**Estimated Time**: 2-3 days

---

### Week 2: ML API Integration 📋 PLANNED

**Goal**: Deploy v2.0 models to production ML API

**Tasks**:
- [ ] **Task 1**: Update ML API model loading
  - [ ] Modify `/ml_api/models/model_loader.py` to support v2.0
  - [ ] Implement multi-input prediction endpoint
  - [ ] Add version parameter (v1.0 / v2.0)

- [ ] **Task 2**: Update prediction endpoint
  - [ ] `/api/v1/predict` - add model_version parameter
  - [ ] Handle v2.0 3-input format
  - [ ] Maintain backward compatibility with v1.0

- [ ] **Task 3**: Real-time fundamental data integration
  - [ ] Connect to fundamental_data table
  - [ ] Implement caching for fundamental features
  - [ ] Handle missing/delayed fundamental data

- [ ] **Task 4**: Real-time event feature extraction
  - [ ] Query economic_events table for upcoming events
  - [ ] Calculate event features on-the-fly
  - [ ] Cache event calculations (TTL: 1 hour)

- [ ] **Task 5**: Testing & validation
  - [ ] Unit tests for v2.0 prediction
  - [ ] Integration tests for API endpoints
  - [ ] Load testing (response time < 200ms)
  - [ ] Compare v1.0 vs v2.0 predictions

**Success Criteria**:
- v2.0 models accessible via API
- Response time < 200ms (p95)
- Backward compatibility maintained
- 100% test coverage for new endpoints

**Estimated Time**: 3-4 days

---

### Week 3: Performance Monitoring 📋 PLANNED

**Goal**: Implement monitoring and logging for production models

**Tasks**:
- [ ] **Task 1**: Prediction logging
  - [ ] Log all predictions to database (predictions table)
  - [ ] Include: timestamp, pair, model_version, prediction, confidence

- [ ] **Task 2**: Performance tracking
  - [ ] Calculate daily directional accuracy
  - [ ] Track RMSE/MAE vs actual prices
  - [ ] Alert on accuracy drop > 10%

- [ ] **Task 3**: Model drift detection
  - [ ] Compare current vs training distribution
  - [ ] Alert on significant drift (KL divergence)
  - [ ] Trigger retraining recommendations

- [ ] **Task 4**: Dashboard creation
  - [ ] Grafana dashboard for model metrics
  - [ ] Real-time accuracy tracking
  - [ ] Prediction vs actual price charts

**Success Criteria**:
- All predictions logged
- Daily accuracy reports generated
- Drift detection alerts functional
- Dashboard accessible to team

**Estimated Time**: 2-3 days

---

## 🔧 Known Issues & Improvements

### Critical Issues (P0)
- None (Phase 2 Week 2 bugs resolved)

### Important Improvements (P1)
- [ ] Fix `prepare_v2_training_data.py` date alignment issue
  - Currently using workaround (direct data regeneration)
  - Need to fix v1.0 technical data timestamps
  - Normalize all timestamps to date-only format

- [ ] Implement automated data quality checks
  - Verify 0% NaN before training
  - Check feature distributions
  - Validate date alignments

### Nice-to-Have (P2)
- [ ] Migrate to .keras format (currently using legacy .h5)
- [ ] Implement model versioning system
- [ ] Add hyperparameter tuning automation
- [ ] Create data augmentation pipeline

---

## 📁 File Structure

```
/root/AIFX_v2/ml_engine/
├── models/
│   ├── price_predictor.py              # v1.0 LSTM (STABLE)
│   └── multi_input_predictor.py        # v2.0 Multi-Input LSTM ✅
├── data_processing/
│   ├── preprocessor.py                 # v1.0 technical features
│   └── fundamental_features.py         # v2.0 fundamental/event features ✅
├── scripts/
│   ├── prepare_training_data.py        # v1.0 data prep
│   └── prepare_v2_training_data.py     # v2.0 data prep ✅
├── train_pair.py                       # v1.0 training script
├── train_v2_pair.py                    # v2.0 training script ✅
├── data/
│   ├── training/                       # v1.0 data (EURUSD, GBPUSD, USDJPY)
│   └── training_v2/                    # v2.0 data ✅
│       └── EURUSD_*.npy                # ✅ Regenerated with 0% NaN
├── saved_models/                       # v1.0 models
├── saved_models_v2/                    # v2.0 models ✅
│   └── EURUSD_v2_20251008_193436.*     # ✅ 65.96% accuracy
├── checkpoints_v2/                     # Training checkpoints
├── ML_ENGINE_TODO.md                   # This file ⭐
├── PHASE2_WEEK2_PLAN.md               # Architecture planning
├── PHASE2_WEEK2_COMPLETION.md         # ✅ Week 2 report
└── FUNDAMENTAL_EVENT_DESIGN.md        # Feature design doc
```

---

## 🎯 Success Metrics

### Phase 2 Week 2 (COMPLETED ✅)
- ✅ EURUSD v2.0 directional accuracy: **65.96%** (target: >60%)
- ✅ Fundamental NaN rate: **0%** (target: <5%)
- ✅ Model saves successfully with all artifacts
- ✅ Training stability: Early stopping at epoch 26

### Phase 3 Week 1 (NEXT TARGET)
- [ ] GBPUSD v2.0 directional accuracy: **>60%**
- [ ] USDJPY v2.0 directional accuracy: **>60%**
- [ ] All models show improvement vs v1.0
- [ ] Comparison report completed

### Production Deployment (FUTURE)
- [ ] API response time: **<200ms** (p95)
- [ ] Daily accuracy tracking: **>60%**
- [ ] Model uptime: **>99.5%**
- [ ] Drift detection: **Alert within 24h**

---

## 📝 Quick Commands

### Training Commands
```bash
# Activate virtual environment
cd /root/AIFX_v2/ml_engine
source venv/bin/activate

# Train v2.0 models
python train_v2_pair.py EURUSD  # ✅ Done (65.96% accuracy)
python train_v2_pair.py GBPUSD  # 📋 Next
python train_v2_pair.py USDJPY  # 📋 Next

# Prepare v2.0 training data
python scripts/prepare_v2_training_data.py GBPUSD
python scripts/prepare_v2_training_data.py USDJPY
```

### Data Quality Checks
```bash
# Check fundamental features NaN
python -c "
import numpy as np
for pair in ['EURUSD', 'GBPUSD', 'USDJPY']:
    try:
        X_fund = np.load(f'data/training_v2/{pair}_fundamental_X_train.npy')
        nan_pct = np.isnan(X_fund).sum() / X_fund.size * 100
        print(f'{pair}: {nan_pct:.2f}% NaN')
    except FileNotFoundError:
        print(f'{pair}: No data file')
"
```

### Model Verification
```bash
# Verify saved models
ls -lh saved_models_v2/
cat saved_models_v2/EURUSD_v2_*_metadata.json | python -m json.tool
```

---

## 🚀 Next Steps (Immediate Action)

**Priority 1** (This Week):
1. Generate GBPUSD v2.0 training data
2. Generate USDJPY v2.0 training data  
3. Train both models
4. Create comparison report

**Priority 2** (Next Week):
1. Integrate v2.0 into ML API
2. Test real-time prediction
3. Deploy to staging environment

**Priority 3** (Future):
1. Implement monitoring dashboard
2. Set up automated retraining
3. Performance optimization

---

**Current Focus**: Phase 3 Week 1 - Multi-Pair v2.0 Training 🎯
**Status**: Ready to start ✅
**Blockers**: None
**Last Major Achievement**: EURUSD v2.0 - 65.96% directional accuracy (+25.53% improvement)

