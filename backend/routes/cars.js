const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();
const { validationResult } = require('express-validator');
const { protect, admin } = require('../middleware/auth');
const { upload, processImage } = require('../middleware/fileUpload');
const Car = require('../models/Car');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const {
  getCars,
  getCarById,
  createCar,
  updateCar,
  deleteCar
} = require('../controllers/carController');

const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));
    const errors = validationResult(req);
    if (errors.isEmpty()) return next();
    res.status(400).json({ errors: errors.array() });
  };
};

// GET all cars
router.get('/', 
  validate([
    query('locationId').optional().isMongoId(),
    query('available').optional().isBoolean(),
    query('minPrice').optional().isFloat({ min: 0 }),
    query('maxPrice').optional().isFloat({ min: 0 }),
    query('brand').optional().trim().escape()
  ]),
  getCars
);

// GET single car
router.get('/:id',
  validate([
    param('id').isMongoId().withMessage('Invalid car ID')
  ]),
  getCarById
);

// POST create car (Admin only)
router.post('/',
  protect,
  admin,
  validate([
    body('locationId').isMongoId(),
    body('brand').trim().notEmpty().isLength({ max: 50 }),
    body('model').trim().notEmpty().isLength({ max: 50 }),
    body('year').isInt({ min: 1900, max: new Date().getFullYear() + 1 }),
    body('priceByDay').isFloat({ min: 1 }),
    body('registrationNumber')
      .trim()
      .matches(/^[A-Z0-9]{6,12}$/),
    body('imageUrl').isURL({ require_protocol: true }),
    body('fuelType').optional().isIn(['petrol', 'diesel', 'electric', 'hybrid', 'other']),
    body('transmission').optional().isIn(['manual', 'automatic', 'semi-automatic']),
    body('seats').optional().isInt({ min: 1, max: 16 })
  ]),
  createCar
);

// PUT update car (Admin only)
router.put('/:id',
  protect,
  admin,
  validate([
    param('id').isMongoId(),
    body('locationId').optional().isMongoId(),
    body('brand').optional().trim().isLength({ max: 50 }),
    body('model').optional().trim().isLength({ max: 50 }),
    body('year').optional().isInt({ min: 1900, max: new Date().getFullYear() + 1 }),
    body('priceByDay').optional().isFloat({ min: 1 }),
    body('registrationNumber').optional().trim().matches(/^[A-Z0-9]{6,12}$/),
    body('imageUrl').optional().isURL({ require_protocol: true }),
    body('available').optional().isBoolean()
  ]),
  updateCar
);

// DELETE car (Admin only)
router.delete('/:id',
  protect,
  admin,
  validate([
    param('id').isMongoId()
  ]),
  deleteCar
);
router.post('/test-upload', 
  upload,
  processImage,
  (req, res) => {
    res.json({
      original: req.file.originalname,
      savedAs: req.file.filename,
      path: req.file.path,
      size: req.file.size
    });
  }
);
router.put('/:id/image',
  protect,
  admin,
  (req, res, next) => {
    upload(req, res, function (err) {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  processImage,
  async (req, res) => {
    try {
      const car = await Car.findById(req.params.id);
      if (!car) return res.status(404).json({ error: 'Car not found' });

      // Delete old image if exists and not default
      if (car.imageUrl && car.imageUrl !== '/images/default-car.jpg') {
        const filename = car.imageUrl.split('/images/')[1];
        if (filename) {
          const oldImagePath = path.join(
            __dirname, 
            '..',
            'uploads',
            'cars',
            filename
          );
          
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }
      }

      // Update with new image URL
      const relativePath = req.file.path.replace(/\\/g, '/').split('uploads/')[1];
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      car.imageUrl = `/images/${relativePath}`;
      await car.save();

      res.json({
        message: 'Image uploaded successfully',
        imageUrl: car.imageUrl
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Image upload failed' });
    }
  }
);
module.exports = router;
