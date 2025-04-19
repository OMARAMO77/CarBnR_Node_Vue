// controllers/userController.js (Critical Security Fixes)
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// Async error handler wrapper
const handleErrors = (res, error, defaultMessage) => {
  console.error(error);
  
  if (error.name === 'ValidationError') {
    return res.status(400).json({ error: error.message });
  }
  if (error.code === 11000) {
    return res.status(409).json({ error: 'Email already exists' });
  }
  res.status(500).json({ error: defaultMessage });
};

// Get all users (safe version)
//const getUsers = async (req, res) => {
//  try {
//    const users = await User.find().select('-password -__v');
//    res.json(users);
//  } catch (err) {
//    handleErrors(res, err, 'Failed to fetch users');
//  }
//};


// Get all users with filters
const getUsers = async (req, res) => {
  try {
    const { deleted } = req.query;
    const query = {};
    
    // Handle deleted filter
    if (deleted === 'true') {
      query.deleted = { $ne: null };
    } else if (deleted === 'false') {
      query.deleted = null;
    }

    const users = await User.find(query)
      .setOptions({ withDeleted: deleted === 'true' })
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (err) {
    handleErrors(res, err, 'Failed to fetch users');
  }
};

// Create user (with proper password handling)
const createUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const user = new User({ name, email, password });
    await user.save();
    res.status(201).json(user.toJSON());
  } catch (err) {
    handleErrors(res, err, 'Failed to create user');
  }
};

// Update user (secure password handling)
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    
    // Handle password updates securely
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 12);
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      updates,
      { 
        new: true,
        runValidators: true,
        select: '-password -__v'
      }
    ).orFail();

    res.json(updatedUser);
  } catch (err) {
    handleErrors(res, err, 'Failed to update user');
  }
};

const softDeleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { deleted: new Date() },
      { new: true }
    ).populate('city user');

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    handleErrors(res, err, 'Delete failed');
  }
};

// Delete user
const deleteUser = async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id)
    if (!deletedUser) return res.status(404).json({ error: 'User not found' });
    res.status(204).send();
  } catch (err) {
    handleErrors(res, err, 'Failed to delete user');
  }
};

// Login user
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Get user with password and admin status
    const user = await User.findOne({ email }).select('+password +isAdmin');
    if (!user) throw new Error('Invalid credentials');

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new Error('Invalid credentials');

    // Create JWT token
    const token = jwt.sign(
      { id: user._id }, 
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );

    // Prepare base response
    const response = {
      id: user.id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      token
    };

    res.json(response);
    
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
};
// Get current user profile
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getUsers,
  createUser,
  updateUser,
  softDeleteUser,
  deleteUser,
  loginUser,
  getMe
};
