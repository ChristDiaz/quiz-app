const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionType: {
    type: String,
    enum: ['multiple-choice', 'true-false', 'fill-in-the-blank', 'image-based'],
    required: true,
    default: 'multiple-choice',
  },
  questionText: { type: String, required: true },
  options: [{ type: String }],
  correctAnswer: { type: String, required: true },
  imageUrl: { type: String },
});

const quizSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  questions: [questionSchema],
}, { timestamps: true });

module.exports = mongoose.model('Quiz', quizSchema);