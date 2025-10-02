# Testing Guide

## Overview

This project uses Jest for unit and integration testing with a coverage threshold of 70%.

## Test Structure

```
tests/
├── unit/                      # Unit tests
│   ├── auth.test.js          # Authentication tests (24 tests)
│   ├── forexService.test.js  # Forex service tests (38 tests)
│   └── tradingSignals.test.js # Trading signal tests (37 tests)
├── integration/               # Integration tests
│   └── api.test.js           # API endpoint tests
└── setup.js                  # Jest setup configuration
```

## Running Tests

### All Tests
```bash
npm test
```

### With Coverage Report
```bash
npm run test:coverage
```

### Watch Mode (for development)
```bash
npm run test:watch
```

### Specific Test File
```bash
npm test -- auth.test.js
```

### Run Single Test
```bash
npm test -- -t "should hash password correctly"
```

## Test Categories

### 1. Authentication Tests (`auth.test.js`)

**Password Hashing (3 tests)**
- Hash password correctly
- Verify correct password
- Reject incorrect password

**JWT Token Generation (5 tests)**
- Generate valid JWT token
- Verify valid JWT token
- Reject invalid JWT token
- Reject expired JWT token
- Reject token with wrong secret

**Email Validation (2 tests)**
- Validate correct email format
- Reject invalid email format

**Password Strength (2 tests)**
- Accept strong password
- Reject weak password

**Token Payload (2 tests)**
- Create token with user information
- Not include sensitive information

**Token Expiration (2 tests)**
- Create access token with 1 hour expiration
- Create refresh token with 7 days expiration

### 2. Forex Service Tests (`forexService.test.js`)

**Currency Pair Validation (2 tests)**
- Validate correct currency pair format
- Reject invalid currency pair format

**Price Data Validation (3 tests)**
- Validate price data structure
- Calculate spread correctly
- Validate historical data format

**Timeframe Validation (3 tests)**
- Validate correct timeframe values
- Reject invalid timeframe values
- Convert timeframe to minutes

**Rate Limiting (2 tests)**
- Track API request count
- Reset counter after time window

**Data Caching (3 tests)**
- Cache forex data
- Invalidate expired cache
- Return valid cached data

**Price Change Calculation (3 tests)**
- Calculate price change percentage
- Handle negative price change
- Calculate pips difference

**Error Handling (3 tests)**
- Handle API timeout
- Handle invalid API response
- Retry failed requests

**Data Transformation (1 test)**
- Transform API response to standard format

### 3. Trading Signal Tests (`tradingSignals.test.js`)

**Signal Structure Validation (5 tests)**
- Create valid signal structure
- Validate stop loss placement for buy signal
- Validate stop loss placement for sell signal
- Validate take profit placement for buy signal
- Validate take profit placement for sell signal

**Risk/Reward Ratio (4 tests)**
- Calculate risk/reward for buy signal
- Calculate risk/reward for sell signal
- Accept good risk/reward ratio
- Reject poor risk/reward ratio

**Confidence Score (3 tests)**
- Normalize confidence score
- Filter low confidence signals
- Weight multiple factors

**Technical Indicators (4 tests)**
- Calculate SMA crossover
- Identify RSI overbought condition
- Identify RSI oversold condition
- Validate MACD signal

**Signal Action Determination (3 tests)**
- Generate buy signal on bullish indicators
- Generate sell signal on bearish indicators
- Generate hold signal on mixed indicators

**Signal Filtering (3 tests)**
- Filter by user risk level
- Filter by preferred pairs
- Filter by trading style

**Signal Expiration (2 tests)**
- Mark signal as expired after timeframe
- Keep signal active within timeframe

**Stop Loss Calculation (2 tests)**
- Calculate stop loss using ATR
- Respect maximum stop loss distance

## Coverage Requirements

The project enforces the following coverage thresholds:

- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

### Viewing Coverage Report

After running `npm run test:coverage`, open:
```
coverage/lcov-report/index.html
```

## Test Configuration

### Jest Config (`jest.config.js`)

```javascript
module.exports = {
  testEnvironment: 'node',
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
```

### Test Setup (`tests/setup.js`)

- Sets environment to 'test'
- Configures test database
- Mocks console methods
- Sets 10s timeout

## Writing New Tests

### Test Template

```javascript
describe('Feature Name', () => {
  describe('Sub-feature', () => {
    test('should do something', () => {
      // Arrange
      const input = 'test';

      // Act
      const result = functionToTest(input);

      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

### Best Practices

1. **Clear Test Names**: Use descriptive names that explain what is being tested
2. **AAA Pattern**: Arrange, Act, Assert
3. **One Assertion**: Focus on one thing per test
4. **Mock External Dependencies**: Don't make real API calls
5. **Test Edge Cases**: Include boundary conditions
6. **Clean Up**: Remove test data after tests

### Example Test

```javascript
describe('Password Validation', () => {
  test('should reject password shorter than 8 characters', () => {
    const shortPassword = 'Short1';
    const isValid = validatePassword(shortPassword);
    expect(isValid).toBe(false);
  });
});
```

## Continuous Integration

Tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`

GitHub Actions workflow:
- Runs all tests
- Generates coverage report
- Fails if coverage < 70%
- Uploads coverage to Codecov

## Troubleshooting

### Tests Timing Out

If tests timeout, increase timeout in `jest.config.js`:
```javascript
testTimeout: 30000 // 30 seconds
```

### Database Connection Issues

Ensure PostgreSQL test database exists:
```bash
sudo -u postgres psql -c "CREATE DATABASE aifx_v2_test;"
```

### Redis Connection Issues

Start Redis:
```bash
sudo service redis-server start
```

### Module Not Found

Reinstall dependencies:
```bash
rm -rf node_modules package-lock.json
npm install
```

## Mock Data

Test files include realistic mock data:
- Currency pairs: EUR/USD, GBP/USD, USD/JPY
- Price ranges: 1.0800 - 1.0900
- Timeframes: 1min, 5min, 15min, 1hour, 4hour, daily
- Confidence scores: 0.60 - 0.95

## Performance

Current test suite:
- **Total Tests**: ~99 tests
- **Execution Time**: ~5-10 seconds
- **Coverage**: >70% (target met)

## Next Steps

To add more tests:
1. Create test file in `tests/unit/` or `tests/integration/`
2. Follow naming convention: `*.test.js`
3. Import necessary dependencies
4. Write descriptive test cases
5. Run tests to verify
6. Check coverage report

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Testing Best Practices](https://testingjavascript.com/)
- [Jest Matchers](https://jestjs.io/docs/expect)