# AIFX_v2 Authentication System

Complete JWT-based authentication system with user registration, login, token refresh, and secure password handling.

## Features

- ✅ **User Registration** with input validation
- ✅ **Secure Login** with email/username support
- ✅ **JWT Access Tokens** (1 hour expiry)
- ✅ **Refresh Tokens** (30 days expiry)
- ✅ **Password Encryption** (bcrypt with 12 rounds)
- ✅ **Rate Limiting** for security
- ✅ **Profile Management**
- ✅ **Session Management** (logout, logout all devices)
- ✅ **Password Change** functionality
- ✅ **Account Verification** system
- ✅ **Unified Error Handling**

## API Endpoints

### Public Endpoints

#### POST `/api/v1/auth/register`
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "username": "username",
  "password": "SecurePass123!@#",
  "confirmPassword": "SecurePass123!@#",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "username": "username",
      "firstName": "John",
      "lastName": "Doe",
      "isActive": true,
      "isVerified": false,
      "tradingFrequency": "daytrading",
      "riskLevel": 5,
      "preferredPairs": ["EUR/USD", "GBP/USD", "USD/JPY"],
      "tradingStyle": "mixed",
      "indicators": {...},
      "notificationSettings": {...},
      "timezone": "UTC",
      "language": "en",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token",
    "message": "User registered successfully"
  },
  "error": null,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### POST `/api/v1/auth/login`
Authenticate user and receive tokens.

**Request Body:**
```json
{
  "identifier": "user@example.com", // email or username
  "password": "SecurePass123!@#"
}
```

**Response:** Same as registration response.

#### POST `/api/v1/auth/refresh`
Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "jwt_refresh_token"
}
```

**Response:** Returns new access and refresh tokens.

#### POST `/api/v1/auth/forgot-password`
Initiate password reset process.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Password reset instructions sent to email",
    "resetToken": "reset_token", // Remove in production
    "userId": "user_id" // Remove in production
  },
  "error": null,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### POST `/api/v1/auth/reset-password`
Complete password reset with token.

**Request Body:**
```json
{
  "resetToken": "reset_token",
  "newPassword": "NewSecurePass123!@#",
  "userId": "user_id"
}
```

### Protected Endpoints

All protected endpoints require `Authorization: Bearer <access_token>` header.

#### GET `/api/v1/auth/me`
Get current user profile.

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      // User profile data
    }
  },
  "error": null,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### PUT `/api/v1/auth/profile`
Update user profile.

**Request Body:**
```json
{
  "firstName": "UpdatedName",
  "lastName": "UpdatedLastName",
  "timezone": "America/New_York",
  "language": "en"
}
```

#### POST `/api/v1/auth/logout`
Logout from current device.

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Logout successful"
  },
  "error": null,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### POST `/api/v1/auth/logout-all`
Logout from all devices.

#### POST `/api/v1/auth/change-password`
Change user password.

**Request Body:**
```json
{
  "currentPassword": "CurrentPass123!@#",
  "newPassword": "NewSecurePass123!@#",
  "confirmPassword": "NewSecurePass123!@#"
}
```

#### POST `/api/v1/auth/verify`
Verify user account (email verification).

#### DELETE `/api/v1/auth/deactivate`
Deactivate user account.

#### GET `/api/v1/auth/validate`
Validate current session.

## Password Requirements

- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character (@$!%*?&)

## Rate Limiting

- **Registration/Login**: 5 attempts per 15 minutes
- **Token Refresh**: 10 attempts per 15 minutes
- **Password Change**: 3 attempts per 15 minutes
- **Password Reset**: 3 attempts per hour

## Error Codes

| Code | Description |
|------|-------------|
| `EMAIL_EXISTS` | Email already registered |
| `USERNAME_EXISTS` | Username already taken |
| `INVALID_CREDENTIALS` | Invalid email/username or password |
| `ACCOUNT_DEACTIVATED` | User account is deactivated |
| `ACCOUNT_NOT_VERIFIED` | User account not verified |
| `TOKEN_EXPIRED` | Access token has expired |
| `INVALID_TOKEN` | Invalid or malformed token |
| `REFRESH_TOKEN_REQUIRED` | Refresh token missing |
| `INVALID_REFRESH_TOKEN` | Invalid refresh token |
| `USER_NOT_FOUND` | User does not exist |
| `VALIDATION_ERROR` | Input validation failed |
| `AUTH_RATE_LIMIT` | Too many authentication attempts |

## Usage Examples

### Frontend Integration

```javascript
// Registration
const register = async (userData) => {
  try {
    const response = await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    const data = await response.json();

    if (data.success) {
      localStorage.setItem('accessToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
      return data.data.user;
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('Registration failed:', error.message);
    throw error;
  }
};

// Making authenticated requests
const makeAuthenticatedRequest = async (url, options = {}) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 401) {
    // Token expired, try to refresh
    const refreshed = await refreshToken();
    if (refreshed) {
      // Retry request with new token
      return makeAuthenticatedRequest(url, options);
    } else {
      // Redirect to login
      window.location.href = '/login';
    }
  }

  return response.json();
};

