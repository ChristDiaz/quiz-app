// /home/christian/gpt-quiz-app/server/models/QuizAttempt.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const QuizAttemptSchema = new Schema({
    // Link to the user who took the quiz
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User', // Replace 'User' if your user model is named differently
        required: true,
        index: true
    },
    // Link to the quiz that was taken
    quizId: {
        type: Schema.Types.ObjectId,
        ref: 'Quiz', // Assumes your quiz model is named 'Quiz'
        required: true,
        index: true
    },
    // Store the quiz title at the time of taking
    quizTitle: {
        type: String,
        required: true
    },
    // Store the user's answers as a Map { questionIdString: answerString }
    answers: {
        type: Map,
        of: String,
        required: true
    },
    // Calculated score
    score: {
        type: Number,
        required: true
    },
    // Total number of questions in the quiz
    totalQuestions: {
        type: Number,
        required: true
    },
    // Timestamp when the quiz was completed/submitted
    completedAt: {
        type: Date,
        default: Date.now
    }
});

// Export the Mongoose model
module.exports = mongoose.model('QuizAttempt', QuizAttemptSchema);
