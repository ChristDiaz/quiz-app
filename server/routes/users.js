const express = require('express');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const validateFields = require('../middleware/validateFields');

const router = express.Router();

// --- PATCH /api/users/me - Update current user's profile ---
router.patch(
  '/me',
  authMiddleware,
  validateFields(['username', 'email'], { username: 'string', email: 'string' }),
  async (req, res) => {
    const { username, email } = req.body;

    if (username === undefined && email === undefined) {
      return res.status(400).json({ message: 'At least one field (username or email) is required.' });
    }

    const updates = {};

    if (username !== undefined) {
      const trimmedUsername = username.trim();
      if (!trimmedUsername) {
        return res.status(400).json({ message: 'Username cannot be empty.' });
      }
      updates.username = trimmedUsername;
    }

    if (email !== undefined) {
      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail) {
        return res.status(400).json({ message: 'Email cannot be empty.' });
      }
      updates.email = trimmedEmail;
    }

    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User associated with token not found.' });
      }

      const conflictChecks = [];
      if (updates.username && updates.username !== user.username) {
        conflictChecks.push({ username: updates.username });
      }
      if (updates.email && updates.email !== user.email) {
        conflictChecks.push({ email: updates.email });
      }

      if (conflictChecks.length > 0) {
        const existingUser = await User.findOne({
          _id: { $ne: user._id },
          $or: conflictChecks,
        });
        if (existingUser) {
          return res.status(400).json({ message: 'Email or username already exists.' });
        }
      }

      if (updates.username !== undefined) {
        user.username = updates.username;
      }
      if (updates.email !== undefined) {
        user.email = updates.email;
      }

      await user.save();

      const userResponse = user.toObject();
      delete userResponse.password;

      return res.status(200).json({ message: 'Profile updated successfully.', user: userResponse });
    } catch (error) {
      console.error('Update Profile Error:', error);
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(val => val.message);
        return res.status(400).json({ message: messages.join('. ') });
      }
      return res.status(500).json({ message: 'An unexpected error occurred. Please try again later.' });
    }
  }
);

module.exports = router;
