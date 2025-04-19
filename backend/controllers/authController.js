const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('../models/User');

const authController = {
  login: async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email }).select('+password +loginAttempts +lockUntil');

      // Account lock check
      if (user?.lockUntil && user.lockUntil > Date.now()) {
        const retryAfter = Math.ceil((user.lockUntil - Date.now()) / 1000);
        return res.status(403).json({ error: `Account locked. Try again in ${retryAfter} seconds` });
      }

      if (!user || !(await bcrypt.compare(password, user.password))) {
        await User.findByIdAndUpdate(user?._id, {
          $inc: { loginAttempts: 1 },
          $set: { 
            lockUntil: user?.loginAttempts >= 4 ? Date.now() + 15*60*1000 : null 
          }
        });
        throw new Error('Invalid credentials');
      }

      // Reset login attempts
      await User.findByIdAndUpdate(user._id, {
        loginAttempts: 0,
        lockUntil: null
      });

      // Generate tokens
      const accessToken = jwt.sign(
        { id: user._id },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '15m' }
      );

      const refreshToken = jwt.sign(
        { id: user._id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
      );

      // Set cookies
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15*60*1000 // 15 minutes
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7*24*60*60*1000 // 7 days
      });

      // Save refresh token to DB
      user.refreshToken = refreshToken;
      await user.save();

      res.json({
        id: user.id,
        name: user.name,
        email: user.email
      });
    } catch (err) {
      res.status(401).json({ error: err.message });
    }
  },

  refresh: async (req, res) => {
    try {
      const user = req.user;
      const newAccessToken = jwt.sign(
        { id: user._id },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '15m' }
      );

      res.cookie('accessToken', newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15*60*1000
      });

      res.json({ success: true });
    } catch (err) {
      res.status(401).json({ error: 'Refresh failed' });
    }
  },

  logout: async (req, res) => {
    try {
      // Clear refresh token from DB
      await User.findByIdAndUpdate(req.user.id, { refreshToken: null });
      
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Logout failed' });
    }
  },

  forgotPassword: async (req, res) => {
    try {
      const user = await User.findOne({ email: req.body.email });
      if (!user) throw new Error('User not found');

      const resetToken = crypto.randomBytes(20).toString('hex');
      const resetHash = await bcrypt.hash(resetToken, 10);

      user.resetPasswordToken = resetHash;
      user.resetPasswordExpire = Date.now() + 10*60*1000; // 10 minutes
      await user.save();

      // In production: Send email with resetToken
      res.json({ resetToken });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  resetPassword: async (req, res) => {
    try {
      const user = await User.findOne({
        resetPasswordExpire: { $gt: Date.now() }
      });

      if (!user || !(await bcrypt.compare(req.body.token, user.resetPasswordToken))) {
        throw new Error('Invalid or expired token');
      }

      user.password = req.body.password;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();

      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
};

module.exports = authController;
