// routes/states.js (Fixed Query Import)
const express = require('express');
const { query, body, param } = require('express-validator'); // ?? Added query import
const router = express.Router();
const { validationResult } = require('express-validator');
//const { protect } = require('../middleware/auth');

const {
  getStates,
  getStateById,
  createState,
  updateState,
  deleteState,
  searchStates,
  autocompleteStates,
  bulkImportStates,
  bulkExportStates
} = require('../controllers/stateController');

const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));
    const errors = validationResult(req);
    if (errors.isEmpty()) return next();
    res.status(400).json({ errors: errors.array() });
  };
};
// Bulk export
router.get('/bulk-export',
  validate([
    query('format').optional().isIn(['json', 'csv']),
    query('createdAfter').optional().isISO8601(),
    query('createdBefore').optional().isISO8601(),
    query('compress').optional().isBoolean()
  ]),
  bulkExportStates
);
// GET all states
//router.get('/', getStates);

// GET all states with search
router.get('/', 
  validate([
    query('search').optional().trim().escape().isLength({ max: 50 }).withMessage('Search query too long'),
    query('sort').optional().isIn(['name_asc', 'name_desc', 'date_asc', 'date_desc']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('createdAfter').optional().isISO8601(),
    query('createdBefore').optional().isISO8601()
  ]),
  getStates
);// GET single state by ID
router.get(
  '/:id',
  validate([
    param('id').isMongoId().withMessage('Invalid state ID')
  ]),
  getStateById
);

// POST create state
router.post(
  '/',
  validate([
    body('name')
      .trim()
      .notEmpty().withMessage('State name is required')
      .isLength({ min: 2, max: 50 })
  ]),
  createState
);

// PUT update state
router.put(
  '/:id',
  //protect,
  validate([
    param('id').isMongoId().withMessage('Invalid state ID'),
    body('name')
      .trim()
      .notEmpty().withMessage('State name is required')
      .isLength({ min: 2, max: 50 })
  ]),
  updateState
);

// DELETE state
router.delete(
  '/:id',
  //protect,
  validate([
    param('id').isMongoId().withMessage('Invalid state ID')
  ]),
  deleteState
);

// Full-text search
router.get('/search/:query', 
  validate([
    param('query').trim().escape()
  ]),
  searchStates
);

// Autocomplete
router.get('/autocomplete/:prefix',
  validate([
    param('prefix').trim().escape().isLength({ min: 2 })
  ]),
  autocompleteStates
);

// Bulk import
router.post('/bulk-import',
  validate([
    body().isArray().withMessage('Expected array of state names'),
    body('*').isString().trim().notEmpty()
  ]),
  bulkImportStates
);

// Bulk export
router.get('/bulk-export', bulkExportStates);

module.exports = router;
