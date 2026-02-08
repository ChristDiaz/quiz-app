require('dotenv').config();
const authRoutes = require('./routes/auth');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet'); // Import helmet

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/quizcraft';

// Middleware
app.use(helmet()); // Basic helmet protection

// Configure specific security headers
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'"],
    // Add other directives as needed, e.g., imgSrc, fontSrc
  }
}));
// Helmet 8 uses noSniff and frameguard instead of legacy middleware names
app.use(helmet.noSniff()); // Sets X-Content-Type-Options: nosniff
app.use(helmet.frameguard({ action: 'deny' })); // Sets X-Frame-Options: DENY

const FRONTEND_URLS = [
  'http://10.10.10.2:5173', // Vite dev server
  'http://localhost:5173',  // Localhost dev server
  process.env.FRONTEND_URL || 'http://10.10.10.2:3000', // Production or custom
  'https://quizcraft.elatron.net', // Deployed frontend
  'http://quizcraft.elatron.net' // HTTP variant of deployed frontend
];

const corsOptions = {
  origin: FRONTEND_URLS,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

app.use(cors(corsOptions));

app.options(/.*/, cors(corsOptions));

app.use(express.json());

// Routes
// quiz routes
const quizRoutes = require('./routes/quizzes');
app.use('/api/quizzes', quizRoutes);
// quiz attempts routes
const quizAttemptRoutes = require('./routes/quizAttempts');
app.use('/api/quiz-attempts', quizAttemptRoutes);
// User routes
app.use('/api/auth', authRoutes); // Auth routes
const userRoutes = require('./routes/users');
app.use('/api/users', userRoutes);

const isTest = process.env.NODE_ENV === 'test';

// MongoDB connection
if (!isTest) {
  mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB connected!'))
    .catch((err) => console.error('MongoDB connection error:', err));
}

// Start server only when run directly (not during tests)
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on http://10.10.10.2:${PORT}`);
  }).on('error', (err) => {
    console.error('❌ Server failed to start:', err);
  });
}

module.exports = app;
