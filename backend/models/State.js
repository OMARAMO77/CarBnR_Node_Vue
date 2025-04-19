// models/State.js
const mongoose = require('mongoose');
const City = require('./City');

const stateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'State name is required'],
    unique: true,
    trim: true,
    maxlength: [50, 'State name cannot exceed 50 characters'],
    minlength: [2, 'State name must be at least 2 characters'],
    set: value => value.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())
  }
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

// Case-insensitive search index
stateSchema.index({ name: 'text' });
// Add index for createdAt to support date-based queries
stateSchema.index({ createdAt: 1 });

// Create text index with custom weights and language
//stateSchema.index(
//  { name: 'text' },
//  { 
//    weights: { name: 10 }, // Higher weight to name field
//    default_language: 'none', // Disable stemming
//    name: 'stateTextIndex' // Named index for easier management
//  }
//);
// Add autocomplete index
stateSchema.index({ name_autocomplete: 1 });

// Add virtual for autocomplete
stateSchema.virtual('name_autocomplete').get(function() {
  return this.name.toLowerCase().replace(/ /g, ''); // Remove spaces for better matching
});


// Middleware for case normalization on update
stateSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  if (update.name) {
    update.name = update.name.replace(/\w\S*/g, txt => 
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
  }
  next();
});

// Add this to the bottom of State.js
//stateSchema.pre('deleteOne', { document: true, query: false }, async function (next) {
//  try {
    //const stateId = this._id;
//    const doc = await this.model.findOne(this.getFilter());
    // Delete cities first
    //await mongoose.model('City').deleteMany({ stateId });
//    await mongoose.model('City').deleteMany({ stateId: doc._id });
    // Then delete the state
    //await this.model.deleteOne({ _id: stateId });
    //await this.deleteOne(); // Changed from this.model.deleteOne()

//    next();
//  } catch (err) {
//    next(new Error(`Cascade delete failed: ${err.message}`));
//  }
//});

stateSchema.pre('findOneAndDelete', async function(next) {
  try {
    const doc = await this.model.findOne(this.getFilter());
    if (!doc) {
      return next(new Error('Document not found'));
    }
    
    //await mongoose.model('City').deleteMany({ stateId: doc._id });
    await City.deleteMany({ stateId: doc._id });
    next();
  } catch (err) {
    next(err);
  }
});
// Handle bulk deletions
//stateSchema.pre('deleteMany', async function (next) {
//stateSchema.pre('deleteMany', { document: false, query: true }, async function (next) {
//  try {
//    const stateIds = await this.model.find(this.getFilter()).distinct('_id');
    
    // Delete related cities
//    await City.deleteMany({ stateId: { $in: stateIds } });
    
    // Proceed with state deletion
//    await this.model.deleteMany(this.getFilter());
    
//    next();
//  } catch (err) {
//    next(new Error(`Bulk cascade delete failed: ${err.message}`));
//  }
//});

stateSchema.pre('deleteMany', async function(next) {
  // Get all states that match the filter
  const states = await this.model.find(this.getFilter());
  // Delete all cities for these states
  await City.deleteMany({ 
    stateId: { $in: states.map(s => s._id) }
  });
  next();
});

module.exports = mongoose.model('State', stateSchema);
