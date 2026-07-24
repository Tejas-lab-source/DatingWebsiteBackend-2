require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');

const connectDB = require('./config/db');
const { initSocket } = require('./config/socket');
const apiRoutes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { globalLimiter } = require('./middleware/rateLimiters');

// Fail loudly at boot rather than mysteriously at request time.
for (const key of ['MONGODB_URL', 'JWT_SECRET']) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}
if (process.env.JWT_SECRET.length < 32) {
  console.warn('[warn] JWT_SECRET is short. Use at least 32 random characters.');
}

const allowedOrigins = (process.env.CLIENT_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const app = express();
const server = http.createServer(app);

app.set('trust proxy', 1); // needed for correct IPs behind Render/Vercel/nginx

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression()); // gzip — noticeably smaller JSON payloads
app.use(
  cors({
    origin: "*",
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/api', globalLimiter);

app.get('/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));
app.use('/api/v1', apiRoutes);

app.use(notFound);
app.use(errorHandler); // must be last

(async () => {
  await connectDB();
  initSocket(server, allowedOrigins);

  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => console.log(`[server] listening on :${PORT}`));
})();

// Don't leave the process in a zombie state after an unhandled rejection.
process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err);
});
process.on('SIGTERM', () => server.close(() => process.exit(0)));
