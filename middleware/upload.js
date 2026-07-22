const multer = require('multer');

// memoryStorage: the file stays as a Buffer and goes straight to Cloudinary.
// No ./public/temp directory to create, nothing left on disk, works fine on
// ephemeral hosts like Render / Railway / Fly.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 }, // 8MB
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype);
    cb(ok ? null : new Error('Only JPEG, PNG, WEBP or GIF images are allowed'), ok);
  },
});

module.exports = { upload };
