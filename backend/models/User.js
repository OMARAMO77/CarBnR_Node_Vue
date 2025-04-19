// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true, // Remove whitespace
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true, // No duplicate emails
    lowercase: true, // Store emails in lowercase
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false // Prevents password from being returned in queries
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  active: {
    type: Boolean,
    default: true
  },  
  deleted: {
    type: Date,
    default: null
  }//,
  //refreshToken: String,
  //resetPasswordToken: String,
  //resetPasswordExpire: Date,
  //loginAttempts: {
  // type: Number,
  //  default: 0
  //},
  //lockUntil: Date
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.password;
      delete ret._id;  // ?? Remove the _id field
      delete ret.__v;  // Remove version key
      return ret;
    }
  },
  //id: false // ?? Disable the virtual `id` getter
});

userSchema.pre(/^find/, function() {
  // Only apply default filter if not explicitly requesting deleted
  if (!this.getOptions().withDeleted && !this._conditions.deleted) {
    this.where({ deleted: null });
  }
});

// Password hashing middleware
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12); // Increased salt rounds
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(new Error('Password hashing failed: ' + err.message));
  }
});

// Account lock check
//userSchema.virtual('isLocked').get(function() {
//  return this.lockUntil && this.lockUntil > Date.now();
//});

// Password comparison method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.pre('deleteOne', { document: true }, async function(next) {
  await mongoose.model('Location').deleteMany({ userId: this._id });
  next();
});

// Indexes
userSchema.index({ createdAt: 1 });

module.exports = mongoose.model('User', userSchema);
