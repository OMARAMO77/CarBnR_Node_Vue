// models/City.js
const mongoose = require('mongoose');
const Location = require('./Location');

const citySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'City name is required'],
    trim: true,
    maxlength: [100, 'City name cannot exceed 100 characters'],
    minlength: [2, 'City name must be at least 2 characters'],
    // Case normalization: Store as Proper Case
    set: value => value.replace(/\w\S*/g, txt => 
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    )
  },
  stateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'State',
    required: [true, 'State reference is required'],
    validate: {
      validator: async function(stateId) {
        const state = await mongoose.model('State').findById(stateId);
        return !!state;
      },
      message: 'Invalid state reference'
    }
  }
}, {
  timestamps: true,
// Fix the toJSON transform
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      try {
        // Handle null/undefined document
        if (!doc) return {};
      
        // Create safe return object
        const result = ret ? { ...ret } : {};
      
        // Convert MongoDB _id to id
        if (doc._id) {
          result.id = doc._id.toString();
        }
      
        // Remove internal fields
        delete result._id;
        delete result.__v;
      
        return result;
      } catch (err) {
        console.error('City transform error:', err);
        return ret || {};
      }
    }
  },
  //id: false
});

// Indexes for common queries
citySchema.index({ stateId: 1 }); // For filtering cities by state
citySchema.index({ name: 1 }); // For searching by city name
citySchema.index({ stateId: 1, name: 1 }, { unique: true }); // Prevent duplicate cities in same state

// Virtual for state information
citySchema.virtual('state', {
  ref: 'State',
  localField: 'stateId',
  foreignField: '_id',
  justOne: true
});

// Validation middleware
citySchema.pre('save', async function(next) {
  const stateExists = await mongoose.model('State').exists({ _id: this.stateId });
  if (!stateExists) {
    throw new Error('Referenced state does not exist');
  }
  next();
});

citySchema.pre('deleteOne', { document: true }, async function(next) {
  try {
    await Location.deleteMany({ cityId: this._id }).maxTimeMS(30000);
    next();
  } catch (err) {
    next(new Error(`Failed to delete locations: ${err.message}`));
  }
});

citySchema.pre('deleteMany', async function(next) {
  // Get all cities that match the filter
  const cities = await this.model.find(this.getFilter());
  // Delete all locations for these cities
  await Location.deleteMany({ 
    cityId: { $in: cities.map(c => c._id) }
  });
  next();
});


module.exports = mongoose.model('City', citySchema);
