const mongoose = require('mongoose');
const validator = require('validator');

const reservationSchema = new mongoose.Schema({
  carId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Car',
    required: [true, 'Car reference is required'],
    validate: {
      validator: async function(carId) {
        const car = await mongoose.model('Car').findById(carId);
        return !!car;
      },
      message: 'Invalid car reference'
    }
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required'],
    validate: {
      validator: async function(userId) {
        const user = await mongoose.model('User').findById(userId);
        return !!user;
      },
      message: 'Invalid user reference'
    }
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required'],
    validate: {
      validator: function(v) {
        return v > new Date();
      },
      message: 'Start date must be in the future'
    }
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required'],
    validate: {
      validator: function(v) {
        return v > this.startDate;
      },
      message: 'End date must be after start date'
    }
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'pending'
  },
  totalPrice: Number
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  },
  //id: false
});

// Calculate total price before saving
reservationSchema.pre('save', async function(next) {
  const car = await mongoose.model('Car').findById(this.carId);
  const days = Math.ceil((this.endDate - this.startDate) / (1000 * 60 * 60 * 24));
  this.totalPrice = days * car.priceByDay;
  next();
});

// Prevent overlapping reservations
reservationSchema.pre('save', async function(next) {
  const overlapping = await mongoose.model('Reservation').find({
    carId: this.carId,
    $nor: [
      { endDate: { $lte: this.startDate } },
      { startDate: { $gte: this.endDate } }
    ]
  });
  
  if (overlapping.length > 0) {
    throw new Error('Car already reserved for these dates');
  }
  next();
});

module.exports = mongoose.model('Reservation', reservationSchema);
