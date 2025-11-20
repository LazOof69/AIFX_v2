# Database Schema Documentation

## Entity Relationship Diagram

```
┌─────────────────┐
│     users       │
│─────────────────│
│ id (PK)         │
│ username        │◄──────┐
│ email           │       │
│ password_hash   │       │
│ is_active       │       │
│ last_login      │       │
│ created_at      │       │
│ updated_at      │       │
└─────────────────┘       │
         │                │
         │ 1:1            │ 1:N
         │                │
         ▼                │
┌─────────────────────────┤
│  user_preferences       │
│─────────────────────────│
│ id (PK)                 │
│ user_id (FK)            │
│ trading_frequency       │
│ risk_level              │
│ preferred_pairs         │
│ trading_style           │
│ indicators (JSONB)      │
│ notification_settings   │
│ created_at              │
│ updated_at              │
└─────────────────────────┘


┌─────────────────────────┐         ┌──────────────────────┐
│   trading_signals       │         │   notifications      │
│─────────────────────────│         │──────────────────────│
│ id (PK)                 │         │ id (PK)              │
│ pair                    │◄────┐   │ user_id (FK)         │
│ action                  │     │   │ type                 │
│ confidence              │     │   │ title                │
│ entry_price             │     │   │ message              │
│ stop_loss               │     │   │ data (JSONB)         │
│ take_profit             │     │   │ is_read              │
│ risk_reward             │     │   │ priority             │
│ timeframe               │     │   │ channels             │
│ technical_factors       │     │   │ sent_at              │
│ sentiment_factors       │     │   │ read_at              │
│ ml_prediction           │     │   │ created_at           │
│ status                  │     │   │ updated_at           │
│ result                  │     │   └──────────────────────┘
│ closed_at               │     │            ▲
│ created_at              │     │            │
│ updated_at              │     │            │ N:1
└─────────────────────────┘     │            │
         ▲                       │            │
         │ N:1                   │   ┌────────┴───────────┐
         │                       │   │                    │
         │                       └───┤                    │
┌────────┴──────────────────────────┤                    │
│   user_trading_history            │                    │
│───────────────────────────────────│                    │
│ id (PK)                           │                    │
│ user_id (FK) ─────────────────────┴────────────────────┘
│ signal_id (FK)
│ pair
│ action
│ entry_price
│ exit_price
│ stop_loss
│ take_profit
│ position_size
│ profit_loss
│ profit_loss_percentage
│ status
│ result
│ notes
│ opened_at
│ closed_at
│ created_at
│ updated_at
└───────────────────────────────────┘
```

## Table Descriptions

### users
Primary table for user accounts and authentication.

**Columns:**
- `id`: UUID primary key
- `username`: Unique username (max 50 chars)
- `email`: Unique email address (max 100 chars)
- `password_hash`: Bcrypt hashed password
- `is_active`: Account status (boolean)
- `last_login`: Last login timestamp
- `created_at`: Account creation timestamp
- `updated_at`: Last update timestamp

**Indexes:**
- email
- username

### user_preferences
Stores user trading preferences and settings (1:1 with users).

**Columns:**
- `id`: UUID primary key
- `user_id`: Foreign key to users
- `trading_frequency`: ENUM('scalping', 'daytrading', 'swing', 'position')
- `risk_level`: Integer 1-10
- `preferred_pairs`: Array of currency pairs
- `trading_style`: ENUM('trend', 'counter-trend', 'mixed')
- `indicators`: JSONB object with indicator settings
- `notification_settings`: JSONB object with notification preferences
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

**Indexes:**
- user_id (unique)

**Example indicators JSON:**
```json
{
  "sma": { "enabled": true, "period": 20 },
  "rsi": { "enabled": true, "period": 14 },
  "macd": { "enabled": true },
  "bb": { "enabled": false, "period": 20 }
}
```

**Example notification_settings JSON:**
```json
{
  "email": true,
  "discord": false,
  "browser": true,
  "signalTypes": {
    "buy": true,
    "sell": true,
    "hold": false
  },
  "minConfidence": 70
}
```