// Token refresh
const refreshToken = async () => {
  try {
    const refreshToken = localStorage.getItem('refreshToken');

    const response = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await response.json();

    if (data.success) {
      localStorage.setItem('accessToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
      return true;
    } else {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      return false;
    }
  } catch (error) {
    console.error('Token refresh failed:', error.message);
    return false;
  }
};
```

### Node.js Client

```javascript
const axios = require('axios');

class APIClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
    this.accessToken = null;
    this.refreshToken = null;
  }

  async login(identifier, password) {
    try {
      const response = await axios.post(`${this.baseURL}/auth/login`, {
        identifier,
        password,
      });

      if (response.data.success) {
        this.accessToken = response.data.data.accessToken;
        this.refreshToken = response.data.data.refreshToken;
        return response.data.data.user;
      }
    } catch (error) {
      throw new Error(error.response?.data?.error || error.message);
    }
  }

  async makeRequest(method, endpoint, data = null) {
    try {
      const config = {
        method,
        url: `${this.baseURL}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        // Try to refresh token
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          // Retry request
          return this.makeRequest(method, endpoint, data);
        }
      }
      throw error;
    }
  }

  async refreshAccessToken() {
    try {
      const response = await axios.post(`${this.baseURL}/auth/refresh`, {
        refreshToken: this.refreshToken,
      });

      if (response.data.success) {
        this.accessToken = response.data.data.accessToken;
        this.refreshToken = response.data.data.refreshToken;
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }
}
```

## Testing

Run the authentication test suite:

```bash
# Start the server
npm run dev

# In another terminal, run tests
node test-auth.js
```

## Database Setup

Run migrations and seeders:

```bash
# Run migrations
npm run db:migrate

# Run seeders (creates demo users)
npm run db:seed

# Or run both at once
npm run db:setup
```

Demo users created by seeder:
- `admin@aifx.com` / `admin` - Password: `Admin123!@#`
- `demo@aifx.com` / `demo` - Password: `Demo123!@#`
- `trader@aifx.com` / `trader` - Password: `Trader123!@#`

## Security Features

1. **Password Hashing**: bcrypt with 12 salt rounds
2. **JWT Security**: Short-lived access tokens (1 hour)
3. **Rate Limiting**: Prevents brute force attacks
4. **Input Validation**: Joi schemas for all inputs
5. **SQL Injection Prevention**: Parameterized queries
6. **CORS Protection**: Configurable origins
7. **Session Management**: Refresh token rotation
8. **Password Requirements**: Strong password enforcement

## Environment Variables

Required environment variables:

```env
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=30d
BCRYPT_ROUNDS=12
```

## Production Considerations

1. **Remove debug fields** from password reset responses
2. **Implement email verification** with real email service
3. **Add 2FA support** for enhanced security
4. **Implement password reset tokens** in database
5. **Add login attempt tracking** per user
6. **Implement account lockout** after failed attempts
7. **Add audit logging** for security events
8. **Use HTTPS** in production
9. **Implement CSRF protection** for web clients
10. **Add device tracking** for security monitoring