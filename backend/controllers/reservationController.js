const Reservation = require('../models/Reservation');
const Car = require('../models/Car');
const User = require('../models/User');

const handleErrors = (res, error, defaultMessage) => {
  console.error(error);
  
  if (error.message.includes('already reserved')) {
    return res.status(409).json({ error: error.message });
  }
  if (error.name === 'ValidationError') {
    return res.status(400).json({ error: error.message });
  }
  res.status(500).json({ error: defaultMessage });
};

// Create reservation
const createReservation = async (req, res) => {
  try {
    const { carId, startDate, endDate } = req.body;
    const userId = req.user.id;

    const reservation = new Reservation({
      carId,
      userId,
      startDate: new Date(startDate),
      endDate: new Date(endDate)
    });

    await reservation.save();
    res.status(201).json(await reservation.populate(['carId', 'userId']));
  } catch (err) {
    handleErrors(res, err, 'Failed to create reservation');
  }
};

// Get user reservations
const getUserReservations = async (req, res) => {
  try {
    const reservations = await Reservation.find({ userId: req.user.id })
      .populate('carId', 'brand model imageUrl')
      .populate('userId', 'name email');
      
    res.json(reservations);
  } catch (err) {
    handleErrors(res, err, 'Failed to fetch reservations');
  }
};

// Update reservation status (Admin only)
const updateReservationStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const reservation = await Reservation.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate(['carId', 'userId']);

    if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
    res.json(reservation);
  } catch (err) {
    handleErrors(res, err, 'Failed to update reservation');
  }
};

module.exports = {
  createReservation,
  getUserReservations,
  updateReservationStatus
};
