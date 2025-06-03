// /home/christian/gpt-quiz-app/server/routes/quizAttempts.js
const express = require('express');
const router = express.Router();
const QuizAttempt = require('../models/QuizAttempt'); // Adjust path if needed
const authMiddleware = require('../middleware/authMiddleware'); // Import auth middleware

// --- POST /api/quiz-attempts - Save a new quiz attempt ---
// Protected by authMiddleware
router.post('/', authMiddleware, async (req, res) => {
    try {
        // Ensure user ID is available from middleware
        if (!req.user || !req.user.id) {
             console.error("Save Attempt Error: User ID not found on request after auth middleware.");
             return res.status(401).json({ message: 'Authentication error.' });
        }
        const userId = req.user.id; // Get user ID from middleware

        // Destructure data from request body
        const {
            quizId,
            quizTitle,
            answers, // Expecting an object like { questionId1: answer1, questionId2: answer2 }
            score,
            totalQuestions
        } = req.body;

        // Basic validation
        if (!quizId || !quizTitle || answers === undefined || score === undefined || totalQuestions === undefined) {
            return res.status(400).json({ message: 'Missing required attempt data.' });
        }

        // Convert answers object to Map for schema compatibility
        // Ensure 'answers' is actually an object before trying Object.entries
        if (typeof answers !== 'object' || answers === null) {
             return res.status(400).json({ message: 'Invalid format for answers data.' });
        }
        const answersMap = new Map(Object.entries(answers));

        // Create a new QuizAttempt document
        const newAttempt = new QuizAttempt({
            userId, // Use the authenticated user's ID
            quizId,
            quizTitle,
            answers: answersMap,
            score,
            totalQuestions
            // completedAt defaults to now via schema
        });

        // Save the attempt to the database
        const savedAttempt = await newAttempt.save();

        // Respond with success message and the ID of the saved attempt
        res.status(201).json({ message: 'Quiz attempt saved successfully.', attemptId: savedAttempt._id });

    } catch (error) {
        console.error('Error saving quiz attempt:', error);
        // Handle potential validation errors from Mongoose
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: messages.join('. ') });
       }
        res.status(500).json({ message: 'Server error saving quiz attempt.' });
    }
});

// --- GET /api/quiz-attempts/my-attempts - Fetch attempts for logged-in user ---
// Protected by authMiddleware
router.get('/my-attempts', authMiddleware, async (req, res) => {
    try {
        // Ensure user ID is available from middleware
        if (!req.user || !req.user.id) {
            // This check is mostly redundant due to middleware, but good practice
            return res.status(401).json({ message: 'Authentication error.' });
        }
        const userId = req.user.id;

        // Find attempts for the user
        const attempts = await QuizAttempt.find({ userId: userId })
                                        .sort({ completedAt: -1 }) // Sort newest first
                                        .select('-answers -userId'); // Exclude answers map and userId

        // Send the array of attempts (will be empty if none found)
        res.status(200).json(attempts);

    } catch (error) {
        console.error('Error fetching user quiz attempts:', error);
        res.status(500).json({ message: 'Server error fetching quiz attempts.' });
    }
});

// You could add more routes here later, e.g., GET /api/quiz-attempts/:id to get details of a specific attempt

module.exports = router;
