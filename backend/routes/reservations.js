const express = require('express');
const router = express.Router();
const {
  createReservation,
  getUserReservations,
  updateReservationStatus
} = require('../controllers/reservationController');
const { protect, admin } = require('../middleware/auth');

// POST /reservations
router.post('/',
  protect,
  (req, res, next) => {
    // Verify user is properly attached
    if (!req.user || !req.user._id) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    req.body.userId = req.user._id; // Use _id instead of id
    next();
  },
  createReservation
);

// GET /reservations/my-reservations
router.get('/my-reservations',
  protect,
  getUserReservations
);

// PATCH /reservations/:id/status
router.patch('/:id/status',
  protect,
  admin,
  updateReservationStatus
);

module.exports = router;
