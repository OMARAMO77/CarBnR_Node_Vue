const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();
const { validationResult } = require('express-validator');
//const { protect } = require('../middleware/auth');

const {
  getCities,
  getCityById,
  createCity,
  updateCity,
  deleteCity
} = require('../controllers/cityController');

const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));
    const errors = validationResult(req);
    if (errors.isEmpty()) return next();
    res.status(400).json({ errors: errors.array() });
  };
};

// GET all cities
router.get('/', 
  validate([
    query('stateId').optional().isMongoId().withMessage('Invalid state ID format'),
    query('search').optional().trim().escape()
  ]),
  getCities
);

// GET single city
router.get('/:id',
  validate([
    param('id').isMongoId().withMessage('Invalid city ID')
  ]),
  getCityById
);

// POST create city
router.post('/',
  validate([
    body('name')
      .trim()
      .notEmpty().withMessage('City name is required')
      .isLength({ min: 2, max: 100 }),
    body('stateId')
      .isMongoId().withMessage('Invalid state ID')
  ]),
  createCity
);

// PUT update city
router.put('/:id',
  //protect,
  validate([
    param('id').isMongoId().withMessage('Invalid city ID'),
    body('name').optional().trim().isLength({ min: 2, max: 100 }),
    body('stateId').optional().isMongoId()
  ]),
  updateCity
);

// DELETE city
router.delete('/:id',
  //protect,
  validate([
    param('id').isMongoId().withMessage('Invalid city ID')
  ]),
  deleteCity
);

module.exports = router;
