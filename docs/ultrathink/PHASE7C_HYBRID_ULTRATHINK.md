# Phase 7C: Hybrid Approach - ULTRATHINK Execution Plan
**Generated**: 2025-11-22 17:45:00
**Strategy**: MVP First + Production Optimization
**Total Timeline**: 2 days + 1-2 weeks
**Status**: Planning Complete - Ready to Execute

---

## 🎯 Executive Summary

**Approach**: Two-stage deployment strategy combining speed and quality

### Stage 1: Frontend MVP Deployment (2 Days) ⚡ FAST IMPACT
- **Goal**: Get frontend live with all current features
- **Timeline**: Days 1-2
- **Result**: Users can access web dashboard immediately

### Stage 2: Production Infrastructure (1-2 Weeks) 🏗️ LONG-TERM STABILITY
- **Goal**: Production-grade deployment infrastructure
- **Timeline**: Weeks 1-2
- **Result**: Reliable, scalable, maintainable system

---

## 📊 Why This Approach Works

### ✅ Advantages of Hybrid Approach:

1. **Fastest Time-to-Value**: Frontend live in 2 days
   - Immediate user access to trading dashboard
   - Start collecting user feedback early
   - Validate product-market fit quickly

2. **Risk Mitigation**: Test before full production deployment
   - Identify issues with real usage
   - Fix bugs before investing in infrastructure
   - Validate API integration in production

3. **Incremental Investment**: Optimize based on actual needs
   - See what features users actually use
   - Prioritize infrastructure work based on load
   - Avoid over-engineering

4. **Continuous Delivery**: System stays operational during upgrades
   - No downtime during Stage 2 implementation
   - Can rollback if needed
   - Gradual improvement

5. **Team Learning**: Build knowledge incrementally
   - Learn from MVP deployment
   - Apply lessons to production deployment
   - Reduce mistakes in Stage 2

---

## 🚀 STAGE 1: Frontend MVP Deployment (2 Days)

### 📅 Day 1: Testing & Bug Fixing

#### Morning (4 hours): Comprehensive Testing

**Task 1.1: Start Development Server & Verify** (30 min)
```bash
cd /root/AIFX_v2/frontend
npm run dev
# Verify server starts on port 5173
# Check console for errors
```

**Success Criteria**:
- ✅ Server starts without errors
- ✅ No dependency warnings
- ✅ Port 5173 accessible
- ✅ Hot reload working

---

**Task 1.2: Test Authentication Flow** (1 hour)
```
Test Cases:
1. Login with existing user (john@example.com)
   - Verify JWT token stored
   - Verify redirect to /dashboard
   - Check localStorage for tokens

2. Registration with new user
   - Verify validation errors
   - Verify successful registration
   - Verify auto-login after register

3. Protected routes
   - Try accessing /dashboard without login
   - Verify redirect to /login
   - Verify token refresh on 401

4. Logout
   - Verify token cleared
   - Verify redirect to /login
   - Verify cannot access protected routes
```

**Success Criteria**:
- ✅ All authentication flows working
- ✅ Token management correct
- ✅ No console errors
- ✅ UI displays properly

---

**Task 1.3: Test Dashboard Features** (1 hour)
```
Test Cases:
1. Dashboard loads
   - User profile displays correctly
   - Performance metrics show

2. WebSocket connection
   - Open browser console
   - Verify WebSocket connected
   - Check for connection errors

3. Real-time signals
   - Wait for signal updates
   - Verify signals appear in UI
   - Check browser notifications

4. Navigation
   - Click on signal to go to trading view
   - Verify navigation works
   - Check back navigation
```

**Success Criteria**:
- ✅ Dashboard displays user data
- ✅ WebSocket connected
- ✅ Real-time updates working
- ✅ Navigation smooth

---

**Task 1.4: Test Trading View** (1 hour)
```
Test Cases:
1. Trading View page
   - Select different currency pairs
   - Verify chart loads
   - Check signal details display

2. Chart functionality
   - Verify candlestick chart renders
   - Check timeframe selector
   - Test chart interactions

3. Signal information
   - Entry price displayed
   - Stop Loss / Take Profit shown
   - Confidence score visible
   - Risk-Reward ratio calculated

4. Signal history
   - View historical signals for pair
   - Check signal status (pending/triggered/expired)
```

