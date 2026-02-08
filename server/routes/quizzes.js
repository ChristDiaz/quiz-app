const express = require('express');
const router = express.Router();
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const Quiz = require('../models/Quiz');
const authMiddleware = require('../middleware/authMiddleware');
const validateFields = require('../middleware/validateFields');
const {
  extractTextFromDocument,
  MAX_UPLOAD_BYTES,
  SUPPORTED_DOCUMENT_MESSAGE,
} = require('../utils/documentTextExtractor');
const {
  generateQuizFromDocument,
  MIN_QUESTION_COUNT,
  MAX_QUESTION_COUNT,
} = require('../utils/aiQuizGenerator');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

const generateQuizLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many quiz generation requests. Please wait a minute and try again.',
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadDocument = (req, res, next) => {
  upload.single('document')(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        message: `Document is too large. Maximum size is ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}MB.`,
      });
    }

    return res.status(400).json({ message: 'Invalid document upload request.' });
  });
};

const isPdfUpload = (file) => {
  if (!file) {
    return false;
  }

  const mimeType = (file.mimetype || '').toLowerCase();
  const fileName = (file.originalname || '').toLowerCase();
  return mimeType === 'application/pdf' || fileName.endsWith('.pdf');
};

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

// POST /api/quizzes/generate-from-document - Build quiz draft from uploaded document
router.post(
  '/generate-from-document',
  authMiddleware,
  generateQuizLimiter,
  uploadDocument,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: `Please upload a document file. ${SUPPORTED_DOCUMENT_MESSAGE}`,
        });
      }

      const rawQuestionCount = req.body?.questionCount;
      if (rawQuestionCount !== undefined && typeof rawQuestionCount !== 'string') {
        return res.status(400).json({
          message: `questionCount must be provided as a string value between ${MIN_QUESTION_COUNT} and ${MAX_QUESTION_COUNT}.`,
        });
      }

      const isPdfDocument = isPdfUpload(req.file);
      let documentText = '';

      if (!isPdfDocument) {
        documentText = await extractTextFromDocument(req.file);
        if (!documentText || !documentText.trim()) {
          return res.status(400).json({ message: 'The uploaded document does not contain readable text.' });
        }
      }

      const generationResult = await generateQuizFromDocument({
        documentText,
        questionCount: rawQuestionCount,
        fileName: req.file.originalname,
        documentBuffer: req.file.buffer,
        mimeType: req.file.mimetype,
      });

      return res.status(200).json({
        message: 'Quiz generated successfully.',
        quiz: generationResult.quiz,
        metadata: {
          model: generationResult.model,
          wasSourceTruncated: generationResult.wasSourceTruncated,
          usedPdfInput: generationResult.usedPdfInput,
        },
      });
    } catch (error) {
      if (error.code === 'UNSUPPORTED_FILE_TYPE' || error.code === 'INVALID_FILE' || error.code === 'INVALID_INPUT') {
        return res.status(400).json({ message: error.message });
      }

      if (error.code === 'MISSING_API_KEY') {
        return res.status(500).json({ message: 'Server is missing OpenAI configuration.' });
      }

      if (error.code === 'UPSTREAM_NETWORK_ERROR') {
        console.error('OpenAI network error while generating quiz:', error.message);
        return res.status(502).json({ message: 'Could not reach OpenAI. Please try again in a moment.' });
      }

      if (error.code === 'UPSTREAM_REQUEST_FAILED') {
        console.error('OpenAI request failed while generating quiz:', {
          status: error.httpStatus,
          message: error.upstreamMessage || error.message,
        });

        if (error.httpStatus === 401 || error.httpStatus === 403) {
          return res.status(502).json({ message: 'OpenAI authentication failed. Check OPENAI_API_KEY.' });
        }

        if (error.httpStatus === 429) {
          return res.status(502).json({ message: 'OpenAI rate limit or quota reached. Try again later.' });
        }

        if (error.httpStatus === 400) {
          return res.status(502).json({
            message: `OpenAI rejected the generation request: ${error.upstreamMessage || 'Invalid request.'}`,
          });
        }

        return res.status(502).json({ message: 'OpenAI failed to generate quiz content. Please try again.' });
      }

      if (error.code === 'INVALID_OUTPUT') {
        console.error('OpenAI returned invalid output while generating quiz:', error.message);
        return res.status(502).json({
          message: 'OpenAI returned unexpected output. Try again or change OPENAI_MODEL.',
        });
      }

      console.error('Error generating quiz from document:', error);
      return res.status(500).json({ message: 'Server error while generating quiz.' });
    }
  }
);

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
