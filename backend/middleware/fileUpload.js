const fs = require('fs')
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const sharp = require('sharp');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Create directory if it doesn't exist
    fs.mkdirSync('uploads/cars/', { recursive: true });
    cb(null, 'uploads/cars/');
  },
  filename: function (req, file, cb) {
    const uniqueName = uuidv4();
    //const ext = path.extname(file.originalname);
    cb(null, `${uniqueName}-${Date.now()}`);
    //cb(null, `${uniqueName}-${Date.now()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
}).single('image');

const processImage = async (req, res, next) => {
  if (!req.file) return next();
  
  try {
    const originalPath = req.file.path;
    const processedPath = `${originalPath}.jpg`;

    await sharp(originalPath)
      .resize(800, 800, { fit: 'inside' })
      .jpeg({ quality: 80 })
      .toFile(processedPath);

    // Replace original with processed image
    fs.unlinkSync(originalPath);
    req.file.path = processedPath;
    req.file.filename = path.basename(processedPath);

    next();
  } catch (err) {
    // Clean up files on error
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    next(err);
  }
};

module.exports = { upload, processImage };