**Success Criteria**:
- ✅ All currency pairs work
- ✅ Charts render correctly
- ✅ Signal data accurate
- ✅ No errors in console

---

**Task 1.5: Test Market Overview** (30 min)
```
Test Cases:
1. Market Overview grid
   - All currency pairs display
   - Prices updating
   - 24h change showing

2. Real-time updates
   - Verify WebSocket price updates
   - Check color coding (green/red)
   - Test signal recommendations

3. Navigation
   - Click on pair card
   - Verify navigation to trading view
   - Check correct pair loaded
```

**Success Criteria**:
- ✅ All pairs display correctly
- ✅ Real-time updates working
- ✅ Navigation functional

---

**Task 1.6: Test Settings Page** (30 min)
```
Test Cases:
1. User profile editing
   - Change email
   - Change username
   - Verify save works

2. Trading preferences
   - Change risk level
   - Select trading frequency
   - Choose preferred pairs
   - Update trading style

3. Notification settings
   - Toggle email notifications
   - Toggle Discord notifications
   - Toggle browser notifications
   - Save preferences

4. Technical indicators
   - Enable/disable indicators
   - Change periods
   - Save preferences

5. Password change
   - Enter old password (wrong)
   - Verify error shows
   - Enter correct old password
   - Change to new password
   - Verify success
```

**Success Criteria**:
- ✅ All settings save correctly
- ✅ API calls successful
- ✅ UI updates reflect changes
- ✅ Validation working

---

#### Afternoon (4 hours): Bug Fixing & Optimization

**Task 1.7: Fix Critical Bugs** (2 hours)
- Identify all errors from morning testing
- Prioritize by severity (Critical > High > Medium)
- Fix critical bugs first
- Test fixes immediately
- Document all changes

**Common Issues to Check**:
```javascript
// API endpoint mismatches
// Check if frontend API calls match backend routes

// WebSocket connection issues
// Verify SOCKET_URL in .env correct

// JWT token expiration
// Check token refresh logic working

// Chart rendering issues
// Verify Chart.js configuration

// CSS/styling problems
// Check Tailwind classes applied correctly
```

---

**Task 1.8: Performance Optimization** (1 hour)
```javascript
// Check for unnecessary re-renders
// Use React DevTools Profiler

// Optimize WebSocket subscriptions
// Ensure proper cleanup on unmount

// Check bundle size
npm run build
# Analyze dist/ folder size

// Lazy load components if needed
const TradingView = React.lazy(() => import('./components/TradingView'));
```

---

**Task 1.9: Cross-browser Testing** (1 hour)
```
Test on:
- Chrome (primary)
- Firefox
- Safari (if available)
- Edge

Check:
- Layout consistency
- WebSocket support
- Chart rendering
- Notifications
```

---

### 📅 Day 2: Production Build & Deployment

#### Morning (4 hours): Production Build

**Task 2.1: Environment Configuration** (30 min)
```bash
# Create production .env
cd /root/AIFX_v2/frontend

# Check current .env
cat .env

# Update for production
nano .env
```

**Production .env**:
```env
# Production environment
VITE_API_BASE_URL=https://yourdomain.com/api/v1
VITE_SOCKET_URL=https://yourdomain.com

# Or if using IP:
# VITE_API_BASE_URL=https://YOUR_IP/api/v1
# VITE_SOCKET_URL=https://YOUR_IP
```

---

**Task 2.2: Build Production Bundle** (30 min)
```bash
cd /root/AIFX_v2/frontend

# Clean previous build
rm -rf dist/

# Build production
npm run build

# Check build output
ls -lh dist/

# Check bundle size
du -sh dist/
```

**Success Criteria**:
- ✅ Build completes without errors
- ✅ dist/ folder created
- ✅ index.html exists
- ✅ assets/ folder with JS/CSS bundles
- ✅ Total size < 5MB (ideally < 2MB)

---

**Task 2.3: Test Production Build Locally** (30 min)
```bash
# Install serve if needed
npm install -g serve

# Serve production build
cd /root/AIFX_v2/frontend/dist
serve -s . -l 8080

# Test in browser
# http://localhost:8080

# Verify:
# - All routes work
# - API calls successful
# - WebSocket connects
# - No console errors
```

