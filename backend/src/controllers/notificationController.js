const { Notification } = require('../models');
const { Op } = require('sequelize');

/**
 * Notification Controller
 * Handles user notifications
 */

/**
 * Get all notifications for user
 * @route GET /api/v1/notifications
 */
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      page = 1,
      limit = 20,
      type,
      isRead,
    } = req.query;

    // Build where clause
    const where = { userId };

    if (type) where.type = type;
    if (isRead !== undefined) where.isRead = isRead === 'true';

    // Calculate offset
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get notifications
    const { count, rows: notifications } = await Notification.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
    });

    // Count unread notifications
    const unreadCount = await Notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    // Calculate pagination
    const totalPages = Math.ceil(count / parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        notifications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: totalPages,
        },
        unreadCount,
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Mark notification as read
 * @route PATCH /api/v1/notifications/:id/read
 */
exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const notification = await Notification.findOne({
      where: {
        id,
        userId,
      },
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Notification not found',
        timestamp: new Date().toISOString(),
      });
    }

    await notification.update({
      isRead: true,
      readAt: new Date(),
    });

    res.status(200).json({
      success: true,
      data: notification,
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Mark all notifications as read
 * @route PATCH /api/v1/notifications/read-all
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await Notification.update(
      {
        isRead: true,
        readAt: new Date(),
      },
      {
        where: {
          userId,
          isRead: false,
        },
      }
    );

    res.status(200).json({
      success: true,
      data: {
        updatedCount: result[0],
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Delete notification
 * @route DELETE /api/v1/notifications/:id
 */
exports.deleteNotification = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const notification = await Notification.findOne({
      where: {
        id,
        userId,
      },
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Notification not found',
        timestamp: new Date().toISOString(),
      });
    }

    await notification.destroy();

    res.status(200).json({
      success: true,
      data: null,
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Create notification (internal use)
 * @param {string} userId - User ID
 * @param {object} notificationData - Notification data
 */
exports.createNotification = async (userId, notificationData) => {
  try {
    const notification = await Notification.create({
      userId,
      ...notificationData,
      sentAt: new Date(),
    });

    return notification;
  } catch (error) {
    console.error('Create notification error:', error);
    throw error;
  }
};