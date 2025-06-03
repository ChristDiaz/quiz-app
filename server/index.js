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
app.use(helmet.xContentTypeOptions()); // Sets X-Content-Type-Options: nosniff
app.use(helmet.xFrameOptions({ action: 'deny' })); // Sets X-Frame-Options: DENY

const FRONTEND_URLS = [
  'http://10.10.10.2:5173', // Vite dev server
  'http://localhost:5173',  // Localhost dev server
  process.env.FRONTEND_URL || 'http://10.10.10.2:3000' // Production or custom
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || FRONTEND_URLS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.options('*', cors());

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

// MongoDB connection
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected!'))
  .catch((err) => console.error('MongoDB connection error:', err));

 
// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on http://10.10.10.2:${PORT}`);
}).on('error', (err) => {
  console.error('❌ Server failed to start:', err);
});