---

**Task 2.4: Optimize Assets** (30 min)
```bash
# Check for large files
find dist/ -type f -size +500k

# If images are too large, compress them
# If JS bundles too large, check for code splitting opportunities
```

---

#### Afternoon (4 hours): Nginx & SSL Setup

**Task 2.5: Install & Configure Nginx** (1 hour)
```bash
# Install Nginx
sudo apt update
sudo apt install nginx -y

# Check Nginx status
sudo systemctl status nginx

# Enable Nginx on boot
sudo systemctl enable nginx

# Create frontend configuration
sudo nano /etc/nginx/sites-available/aifx-frontend
```

**Nginx Configuration**:
```nginx
# /etc/nginx/sites-available/aifx-frontend

server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    # Or use IP: server_name YOUR_IP;

    # Frontend - React SPA
    location / {
        root /root/AIFX_v2/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API proxy
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket proxy
    location /socket.io/ {
        proxy_pass http://localhost:3000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # ML Engine API proxy (optional)
    location /ml-api/ {
        proxy_pass http://localhost:8000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**Enable Configuration**:
```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/aifx-frontend /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

**Task 2.6: Setup SSL Certificate** (1 hour)
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Or for IP address (self-signed):
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/nginx-selfsigned.key \
  -out /etc/ssl/certs/nginx-selfsigned.crt

# Update Nginx config for SSL
sudo nano /etc/nginx/sites-available/aifx-frontend
```

**SSL Nginx Configuration**:
```nginx
# HTTPS server
server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Or for self-signed:
    # ssl_certificate /etc/ssl/certs/nginx-selfsigned.crt;
    # ssl_certificate_key /etc/ssl/private/nginx-selfsigned.key;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # ... (rest of location blocks same as HTTP)
}

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$host$request_uri;
}
```

**Test SSL**:
```bash
# Reload Nginx
sudo systemctl reload nginx

# Test HTTPS
curl -I https://your-domain.com
```

---

**Task 2.7: Verify Backend is Running** (30 min)
```bash
# Check Backend status
cd /root/AIFX_v2/backend
pm2 status
# Or if using npm:
ps aux | grep "node.*backend"

# If not running, start it
cd /root/AIFX_v2/backend
npm start &

# Or better, use PM2:
pm2 start npm --name "aifx-backend" -- start
pm2 save
pm2 startup

# Verify Backend accessible
curl http://localhost:3000/api/v1/health
```

---

**Task 2.8: End-to-End Testing** (1 hour)
```
Test Production Deployment:

1. Access via domain/IP
   - https://your-domain.com
   - Verify HTTPS lock icon

2. Test authentication
   - Login with existing user
   - Check JWT token
   - Verify dashboard loads

3. Test real-time features
   - WebSocket connection
   - Live signal updates
   - Browser notifications

4. Test all pages
   - Dashboard
   - Trading View
   - Market Overview
   - Settings

5. Test API integration
   - Check Network tab
   - Verify API calls use HTTPS
   - Check WebSocket uses WSS

6. Performance check
   - Page load time < 3s
   - Time to interactive < 5s
   - No console errors
   - No network errors

7. Mobile test
   - Access from mobile device
   - Verify responsive design
   - Test touch interactions
```

---

**Task 2.9: Documentation & Handoff** (30 min)

Create deployment documentation:

```markdown
# Frontend Deployment Guide

## Production URLs
- Frontend: https://your-domain.com
- Backend API: https://your-domain.com/api/v1
- WebSocket: wss://your-domain.com

## Services Status
- Frontend: Nginx (port 80/443)
- Backend: PM2/npm (port 3000)
- ML Engine: systemd (port 8000)
- Database: PostgreSQL (port 5432)
- Cache: Redis (port 6379)

## Deployment Process
1. Code changes in /root/AIFX_v2/frontend/src
2. Build: npm run build
3. Deploy: Copy dist/ to /root/AIFX_v2/frontend/dist
4. Nginx auto-serves updated files

## Rollback Procedure
1. Keep previous dist/ backup
2. Copy backup to dist/
3. Reload Nginx: sudo systemctl reload nginx

