const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/user');

let io = null;

// userId -> number of open sockets. A count, not a single socket id, so
// opening a second tab doesn't mark you offline when you close the first.
const onlineCounts = new Map();

function initSocket(server, allowedOrigins) {
  io = new Server(server, {
    cors: { origin: allowedOrigins, credentials: true },
    pingTimeout: 30000,
  });

  /**
   * The old handshake trusted `socket.handshake.query.UserID` — an
   * unauthenticated string. Anyone could connect claiming to be any user
   * and receive that person's private messages in real time.
   * Now the client must send its JWT.
   */
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('Not authenticated'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.scope !== 'auth' || !decoded.userId) return next(new Error('Invalid token'));

      socket.userId = String(decoded.userId);
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const { userId } = socket;

    // Rooms replace the manual userId -> socketId map. Emitting to a room
    // reaches every device the user has open.
    socket.join(userId);

    const count = (onlineCounts.get(userId) || 0) + 1;
    onlineCounts.set(userId, count);

    if (count === 1) {
      await User.updateOne({ _id: userId }, { isOnline: true, lastActive: new Date() });
      io.emit('presence:online', { userId });
    }

    socket.emit('presence:list', [...onlineCounts.keys()]);

    socket.on('typing:start', ({ to }) => {
      if (to) io.to(String(to)).emit('typing:start', { from: userId });
    });
    socket.on('typing:stop', ({ to }) => {
      if (to) io.to(String(to)).emit('typing:stop', { from: userId });
    });

    socket.on('disconnect', async () => {
      const left = (onlineCounts.get(userId) || 1) - 1;
      if (left <= 0) {
        onlineCounts.delete(userId);
        await User.updateOne({ _id: userId }, { isOnline: false, lastActive: new Date() });
        io.emit('presence:offline', { userId });
      } else {
        onlineCounts.set(userId, left);
      }
    });
  });

  return io;
}

const getIo = () => io;
const isOnline = (userId) => onlineCounts.has(String(userId));

module.exports = { initSocket, getIo, isOnline };
