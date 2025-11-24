/**
 * Subscriptions Routes
 * API routes for managing signal change subscriptions
 */

const express = require('express');
const router = express.Router();
const subscriptionsController = require('../../../controllers/subscriptionsController');
const { validateApiKey } = require('../../../middleware/auth');

// Apply API key authentication to all routes
router.use(validateApiKey);

// Create subscription
router.post('/', subscriptionsController.createSubscription);

// Delete subscription by ID
router.delete('/:id', subscriptionsController.deleteSubscription);

// Delete subscription by user and pair
router.delete('/user/:discordUserId/pair/:pair', subscriptionsController.deleteSubscriptionByUserAndPair);

// Get user's subscriptions
router.get('/user/:discordUserId', subscriptionsController.getUserSubscriptions);

// Get subscribers for a pair
router.get('/pair/:pair', subscriptionsController.getPairSubscribers);

// Get all subscribed pairs (for monitoring service)
router.get('/pairs', subscriptionsController.getSubscribedPairs);

module.exports = router;
