const mongoose = require('mongoose');

module.exports = async function connectDB() {
  const uri = process.env.MONGODB_URL;
  if (!uri) throw new Error('MONGODB_URL is not set');

  mongoose.set('strictQuery', true);

  try {
    await mongoose.connect(uri, {
      maxPoolSize: 20,             // reuse connections instead of opening new ones
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
    });
    console.log('[db] connected');
  } catch (err) {
    console.error('[db] connection failed:', err.message);
    // Your old version swallowed this and let the server boot with no DB,
    // so every request 500'd with a confusing error.
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => console.warn('[db] disconnected'));
};
