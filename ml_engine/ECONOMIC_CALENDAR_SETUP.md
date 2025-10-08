# Economic Calendar Auto-Update System

**Status**: ✅ Fully Operational
**Created**: 2025-10-08
**Last Updated**: 2025-10-08

---

## 📊 System Overview

自動化經濟日曆數據收集和更新系統，使用 **investpy** 從 Investing.com 獲取經濟事件數據。

### Key Features

- ✅ **自動每日更新**：每天凌晨 1:00 AM 自動執行
- ✅ **雙向數據收集**：
  - 過去 7 天（更新 actual 值）
  - 未來 30 天（獲取 forecast 值）
- ✅ **智能去重**：UPSERT 邏輯防止數據重複
- ✅ **日誌管理**：30 天自動輪轉
- ✅ **健康監控**：隨時檢查系統狀態

---

## 📁 Files Structure

```
/root/AIFX_v2/ml_engine/
├── scripts/
│   ├── collect_economic_calendar.py    # 主收集腳本
│   ├── update_calendar.sh              # 自動更新腳本 (cron)
│   └── check_calendar_health.sh        # 健康檢查腳本
├── logs/
│   ├── calendar_auto_update.log        # 自動更新日誌
│   ├── calendar_auto_update_error.log  # 錯誤日誌
│   ├── calendar_history_*.log          # 歷史收集日誌
│   └── cron.log                        # Cron 執行日誌
└── /etc/logrotate.d/aifx_calendar      # 日誌輪轉配置
```

---

## 🗄️ Database Schema

### Table: `economic_events`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `event_date` | TIMESTAMP | 事件發生日期時間 |
| `currency` | VARCHAR(10) | 貨幣代碼 (USD, EUR, GBP, JPY) |
| `event_name` | VARCHAR(200) | 事件名稱 |
| `impact_level` | ENUM | 影響等級 (high, medium, low) |
| `forecast_value` | NUMERIC(15,6) | 預測值 |
| `actual_value` | NUMERIC(15,6) | 實際值 |
| `previous_value` | NUMERIC(15,6) | 前值 |
| `source` | VARCHAR(50) | 數據來源 (Investing.com) |
| `created_at` | TIMESTAMP | 創建時間 |
| `updated_at` | TIMESTAMP | 更新時間 |

**Unique Constraint**: `(event_date, currency, event_name)`

---

## 📈 Current Data Status

**Last Check**: 2025-10-08 12:53:02

| Metric | Value |
|--------|-------|
| Total Events | 21,179 |
| Date Range | 2020-01-01 to 2025-11-06 |
| Future Events | 144 |
| High-Impact (Next 7 Days) | 12 |

### Distribution by Currency

| Currency | High Impact | Medium Impact | Total |
|----------|-------------|---------------|-------|
| USD | 2,891 | 9,424 | 12,315 (58%) |
| EUR | 287 | 3,079 | 3,366 (16%) |
| GBP | 336 | 3,076 | 3,412 (16%) |
| JPY | 97 | 1,989 | 2,086 (10%) |

---

## 🚀 Usage Guide

### 1. Manual Collection

```bash
cd /root/AIFX_v2/ml_engine
source venv/bin/activate

# Collect last 30 days
python scripts/collect_economic_calendar.py --days 30

# Collect specific date range
python scripts/collect_economic_calendar.py --start-date 2024-01-01 --end-date 2024-12-31

# Test mode (no database write)
python scripts/collect_economic_calendar.py --test
```

### 2. Check System Health

```bash
cd /root/AIFX_v2/ml_engine
./scripts/check_calendar_health.sh

# Verbose mode (show upcoming high-impact events)
./scripts/check_calendar_health.sh --verbose
```

### 3. Manual Update

```bash
cd /root/AIFX_v2/ml_engine
./scripts/update_calendar.sh
```

### 4. Check Auto-Update Logs

```bash
# Latest update log
tail -50 /root/AIFX_v2/ml_engine/logs/calendar_auto_update.log

# Error log
tail -50 /root/AIFX_v2/ml_engine/logs/calendar_auto_update_error.log

# Cron execution log
tail -50 /root/AIFX_v2/ml_engine/logs/cron.log
```

---

## ⏰ Automatic Update Schedule

**Cron Configuration**: `/var/spool/cron/crontabs/root`

