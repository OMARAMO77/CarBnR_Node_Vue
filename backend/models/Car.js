// models/Car.js
const mongoose = require('mongoose');
const validator = require('validator');
const Reservation = require('./Reservation');

const currentYear = new Date().getFullYear();

const carSchema = new mongoose.Schema({
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: [true, 'Location reference is required'],
    validate: {
      validator: async function(locationId) {
        const location = await mongoose.model('Location').findById(locationId);
        return !!location;
      },
      message: 'Invalid location reference'
    }
  },
  brand: {
    type: String,
    required: [true, 'Brand is required'],
    trim: true,
    maxlength: [50, 'Brand cannot exceed 50 characters']
  },
  model: {
    type: String,
    required: [true, 'Model is required'],
    trim: true,
    maxlength: [50, 'Model cannot exceed 50 characters']
  },
  year: {
    type: Number,
    required: true,
    min: [1900, 'Invalid year'],
    max: [currentYear + 1, 'Year cannot be in the future']
  },
  priceByDay: {
    type: Number,
    required: [true, 'Daily price is required'],
    min: [1, 'Daily price must be at least 1']
  },
  registrationNumber: {
    type: String,
    required: [true, 'Registration number is required'],
    unique: true,
    uppercase: true,
    validate: {
      validator: function(v) {
        return /^[A-Z0-9]{6,12}$/.test(v);
      },
      message: 'Invalid registration number format'
    }
  },
  available: {
    type: Boolean,
    default: true
  },
  imageUrl: {
    type: String,
    default: '/images/default-car.jpg',
    validate: {
      validator: function(v) {
        // Allow both relative paths and absolute URLs
        return typeof v === 'string' && (
          validator.isURL(v, {
            require_protocol: false,
            require_valid_protocol: false
          }) || v.startsWith('/images/')
        );
      },
      message: 'Invalid image URL format'
    }
  },
  mileage: {
    type: Number,
    min: [0, 'Mileage cannot be negative']
  },
  fuelType: {
    type: String,
    enum: ['petrol', 'diesel', 'electric', 'hybrid', 'other']
  },
  transmission: {
    type: String,
    enum: ['manual', 'automatic', 'semi-automatic']
  },
  seats: {
    type: Number,
    min: [1, 'Must have at least 1 seat'],
    max: [16, 'Maximum 16 seats']
  },
  features: [String]
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

// Indexes
carSchema.index({ locationId: 1 });          // Filter by location
carSchema.index({ brand: 1, model: 1 });     // Filter by brand-model combination
carSchema.index({ priceByDay: 1 });          // Sorting by price
carSchema.index({ year: -1 });               // Sorting by newest first
// Virtual population
carSchema.virtual('location', {
  ref: 'Location',
  localField: 'locationId',
  foreignField: '_id',
  justOne: true
});

// Pre-save validation
carSchema.pre('save', async function(next) {
  const location = await mongoose.model('Location').findById(this.locationId);
  if (!location) throw new Error('Referenced location does not exist');
  next();
});

carSchema.pre('deleteOne', { document: true }, async function(next) {
  try {
    await Reservation.deleteMany({ carId: this._id }).maxTimeMS(30000);
    next();
  } catch (err) {
    next(new Error(`Failed to delete reservations: ${err.message}`));
  }
});

carSchema.pre('deleteMany', async function(next) {
  // Get all cars that match the filter
  const cars = await this.model.find(this.getFilter());
  // Delete all reservations for these cars
  await Reservation.deleteMany({ 
    carId: { $in: cars.map(c => c._id) }
  });
  next();
});


module.exports = mongoose.model('Car', carSchema);
