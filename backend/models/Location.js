// models/Location.js
const mongoose = require('mongoose');
const validator = require('validator');
const Car = require('./Car');

const locationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Location name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters'],
    minlength: [2, 'Name must be at least 2 characters']
  },
  address: {
    type: String,
    required: [true, 'Address is required'],
    trim: true,
    maxlength: [200, 'Address cannot exceed 200 characters']
  },
  phone_number: {
    type: String,
    required: [true, 'Phone number is required'],
    set: v => v.replace(/[^\d+]/g, ''), // Normalize to +15551234567 format
    validate: {
      validator: function(v) {
        return /^\+\d{7,15}$/.test(v); // Strict int'l format validation
      },
      message: props => `${props.value} is not a valid phone number!`
    }
  },
  cityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'City',
    required: [true, 'City reference is required'],
    validate: {
      validator: async function(cityId) {
        const city = await mongoose.model('City').findById(cityId);
        return !!city;
      },
      message: 'Invalid city reference'
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
  },  deleted: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      try {
        const transformed = { ...ret };
        if (doc._id) transformed.id = doc._id.toString();
        delete transformed._id;
        delete transformed.__v;
        return transformed;
      } catch (err) {
        console.error('Transform error:', err);
        return ret;
      }
    }
  },
  id: false
});

// Soft delete middleware
//locationSchema.pre(/^find/, function() {
//  if (!this.getOptions().withDeleted) {
//    this.where({ deleted: null });
//  }
//});

// Modify the pre-find hook
locationSchema.pre(/^find/, function() {
  // Only apply default filter if not explicitly requesting deleted
  if (!this.getOptions().withDeleted && !this._conditions.deleted) {
    this.where({ deleted: null });
  }
});

// Indexes for common queries
locationSchema.index({ cityId: 1 });
locationSchema.index({ userId: 1 });
//locationSchema.index({ name: 'text' });
// Text search index
locationSchema.index({
  name: 'text',
  address: 'text'
});

// Virtual population
locationSchema.virtual('city', {
  ref: 'City',
  localField: 'cityId',
  foreignField: '_id',
  justOne: true
});

locationSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Pre-save validation
locationSchema.pre('save', async function(next) {
  const [city, user] = await Promise.all([
    mongoose.model('City').findById(this.cityId),
    mongoose.model('User').findById(this.userId)
  ]);

  if (!city) throw new Error('Referenced city does not exist');
  if (!user) throw new Error('Referenced user does not exist');
  next();
});

locationSchema.pre('deleteOne', { document: true }, async function(next) {
  try {
    await Car.deleteMany({ locationId: this._id }).maxTimeMS(30000);
    next();
  } catch (err) {
    next(new Error(`Failed to delete cars: ${err.message}`));
  }
});

locationSchema.pre('deleteMany', async function(next) {
  // Get all locations that match the filter
  const locations = await this.model.find(this.getFilter());
  // Delete all cars for these locations
  await Car.deleteMany({ 
    locationId: { $in: locations.map(l => l._id) }
  });
  next();
});


module.exports = mongoose.model('Location', locationSchema);
