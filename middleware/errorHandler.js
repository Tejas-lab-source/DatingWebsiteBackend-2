const multer = require('multer');

function notFound(_req, res) {
  res.status(404).json({ message: 'Route not found' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Image must be under 8MB' : err.message;
    return res.status(400).json({ message: msg });
  }
  if (err?.name === 'ValidationError') {
    return res.status(400).json({
      message: Object.values(err.errors).map((e) => e.message).join(', '),
    });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ message: 'That already exists' });
  }
  if (err?.expected) {
    return res.status(err.status || 400).json({ message: err.message });
  }

  console.error('[unhandled]', err);
  res.status(500).json({ message: 'Something went wrong on our end' });
}

module.exports = { notFound, errorHandler };
