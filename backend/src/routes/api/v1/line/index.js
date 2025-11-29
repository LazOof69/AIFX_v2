/**
 * LINE Bot API Routes
 * Main router for LINE Bot API endpoints
 *
 * Architecture: Backend API layer for LINE Bot (microservices)
 * LINE Bot -> Backend API -> Database
 */

const express = require('express');
const router = express.Router();

// Import sub-routes
const usersRouter = require('./users');
const subscriptionsRouter = require('./subscriptions');

// Mount routes
router.use('/users', usersRouter);
router.use('/subscriptions', subscriptionsRouter);

module.exports = router;
