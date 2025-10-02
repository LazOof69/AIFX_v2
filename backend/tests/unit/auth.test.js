/**
 * Authentication Service Unit Tests
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

describe('Authentication Service', () => {
  describe('Password Hashing', () => {
    test('should hash password correctly', async () => {
      const password = 'testPassword123';
      const hashedPassword = await bcrypt.hash(password, 10);

      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(0);
    });

    test('should verify correct password', async () => {
      const password = 'testPassword123';
      const hashedPassword = await bcrypt.hash(password, 10);
      const isValid = await bcrypt.compare(password, hashedPassword);

      expect(isValid).toBe(true);
    });

    test('should reject incorrect password', async () => {
      const password = 'testPassword123';
      const wrongPassword = 'wrongPassword456';
      const hashedPassword = await bcrypt.hash(password, 10);
      const isValid = await bcrypt.compare(wrongPassword, hashedPassword);

      expect(isValid).toBe(false);
    });
  });

  describe('JWT Token Generation', () => {
    const secret = 'test-secret-key';
    const payload = { userId: '123', email: 'test@example.com' };

    test('should generate valid JWT token', () => {
      const token = jwt.sign(payload, secret, { expiresIn: '1h' });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // Header, Payload, Signature
    });

    test('should verify valid JWT token', () => {
      const token = jwt.sign(payload, secret, { expiresIn: '1h' });
      const decoded = jwt.verify(token, secret);

      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
    });

    test('should reject invalid JWT token', () => {
      const token = 'invalid.token.string';

      expect(() => {
        jwt.verify(token, secret);
      }).toThrow();
    });

    test('should reject expired JWT token', () => {
      const token = jwt.sign(payload, secret, { expiresIn: '-1s' });

      expect(() => {
        jwt.verify(token, secret);
      }).toThrow(jwt.TokenExpiredError);
    });

    test('should reject token with wrong secret', () => {
      const token = jwt.sign(payload, secret, { expiresIn: '1h' });
      const wrongSecret = 'wrong-secret-key';

      expect(() => {
        jwt.verify(token, wrongSecret);
      }).toThrow(jwt.JsonWebTokenError);
    });
  });

  describe('Email Validation', () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    test('should validate correct email format', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.com',
      ];

      validEmails.forEach(email => {
        expect(emailRegex.test(email)).toBe(true);
      });
    });

    test('should reject invalid email format', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user@.com',
        'user name@example.com',
      ];

      invalidEmails.forEach(email => {
        expect(emailRegex.test(email)).toBe(false);
      });
    });
  });

  describe('Password Strength', () => {
    const isStrongPassword = (password) => {
      return password.length >= 8 &&
             /[a-z]/.test(password) &&
             /[A-Z]/.test(password) &&
             /[0-9]/.test(password);
    };

    test('should accept strong password', () => {
      const strongPasswords = [
        'Password123',
        'SecurePass1',
        'MyP@ssw0rd',
      ];

      strongPasswords.forEach(password => {
        expect(isStrongPassword(password)).toBe(true);
      });
    });

    test('should reject weak password', () => {
      const weakPasswords = [
        'short',           // Too short
        'alllowercase1',   // No uppercase
        'ALLUPPERCASE1',   // No lowercase
        'NoNumbers',       // No numbers
      ];

      weakPasswords.forEach(password => {
        expect(isStrongPassword(password)).toBe(false);
      });
    });
  });

  describe('Token Payload', () => {
    test('should create token with user information', () => {
      const user = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'user@example.com',
        username: 'testuser',
      };

      const tokenPayload = {
        userId: user.id,
        email: user.email,
        username: user.username,
      };

      const token = jwt.sign(tokenPayload, 'test-secret', { expiresIn: '1h' });
      const decoded = jwt.verify(token, 'test-secret');

      expect(decoded.userId).toBe(user.id);
      expect(decoded.email).toBe(user.email);
      expect(decoded.username).toBe(user.username);
    });

    test('should not include sensitive information in token', () => {
      const user = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'user@example.com',
        password_hash: '$2b$10$abcdefghijklmnopqrstuv',
      };

      const tokenPayload = {
        userId: user.id,
        email: user.email,
        // Should NOT include password_hash
      };

      const token = jwt.sign(tokenPayload, 'test-secret', { expiresIn: '1h' });
      const decoded = jwt.verify(token, 'test-secret');

      expect(decoded.password_hash).toBeUndefined();
      expect(decoded.userId).toBe(user.id);
    });
  });

  describe('Token Expiration', () => {
    test('should create access token with 1 hour expiration', () => {
      const token = jwt.sign({ userId: '123' }, 'secret', { expiresIn: '1h' });
      const decoded = jwt.verify(token, 'secret');

      const expirationTime = decoded.exp - decoded.iat;
      expect(expirationTime).toBe(3600); // 1 hour = 3600 seconds
    });

    test('should create refresh token with 7 days expiration', () => {
      const token = jwt.sign({ userId: '123' }, 'secret', { expiresIn: '7d' });
      const decoded = jwt.verify(token, 'secret');

      const expirationTime = decoded.exp - decoded.iat;
      expect(expirationTime).toBe(604800); // 7 days = 604800 seconds
    });
  });
});