## Monitoring
- Nginx logs: /var/log/nginx/access.log
- Nginx errors: /var/log/nginx/error.log
- Backend logs: pm2 logs aifx-backend

## Troubleshooting
- HTTPS not working: Check SSL cert with certbot certificates
- API not accessible: Check Backend running on port 3000
- WebSocket issues: Verify /socket.io/ proxy in Nginx
```

---

### ✅ Stage 1 Success Criteria

**At end of Day 2, you should have**:
- ✅ Frontend accessible via HTTPS
- ✅ All features working (auth, dashboard, trading, settings)
- ✅ WebSocket real-time updates functional
- ✅ SSL certificate installed
- ✅ Nginx serving frontend + proxying Backend
- ✅ No critical bugs
- ✅ Documentation complete
- ✅ Mobile responsive

**Key Metrics**:
- Page load time: < 3 seconds
- Time to interactive: < 5 seconds
- WebSocket latency: < 100ms
- API response time: < 200ms
- Error rate: 0%

---

## 🏗️ STAGE 2: Production Infrastructure (1-2 Weeks)

### 📅 Week 1: Process Management & Configuration

#### Day 1-2: PM2 Setup for Backend (UPGRADE)

**Current State**: Backend running with `npm start` or PM2 basic
**Goal**: Production-grade PM2 configuration

**Task 2.1.1: Create PM2 Ecosystem File** (1 hour)
```javascript
// /root/AIFX_v2/ecosystem.config.js

module.exports = {
  apps: [
    {
      name: 'aifx-backend',
      cwd: '/root/AIFX_v2/backend',
      script: 'src/server.js',
      instances: 2, // Cluster mode for load balancing
      exec_mode: 'cluster',

      // Environment variables
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },

      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/root/AIFX_v2/logs/backend-error.log',
      out_file: '/root/AIFX_v2/logs/backend-out.log',
      log_file: '/root/AIFX_v2/logs/backend-combined.log',

      // Auto-restart configuration
      max_memory_restart: '500M',
      max_restarts: 10,
      min_uptime: '10s',

      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 3000,
      shutdown_with_message: true,

      // Monitoring
      autorestart: true,
      watch: false, // Don't watch in production

      // Cron restart (optional - restart daily at 3 AM)
      cron_restart: '0 3 * * *'
    }
  ]
};
```

**Deploy PM2**:
```bash
# Install PM2 globally
npm install -g pm2

# Start with ecosystem file
cd /root/AIFX_v2
pm2 start ecosystem.config.js --env production

# Save PM2 process list
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the command it shows

# Monitor
pm2 monit

# Logs
pm2 logs aifx-backend --lines 100

# Status
pm2 status
```

**Success Criteria**:
- ✅ Backend running in cluster mode (2 instances)
- ✅ Auto-restart on crash
- ✅ Auto-start on server reboot
- ✅ Logs rotating properly
- ✅ Memory limits enforced

---

#### Day 3-4: systemd Service for ML Engine

**Current State**: ML Engine running manually
**Goal**: systemd service with auto-restart

**Task 2.1.2: Create systemd Service File**
```bash
sudo nano /etc/systemd/system/aifx-ml-engine.service
```

```ini
[Unit]
Description=AIFX ML Engine API Service
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=root
WorkingDirectory=/root/AIFX_v2/ml_engine
Environment="PATH=/usr/bin:/usr/local/bin"
Environment="PYTHONUNBUFFERED=1"
EnvironmentFile=/root/AIFX_v2/ml_engine/.env

ExecStart=/usr/bin/python3 api/api.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Resource limits
MemoryLimit=2G
CPUQuota=150%

[Install]
WantedBy=multi-user.target
```

**Enable Service**:
```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service
sudo systemctl enable aifx-ml-engine

# Start service
sudo systemctl start aifx-ml-engine

# Check status
sudo systemctl status aifx-ml-engine

# View logs
sudo journalctl -u aifx-ml-engine -f

