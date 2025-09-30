/**
 * Authentication System Test Script
 * Demonstrates how to use the authentication endpoints
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/v1/auth';

// Test data
const testUser = {
  email: 'test@example.com',
  username: 'testuser',
  password: 'TestPass123!@#',
  confirmPassword: 'TestPass123!@#',
  firstName: 'Test',
  lastName: 'User',
};

let accessToken = '';
let refreshToken = '';

/**
 * Test user registration
 */
const testRegistration = async () => {
  try {
    console.log('🔄 Testing user registration...');

    const response = await axios.post(`${BASE_URL}/register`, testUser);

    if (response.data.success) {
      console.log('✅ Registration successful!');
      console.log('📋 User data:', response.data.data.user);

      accessToken = response.data.data.accessToken;
      refreshToken = response.data.data.refreshToken;

      console.log('🎫 Access token received (first 20 chars):', accessToken.substring(0, 20) + '...');
      console.log('🔄 Refresh token received (first 20 chars):', refreshToken.substring(0, 20) + '...');
    } else {
      console.error('❌ Registration failed:', response.data.error);
    }
  } catch (error) {
    if (error.response) {
      console.error('❌ Registration failed:', error.response.data.error);
    } else {
      console.error('❌ Registration error:', error.message);
    }
  }
};

/**
 * Test user login
 */
const testLogin = async () => {
  try {
    console.log('\n🔄 Testing user login...');

    const response = await axios.post(`${BASE_URL}/login`, {
      identifier: testUser.email,
      password: testUser.password,
    });

    if (response.data.success) {
      console.log('✅ Login successful!');
      console.log('📋 User data:', response.data.data.user);

      accessToken = response.data.data.accessToken;
      refreshToken = response.data.data.refreshToken;

      console.log('🎫 New access token received (first 20 chars):', accessToken.substring(0, 20) + '...');
    } else {
      console.error('❌ Login failed:', response.data.error);
    }
  } catch (error) {
    if (error.response) {
      console.error('❌ Login failed:', error.response.data.error);
    } else {
      console.error('❌ Login error:', error.message);
    }
  }
};

/**
 * Test protected route (get profile)
 */
const testProtectedRoute = async () => {
  try {
    console.log('\n🔄 Testing protected route (get profile)...');

    const response = await axios.get(`${BASE_URL}/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.data.success) {
      console.log('✅ Protected route access successful!');
      console.log('📋 Profile data:', response.data.data.user);
    } else {
      console.error('❌ Protected route failed:', response.data.error);
    }
  } catch (error) {
    if (error.response) {
      console.error('❌ Protected route failed:', error.response.data.error);
    } else {
      console.error('❌ Protected route error:', error.message);
    }
  }
};

/**
 * Test token refresh
 */
const testTokenRefresh = async () => {
  try {
    console.log('\n🔄 Testing token refresh...');

    const response = await axios.post(`${BASE_URL}/refresh`, {
      refreshToken: refreshToken,
    });

    if (response.data.success) {
      console.log('✅ Token refresh successful!');

      accessToken = response.data.data.accessToken;
      refreshToken = response.data.data.refreshToken;

      console.log('🎫 New access token received (first 20 chars):', accessToken.substring(0, 20) + '...');
      console.log('🔄 New refresh token received (first 20 chars):', refreshToken.substring(0, 20) + '...');
    } else {
      console.error('❌ Token refresh failed:', response.data.error);
    }
  } catch (error) {
    if (error.response) {
      console.error('❌ Token refresh failed:', error.response.data.error);
    } else {
      console.error('❌ Token refresh error:', error.message);
    }
  }
};

/**
 * Test profile update
 */
const testProfileUpdate = async () => {
  try {
    console.log('\n🔄 Testing profile update...');

    const response = await axios.put(`${BASE_URL}/profile`, {
      firstName: 'Updated',
      lastName: 'Name',
      timezone: 'America/New_York',
    }, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.data.success) {
      console.log('✅ Profile update successful!');
      console.log('📋 Updated profile:', response.data.data.user);
    } else {
      console.error('❌ Profile update failed:', response.data.error);
    }
  } catch (error) {
    if (error.response) {
      console.error('❌ Profile update failed:', error.response.data.error);
    } else {
      console.error('❌ Profile update error:', error.message);
    }
  }
};

/**
 * Test logout
 */
const testLogout = async () => {
  try {
    console.log('\n🔄 Testing logout...');

    const response = await axios.post(`${BASE_URL}/logout`, {}, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.data.success) {
      console.log('✅ Logout successful!');
      console.log('📋 Message:', response.data.data.message);
    } else {
      console.error('❌ Logout failed:', response.data.error);
    }
  } catch (error) {
    if (error.response) {
      console.error('❌ Logout failed:', error.response.data.error);
    } else {
      console.error('❌ Logout error:', error.message);
    }
  }
};

/**
 * Test using invalidated token (should fail)
 */
const testInvalidatedToken = async () => {
  try {
    console.log('\n🔄 Testing invalidated token (should fail)...');

    const response = await axios.get(`${BASE_URL}/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.data.success) {
      console.error('❌ This should have failed! Token should be invalidated.');
    } else {
      console.log('✅ Correctly rejected invalidated token:', response.data.error);
    }
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log('✅ Correctly rejected invalidated token:', error.response.data.error);
    } else {
      console.error('❌ Unexpected error:', error.message);
    }
  }
};

/**
 * Test health check endpoint
 */
const testHealthCheck = async () => {
  try {
    console.log('\n🔄 Testing health check...');

    const response = await axios.get('http://localhost:3000/api/v1/health');

    if (response.data.success) {
      console.log('✅ Health check successful!');
      console.log('📋 Server status:', response.data.data);
    } else {
      console.error('❌ Health check failed:', response.data.error);
    }
  } catch (error) {
    console.error('❌ Health check error:', error.message);
  }
};

/**
 * Run all tests
 */
const runAllTests = async () => {
  console.log('🚀 Starting Authentication System Tests');
  console.log('=' .repeat(50));

  // Test server health first
  await testHealthCheck();

  // Test authentication flow
  await testRegistration();
  await testLogin();
  await testProtectedRoute();
  await testTokenRefresh();
  await testProtectedRoute(); // Test with refreshed token
  await testProfileUpdate();
  await testLogout();
  await testInvalidatedToken();

  console.log('\n🎉 Authentication tests completed!');
  console.log('=' .repeat(50));
};

// Check if server is running
const checkServer = async () => {
  try {
    await axios.get('http://localhost:3000/api/v1/health');
    return true;
  } catch (error) {
    return false;
  }
};

// Main execution
const main = async () => {
  console.log('🔍 Checking if server is running...');

  const serverRunning = await checkServer();

  if (!serverRunning) {
    console.error('❌ Server is not running on http://localhost:3000');
    console.log('💡 Please start the server first with: npm run dev');
    console.log('💡 And make sure the database is set up with: npm run db:setup');
    process.exit(1);
  }

  console.log('✅ Server is running!');
  await runAllTests();
};

// Handle command line arguments
if (process.argv[2] === 'cleanup') {
  // Add cleanup functionality if needed
  console.log('🧹 Cleanup mode - implement if needed');
} else {
  main().catch(error => {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  });
}