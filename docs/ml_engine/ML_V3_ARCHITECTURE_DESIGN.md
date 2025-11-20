# ML v3.0 Architecture Design Document

**Version**: 3.0.0
**Date**: 2025-10-13
**Status**: 🏗️ Design Phase
**Purpose**: Dual-mode ML predictor for Phase 3 trading lifecycle management

---

## 📋 Executive Summary

### Mission Statement

Build a **purpose-built trading decision system** that optimizes for **trading profitability**, not price prediction accuracy.

### Key Design Principles

1. **Frame trading as a decision problem**, not classification or regression
2. **Optimize for trading outcomes** (directional accuracy, win rate, Sharpe ratio)
3. **Custom loss functions** that penalize wrong decisions
4. **Proper data labeling** (opportunities, not prices)
5. **Dual-mode architecture** for entry evaluation vs position monitoring
6. **Track trading metrics during training** (not just loss/accuracy)
7. **Validate with backtest** (simulate actual trading)

### Performance Targets

| Metric | Minimum | Target | v1.0 | v2.0 | v3.0 Goal |
|--------|---------|--------|------|------|-----------|
| **Directional Accuracy** | > 50% | > 55% | 40.85% ❌ | 47.60% ❌ | **> 60%** ✅ |
| **Win Rate (Backtest)** | > 50% | > 55% | N/A | N/A | **> 55%** ✅ |
| **Sharpe Ratio** | > 0.5 | > 1.0 | N/A | N/A | **> 1.0** ✅ |
| **Max Drawdown** | < 20% | < 15% | N/A | N/A | **< 15%** ✅ |
| **Confidence Calibration (ECE)** | N/A | < 0.1 | N/A | N/A | **< 0.1** ✅ |

---

## 🎯 Problem Framing

### What v1.0 and v2.0 Got Wrong

#### v1.0: 3-Class Classification (Buy/Hold/Sell)
**Approach**: Classify each candle as Buy (2), Hold (1), or Sell (0)

**Problems**:
1. ❌ "Hold" class is ambiguous (no clear boundary)
2. ❌ Model collapsed to predicting only Buy or only Sell
3. ❌ Categorical cross-entropy doesn't penalize wrong direction enough
4. ❌ Doesn't consider risk-reward or market context
5. ❌ Labels based on arbitrary price thresholds (+0.5% = Buy, -0.5% = Sell)

**Result**: 40.85% directional accuracy (9.15 pp below random)

#### v2.0: Price Regression
**Approach**: Predict next day's closing price

**Problems**:
1. ❌ MSE optimizes price proximity, not direction
2. ❌ Small price errors can yield wrong direction
3. ❌ No concept of "good entry" vs "bad entry"
4. ❌ Labels are absolute prices (no trading context)
5. ❌ Doesn't optimize for what we care about (profitability)

**Result**: 47.60% directional accuracy (2.4 pp below random)

### What v3.0 Will Do Differently

#### Frame Trading as Two Distinct Problems

**Problem 1: Entry Evaluation**
> "Is NOW a good time to enter a trade?"

**Not asking**: "Will price go up or down?"
**Asking**: "If I enter now, what's the probability of a profitable trade with RR > 2.0?"

**Problem 2: Position Monitoring**
> "What should I do with this open position?"

**Not asking**: "What will the price be tomorrow?"
**Asking**: "Should I hold, exit, take partial profit, or adjust stop loss?"

---

## 🏗️ Architecture Overview

### Dual-Mode Predictor System

```
┌─────────────────────────────────────────────────────────────────┐
│                    ML v3.0 DUAL-MODE SYSTEM                     │
└─────────────────────────────────────────────────────────────────┘
                                 │
                 ┌───────────────┴──────────────┐
                 │                              │
         ┌───────▼────────┐            ┌───────▼────────┐
         │   MODE 1       │            │   MODE 2       │
         │ Entry Evaluator│            │Position Monitor│
         └────────────────┘            └────────────────┘
                 │                              │
    ┌────────────┼────────────┐    ┌───────────┼────────────┐
    │            │            │    │           │            │
┌───▼───┐  ┌────▼────┐  ┌────▼───┐│    ┌─────▼─────┐ ┌────▼────┐
│Binary │  │Confidence│  │RR Pred││    │Multi-class│ │Confidence│
│Signal │  │  Score   │  │SL/TP  ││    │  Action   │ │  Score  │
└───────┘  └─────────┘  └────────┘│    └───────────┘ └─────────┘
                                   │
                              ┌────▼────┐  ┌─────────┐
                              │Reversal │  │Reasoning│
                              │  Prob   │  │  Text   │
                              └─────────┘  └─────────┘
```

### Mode 1: Entry Evaluator

**Use Case**: Evaluate if current market conditions represent a good entry opportunity

**Inputs** (Feature Vector):
- **Technical Features** (28):
  - OHLC, SMA (20/50/200), EMA (12/26)
  - RSI, MACD, Bollinger Bands
  - ATR, Stochastic, Momentum, Williams %R, CCI, ADX
  - Price change, range, body size

