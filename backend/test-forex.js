/**
 * Forex Data Collection Test Script
 * Tests the forex service, caching, and API endpoints
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/v1';

// Test configuration
const TEST_PAIRS = ['EUR/USD', 'GBP/USD', 'USD/JPY'];
const TEST_TIMEFRAMES = ['1min', '5min', '1h', '1d'];

let testResults = {
  passed: 0,
  failed: 0,
  tests: [],
};

/**
 * Log test result
 */
const logTest = (name, success, details = null, error = null) => {
  const result = {
    name,
    success,
    details,
    error: error ? error.message : null,
    timestamp: new Date().toISOString(),
  };

  testResults.tests.push(result);

  if (success) {
    testResults.passed++;
    console.log(`✅ ${name}`);
    if (details) console.log(`   📋 ${details}`);
  } else {
    testResults.failed++;
    console.log(`❌ ${name}`);
    if (error) console.log(`   🚨 ${error.message}`);
    if (details) console.log(`   📋 ${details}`);
  }
};

/**
 * Test server health check
 */
const testHealthCheck = async () => {
  try {
    const response = await axios.get(`${BASE_URL.replace('/api/v1', '')}/api/v1/health`);

    if (response.data.success) {
      logTest('Health Check', true, `Server is healthy, version: ${response.data.data.version}`);
      return true;
    } else {
      logTest('Health Check', false, 'Server health check failed');
      return false;
    }
  } catch (error) {
    logTest('Health Check', false, null, error);
    return false;
  }
};

/**
 * Test market status endpoint
 */
const testMarketStatus = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/market/status`);

    if (response.data.success) {
      const data = response.data.data;
      logTest('Market Status', true,
        `APIs: ${Object.keys(data.apis.providers).length}, ` +
        `Cache: ${data.cache.connected ? 'Connected' : 'Disconnected'}, ` +
        `Supported pairs: ${data.market.supportedPairs}`
      );
      return data;
    } else {
      logTest('Market Status', false, 'Failed to get market status');
      return null;
    }
  } catch (error) {
    logTest('Market Status', false, null, error);
    return null;
  }
};

/**
 * Test supported pairs endpoint
 */
const testSupportedPairs = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/market/pairs`);

    if (response.data.success) {
      const data = response.data.data;
      logTest('Supported Pairs', true,
        `Total: ${data.total}, Major: ${data.categories.major.count}, Minor: ${data.categories.minor.count}`
      );
      return data.pairs;
    } else {
      logTest('Supported Pairs', false, 'Failed to get supported pairs');
      return [];
    }
  } catch (error) {
    logTest('Supported Pairs', false, null, error);
    return [];
  }
};

/**
 * Test supported pairs with filters
 */
const testSupportedPairsFiltered = async () => {
  try {
    // Test category filter
    const majorResponse = await axios.get(`${BASE_URL}/market/pairs?category=major`);
    const minorResponse = await axios.get(`${BASE_URL}/market/pairs?category=minor`);
    const searchResponse = await axios.get(`${BASE_URL}/market/pairs?search=EUR`);

    const allSuccessful = majorResponse.data.success &&
                          minorResponse.data.success &&
                          searchResponse.data.success;

    if (allSuccessful) {
      logTest('Supported Pairs Filtering', true,
        `Major: ${majorResponse.data.data.total}, ` +
        `Minor: ${minorResponse.data.data.total}, ` +
        `EUR search: ${searchResponse.data.data.total}`
      );
    } else {
      logTest('Supported Pairs Filtering', false, 'Filter tests failed');
    }
  } catch (error) {
    logTest('Supported Pairs Filtering', false, null, error);
  }
};

/**
 * Test real-time rate endpoint
 */
