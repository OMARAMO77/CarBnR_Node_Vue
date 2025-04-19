// routes/users.js (Enhanced)
const express = require('express');
const { body, param, validationResult, query } = require('express-validator');
const router = express.Router();
//const { protect } = require('../middleware/auth');

const { 
  getUsers, 
  createUser, 
  updateUser, 
  softDeleteUser, 
  deleteUser 
} = require('../controllers/userController');

// Utility function to handle validation errors
const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));
    
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }
    
    res.status(400).json({ errors: errors.array() });
  };
};

// Async error handler wrapper
const wrapAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// GET /users
router.get('/',
  validate([
    query('deleted').optional().isIn(['true', 'false'])
  ]),
  wrapAsync(getUsers)
);

// POST /users
router.post(
  '/',
  validate([
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required')
      .escape(),
    body('email')
      .isEmail().withMessage('Invalid email address')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/[0-9]/).withMessage('Password must contain a number')
      .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
  ]),
  wrapAsync(createUser)
);

// PUT /users/:id
router.put(
  '/:id',
  //protect,
  validate([
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('name')
      .optional()
      .trim()
      .escape(),
    body('email')
      .optional()
      .isEmail().withMessage('Invalid email address')
      .normalizeEmail(),
    body('password')
      .optional()
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
  ]),
  wrapAsync(updateUser)
);

router.delete('/:id/soft',
  //protect,
  validate([param('id').isMongoId()]),
  //verifyOwnership,
  softDeleteUser
);

// DELETE /users/:id
router.delete(
  '/:id',
  //protect,
  validate([
    param('id').isMongoId().withMessage('Invalid user ID')
  ]),
  wrapAsync(deleteUser)
);

module.exports = router;
