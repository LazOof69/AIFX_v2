# Database Setup Guide

## Prerequisites

1. **PostgreSQL** must be installed and running
2. **Redis** must be installed and running

## Installation

### PostgreSQL (Windows)

1. Download from: https://www.postgresql.org/download/windows/
2. Install with default settings
3. Remember your postgres user password

### PostgreSQL (WSL/Linux)

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo service postgresql start
```

### Redis (Windows)

1. Download from: https://github.com/microsoftarchive/redis/releases
2. Or use WSL

### Redis (WSL/Linux)

```bash
sudo apt install redis-server
sudo service redis-server start
```

## Database Creation

### Option 1: Using psql

```bash
# Access PostgreSQL
sudo -u postgres psql

# Create database
CREATE DATABASE aifx_v2_dev;

# Create user (optional)
CREATE USER aifx_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE aifx_v2_dev TO aifx_user;

# Exit
\q
```

### Option 2: Using pgAdmin

1. Open pgAdmin
2. Right-click on "Databases"
3. Create → Database
4. Name: `aifx_v2_dev`
5. Click "Save"

## Environment Configuration

1. Copy `.env.example` to `.env`
2. Update `DATABASE_URL` with your credentials:

```
DATABASE_URL=postgresql://username:password@localhost:5432/aifx_v2_dev
```

Example:
```
DATABASE_URL=postgresql://postgres:mypassword@localhost:5432/aifx_v2_dev
```

## Run Migrations

Once database is created and configured:

```bash
# Run all migrations
npm run migrate

# Check migration status
npm run migrate:status

# Rollback last migration
npm run migrate:undo

# Rollback all migrations
npm run migrate:undo:all
```

## Seed Database

Add demo data for testing:

```bash
# Seed all data
npm run seed

# Undo all seeds
npm run seed:undo:all
```

## Complete Setup

Run migrations and seeds together:

```bash
npm run db:setup
```

## Reset Database

Drop all tables and recreate with fresh data:

```bash
npm run db:reset
```

## Troubleshooting

### Connection Refused Error

If you see `ECONNREFUSED 127.0.0.1:5432`:

1. Check if PostgreSQL is running:
   ```bash
   # WSL/Linux
   sudo service postgresql status
   sudo service postgresql start

   # Windows
   # Check Services → PostgreSQL Server
   ```

2. Verify connection settings in `.env`

### Authentication Failed

If you see authentication errors:

1. Check your PostgreSQL password
2. Update `DATABASE_URL` in `.env`
3. For PostgreSQL on WSL, you may need to:
   ```bash
   sudo -u postgres psql
   ALTER USER postgres PASSWORD 'new_password';
   ```

### Database Does Not Exist

```bash
# Create it using psql
sudo -u postgres psql -c "CREATE DATABASE aifx_v2_dev;"
```

## Verify Setup

After setup, verify tables exist:

```bash
sudo -u postgres psql aifx_v2_dev -c "\dt"
```

You should see:
- users
- user_preferences
- trading_signals
- notifications
- user_trading_history
- SequelizeMeta (migration tracking)

## Demo Users

After seeding, you can login with:

1. **john_trader**
   - Email: john@example.com
   - Password: password123

2. **sarah_fx**
   - Email: sarah@example.com
   - Password: trader2023

3. **demo_user**
   - Email: demo@example.com
   - Password: demo1234