const testRealTimeRates = async () => {
  for (const pair of TEST_PAIRS) {
    try {
      const startTime = Date.now();
      const response = await axios.get(`${BASE_URL}/market/realtime/${pair}`);
      const duration = Date.now() - startTime;

      if (response.data.success) {
        const data = response.data.data;
        logTest(`Real-time Rate: ${pair}`, true,
          `Provider: ${data.provider}, Cached: ${data.cached}, Duration: ${duration}ms`
        );

        // Test cache effectiveness by making another request
        const startTime2 = Date.now();
        const response2 = await axios.get(`${BASE_URL}/market/realtime/${pair}`);
        const duration2 = Date.now() - startTime2;

        if (response2.data.success && response2.data.data.cached) {
          logTest(`Cache Test: ${pair}`, true,
            `Second request cached, Duration: ${duration2}ms (${duration2 < duration ? 'faster' : 'slower'})`
          );
        } else {
          logTest(`Cache Test: ${pair}`, false, 'Second request was not cached');
        }
      } else {
        logTest(`Real-time Rate: ${pair}`, false, 'Failed to get real-time rate');
      }
    } catch (error) {
      logTest(`Real-time Rate: ${pair}`, false, null, error);
    }

    // Small delay to avoid overwhelming the APIs
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
};

/**
 * Test historical data endpoint
 */
const testHistoricalData = async () => {
  for (const pair of TEST_PAIRS.slice(0, 2)) { // Test fewer pairs for historical data
    for (const timeframe of TEST_TIMEFRAMES.slice(0, 2)) { // Test fewer timeframes
      try {
        const startTime = Date.now();
        const response = await axios.get(`${BASE_URL}/market/history/${pair}?timeframe=${timeframe}&limit=10`);
        const duration = Date.now() - startTime;

        if (response.data.success) {
          const data = response.data.data;
          const dataPoints = data.data ? (Array.isArray(data.data) ? data.data.length : 1) : 0;

          logTest(`Historical Data: ${pair} ${timeframe}`, true,
            `Provider: ${data.provider}, Points: ${dataPoints}, Cached: ${data.cached}, Duration: ${duration}ms`
          );
        } else {
          logTest(`Historical Data: ${pair} ${timeframe}`, false, 'Failed to get historical data');
        }
      } catch (error) {
        logTest(`Historical Data: ${pair} ${timeframe}`, false, null, error);
      }

      // Delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
};

/**
 * Test analytics endpoint
 */
const testAnalytics = async () => {
  for (const pair of TEST_PAIRS.slice(0, 1)) { // Test one pair
    try {
      const response = await axios.get(`${BASE_URL}/market/analytics/${pair}`);

      if (response.data.success) {
        const data = response.data.data;
        if (data.analytics) {
          logTest(`Analytics: ${pair}`, true,
            `Change: ${data.analytics.changePercent}%, Volatility: ${data.analytics.volatility}%`
          );
        } else {
          logTest(`Analytics: ${pair}`, true, 'No analytics data available');
        }
      } else {
        logTest(`Analytics: ${pair}`, false, 'Failed to get analytics');
      }
    } catch (error) {
      logTest(`Analytics: ${pair}`, false, null, error);
    }
  }
};

/**
 * Test error handling
 */
const testErrorHandling = async () => {
  try {
    // Test invalid currency pair
    const response = await axios.get(`${BASE_URL}/market/realtime/INVALID`);
    logTest('Error Handling: Invalid Pair', false, 'Should have returned an error');
  } catch (error) {
    if (error.response && error.response.status === 400) {
      logTest('Error Handling: Invalid Pair', true, 'Correctly rejected invalid pair');
    } else {
      logTest('Error Handling: Invalid Pair', false, 'Unexpected error response', error);
    }
  }

  try {
    // Test invalid timeframe
    const response = await axios.get(`${BASE_URL}/market/history/EUR/USD?timeframe=invalid`);
    logTest('Error Handling: Invalid Timeframe', false, 'Should have returned an error');
  } catch (error) {
    if (error.response && error.response.status === 400) {
      logTest('Error Handling: Invalid Timeframe', true, 'Correctly rejected invalid timeframe');
    } else {
      logTest('Error Handling: Invalid Timeframe', false, 'Unexpected error response', error);
    }
  }
};

/**
 * Test rate limiting
 */
const testRateLimiting = async () => {
  try {
    console.log('\n🔄 Testing rate limiting (this may take a moment)...');

    const requests = [];
    // Make 35 requests rapidly (limit is 30 per minute)
    for (let i = 0; i < 35; i++) {
      requests.push(axios.get(`${BASE_URL}/market/pairs`));
    }

    const results = await Promise.allSettled(requests);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.status === 200).length;
    const rateLimited = results.filter(r =>
      r.status === 'rejected' && r.reason.response?.status === 429
    ).length;

    if (rateLimited > 0) {
      logTest('Rate Limiting', true, `${successful} successful, ${rateLimited} rate limited`);
    } else {
      logTest('Rate Limiting', false, `No rate limiting observed (${successful} successful)`);
    }
  } catch (error) {
    logTest('Rate Limiting', false, null, error);
  }
};

/**
 * Test with authentication
 */
const testWithAuthentication = async () => {
  try {
    // First login to get a token
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      identifier: 'demo@aifx.com',
      password: 'Demo123!@#',
    });

    if (!loginResponse.data.success) {
      logTest('Authentication Setup', false, 'Failed to login with demo user');
      return;
    }

    const token = loginResponse.data.data.accessToken;

    // Test authenticated request
    const response = await axios.get(`${BASE_URL}/market/realtime/EUR/USD`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.data.success && response.data.data.userContext) {
      logTest('Authenticated Request', true,
        `User context included, Preferred: ${response.data.data.userContext.isPreferred}`
      );
    } else {
      logTest('Authenticated Request', false, 'User context not included');
    }
  } catch (error) {
    logTest('Authenticated Request', false, null, error);
  }
};