```cron
# AIFX v2 Economic Calendar Auto-Update
# Update economic calendar daily at 01:00 AM
# Collects past 7 days (for actual values) + next 30 days (for forecasts)
0 1 * * * /root/AIFX_v2/ml_engine/scripts/update_calendar.sh >> /root/AIFX_v2/ml_engine/logs/cron.log 2>&1
```

**Schedule**: Every day at **01:00 AM UTC**

**What it does**:
1. Activates Python virtual environment
2. Collects data from **7 days ago** to **30 days future**
3. Updates existing events with new actual values
4. Inserts new upcoming events
5. Logs results and statistics

---

## 🔍 Monitoring & Maintenance

### Daily Health Check Checklist

```bash
# 1. Check if data is fresh
./scripts/check_calendar_health.sh

# 2. Verify cron execution
grep "Collection complete" logs/calendar_auto_update.log | tail -3

# 3. Check for errors
tail -20 logs/calendar_auto_update_error.log
```

### Expected Behavior

✅ **Healthy System**:
- Updated in last 24h: > 0 events
- Future events: > 100
- Data freshness: < 24 hours
- No errors in error log

⚠️ **Warning Signs**:
- No updates in last 24h
- Future events < 50
- Data freshness > 48 hours
- Repeated errors in logs

### Troubleshooting

#### Problem: No updates in last 24h

```bash
# Check cron service
systemctl status cron

# Check cron logs
tail -50 logs/cron.log

# Manually run update
./scripts/update_calendar.sh
```

#### Problem: Low number of future events

```bash
# Manually update with larger date range
python scripts/collect_economic_calendar.py --days 60
```

#### Problem: Database connection errors

```bash
# Check PostgreSQL service
systemctl status postgresql

# Test database connection
export PGPASSWORD=postgres
psql -h localhost -U postgres -d aifx_v2_dev -c "SELECT 1;"
```

---

## 📝 Log Rotation

**Configuration**: `/etc/logrotate.d/aifx_calendar`

- **Rotation**: Daily
- **Retention**: 30 days
- **Compression**: Enabled (gzip)
- **Old history cleanup**: 90 days

---

## 🔧 Environment Variables

All scripts use these environment variables (defaults shown):

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=aifx_v2_dev
DB_USER=postgres
DB_PASSWORD=postgres
```

Set in `/root/.bashrc` or script header to override.

---

## 📊 Data Quality Standards

### Collection Rules

1. **Importance Filtering**: Only collect `high` and `medium` impact events
2. **Holiday Filtering**: Automatically skip events without valid importance
3. **Currency Focus**: USD, EUR, GBP, JPY only
4. **Country Mapping**:
   - United States → USD
   - Euro Zone → EUR
   - United Kingdom → GBP
   - Japan → JPY

### Update Strategy

- **UPSERT Logic**: Insert new, update existing
- **Actual Values**: Prefer new over null, keep existing if new is null
- **Forecast Values**: Same as actual
- **Previous Values**: Same as actual

---

## 🎯 Integration with ML Pipeline

This system provides economic event data for:

1. **Feature Engineering** (`fundamental_features.py`):
   - Days to next high-impact event
   - Event impact scoring
   - Event clustering by time window

2. **Risk Assessment**:
   - Pre-event risk warnings
   - High volatility period detection
   - Trading signal filtering

3. **Model Training** (Phase 2 MVP):
   - Event features as additional input
   - Volatility prediction
   - Direction accuracy improvement

---

## 🚨 Critical Alerts

System should alert if:

- ❌ No updates for > 48 hours
- ❌ Future events < 50
- ❌ Database connection failures
- ❌ More than 5 consecutive cron failures

---

## 📚 References

- **Data Source**: Investing.com via [investpy](https://github.com/alvarobartt/investpy)
- **API Documentation**: https://investpy.readthedocs.io/
- **AIFX v2 Project**: `/root/AIFX_v2/`
- **Phase 2 MVP Plan**: `/root/AIFX_v2/ml_engine/ML_ENGINE_TODO.md`

---

## 🔄 Version History

| Date | Version | Changes |
|------|---------|---------|
| 2025-10-08 | 1.0.0 | Initial setup - Full system operational |

---

**Next Steps**:
1. ✅ Complete - Auto-update system configured
2. 🔄 In Progress - Fundamental feature engineering (`fundamental_features.py`)
3. ⏸️ Pending - Multi-input LSTM v2.0 model

---

**Maintained by**: AIFX v2 ML Engine Team
**Contact**: See `/root/AIFX_v2/CLAUDE.md` for project guidelines
