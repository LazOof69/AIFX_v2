# Cron Job Setup for Continuous Learning

## Overview

AIFX v2 使用 cron 來自動化模型訓練：

- **每日訓練**: 每天 UTC 01:00 執行增量訓練（fine-tuning）
- **每週訓練**: 每週日 UTC 01:00 執行完整訓練（full retrain）

---

## 📋 Prerequisites

1. ✅ PostgreSQL 運行中
2. ✅ Redis 運行中
3. ✅ Python 虛擬環境已設置 (`ml_engine/venv`)
4. ✅ 環境變量已配置 (`.env` 文件)

---

## 🚀 Installation

### Step 1: Make scripts executable

```bash
cd /root/AIFX_v2/ml_engine

# Make cron wrapper scripts executable
chmod +x cron/daily_training.sh
chmod +x cron/weekly_training.sh

# Make Python training scripts executable
chmod +x scripts/daily_incremental_training.py
chmod +x scripts/weekly_full_training.py
```

### Step 2: Test scripts manually

```bash
# Test daily training
/root/AIFX_v2/ml_engine/cron/daily_training.sh

# Test weekly training (takes longer)
/root/AIFX_v2/ml_engine/cron/weekly_training.sh
```

### Step 3: Install cron jobs

```bash
# Open crontab editor
crontab -e

# Add the following lines:

# AIFX v2 - Daily Incremental Training (UTC 01:00)
0 1 * * * /root/AIFX_v2/ml_engine/cron/daily_training.sh >> /root/AIFX_v2/ml_engine/logs/cron/daily_cron.log 2>&1

# AIFX v2 - Weekly Full Training (Sunday UTC 01:00)
0 1 * * 0 /root/AIFX_v2/ml_engine/cron/weekly_training.sh >> /root/AIFX_v2/ml_engine/logs/cron/weekly_cron.log 2>&1
```

### Step 4: Verify cron jobs

```bash
# List installed cron jobs
crontab -l

# Check cron service status
systemctl status cron
```

---

## 📊 Cron Schedule Explanation

### Daily Training - UTC 01:00

```
0 1 * * *
│ │ │ │ │
│ │ │ │ └── Day of week (0-7, 0 and 7 = Sunday)
│ │ │ └──── Month (1-12)
│ │ └────── Day of month (1-31)
│ └──────── Hour (0-23)
└────────── Minute (0-59)
```

**Meaning**: Every day at 01:00 UTC (凌晨 1 點 UTC)

### Weekly Training - Sunday UTC 01:00

```
0 1 * * 0
│ │ │ │ │
│ │ │ │ └── Sunday (0)
│ │ │ └──── Every month
│ │ └────── Every day of month
│ └──────── Hour 01 (1 AM)
└────────── Minute 00
```

**Meaning**: Every Sunday at 01:00 UTC (每週日凌晨 1 點 UTC)

---

## 🕐 Time Zone Considerations

### Current Server Time

```bash
# Check current time
date

# Check UTC time
date -u

# Check timezone
timedatectl
```

### Why UTC 01:00?

1. **Market Close**: Most forex markets are closed or low volume
2. **System Load**: Minimal user activity
3. **Data Availability**: Full day's data available
4. **Consistent**: No daylight saving time issues

### Time Zone Conversion

| Location      | UTC 01:00 = |
|---------------|-------------|
| New York (EST) | 20:00 (8 PM previous day) |
| New York (EDT) | 21:00 (9 PM previous day) |
| London (GMT)   | 01:00 |
| London (BST)   | 02:00 |
| Tokyo (JST)    | 10:00 |
| Sydney (AEDT)  | 12:00 (noon) |

---

## 📁 Log Files

### Cron Wrapper Logs

```
/root/AIFX_v2/ml_engine/logs/cron/
├── daily_cron.log             # Cron stdout/stderr
├── daily_training_cron_YYYYMMDD.log
├── weekly_cron.log            # Cron stdout/stderr
└── weekly_training_cron_YYYYMMDD.log
```

### Training Script Logs

```
/root/AIFX_v2/ml_engine/logs/training/
├── daily_training_YYYYMMDD.log
└── weekly_training_YYYYMMDD.log
```

### Viewing Logs

```bash
# View today's daily training log
tail -f /root/AIFX_v2/ml_engine/logs/training/daily_training_$(date +%Y%m%d).log

# View latest cron log
tail -f /root/AIFX_v2/ml_engine/logs/cron/daily_cron.log

# Search for errors
grep -i error /root/AIFX_v2/ml_engine/logs/training/*.log

# Check training completion
grep "COMPLETED" /root/AIFX_v2/ml_engine/logs/training/*.log
```

---

## 🔍 Monitoring