# Test restart
sudo systemctl restart aifx-ml-engine
```

**Success Criteria**:
- ✅ ML Engine starts automatically on boot
- ✅ Auto-restart on failure (with 10s delay)
- ✅ Logs accessible via journalctl
- ✅ Resource limits enforced

---

#### Day 5: Environment Configuration & Security

**Task 2.1.3: Production Environment Files**

**Backend Production .env**:
```bash
cd /root/AIFX_v2/backend
cp .env .env.backup
nano .env.production
```

```env
# Production Environment
NODE_ENV=production
PORT=3000

# Database (Production)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=aifx_prod
DB_USER=aifx_user
DB_PASSWORD=STRONG_PASSWORD_HERE

# Redis (Production)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=STRONG_PASSWORD_HERE

# JWT Secrets (ROTATE THESE!)
JWT_SECRET=GENERATE_STRONG_SECRET_64_CHARS
JWT_REFRESH_SECRET=GENERATE_DIFFERENT_SECRET_64_CHARS
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# API Keys (ROTATE THESE!)
DISCORD_BOT_API_KEY=GENERATE_STRONG_KEY
ML_ENGINE_API_KEY=GENERATE_STRONG_KEY

# External APIs
ALPHA_VANTAGE_KEY=your_production_key
TWELVE_DATA_KEY=your_production_key

# CORS
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com

# Rate Limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=100
```

**Generate Strong Secrets**:
```bash
# Generate JWT secrets
openssl rand -hex 32
openssl rand -hex 32

# Generate API keys
openssl rand -base64 32
openssl rand -base64 32
```

**ML Engine Production .env**:
```bash
cd /root/AIFX_v2/ml_engine
nano .env.production
```

```env
# ML Engine Production
BACKEND_API_URL=http://localhost:3000/api/v1
ML_ENGINE_API_KEY=SAME_AS_BACKEND
PORT=8000

# Model Configuration
MODEL_PATH=/root/AIFX_v2/ml_engine/models/production
TRAINING_DATA_PATH=/root/AIFX_v2/ml_engine/data

# Performance
WORKERS=4
TIMEOUT=60
```

**Success Criteria**:
- ✅ All secrets rotated
- ✅ Strong passwords generated
- ✅ Production configs separate from development
- ✅ No secrets in git

---

### 📅 Week 2: Database, Backups & CI/CD

#### Day 1-2: Database Management

**Task 2.2.1: Database Backup Automation**

**Create Backup Script**:
```bash
sudo nano /root/scripts/backup-database.sh
```

```bash
#!/bin/bash

# AIFX Database Backup Script
# Runs daily via cron

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/root/backups/database"
DB_NAME="aifx_prod"
DB_USER="aifx_user"
RETENTION_DAYS=7

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
pg_dump -U $DB_USER -d $DB_NAME | gzip > $BACKUP_DIR/aifx_backup_$DATE.sql.gz

# Delete old backups (older than 7 days)
find $BACKUP_DIR -name "aifx_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Log
echo "$(date): Database backup completed: aifx_backup_$DATE.sql.gz" >> /root/logs/backup.log

# Upload to cloud (optional)
# aws s3 cp $BACKUP_DIR/aifx_backup_$DATE.sql.gz s3://your-bucket/backups/
```

**Make Executable & Schedule**:
```bash
# Make executable
chmod +x /root/scripts/backup-database.sh

# Test run
/root/scripts/backup-database.sh

# Schedule with cron (daily at 2 AM)
crontab -e
```

Add to crontab:
```cron
0 2 * * * /root/scripts/backup-database.sh >> /root/logs/backup.log 2>&1
```

**Create Restore Script**:
```bash
sudo nano /root/scripts/restore-database.sh
```

```bash
#!/bin/bash

# AIFX Database Restore Script
# Usage: ./restore-database.sh <backup_file>

if [ -z "$1" ]; then
    echo "Usage: $0 <backup_file.sql.gz>"
    exit 1
fi

BACKUP_FILE=$1
DB_NAME="aifx_prod"
DB_USER="aifx_user"

echo "WARNING: This will overwrite the current database!"
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Restore cancelled"
    exit 0
fi

# Restore
gunzip < $BACKUP_FILE | psql -U $DB_USER -d $DB_NAME

