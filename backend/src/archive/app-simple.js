console.log('app.js: Starting');

const express = require('express');
console.log('app.js: Express loaded');

const { createServer } = require('http');
console.log('app.js: HTTP loaded');

const { Server } = require('socket.io');
console.log('app.js: Socket.IO loaded');

const app = express();
console.log('app.js: App created');

const server = createServer(app);
console.log('app.js: Server created');

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});
console.log('app.js: Socket.IO initialized');

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

console.log('app.js: Routes added');

module.exports = { app, server, io };
console.log('app.js: Module exported');