### Check if cron jobs are running

```bash
# View running processes
ps aux | grep daily_training
ps aux | grep weekly_training

# Check recent cron executions
grep -i cron /var/log/syslog | tail -20

# Check cron service
systemctl status cron
```

### Database Monitoring

```bash
# Connect to PostgreSQL
psql $DATABASE_URL

# Check recent training logs
SELECT id, training_type, status, started_at, training_duration
FROM model_training_log
ORDER BY started_at DESC
LIMIT 10;

# Check model versions
SELECT version, status, created_at, metrics
FROM model_versions
ORDER BY created_at DESC
LIMIT 5;
```

---

## 🚨 Troubleshooting

### Cron job not running

1. **Check cron service**
   ```bash
   systemctl status cron
   systemctl restart cron
   ```

2. **Check crontab syntax**
   ```bash
   crontab -l
   ```

3. **Check script permissions**
   ```bash
   ls -la /root/AIFX_v2/ml_engine/cron/*.sh
   # Should show -rwxr-xr-x
   ```

4. **Test script manually**
   ```bash
   /root/AIFX_v2/ml_engine/cron/daily_training.sh
   ```

### Script fails with errors

1. **Check environment variables**
   ```bash
   cat /root/AIFX_v2/backend/.env | grep DATABASE_URL
   cat /root/AIFX_v2/ml_engine/.env
   ```

2. **Check database connectivity**
   ```bash
   psql $DATABASE_URL -c "SELECT 1"
   ```

3. **Check Redis connectivity**
   ```bash
   redis-cli ping
   ```

4. **Check Python dependencies**
   ```bash
   source /root/AIFX_v2/ml_engine/venv/bin/activate
   pip list | grep -E 'tensorflow|psycopg2|redis|pandas'
   ```

### No data available for training

1. **Check market data**
   ```sql
   SELECT COUNT(*), MIN(timestamp), MAX(timestamp)
   FROM market_data;
   ```

2. **Check labeled signals**
   ```sql
   SELECT COUNT(*), actual_outcome
   FROM trading_signals
   WHERE actual_outcome != 'pending'
   GROUP BY actual_outcome;
   ```

3. **Run data collection manually**
   ```bash
   cd /root/AIFX_v2/backend
   npm run collect-market-data
   ```

---

## 📧 Notifications (Optional)

### Email on failure

Add to cron job:

```bash
0 1 * * * /root/AIFX_v2/ml_engine/cron/daily_training.sh || echo "Daily training failed" | mail -s "AIFX Training Failure" admin@example.com
```

### Slack/Discord webhook

Modify `daily_training.sh` to send webhook notification on failure.

---

## 🔄 Updating Cron Jobs

### Modify schedule

```bash
# Edit crontab
crontab -e

# Example: Change to run at 02:00 instead of 01:00
0 2 * * * /root/AIFX_v2/ml_engine/cron/daily_training.sh
```

### Disable temporarily

```bash
# Comment out in crontab
crontab -e

# Add # at the beginning of the line
# 0 1 * * * /root/AIFX_v2/ml_engine/cron/daily_training.sh
```

### Remove completely

```bash
crontab -e

# Delete the entire line
```

---

## 📊 Expected Behavior

### Daily Training

- **Duration**: 5-15 minutes
- **Data**: Last 24 hours
- **Output**: New model version in `staging` status
- **Frequency**: Every day

### Weekly Training

- **Duration**: 30-60 minutes
- **Data**: Last 7-30 days (full retrain)
- **Output**: New model version in `staging` status
- **Frequency**: Every Sunday

### Model Deployment

Models created by cron jobs start in `staging` status. To promote to production:

```sql
-- Manually promote model
UPDATE model_versions
SET status = 'production'
WHERE id = 'your-model-id';

-- Or use backend API
curl -X POST http://localhost:3000/api/v1/ml/models/{version}/promote
```

---

## 🎯 Best Practices

1. **Monitor logs regularly** - Check for errors and warnings
2. **Validate models before promotion** - Don't auto-promote to production
3. **Keep data fresh** - Ensure market data collection is working
4. **Backup models** - Save production models before replacing
5. **Test schedule changes** - Test manually before updating cron
6. **Document changes** - Keep notes on training performance
7. **Set up alerts** - Get notified on failures
8. **Review metrics** - Track model performance over time

---

## 📞 Support

If cron jobs fail consistently:

1. Check logs in `/root/AIFX_v2/ml_engine/logs/`
2. Verify all services are running (PostgreSQL, Redis)
3. Test scripts manually
4. Review database for training logs and errors

**Logs location**: `/root/AIFX_v2/ml_engine/logs/`
**Cron logs**: `/var/log/syslog` (search for "CRON")
