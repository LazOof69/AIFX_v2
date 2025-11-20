/**
 * AIFX_v2 Backend Application
 * Main Express.js application setup with security, middleware, and routing
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const { createServer } = require('http');
const { Server } = require('socket.io');

const AppError = require('./utils/AppError');

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// Trust proxy for accurate IP addresses behind load balancers
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.CORS_ORIGIN || 'http://localhost:5173',
      'http://localhost:3000',
      'http://10.0.0.199',
      'http://168.138.182.181',
      'http://168.138.182.181:5173',
    ];

    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new AppError('Not allowed by CORS', 403, 'CORS_ERROR'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Service-Name'],
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    data: null,
    error: 'Too many requests from this IP, please try again later',
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/api/v1/health';
  },
});

app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Request logging middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  console.log(`${req.method} ${req.path} - ${req.ip} - ${req.requestTime}`);
  next();
});

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      version: require('../package.json').version,
    },
    error: null,
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/market', require('./routes/market'));
app.use('/api/v1/trading', require('./routes/trading'));
app.use('/api/v1/notifications', require('./routes/notifications'));
app.use('/api/v1/positions', require('./routes/positions')); // Phase 3: Position management

// Microservices API routes (Phase 2: Backend APIs for services)
app.use('/api/v1/discord', require('./routes/api/v1/discord')); // Discord Bot APIs

// TODO: Add additional route files when created
// app.use('/api/v1/preferences', require('./routes/preferences'));
// app.use('/api/v1/analytics', require('./routes/analytics'));
// app.use('/api/v1/ml', require('./routes/api/v1/ml')); // ML Engine APIs (Phase 3)

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join_user_room', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined their room`);
  });

  socket.on('subscribe_to_pair', (pair) => {
    socket.join(`pair_${pair}`);
    console.log(`Socket ${socket.id} subscribed to ${pair}`);
  });

  socket.on('unsubscribe_from_pair', (pair) => {
    socket.leave(`pair_${pair}`);
    console.log(`Socket ${socket.id} unsubscribed from ${pair}`);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Make io accessible to routes
app.set('io', io);

// 404 handler for undefined routes
app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404, 'ROUTE_NOT_FOUND'));
});

// Global error handling middleware
app.use((err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Development error response
  if (process.env.NODE_ENV === 'development') {
    res.status(err.statusCode).json({
      success: false,
      data: null,
      error: err.message,
      timestamp: new Date().toISOString(),
      stack: err.stack,
      code: err.code || 'INTERNAL_ERROR',
    });
  } else {
    // Production error response
    if (err.isOperational) {
      res.status(err.statusCode).json({
        success: false,
        data: null,
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    } else {
      // Log error for debugging
      console.error('ERROR 💥', err);

      res.status(500).json({
        success: false,
        data: null,
        error: 'Something went wrong!',
        timestamp: new Date().toISOString(),
      });
    }
  }
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
  server.close(() => {
    console.log('💥 Process terminated!');
  });
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT RECEIVED. Shutting down gracefully');
  server.close(() => {
    console.log('💥 Process terminated!');
  });
});

// Unhandled promise rejection handling
process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

// Uncaught exception handling
process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`🚀 AIFX_v2 Backend running on port ${PORT} in ${process.env.NODE_ENV} mode`);
  });
}

module.exports = { app, server, io };