/**
 * Run all tests
 */
const runAllTests = async () => {
  console.log('🚀 Starting Forex Data Collection Tests');
  console.log('=' .repeat(60));

  // Basic connectivity tests
  const healthOk = await testHealthCheck();
  if (!healthOk) {
    console.log('\n❌ Server health check failed. Cannot continue with tests.');
    return;
  }

  const marketStatus = await testMarketStatus();

  // Test endpoints
  console.log('\n📋 Testing Market Data Endpoints...');
  await testSupportedPairs();
  await testSupportedPairsFiltered();

  console.log('\n💱 Testing Real-time Rates...');
  await testRealTimeRates();

  console.log('\n📊 Testing Historical Data...');
  await testHistoricalData();

  console.log('\n📈 Testing Analytics...');
  await testAnalytics();

  console.log('\n🚫 Testing Error Handling...');
  await testErrorHandling();

  console.log('\n⏱️ Testing Rate Limiting...');
  await testRateLimiting();

  console.log('\n🔐 Testing with Authentication...');
  await testWithAuthentication();

  // Print summary
  console.log('\n🎉 Test Summary');
  console.log('=' .repeat(60));
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📊 Total: ${testResults.tests.length}`);
  console.log(`🎯 Success Rate: ${(testResults.passed / testResults.tests.length * 100).toFixed(1)}%`);

  if (marketStatus) {
    console.log('\n📊 System Status:');
    console.log(`   💾 Cache: ${marketStatus.cache.connected ? 'Connected' : 'Disconnected'}`);
    console.log(`   🔑 APIs: ${Object.keys(marketStatus.apis.providers).length} providers`);
    console.log(`   💱 Pairs: ${marketStatus.market.supportedPairs} supported`);
  }

  // Show failed tests
  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.tests
      .filter(test => !test.success)
      .forEach(test => {
        console.log(`   - ${test.name}: ${test.error || 'Unknown error'}`);
      });
  }

  console.log('\n' + '=' .repeat(60));
};

/**
 * Check if server is running
 */
const checkServer = async () => {
  try {
    await axios.get(`${BASE_URL.replace('/api/v1', '')}/api/v1/health`);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Main execution
 */
const main = async () => {
  console.log('🔍 Checking if server is running...');

  const serverRunning = await checkServer();

  if (!serverRunning) {
    console.error('❌ Server is not running on http://localhost:3000');
    console.log('💡 Please start the server first with: npm run dev');
    console.log('💡 Make sure Redis is running and APIs are configured');
    console.log('💡 Required environment variables:');
    console.log('   - ALPHA_VANTAGE_KEY=your_api_key');
    console.log('   - TWELVE_DATA_KEY=your_api_key');
    console.log('   - REDIS_URL=redis://localhost:6379');
    process.exit(1);
  }

  console.log('✅ Server is running!');

  if (process.argv.includes('--quick')) {
    console.log('⚡ Running quick tests only...');
    await testHealthCheck();
    await testMarketStatus();
    await testSupportedPairs();
    await testRealTimeRates();
  } else {
    await runAllTests();
  }
};

// Handle command line arguments
if (process.argv[2] === 'status') {
  testMarketStatus().then(() => process.exit(0));
} else {
  main().catch(error => {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  });
}