### trading_signals
AI-generated trading signals.

**Columns:**
- `id`: UUID primary key
- `pair`: Currency pair (e.g., 'EUR/USD')
- `action`: ENUM('buy', 'sell', 'hold')
- `confidence`: Decimal 0.00-1.00
- `entry_price`: Suggested entry price
- `stop_loss`: Suggested stop loss
- `take_profit`: Suggested take profit
- `risk_reward`: Risk/reward ratio
- `timeframe`: Signal timeframe
- `technical_factors`: JSONB with technical analysis
- `sentiment_factors`: JSONB with sentiment analysis
- `ml_prediction`: JSONB with ML model output
- `status`: ENUM('pending', 'active', 'closed', 'expired')
- `result`: ENUM('win', 'loss', 'breakeven', null)
- `closed_at`: Signal closure timestamp
- `created_at`: Signal creation timestamp
- `updated_at`: Last update timestamp

**Indexes:**
- pair
- action
- status
- created_at

### notifications
User notifications for signals, alerts, and system messages.

**Columns:**
- `id`: UUID primary key
- `user_id`: Foreign key to users
- `type`: ENUM('signal', 'alert', 'system', 'news')
- `title`: Notification title
- `message`: Notification message (text)
- `data`: JSONB with additional data
- `is_read`: Read status (boolean)
- `priority`: ENUM('low', 'medium', 'high', 'urgent')
- `channels`: Array of notification channels
- `sent_at`: Sent timestamp
- `read_at`: Read timestamp
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

**Indexes:**
- user_id
- type
- is_read
- created_at

### user_trading_history
Records of user's trading activities based on signals.

**Columns:**
- `id`: UUID primary key
- `user_id`: Foreign key to users
- `signal_id`: Foreign key to trading_signals
- `pair`: Currency pair
- `action`: ENUM('buy', 'sell')
- `entry_price`: Actual entry price
- `exit_price`: Actual exit price
- `stop_loss`: Stop loss level
- `take_profit`: Take profit level
- `position_size`: Position size in lots/units
- `profit_loss`: P&L in base currency
- `profit_loss_percentage`: P&L percentage
- `status`: ENUM('open', 'closed', 'cancelled')
- `result`: ENUM('win', 'loss', 'breakeven', null)
- `notes`: User notes (text)
- `opened_at`: Position open timestamp
- `closed_at`: Position close timestamp
- `created_at`: Record creation timestamp
- `updated_at`: Last update timestamp

**Indexes:**
- user_id
- signal_id
- pair
- status
- opened_at

## Data Types Reference

### ENUM Types
- **trading_frequency**: scalping, daytrading, swing, position
- **trading_style**: trend, counter-trend, mixed
- **signal_action**: buy, sell, hold
- **signal_status**: pending, active, closed, expired
- **trade_result**: win, loss, breakeven
- **notification_type**: signal, alert, system, news
- **notification_priority**: low, medium, high, urgent
- **trade_status**: open, closed, cancelled

### JSONB Structures

**Indicators:**
```json
{
  "indicator_name": {
    "enabled": boolean,
    "period": number (optional)
  }
}
```

**Technical Factors:**
```json
{
  "sma": boolean,
  "rsi": number,
  "macd": "bullish" | "bearish"
}
```

**Sentiment Factors:**
```json
{
  "market_sentiment": "bullish" | "bearish",
  "news_impact": "low" | "medium" | "high"
}
```

**ML Prediction:**
```json
{
  "model_confidence": number,
  "prediction": "buy" | "sell" | "hold"
}
```

## Cascading Rules

- **user_preferences**: ON DELETE CASCADE (deleting user deletes preferences)
- **notifications**: ON DELETE CASCADE (deleting user deletes notifications)
- **user_trading_history**: ON DELETE CASCADE (deleting user or signal deletes history)

## Constraints

- All tables have `created_at` and `updated_at` timestamps
- All primary keys are UUIDs
- Email and username must be unique in users table
- One preference record per user (unique constraint on user_id)
- Risk level must be between 1-10
- Confidence must be between 0.00-1.00