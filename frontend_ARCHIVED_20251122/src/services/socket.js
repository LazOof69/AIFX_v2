import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

let socket = null;

/**
 * Initialize Socket.io connection
 * @returns {Socket} Socket instance
 */
export const initializeSocket = () => {
  if (socket) return socket;

  const token = localStorage.getItem('accessToken');

  socket = io(SOCKET_URL, {
    auth: {
      token,
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });

  return socket;
};

/**
 * Get existing socket instance
 * @returns {Socket} Socket instance
 */
export const getSocket = () => {
  if (!socket) {
    return initializeSocket();
  }
  return socket;
};

/**
 * Subscribe to trading signals
 * @param {Function} callback - Callback function for signal events
 */
export const subscribeToSignals = (callback) => {
  const socketInstance = getSocket();
  socketInstance.on('trading:signal', callback);
  return () => socketInstance.off('trading:signal', callback);
};

/**
 * Subscribe to price updates
 * @param {string} pair - Currency pair
 * @param {Function} callback - Callback function for price updates
 */
export const subscribeToPriceUpdates = (pair, callback) => {
  const socketInstance = getSocket();
  socketInstance.emit('subscribe:price', { pair });
  socketInstance.on(`price:${pair}`, callback);

  return () => {
    socketInstance.emit('unsubscribe:price', { pair });
    socketInstance.off(`price:${pair}`, callback);
  };
};

/**
 * Subscribe to market updates
 * @param {Function} callback - Callback function for market updates
 */
export const subscribeToMarketUpdates = (callback) => {
  const socketInstance = getSocket();
  socketInstance.on('market:update', callback);
  return () => socketInstance.off('market:update', callback);
};

/**
 * Subscribe to notifications
 * @param {Function} callback - Callback function for notifications
 */
export const subscribeToNotifications = (callback) => {
  const socketInstance = getSocket();
  socketInstance.on('notification', callback);
  return () => socketInstance.off('notification', callback);
};

/**
 * Disconnect socket
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export default {
  initializeSocket,
  getSocket,
  subscribeToSignals,
  subscribeToPriceUpdates,
  subscribeToMarketUpdates,
  subscribeToNotifications,
  disconnectSocket,
};