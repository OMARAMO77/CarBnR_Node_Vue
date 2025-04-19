const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();
const { validationResult } = require('express-validator');
//const { protect } = require('../middleware/auth');

const {
  getLocations,
  getLocationById,
  createLocation,
  updateLocation,
  deleteLocation,
  searchLocations,
  softDeleteLocation//,
  //verifyOwnership
} = require('../controllers/locationController');

const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));
    const errors = validationResult(req);
    if (errors.isEmpty()) return next();
    res.status(400).json({ errors: errors.array() });
  };
};

router.get('/search',
  validate([
    query('q').trim().escape().notEmpty()
  ]),
  searchLocations
);

// GET all locations
router.get('/',
  validate([
    query('cityId').optional().isMongoId(),
    query('userId').optional().isMongoId(),
    query('deleted').optional().isIn(['true', 'false'])
  ]),
  getLocations
);

// GET single location
router.get('/:id',
  validate([
    param('id').isMongoId().withMessage('Invalid location ID')
  ]),
  getLocationById
);

// POST create location
router.post('/',
  validate([
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required')
      .isLength({ max: 100 }),
    body('address')
      .trim()
      .notEmpty().withMessage('Address is required')
      .isLength({ max: 200 }),
    body('phone_number')
      .trim()
      .matches(/^\+?[0-9\s\-()]{7,20}$/).withMessage('Invalid phone number'),
    body('cityId')
      .isMongoId().withMessage('Invalid city ID'),
    body('userId')
      .isMongoId().withMessage('Invalid user ID')
  ]),
  createLocation
);

// PUT update location
router.put('/:id',
  //protect,
  validate([
    param('id').isMongoId().withMessage('Invalid location ID'),
    body('name').optional().trim().isLength({ max: 100 }),
    body('address').optional().trim().isLength({ max: 200 }),
    body('phone_number').optional().trim().matches(/^\+?[0-9\s\-()]{7,20}$/),
    body('cityId').optional().isMongoId(),
    body('userId').optional().isMongoId()
  ]),
  //verifyOwnership,
  updateLocation
);

router.delete('/:id/soft',
  //protect,
  validate([param('id').isMongoId()]),
  //verifyOwnership,
  softDeleteLocation
);

// Update existing delete route
router.delete('/:id',
  //protect,
  validate([param('id').isMongoId()]),
  //verifyOwnership,
  deleteLocation
);

module.exports = router;
