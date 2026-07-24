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
  console.error("===== MONGODB ERROR =====");
  console.error(err);
  console.error("Error name:", err.name);
  console.error("Error message:", err.message);
  console.error("Error cause:", err.cause);
  process.exit(1);
}

  mongoose.connection.on('disconnected', () => console.warn('[db] disconnected'));
};
