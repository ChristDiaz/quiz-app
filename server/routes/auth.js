const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User'); // Import the User model
const authMiddleware = require('../middleware/authMiddleware'); // 1. Import auth middleware
const validateFields = require('../middleware/validateFields'); // Import validateFields

const router = express.Router();

const passwordPolicyRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
const passwordPolicyMessage = 'Password does not meet policy requirements. It must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character (e.g., !@#$%^&*).';

// Load JWT Secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error("FATAL ERROR: JWT_SECRET is not defined. Cannot run auth routes.");
    // Consider exiting the process if JWT_SECRET is critical and missing
    // process.exit(1);
}

// Rate limiter for authentication routes
const authLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // Limit each IP to 10 requests per windowMs
    message: 'Too many requests from this IP, please try again after a minute',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// --- POST /api/auth/signup ---
router.post('/signup', authLimiter, validateFields(['username', 'email', 'password'], { username: 'string', email: 'string', password: 'string' }), async (req, res) => {
    const { username, email, password } = req.body;

    // Password policy validation
    if (!passwordPolicyRegex.test(password)) {
        return res.status(400).json({ 
            message: passwordPolicyMessage
        });
    }

    try {
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ message: 'Email or username already exists.' });
        }

        const newUser = new User({ username, email, password });
        await newUser.save();

        const userResponse = newUser.toObject();
        delete userResponse.password;

        res.status(201).json({ message: 'User created successfully.', user: userResponse });

    } catch (error) {
        console.error("Signup Error:", error);
        if (error.name === 'ValidationError') {
             const messages = Object.values(error.errors).map(val => val.message);
             return res.status(400).json({ message: messages.join('. ') });
        }
        res.status(500).json({ message: 'An unexpected error occurred. Please try again later.' });
    }
});

// --- POST /api/auth/login ---
router.post('/login', authLimiter, validateFields(['email', 'password'], { email: 'string', password: 'string' }), async (req, res) => {
    const { email, password } = req.body;

    // Basic validation for presence is now handled by validateFields.

    try {
        // Find user by email. Use .select('+password') if password field has 'select: false' in schema
        const user = await User.findOne({ email }); //.select('+password');

        if (!user) {
             console.log(`Login attempt failed: User not found for email ${email}`);
             return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            console.log(`Login attempt failed: Incorrect password for email ${email}`);
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        if (!JWT_SECRET) {
             console.error("Login Error: JWT_SECRET is missing.");
             return res.status(500).json({ message: 'An unexpected error occurred. Please try again later.' });
        }

        const payload = {
            id: user._id, // User ID for JWT payload
            // username: user.username // Optionally include username
        };

        const token = jwt.sign(
            payload,
            JWT_SECRET,
            { expiresIn: '1h' } // Token expires in 1 hour
        );

        res.status(200).json({
            message: 'Login successful.',
            token: token,
            user: { // Send back basic user info
                id: user._id,
                username: user.username,
                email: user.email
            }
        });

    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: 'An unexpected error occurred. Please try again later.' });
    }
});


// --- GET /api/auth/me - Get current logged-in user data --- // 2. Add the new route
// This route is protected by the authMiddleware
router.get('/me', authMiddleware, async (req, res) => {
    try {
        // authMiddleware verifies token and attaches user info to req.user
        // Fetch user details using the ID from the token payload, excluding the password
        const user = await User.findById(req.user.id).select('-password');

        if (!user) {
            // Should not happen if token is valid but user deleted, but good practice to check
            console.log(`Auth /me: User not found for ID ${req.user.id} from valid token.`);
            return res.status(404).json({ message: 'User associated with token not found.' });
        }

        // Send back the user data
        res.status(200).json({ user });

    } catch (error) {
        console.error("Get User (/me) Error:", error);
        res.status(500).json({ message: 'An unexpected error occurred. Please try again later.' });
    }
});

// --- PATCH /api/auth/password - Update current user's password ---
router.patch('/password', authMiddleware, authLimiter, validateFields(['currentPassword', 'newPassword'], { currentPassword: 'string', newPassword: 'string' }), async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Current and new password are required.' });
    }

    if (!passwordPolicyRegex.test(newPassword)) {
        return res.status(400).json({ message: passwordPolicyMessage });
    }

    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User associated with token not found.' });
        }

        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({ message: 'Current password is incorrect.' });
        }

        const isSamePassword = await user.comparePassword(newPassword);
        if (isSamePassword) {
            return res.status(400).json({ message: 'New password must be different from the current password.' });
        }

        user.password = newPassword;
        await user.save();

        res.status(200).json({ message: 'Password updated successfully.' });
    } catch (error) {
        console.error('Update Password Error:', error);
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: messages.join('. ') });
        }
        res.status(500).json({ message: 'An unexpected error occurred. Please try again later.' });
    }
});


module.exports = router; // Ensure router is exported at the end