echo "Database restored from $BACKUP_FILE"
```

```bash
chmod +x /root/scripts/restore-database.sh
```

**Success Criteria**:
- ✅ Daily automated backups
- ✅ 7-day retention
- ✅ Backups compressed (gzip)
- ✅ Restore script tested
- ✅ Logs maintained

---

**Task 2.2.2: Database Optimization**

```sql
-- Create indexes for performance
-- Connect to database
psql -U aifx_user -d aifx_prod

-- Market data indexes
CREATE INDEX IF NOT EXISTS idx_market_data_pair_timestamp
ON market_data(pair, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_market_data_timestamp
ON market_data(timestamp DESC);

-- Signals indexes
CREATE INDEX IF NOT EXISTS idx_signals_pair_timestamp
ON signals(pair, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_signals_status
ON signals(status);

-- Trades indexes
CREATE INDEX IF NOT EXISTS idx_trades_user_id
ON trades(user_id);

CREATE INDEX IF NOT EXISTS idx_trades_created_at
ON trades(created_at DESC);

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email
ON users(email);

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Vacuum analyze (maintenance)
VACUUM ANALYZE;
```

**Configure Connection Pooling**:
```javascript
// backend/src/config/database.js

module.exports = {
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    dialect: 'postgres',

    // Connection pool configuration
    pool: {
      max: 20,        // Maximum connections
      min: 5,         // Minimum connections
      acquire: 30000, // Max time to acquire connection (ms)
      idle: 10000     // Max idle time (ms)
    },

    // Logging
    logging: false,   // Disable in production

    // Performance
    dialectOptions: {
      statement_timeout: 10000, // 10 second timeout
      idle_in_transaction_session_timeout: 10000
    }
  }
};
```

---

#### Day 3: SSL & Security Hardening

**Task 2.2.3: SSL Certificate Auto-Renewal**
```bash
# Test renewal
sudo certbot renew --dry-run

# Auto-renewal is configured by default
# Verify timer
sudo systemctl status certbot.timer

# Manual renewal (if needed)
sudo certbot renew
```

**Task 2.2.4: Security Headers in Nginx**
```nginx
# Add to /etc/nginx/sites-available/aifx-frontend

server {
    # ... existing config ...

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';" always;

    # Hide Nginx version
    server_tokens off;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login_limit:10m rate=5r/m;

    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        # ... rest of proxy config ...
    }

    location /api/v1/auth/login {
        limit_req zone=login_limit burst=3 nodelay;
        # ... rest of proxy config ...
    }
}
```

**Task 2.2.5: Firewall Configuration**
```bash
# Install UFW
sudo apt install ufw -y

# Default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (IMPORTANT!)
sudo ufw allow 22/tcp

