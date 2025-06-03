const express = require('express');
const router = express.Router();
const Quiz = require('../models/Quiz');
const validateFields = require('../middleware/validateFields');

// POST /api/quizzes - Create a new quiz
router.post(
  '/',
  validateFields(
    ['title', 'description', 'questions'],
    { title: 'string', description: 'string', questions: 'array' }
  ),
  async (req, res) => {
  try {
    const { title, description, questions } = req.body;
    // Trim title and description
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();

    // Clean options for non-multiple-choice questions
    questions.forEach((q) => {
      if (q.questionType !== 'multiple-choice') {
        q.options = undefined; // Remove options for non-multiple-choice questions
      }
    });

    questions.forEach((q) => {
      if (q.options && Array.isArray(q.options)) {
        q.options = q.options
          .map(opt => typeof opt === 'string' ? opt.trim() : opt)
          .filter(opt => opt !== '');
        if (q.options.length === 0) {
          q.options = ['New Option'];
        }
      }
    });

    const newQuiz = new Quiz({
      title: cleanTitle,
      description: cleanDescription,
      questions,
    });

    const savedQuiz = await newQuiz.save();
    res.status(201).json({ message: 'Quiz created successfully', quiz: savedQuiz });
  } catch (error) {
    console.error('Error creating quiz:', error);
    res.status(500).json({ message: 'Server error while creating quiz' });
  }
});

// GET /api/quizzes - Fetch all quizzes
router.get('/', async (req, res) => {
  try {
    const quizzes = await Quiz.find().sort({ createdAt: -1 }); // Newest first
    res.json(quizzes);
  } catch (error) {
    console.error('Error fetching quizzes:', error);
    res.status(500).json({ message: 'Server error while fetching quizzes' });
  }
});

// GET /api/quizzes/:id - Fetch a single quiz
router.get('/:id', async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    res.json(quiz);
  } catch (error) {
    console.error('Error fetching quiz:', error);
    res.status(500).json({ message: 'Server error while fetching quiz' });
  }
});

// PUT /api/quizzes/:id - Update an existing quiz
router.put(
  '/:id',
  validateFields(
    ['title', 'description', 'questions'],
    { title: 'string', description: 'string', questions: 'array' }
  ),
  async (req, res) => {
  try {
    const { title, description, questions } = req.body;
    // Trim title and description
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();

    // Clean options for non-multiple-choice questions
    questions.forEach((q) => {
      if (q.questionType !== 'multiple-choice') {
        q.options = undefined; // Remove options for non-multiple-choice questions
      }
    });

    questions.forEach((q) => {
      if (q.options && Array.isArray(q.options)) {
        q.options = q.options
          .map(opt => typeof opt === 'string' ? opt.trim() : opt)
          .filter(opt => opt !== '');
        if (q.options.length === 0) {
          q.options = ['New Option'];
        }
      }
    });

    const updatedQuiz = await Quiz.findByIdAndUpdate(req.params.id, {
      title: cleanTitle,
      description: cleanDescription,
      questions,
    }, { new: true });

    if (!updatedQuiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    res.json({ message: 'Quiz updated successfully', quiz: updatedQuiz });
  } catch (error) {
    console.error('Error updating quiz:', error);
    res.status(500).json({ message: 'Server error while updating quiz' });
  }
});

// PUT /api/quizzes/:quizId/questions/:questionId - Update a single question inside a quiz
router.put(
  '/:quizId/questions/:questionId',
  validateFields(
    ['questionText', 'questionType', 'options', 'correctAnswer', 'imageUrl'],
    {
      questionText: 'string',
      questionType: 'string',
      options: 'array',
      correctAnswer: 'string',
      imageUrl: 'string'
    }
  ),
  async (req, res) => {
  try {
    const { quizId, questionId } = req.params;
    const updatedQuestionData = req.body;

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    const question = quiz.questions.id(questionId);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    question.set({
      questionText: updatedQuestionData.questionText?.trim() || question.questionText,
      questionType: updatedQuestionData.questionType?.trim() || question.questionType,
      correctAnswer: updatedQuestionData.correctAnswer?.trim() || question.correctAnswer,
      imageUrl: updatedQuestionData.imageUrl?.trim() || question.imageUrl,
      options: Array.isArray(updatedQuestionData.options)
        ? updatedQuestionData.options.map(opt => typeof opt === 'string' ? opt.trim() : opt).filter(opt => opt !== '')
        : question.options
    });

    if (question.options.length === 0) {
      question.options = ['New Option'];
    }

    quiz.markModified('questions');
    await quiz.save();

    res.status(200).json({
      message: 'Question updated successfully',
      updatedQuestion: question
    });
  } catch (error) {
    console.error('Error updating question:', error);
    res.status(500).json({ message: 'Server error while updating question' });
  }
});

// DELETE /api/quizzes/:id - Delete a quiz
router.delete('/:id', async (req, res) => {
  try {
    const deletedQuiz = await Quiz.findByIdAndDelete(req.params.id);
    if (!deletedQuiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    res.json({ message: 'Quiz deleted successfully' });
  } catch (error) {
    console.error('Error deleting quiz:', error);
    res.status(500).json({ message: 'Server error while deleting quiz' });
  }
});

module.exports = router;