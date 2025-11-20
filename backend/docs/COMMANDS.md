# AIFX Backend Commands Reference

## Database Commands

### Migrations

```bash
# Run all pending migrations
npm run migrate

# Check migration status
npm run migrate:status

# Rollback last migration
npm run migrate:undo

# Rollback all migrations
npm run migrate:undo:all
```

### Seeds

```bash
# Run all seeders
npm run seed

# Undo last seeder
npm run seed:undo

# Undo all seeders
npm run seed:undo:all
```

### Combined Operations

```bash
# Setup: Run migrations + seeds
npm run db:setup

# Reset: Rollback all + Migrate + Seed
npm run db:reset
```

## Server Commands

```bash
# Start production server
npm start

# Start development server with auto-reload
npm run dev
```

## Testing Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Test authentication
npm run test:auth

# Test forex API
npm run test:forex

# Quick forex test
npm run test:forex:quick

# Run all custom tests
npm run test:all
```

## Code Quality

```bash
# Run ESLint
npm run lint

# Auto-fix ESLint issues
npm run lint:fix
```

## Database Tables Created

After running migrations, you'll have:

1. **users** - User accounts
2. **user_preferences** - Trading preferences per user
3. **trading_signals** - Generated trading signals
4. **notifications** - User notifications
5. **user_trading_history** - User's trading history
6. **SequelizeMeta** - Migration tracking (automatic)

## Demo Data (After Seeding)

### Users
- john@example.com / password123
- sarah@example.com / trader2023
- demo@example.com / demo1234

### Trading Signals
- 20 demo signals across different pairs

### Notifications
- 5 notifications per user

## Quick Start

```bash
# 1. Setup environment
cp .env.example .env
# Edit .env with your database credentials

# 2. Create database
sudo -u postgres psql -c "CREATE DATABASE aifx_v2_dev;"

# 3. Run setup
npm run db:setup

# 4. Start server
npm run dev
```

## Troubleshooting

### Reset Everything
```bash
npm run db:reset
```

### Check Database
```bash
npm run migrate:status
```

### View Tables
```bash
sudo -u postgres psql aifx_v2_dev -c "\dt"
```

### View Users
```bash
sudo -u postgres psql aifx_v2_dev -c "SELECT id, username, email FROM users;"
```