- **Fundamental Features** (7):
  - GDP growth, inflation rate, unemployment rate
  - Interest rate, trade balance, government debt, consumer confidence

- **Event Features** (5):
  - Event type (binary: high-impact event in next 24h)
  - Event impact score (0.0-1.0)
  - Days until next major event
  - Recent event impact (last 7 days)
  - Event sentiment (positive/negative/neutral)

- **Market Context** (6):
  - Current volatility (ATR normalized)
  - Trend strength (ADX)
  - Market session (Asian/European/US/Overlap)
  - Time of day
  - Day of week
  - Days since last major news

**Total Input Features**: 46

**Outputs**:

1. **Entry Signal** (Binary Classification)
   - 0 = Bad entry (don't trade)
   - 1 = Good entry (trade setup)

2. **Confidence Score** (Regression, 0.0-1.0)
   - Probability that entry will be profitable
   - Calibrated to actual win rate

3. **Expected Risk-Reward** (Regression, continuous)
   - Estimated RR ratio (e.g., 2.5 = 2.5:1)

4. **Recommended Stop Loss** (Regression, price level)
   - Optimal SL based on recent volatility and support/resistance

5. **Recommended Take Profit** (Regression, price level)
   - Optimal TP based on recent volatility and support/resistance

**Architecture**:

```python
# Pseudo-architecture
Input Layer (46 features)
    │
    ├─► Technical Branch (28 features)
    │   └─► LSTM(128) → Dropout(0.3) → LSTM(64)
    │
    ├─► Fundamental Branch (7 features)
    │   └─► Dense(32) → Dropout(0.2) → Dense(16)
    │
    ├─► Event Branch (5 features)
    │   └─► Dense(16) → Dropout(0.2) → Dense(8)
    │
    └─► Context Branch (6 features)
        └─► Dense(16) → Dense(8)

Fusion Layer (concatenate all branches)
    │
    └─► Dense(64) → Dropout(0.3) → Dense(32)
        │
        ├─► Signal Head: Dense(16) → Dense(1, sigmoid) → Binary Signal
        ├─► Confidence Head: Dense(16) → Dense(1, sigmoid) → Confidence
        ├─► RR Head: Dense(16) → Dense(1, linear) → Expected RR
        └─► SL/TP Head: Dense(32) → Dense(2, linear) → [SL, TP]

Total Parameters: ~80,000 (vs v2.0: 42,505)
```

### Mode 2: Position Monitor

**Use Case**: Monitor open position and recommend action

**Inputs** (Feature Vector):
- **All Mode 1 features** (46) - Current market state
- **Position Info** (6):
  - Entry price
  - Current stop loss
  - Current take profit
  - Position duration (minutes)
  - Position size (lots)
  - Position direction (buy=1, sell=0)

- **Unrealized P&L** (3):
  - Unrealized P&L (pips)
  - Unrealized P&L (%)
  - Current RR ratio

- **Historical Monitoring** (15) - Last 3 monitoring cycles:
  - Previous prices (3)
  - Previous trends (3)
  - Previous reversals (3)
  - Price momentum (3 values)
  - Volatility changes (3 values)

**Total Input Features**: 70

**Outputs**:

1. **Recommendation** (Multi-class Classification)
   - 0 = Hold (continue monitoring)
   - 1 = Exit (close position now)
   - 2 = Take Partial (close 50%, move SL to breakeven)
   - 3 = Adjust SL (move stop loss to lock profit)

2. **Confidence Score** (Regression, 0.0-1.0)
   - Probability that recommendation is correct

3. **Trend Direction** (Categorical)
   - 0 = Downtrend
   - 1 = Sideways
   - 2 = Uptrend
   - 3 = Reversal

4. **Trend Strength** (Regression, 0.0-1.0)
   - How strong is the current trend

5. **Reversal Probability** (Regression, 0.0-1.0)
   - Probability of trend reversal in next 1-4 hours

6. **Reasoning** (Text Generation - Optional Phase 4)
   - Natural language explanation of recommendation
   - For now: Rule-based template based on features

**Architecture**:

```python
# Pseudo-architecture
Input Layer (70 features)
    │
    ├─► Market State Branch (46 features from Mode 1)
    │   └─► LSTM(128) → Dropout(0.3) → LSTM(64)
    │
    ├─► Position Branch (6 features)
    │   └─► Dense(32) → Dropout(0.2) → Dense(16)
    │
    ├─► P&L Branch (3 features)
    │   └─► Dense(16) → Dense(8)
    │
    └─► History Branch (15 features)
        └─► LSTM(32) → Dense(16)

Fusion Layer (concatenate all branches)
    │
    └─► Dense(64) → Dropout(0.3) → Dense(32)
        │
        ├─► Recommendation Head: Dense(16) → Dense(4, softmax) → Action
        ├─► Confidence Head: Dense(16) → Dense(1, sigmoid) → Confidence
        ├─► Trend Direction Head: Dense(16) → Dense(4, softmax) → Direction
        ├─► Trend Strength Head: Dense(8) → Dense(1, sigmoid) → Strength
        └─► Reversal Head: Dense(8) → Dense(1, sigmoid) → Reversal Prob

Total Parameters: ~110,000
```

---

## 🎓 Custom Loss Functions

### Lesson from v1.0 and v2.0

- v1.0 used **categorical cross-entropy** → Doesn't penalize wrong direction enough
- v2.0 used **MSE** → Optimizes price, not direction
- **Solution**: Create custom loss functions that optimize for trading profitability

### Mode 1: Entry Evaluator Loss

```python
def entry_evaluator_loss(y_true, y_pred):
    """
    Custom loss for entry evaluation

    y_true: {
        'signal': Binary (0 or 1) - Was this a good entry?
        'actual_outcome': Binary (0 or 1) - Did the trade succeed?
        'actual_rr': Float - Actual RR achieved
        'confidence_target': Float - Calibrated confidence
    }

    y_pred: {
        'signal': Binary prediction
        'confidence': Float (0-1)
        'expected_rr': Float
        'sl': Float
        'tp': Float
    }
    """

    # Component 1: Signal Accuracy (50% weight)
    # Penalize false positives (bad entries labeled as good) MORE than false negatives
    signal_loss = weighted_binary_cross_entropy(
        y_true['signal'],
        y_pred['signal'],
        pos_weight=2.0  # Penalize false positives 2x
    )

    # Component 2: Confidence Calibration (25% weight)
    # Ensure confidence scores match actual win rates
    confidence_loss = brier_score_loss(
        y_true['actual_outcome'],
        y_pred['confidence']
    )

    # Component 3: RR Estimation (15% weight)
    # Predict accurate risk-reward ratios
    rr_loss = huber_loss(
        y_true['actual_rr'],
        y_pred['expected_rr']
    )

    # Component 4: Directional Penalty (10% weight)
    # Extra penalty if signal direction is wrong
    direction_penalty = directional_mismatch_penalty(
        y_true['actual_outcome'],
        y_pred['signal']
    )

    # Combine
    total_loss = (
        0.50 * signal_loss +
        0.25 * confidence_loss +
        0.15 * rr_loss +
        0.10 * direction_penalty
    )

    return total_loss
```

### Mode 2: Position Monitor Loss

```python
def position_monitor_loss(y_true, y_pred):
    """
    Custom loss for position monitoring

    y_true: {
        'action': Multi-class (0-3) - Optimal action in hindsight
        'action_outcome': Float - Profit/loss from taking action
        'actual_reversal': Binary - Did reversal occur?
        'confidence_target': Float
    }

    y_pred: {
        'recommendation': Multi-class prediction
        'confidence': Float (0-1)
        'trend_direction': Multi-class (0-3)
        'reversal_prob': Float (0-1)
    }
    """

    # Component 1: Action Correctness (40% weight)
    # Penalize wrong actions, especially "Hold" when should "Exit"
    action_loss = weighted_categorical_cross_entropy(
        y_true['action'],
        y_pred['recommendation'],
        class_weights={
            0: 1.0,  # Hold
            1: 3.0,  # Exit (penalize missing exit signals 3x)
            2: 2.0,  # Take Partial
            3: 1.5   # Adjust SL
        }
    )

    # Component 2: Action Outcome (30% weight)
    # Reward actions that lead to better outcomes
    outcome_loss = outcome_based_loss(
        y_true['action_outcome'],
        y_pred['recommendation']
    )

    # Component 3: Confidence Calibration (15% weight)
    confidence_loss = brier_score_loss(
        y_true['action_correct'],
        y_pred['confidence']
    )

    # Component 4: Reversal Prediction (15% weight)
    reversal_loss = binary_cross_entropy(
        y_true['actual_reversal'],
        y_pred['reversal_prob']
    )

    # Combine
    total_loss = (
        0.40 * action_loss +
        0.30 * outcome_loss +
        0.15 * confidence_loss +
        0.15 * reversal_loss
    )

    return total_loss
```

---

## 📊 Data Labeling Strategy

### Critical Principle

**Label outcomes, not movements. Label opportunities, not prices.**

### Mode 1: Entry Evaluation Labeling

**Objective**: Label each historical candle as "Good Entry" or "Bad Entry"

**Algorithm**:

```python
def label_entry_opportunity(candle_index, df, lookforward=5):
    """
    Label if this candle represents a good entry opportunity

    Returns:
        {
            'signal': 0 (bad) or 1 (good),
            'confidence': float,
            'actual_rr': float,
            'actual_outcome': 0 (loss) or 1 (win)
        }
    """

    entry_price = df.loc[candle_index, 'close']

    # Simulate LONG entry
    long_sl = calculate_sl(df, candle_index, direction='long')
    long_tp = calculate_tp(df, candle_index, direction='long', rr=2.0)

    long_outcome = simulate_trade(
        df,
        entry_index=candle_index,
        entry_price=entry_price,
        sl=long_sl,
        tp=long_tp,
        direction='long',
        max_duration=lookforward  # days
    )

    # Simulate SHORT entry
    short_sl = calculate_sl(df, candle_index, direction='short')
    short_tp = calculate_tp(df, candle_index, direction='short', rr=2.0)

    short_outcome = simulate_trade(
        df,
        entry_index=candle_index,
        entry_price=entry_price,
        sl=short_sl,
        tp=short_tp,
        direction='short',
        max_duration=lookforward
    )

    # Determine if good entry
    # Good if EITHER direction yields positive outcome with RR >= 2.0

    long_good = (long_outcome['hit_tp'] and long_outcome['rr'] >= 2.0)
    short_good = (short_outcome['hit_tp'] and short_outcome['rr'] >= 2.0)

    if long_good or short_good:
        # Choose the better direction
        best_outcome = long_outcome if long_good and (
            not short_good or long_outcome['rr'] > short_outcome['rr']
        ) else short_outcome

        return {
            'signal': 1,  # Good entry
            'direction': 'long' if best_outcome == long_outcome else 'short',
            'confidence': calculate_setup_confidence(df, candle_index),
            'actual_rr': best_outcome['rr'],
            'actual_outcome': 1,  # Win
            'sl': best_outcome['sl'],
            'tp': best_outcome['tp']
        }
    else:
        return {
            'signal': 0,  # Bad entry
            'direction': None,
            'confidence': 0.0,
            'actual_rr': 0.0,
            'actual_outcome': 0  # Loss
        }
```

**Helper Functions**:

```python
def calculate_sl(df, index, direction='long'):
    """Calculate optimal stop loss based on recent swing lows/highs"""
    lookback = 20
    if direction == 'long':
        # SL below recent swing low
        swing_low = df.loc[index-lookback:index, 'low'].min()
        sl = swing_low - 2 * df.loc[index, 'atr_14']
    else:
        # SL above recent swing high
        swing_high = df.loc[index-lookback:index, 'high'].max()
        sl = swing_high + 2 * df.loc[index, 'atr_14']
    return sl

def calculate_tp(df, index, direction='long', rr=2.0):
    """Calculate take profit based on risk-reward ratio"""
    entry_price = df.loc[index, 'close']
    sl = calculate_sl(df, index, direction)
    risk = abs(entry_price - sl)

    if direction == 'long':
        tp = entry_price + (risk * rr)
    else:
        tp = entry_price - (risk * rr)
    return tp

def simulate_trade(df, entry_index, entry_price, sl, tp, direction, max_duration):
    """
    Simulate trade execution and return outcome

    Returns:
        {
            'hit_tp': bool,
            'hit_sl': bool,
            'rr': float (actual RR achieved),
            'duration': int (candles),
            'exit_price': float,
            'pnl_pips': float,
            'pnl_pct': float
        }
    """
    for i in range(entry_index + 1, min(entry_index + max_duration + 1, len(df))):
        low = df.loc[i, 'low']
        high = df.loc[i, 'high']

        if direction == 'long':
            if low <= sl:
                # Hit stop loss
                return {
                    'hit_tp': False,
                    'hit_sl': True,
                    'rr': -1.0,
                    'duration': i - entry_index,
                    'exit_price': sl,
                    'pnl_pips': (sl - entry_price) * 10000,
                    'pnl_pct': (sl - entry_price) / entry_price
                }
            elif high >= tp:
                # Hit take profit
                risk = abs(entry_price - sl)
                reward = abs(tp - entry_price)
                return {
                    'hit_tp': True,
                    'hit_sl': False,
                    'rr': reward / risk,
                    'duration': i - entry_index,
                    'exit_price': tp,
                    'pnl_pips': (tp - entry_price) * 10000,
                    'pnl_pct': (tp - entry_price) / entry_price
                }
        else:  # short
            if high >= sl:
                # Hit stop loss
                return {
                    'hit_tp': False,
                    'hit_sl': True,
                    'rr': -1.0,
                    'duration': i - entry_index,
                    'exit_price': sl,
                    'pnl_pips': (entry_price - sl) * 10000,
                    'pnl_pct': (entry_price - sl) / entry_price
                }
            elif low <= tp:
                # Hit take profit
                risk = abs(entry_price - sl)
                reward = abs(entry_price - tp)
                return {
                    'hit_tp': True,
                    'hit_sl': False,
                    'rr': reward / risk,
                    'duration': i - entry_index,
                    'exit_price': tp,
                    'pnl_pips': (entry_price - tp) * 10000,
                    'pnl_pct': (entry_price - tp) / entry_price
                }

    # Max duration reached, no hit
    exit_price = df.loc[entry_index + max_duration, 'close']
    if direction == 'long':
        pnl_pips = (exit_price - entry_price) * 10000
    else:
        pnl_pips = (entry_price - exit_price) * 10000

    return {
        'hit_tp': False,
        'hit_sl': False,
        'rr': 0.0,
        'duration': max_duration,
        'exit_price': exit_price,
        'pnl_pips': pnl_pips,
        'pnl_pct': pnl_pips / 10000
    }

def calculate_setup_confidence(df, index):
    """
    Calculate confidence score based on technical setup quality

    Higher confidence if:
    - Clear trend (ADX > 25)
    - Strong momentum
    - Multiple indicators aligned
    - Low recent volatility
    - Good support/resistance levels
    """
    adx = df.loc[index, 'adx_14']
    rsi = df.loc[index, 'rsi_14']
    macd_hist = df.loc[index, 'macd_histogram']
    atr_normalized = df.loc[index, 'atr_14'] / df.loc[index, 'close']

    confidence = 0.5  # Base

    # Strong trend
    if adx > 25:
        confidence += 0.2

    # RSI in good range (not overbought/oversold)
    if 40 < rsi < 60:
        confidence += 0.1

    # MACD momentum
    if abs(macd_hist) > 0.0005:
        confidence += 0.1

    # Low volatility
    if atr_normalized < 0.01:
        confidence += 0.1

    return min(confidence, 1.0)
```

### Mode 2: Position Monitoring Labeling

**Objective**: For each monitoring checkpoint of open positions, label the optimal action

**Algorithm**:

```python
def label_monitoring_action(position, current_index, df, lookforward=4):
    """
    Label optimal action for position at current monitoring checkpoint

    Returns:
        {
            'action': 0 (Hold), 1 (Exit), 2 (TakePartial), 3 (AdjustSL),
            'action_outcome': float (P&L if action taken),
            'actual_reversal': bool,
            'confidence_target': float
        }
    """
    entry_price = position['entry_price']
    current_price = df.loc[current_index, 'close']
    sl = position['stop_loss']
    tp = position['take_profit']
    direction = position['direction']

    # Simulate holding
    hold_outcome = simulate_from_checkpoint(
        df, current_index, current_price, sl, tp, direction, lookforward
    )

    # Simulate exiting now
    exit_outcome = calculate_immediate_exit(
        entry_price, current_price, direction
    )

    # Simulate taking partial profit (50%)
    partial_outcome = calculate_partial_exit(
        entry_price, current_price, sl, tp, direction, df, current_index, lookforward
    )

    # Simulate adjusting SL
    adjusted_sl = calculate_trailing_sl(current_price, sl, position, df, current_index)
    adjusted_outcome = simulate_from_checkpoint(
        df, current_index, current_price, adjusted_sl, tp, direction, lookforward
    )

    # Determine best action
    outcomes = {
        0: hold_outcome['final_pnl'],
        1: exit_outcome['final_pnl'],
        2: partial_outcome['final_pnl'],
        3: adjusted_outcome['final_pnl']
    }

    best_action = max(outcomes, key=outcomes.get)

    # Detect reversal
    reversal_occurred = detect_reversal(df, current_index, direction, lookforward)

    return {
        'action': best_action,
        'action_outcome': outcomes[best_action],
        'actual_reversal': reversal_occurred,
        'confidence_target': calculate_monitoring_confidence(df, current_index, position)
    }
```

---

## 🧪 Training Strategy

### Phase 1: Data Preparation (2 days)

1. **Collect Historical Data** (2015-2024)
   - EURUSD 1D candles: ~2500 samples
   - Technical indicators calculated
   - Fundamental data aligned
   - Event data aligned

2. **Label Entry Opportunities**
   - Run labeling algorithm on all candles
   - Expected: ~40% good entries, ~60% bad entries
   - Verify label distribution

3. **Create Position Monitoring Dataset**
   - Simulate opening positions at good entry points
   - Create monitoring checkpoints every 4 hours
   - Label optimal actions
   - Expected: ~10,000 monitoring checkpoints

4. **Split Data**
   - Train: 2015-2022 (70%)
   - Validation: 2023 (15%)
   - Test: 2024 (15%)

### Phase 2: Train Mode 1 (2 days)

```python
# Training configuration
config_mode1 = {
    'epochs': 100,
    'batch_size': 32,
    'early_stopping_patience': 15,
    'reduce_lr_patience': 5,
    'optimizer': 'adam',
    'learning_rate': 0.001,
    'class_weight': {0: 1.0, 1: 1.5},  # Slightly favor good entries
    'validation_split': 0.15
}

# Training loop
model_mode1 = build_mode1_model(input_shape)
model_mode1.compile(
    optimizer=Adam(lr=config_mode1['learning_rate']),
    loss=entry_evaluator_loss,
    metrics=[
        'accuracy',
        directional_accuracy_metric,
        rr_mae_metric,
        confidence_calibration_metric
    ]
)

history_mode1 = model_mode1.fit(
    X_train_mode1,
    y_train_mode1,
    epochs=config_mode1['epochs'],
    batch_size=config_mode1['batch_size'],
    validation_data=(X_val_mode1, y_val_mode1),
    callbacks=[
        EarlyStopping(monitor='val_directional_accuracy', patience=15, mode='max'),
        ReduceLROnPlateau(monitor='val_loss', patience=5),
        ModelCheckpoint('checkpoints_v3/mode1_best.h5', monitor='val_directional_accuracy', mode='max'),
        TensorBoard(log_dir='logs/mode1')
    ],
    class_weight=config_mode1['class_weight'],
    verbose=1
)
```

**Success Criteria for Mode 1**:
- Directional accuracy > 55% on validation set
- Confidence calibration ECE < 0.15
- RR prediction MAE < 0.8
- If not met: Adjust architecture, loss weights, or data labeling

### Phase 3: Train Mode 2 (2 days)

```python
# Training configuration
config_mode2 = {
    'epochs': 100,
    'batch_size': 64,  # More samples available
    'early_stopping_patience': 15,
    'reduce_lr_patience': 5,
    'optimizer': 'adam',
    'learning_rate': 0.001,
    'class_weight': {0: 1.0, 1: 3.0, 2: 2.0, 3: 1.5},  # Heavily penalize missing exits
    'validation_split': 0.15
}

# Training loop
model_mode2 = build_mode2_model(input_shape)
model_mode2.compile(
    optimizer=Adam(lr=config_mode2['learning_rate']),
    loss=position_monitor_loss,
    metrics=[
        'accuracy',
        action_correctness_metric,
        reversal_prediction_metric,
        confidence_calibration_metric
    ]
)

history_mode2 = model_mode2.fit(
    X_train_mode2,
    y_train_mode2,
    epochs=config_mode2['epochs'],
    batch_size=config_mode2['batch_size'],
    validation_data=(X_val_mode2, y_val_mode2),
    callbacks=[
        EarlyStopping(monitor='val_action_correctness', patience=15, mode='max'),
        ReduceLROnPlateau(monitor='val_loss', patience=5),
        ModelCheckpoint('checkpoints_v3/mode2_best.h5', monitor='val_action_correctness', mode='max'),
        TensorBoard(log_dir='logs/mode2')
    ],
    class_weight=config_mode2['class_weight'],
    verbose=1
)
```

**Success Criteria for Mode 2**:
- Action correctness > 60% on validation set
- Reversal prediction accuracy > 65%
- Confidence calibration ECE < 0.15

### Phase 4: Integration and Backtest (1 day)

1. **Create v3.0 API Wrapper**
   - `predict_entry(pair, features)` → Mode 1 output
   - `predict_monitoring(position, features)` → Mode 2 output

2. **Integrate with Monitoring Service**
   - Update `monitoringService.analyzePositionWithML()` to call Mode 2
   - Create entry evaluation endpoint for future Phase 3 signal generation

3. **Backtest Validation**
   - Simulate trading on 2024 test set
   - Use Mode 1 for entry decisions
   - Use Mode 2 for position management
   - Calculate:
     - Total trades
     - Win rate
     - Average RR
     - Sharpe ratio
     - Max drawdown
     - Total return

**Minimum Backtest Requirements**:
- Win rate > 52%
- Sharpe ratio > 0.8
- Max drawdown < 18%
- If not met: Review and retrain

---

## ✅ Validation Strategy

### Custom Metrics During Training

```python
# Mode 1 Metrics
def directional_accuracy_metric(y_true, y_pred):
    """Calculate directional accuracy (matches v2.0 metric for comparison)"""
    # Implementation
    pass

def rr_mae_metric(y_true, y_pred):
    """MAE for risk-reward predictions"""
    pass

def confidence_calibration_metric(y_true, y_pred):
    """Expected Calibration Error (ECE)"""
    pass

# Mode 2 Metrics
def action_correctness_metric(y_true, y_pred):
    """Percentage of correct action predictions"""
    pass

def reversal_prediction_metric(y_true, y_pred):
    """Accuracy of reversal predictions"""
    pass
```

### Backtest Validation

```python
def backtest_v3_model(model_mode1, model_mode2, test_data, initial_balance=10000):
    """
    Simulate trading with v3.0 models

    Returns comprehensive trading metrics
    """
    balance = initial_balance
    positions = []
    trades = []
    equity_curve = []

    for i in range(len(test_data)):
        current_candle = test_data.iloc[i]

        # Check for entry opportunity (Mode 1)
        entry_pred = model_mode1.predict(current_candle.features)

        if entry_pred['signal'] == 1 and entry_pred['confidence'] > 0.65:
            # Open position
            position = open_position(
                entry_price=current_candle['close'],
                sl=entry_pred['sl'],
                tp=entry_pred['tp'],
                direction=entry_pred['direction']
            )
            positions.append(position)

        # Monitor open positions (Mode 2)
        for position in positions:
            if position['status'] == 'open':
                monitor_pred = model_mode2.predict(position, current_candle.features)

                # Take action based on recommendation
                if monitor_pred['recommendation'] == 1:  # Exit
                    close_position(position, current_candle['close'])
                    trades.append(position)
                    positions.remove(position)
                elif monitor_pred['recommendation'] == 2:  # Take Partial
                    take_partial_profit(position, current_candle['close'])
                elif monitor_pred['recommendation'] == 3:  # Adjust SL
                    adjust_stop_loss(position, monitor_pred['suggested_sl'])

        # Update equity
        equity = calculate_equity(balance, positions, current_candle['close'])
        equity_curve.append(equity)

    # Calculate metrics
    return {
        'total_trades': len(trades),
        'winning_trades': sum(1 for t in trades if t['pnl'] > 0),
        'win_rate': sum(1 for t in trades if t['pnl'] > 0) / len(trades),
        'avg_rr': np.mean([t['rr'] for t in trades]),
        'total_return': (equity_curve[-1] - initial_balance) / initial_balance,
        'sharpe_ratio': calculate_sharpe(equity_curve),
        'max_drawdown': calculate_max_drawdown(equity_curve),
        'equity_curve': equity_curve
    }
```

---

## 🔗 Integration with Monitoring Service

### Current Monitoring Service Integration Point

**File**: `backend/src/services/monitoringService.js`
**Method**: `analyzePositionWithML(position, currentPrice, unrealizedPnl)`

**Current State**: Uses mock analysis

**v3.0 Integration**:

```javascript
async analyzePositionWithML(position, currentPrice, unrealizedPnl) {
  try {
    // Call ML API Mode 2
    const mlResponse = await axios.post(`${this.mlApiUrl}/v3/monitor`, {
      position: {
        pair: position.pair,
        action: position.action,
        entryPrice: position.entryPrice,
        stopLoss: position.stopLoss,
        takeProfit: position.takeProfit,
        openedAt: position.openedAt,
        size: position.size || 1.0
      },
      currentPrice: currentPrice,
      unrealizedPnl: unrealizedPnl
    }, {
      timeout: 5000
    });

    // Parse v3.0 response
    const analysis = mlResponse.data;

    return {
      trendDirection: analysis.trend_direction,  // 'uptrend', 'downtrend', 'sideways', 'reversal'
      trendStrength: analysis.trend_strength,    // 0.0-1.0
      reversalProbability: analysis.reversal_probability,  // 0.0-1.0
      recommendation: analysis.recommendation,    // 'hold', 'exit', 'take_partial', 'adjust_sl'
      recommendationConfidence: analysis.confidence,  // 0.0-1.0
      reasoning: analysis.reasoning || this._generateReasoning(analysis)
    };

  } catch (error) {
    logger.warn(`ML API unavailable: ${error.message}. Using fallback analysis.`);
    return this._fallbackAnalysis(position, unrealizedPnl);
  }
}
```

### ML API v3.0 Endpoints

**Base URL**: `http://localhost:8000/api/v3`

#### Endpoint 1: Entry Evaluation

```
POST /api/v3/evaluate_entry

Request:
{
  "pair": "EURUSD",
  "timestamp": "2025-10-13T10:00:00Z",  // Optional, defaults to now
  "features": {  // Optional, API will fetch current data if not provided
    "technical": [...],
    "fundamental": [...],
    "events": [...]
  }
}

Response:
{
  "signal": 1,  // 0 or 1
  "confidence": 0.72,
  "expected_rr": 2.3,
  "recommended_sl": 1.0820,
  "recommended_tp": 1.0920,
  "direction": "buy",  // or "sell"
  "reasoning": "Strong uptrend with ADX > 25, RSI in healthy range..."
}
```

#### Endpoint 2: Position Monitoring

```
POST /api/v3/monitor

Request:
{
  "position": {
    "pair": "EURUSD",
    "action": "buy",
    "entryPrice": 1.0850,
    "stopLoss": 1.0820,
    "takeProfit": 1.0920,
    "openedAt": "2025-10-13T08:00:00Z",
    "size": 1.0
  },
  "currentPrice": 1.0875,
  "unrealizedPnl": {
    "pips": 25.0,
    "percentage": 0.23
  }
}

Response:
{
  "recommendation": "hold",  // "hold", "exit", "take_partial", "adjust_sl"
  "confidence": 0.68,
  "trend_direction": "uptrend",  // "uptrend", "downtrend", "sideways", "reversal"
  "trend_strength": 0.72,
  "reversal_probability": 0.15,
  "reasoning": "Position is in profit with strong uptrend. Hold for TP.",
  "suggested_sl": null  // Only if recommendation == "adjust_sl"
}
```

---

## 📈 Success Criteria

### Training Metrics

| Metric | Mode 1 Target | Mode 2 Target |
|--------|---------------|---------------|
| Validation Accuracy | > 55% | > 60% |
| Directional Accuracy (Mode 1) | > 55% | N/A |
| Action Correctness (Mode 2) | N/A | > 60% |
| Confidence Calibration (ECE) | < 0.15 | < 0.15 |
| RR Prediction MAE | < 0.8 | N/A |
| Reversal Prediction Accuracy | N/A | > 65% |

### Backtest Metrics (2024 Test Set)

| Metric | Minimum | Target |
|--------|---------|--------|
| **Directional Accuracy** | > 50% | > 60% |
| **Win Rate** | > 52% | > 55% |
| **Average RR** | > 1.5 | > 2.0 |
| **Sharpe Ratio** | > 0.8 | > 1.2 |
| **Max Drawdown** | < 18% | < 15% |
| **Total Return (2024)** | > 15% | > 25% |

### Production Metrics (Live Monitoring)

| Metric | Monitoring Frequency | Alert Threshold |
|--------|----------------------|-----------------|
| Win Rate (30-day rolling) | Daily | < 48% |
| Sharpe Ratio | Weekly | < 0.5 |
| Max Drawdown | Real-time | > 20% |
| Confidence Calibration | Weekly | ECE > 0.2 |
| API Latency | Real-time | > 2000ms |

---

## 🗓️ Implementation Timeline

### Week 1: Data Preparation (2 days)

**Days 1-2**:
- [ ] Expand EURUSD dataset to 2015-2024
- [ ] Implement entry labeling algorithm
- [ ] Implement monitoring labeling algorithm
- [ ] Create train/val/test splits
- [ ] Verify label distribution and quality

**Deliverables**:
- `ml_engine/data/training_v3/EURUSD_X_train.npy` (2500+ samples)
- `ml_engine/data/training_v3/EURUSD_y_train_mode1.npy`
- `ml_engine/data/training_v3/EURUSD_y_train_mode2.npy` (10000+ checkpoints)
- Data quality report

### Week 2: Model Implementation (2 days)

**Days 3-4**:
- [ ] Implement Mode 1 architecture
- [ ] Implement Mode 2 architecture
- [ ] Implement custom loss functions
- [ ] Implement custom metrics
- [ ] Create training scripts

**Deliverables**:
- `ml_engine/models/dual_mode_predictor.py`
- `ml_engine/train_v3_mode1.py`
- `ml_engine/train_v3_mode2.py`

### Week 3: Training and Validation (2 days)

**Days 5-6**:
- [ ] Train Mode 1 (Entry Evaluator)
- [ ] Evaluate Mode 1 on validation set
- [ ] Train Mode 2 (Position Monitor)
- [ ] Evaluate Mode 2 on validation set
- [ ] Run backtest on 2024 test set
- [ ] Analyze results

**Deliverables**:
- `ml_engine/saved_models_v3/EURUSD_mode1_v3_YYYYMMDD.h5`
- `ml_engine/saved_models_v3/EURUSD_mode2_v3_YYYYMMDD.h5`
- Training logs and metrics
- Backtest report

### Week 4: Integration and Deployment (1 day)

**Day 7**:
- [ ] Create v3.0 API endpoints
- [ ] Update monitoring service integration
- [ ] End-to-end testing
- [ ] Deploy to production (if metrics meet criteria)
- [ ] Update documentation

**Deliverables**:
- Updated ML API with v3.0 endpoints
- Updated monitoring service
- Integration test results
- Production deployment

---

## 📚 Files to Create

```
ml_engine/
├── models/
│   └── dual_mode_predictor.py           # Mode 1 & 2 architectures
├── data_processing/
│   ├── v3_labeler_mode1.py              # Entry labeling algorithm
│   └── v3_labeler_mode2.py              # Monitoring labeling algorithm
├── scripts/
│   ├── prepare_v3_data.py               # Data preparation pipeline
│   ├── train_v3_mode1.py                # Mode 1 training script
│   └── train_v3_mode2.py                # Mode 2 training script
├── utils/
│   ├── custom_losses.py                 # Custom loss functions
│   ├── custom_metrics.py                # Custom metrics
│   └── backtest_v3.py                   # Backtest validation
├── api/
│   └── v3_endpoints.py                  # FastAPI v3.0 endpoints
└── data/
    └── training_v3/
        ├── EURUSD_X_train.npy
        ├── EURUSD_y_train_mode1.npy
        ├── EURUSD_y_train_mode2.npy
        └── ...
```

---

## 🎓 Key Differentiators from v1.0 & v2.0

| Aspect | v1.0 | v2.0 | v3.0 |
|--------|------|------|------|
| **Problem Type** | 3-class classification | Regression (price) | Dual-mode decision system |
| **Objective** | Predict Buy/Hold/Sell | Predict next price | Optimize trading profitability |
| **Loss Function** | Categorical CE | MSE | Custom trading loss |
| **Data Labels** | Price movements | Absolute prices | Trading opportunities & actions |
| **Optimization Goal** | Class accuracy | Price accuracy | Directional acc + Win rate + Sharpe |
| **Validation** | Accuracy metric | val_loss | Backtest with trading simulation |
| **Output** | Class (0/1/2) | Price (float) | Signal + Confidence + RR + Action |
| **Metrics Tracked** | Accuracy | MAE, RMSE | Directional acc, Win rate, Sharpe, ECE |
| **Result** | 40.85% dir. acc | 47.60% dir. acc | Target: > 60% |

---

## ✅ Pre-Implementation Checklist

- [ ] All v1.0 and v2.0 failures documented and understood
- [ ] Problem framing validated (decision system, not classification/regression)
- [ ] Custom loss functions designed and validated mathematically
- [ ] Data labeling algorithm logic verified
- [ ] Architecture design reviewed for overfitting risks
- [ ] Success criteria defined and agreed upon
- [ ] Implementation timeline realistic (6-7 days)
- [ ] Integration points with monitoring service identified
- [ ] Backtest validation approach defined
- [ ] Rollback plan if v3.0 fails (use mock analysis in monitoring service)

---

**Next Action**: Begin data preparation (Week 1, Days 1-2)

**Status**: Ready for implementation

**Priority**: URGENT

---

**Generated**: 2025-10-13
**Author**: Claude Code (AI-assisted design)
**Version**: 1.0 (Initial Design)
