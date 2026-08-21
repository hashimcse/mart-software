import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

// A rejected file type/size surfaces to Express's error middleware via
// multer's own error path, so it comes back as a normal { error: {...} }
// JSON response rather than a raw multer stack trace.
export const uploadProductImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error('Only JPEG, PNG, or WebP images are allowed'));
      return;
    }
    cb(null, true);
  },
}).single('image');