# Allow HTTP & HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow PostgreSQL only from localhost (default)
# Port 5432 should NOT be exposed externally

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status verbose
```

---

#### Day 4-5: CI/CD Pipeline

**Task 2.2.6: GitHub Actions Workflow**

Create workflow file:
```bash
mkdir -p /root/AIFX_v2/.github/workflows
nano /root/AIFX_v2/.github/workflows/deploy.yml
```

```yaml
name: Deploy AIFX

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  # Backend tests
  test-backend:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: aifx_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json

      - name: Install dependencies
        working-directory: ./backend
        run: npm ci

      - name: Run tests
        working-directory: ./backend
        env:
          DB_HOST: localhost
          DB_PORT: 5432
          DB_NAME: aifx_test
          DB_USER: test
          DB_PASSWORD: test
        run: npm test

  # Frontend build
  build-frontend:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        working-directory: ./frontend
        run: npm ci

      - name: Build
        working-directory: ./frontend
        run: npm run build

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: frontend-dist
          path: frontend/dist

  # Deploy (only on main branch)
  deploy:
    needs: [test-backend, build-frontend]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v3

      - name: Download frontend build
        uses: actions/download-artifact@v3
        with:
          name: frontend-dist
          path: frontend/dist

      - name: Deploy to server
        env:
          SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
          SERVER_HOST: ${{ secrets.SERVER_HOST }}
          SERVER_USER: ${{ secrets.SERVER_USER }}
        run: |
          echo "$SSH_PRIVATE_KEY" > deploy_key
          chmod 600 deploy_key

          # Upload frontend
          scp -i deploy_key -r frontend/dist/* $SERVER_USER@$SERVER_HOST:/root/AIFX_v2/frontend/dist/

          # Restart backend
          ssh -i deploy_key $SERVER_USER@$SERVER_HOST "cd /root/AIFX_v2 && pm2 restart aifx-backend"

          rm deploy_key
```

**Setup GitHub Secrets**:
```bash
# Generate SSH key for deployment
ssh-keygen -t rsa -b 4096 -f ~/.ssh/github_deploy -N ""

# Add public key to authorized_keys
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys

# Copy private key content
cat ~/.ssh/github_deploy
# Add this to GitHub Secrets as SSH_PRIVATE_KEY

# Add other secrets in GitHub repo settings:
# - SSH_PRIVATE_KEY: (content of private key)
# - SERVER_HOST: your-server-ip
# - SERVER_USER: root
```

---

### ✅ Stage 2 Success Criteria

**At end of Week 2, you should have**:
- ✅ PM2 cluster mode for Backend (auto-restart, load balancing)
- ✅ systemd service for ML Engine (auto-start on boot)
- ✅ Automated daily database backups
- ✅ SSL auto-renewal configured
- ✅ Security headers and firewall
- ✅ CI/CD pipeline with automated deployment
- ✅ Production environment fully configured
- ✅ Monitoring and logging in place

**Key Improvements**:
- System uptime: 99.9%+
- Auto-recovery from failures: < 30 seconds
- Deployment time: < 5 minutes
- Zero-downtime deployments
- Automated security updates

---

## 📊 Phase 7C Complete Success Metrics

### Stage 1 Metrics (After 2 Days):
- ✅ Frontend live and accessible
- ✅ All features working
- ✅ HTTPS enabled
- ✅ No critical bugs
- ✅ User feedback collection started

### Stage 2 Metrics (After 2 Weeks):
- ✅ System reliability: 99.9%+ uptime
- ✅ Auto-restart: < 30s recovery time
- ✅ Deployments: < 5 minutes
- ✅ Backups: Daily, tested restore
- ✅ Security: A+ SSL rating, firewall enabled
- ✅ Monitoring: PM2, systemd logs
- ✅ CI/CD: Automated testing + deployment

---

## 🎯 Risk Mitigation

### Potential Issues & Solutions:

**Issue 1: Frontend build fails**
- Solution: Test build locally first
- Rollback: Keep previous dist/ backup

**Issue 2: SSL certificate issues**
- Solution: Use self-signed initially
- Backup: Let's Encrypt supports multiple attempts

**Issue 3: WebSocket connection fails after Nginx**
- Solution: Test WebSocket proxy config
- Debug: Check browser console and Nginx logs

**Issue 4: Backend crashes frequently**
- Solution: PM2 cluster mode provides redundancy
- Debug: Check memory usage, add limits

**Issue 5: Database backup fails**
- Solution: Test backup script before scheduling
- Monitor: Add alerting to backup logs

**Issue 6: Deployment breaks production**
- Solution: Blue-green deployment strategy
- Rollback: Git revert + redeploy previous version

---

## 📋 Pre-Flight Checklist

Before starting Stage 1:
- [ ] Backend API running and tested
- [ ] ML Engine API running and tested
- [ ] PostgreSQL accessible
- [ ] Redis running
- [ ] All API tests passing
- [ ] Git repository up to date
- [ ] Backups of current system

Before starting Stage 2:
- [ ] Frontend MVP deployed successfully
- [ ] No critical bugs reported
- [ ] User feedback collected
- [ ] Backend stable for 48+ hours
- [ ] Database migrations up to date

---

## 🎉 Conclusion

**Phase 7C combines the best of both worlds:**

1. **Speed**: Frontend live in 2 days
   - Immediate user access
   - Fast feedback loop
   - Validates product-market fit

2. **Quality**: Production infrastructure in 2 weeks
   - Reliable, scalable system
   - Automated deployment
   - Enterprise-grade security

**This approach minimizes risk while maximizing value delivery.**

---

**Ready to Execute!** 🚀

**Next Step**: Begin Stage 1, Day 1, Task 1.1 - Start Development Server

---

**Generated**: 2025-11-22 17:45:00
**Strategy**: Hybrid MVP + Production
**Total Value**: Immediate impact + Long-term stability
**Status**: ✅ Ready to Execute
