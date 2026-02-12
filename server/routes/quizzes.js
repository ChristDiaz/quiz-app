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
const { extractPdfVisualAssets } = require('../utils/pdfImageExtractor');
const { attachGeneratedImagesToQuizQuestions } = require('../utils/quizQuestionImageGenerator');
const {
  generateQuizFromDocument,
  MIN_QUESTION_COUNT,
  MAX_QUESTION_COUNT,
} = require('../utils/aiQuizGenerator');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});
const DEFAULT_IMAGE_REFERENCE_LIMIT = 40;

const generateQuizLimiter = process.env.NODE_ENV === 'test'
  ? (req, res, next) => next()
  : rateLimit({
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

const parsePageNumberFromImageUrl = (imageUrl) => {
  const match = typeof imageUrl === 'string' ? imageUrl.match(/page-(\d+)\.png$/) : null;
  if (!match) {
    return null;
  }

  const pageNumber = Number.parseInt(match[1], 10);
  if (Number.isNaN(pageNumber) || pageNumber <= 0) {
    return null;
  }

  return pageNumber;
};

const buildImageReferencesFromPageImages = (imageUrls = []) =>
  imageUrls
    .map((imageUrl) => {
      const pageNumber = parsePageNumberFromImageUrl(imageUrl);
      if (!pageNumber) {
        return null;
      }
      return { url: imageUrl, pageNumber };
    })
    .filter(Boolean);

const parsePositiveInteger = (rawValue, fallbackValue) => {
  const parsedValue = Number.parseInt(rawValue, 10);
  if (Number.isNaN(parsedValue) || parsedValue <= 0) {
    return fallbackValue;
  }
  return parsedValue;
};

const sampleEvenly = (items, maxItems) => {
  if (!Array.isArray(items) || maxItems <= 0) {
    return [];
  }

  if (items.length <= maxItems) {
    return [...items];
  }

  const selected = [];
  let previousIndex = -1;
  const step = (items.length - 1) / Math.max(1, maxItems - 1);

  for (let slot = 0; slot < maxItems; slot += 1) {
    const rawIndex = Math.round(slot * step);
    const normalizedIndex = Math.min(
      items.length - 1,
      Math.max(previousIndex + 1, rawIndex)
    );
    selected.push(items[normalizedIndex]);
    previousIndex = normalizedIndex;
  }

  return selected;
};

const buildImageReferencesForPrompt = (imageCandidates = [], maxReferences = DEFAULT_IMAGE_REFERENCE_LIMIT) => {
  if (!Array.isArray(imageCandidates) || imageCandidates.length === 0 || maxReferences <= 0) {
    return [];
  }

  const normalizedCandidates = imageCandidates
    .map((candidate) => {
      const imageUrl = typeof candidate?.url === 'string' ? candidate.url : '';
      const pageNumber = Number.parseInt(candidate?.pageNumber, 10);
      if (!imageUrl || Number.isNaN(pageNumber) || pageNumber <= 0) {
        return null;
      }

      return {
        url: imageUrl,
        pageNumber,
        contextText: typeof candidate?.contextText === 'string' ? candidate.contextText : '',
        sourceType: candidate?.sourceType === 'image-object' ? 'image-object' : 'text-block',
        area: Number(candidate?.area) || 0,
      };
    })
    .filter(Boolean);

  if (normalizedCandidates.length === 0) {
    return [];
  }

  const candidatesByPage = new Map();
  normalizedCandidates.forEach((candidate) => {
    const existingCandidates = candidatesByPage.get(candidate.pageNumber) || [];
    existingCandidates.push(candidate);
    candidatesByPage.set(candidate.pageNumber, existingCandidates);
  });

  const pageGroups = Array.from(candidatesByPage.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([pageNumber, candidates]) => ({
      pageNumber,
      nextIndex: 0,
      candidates: candidates.sort((left, right) => {
        if (left.sourceType !== right.sourceType) {
          return left.sourceType === 'image-object' ? -1 : 1;
        }
        if (left.area !== right.area) {
          return right.area - left.area;
        }
        return (right.contextText || '').length - (left.contextText || '').length;
      }),
    }));

  const selectedPageGroups = sampleEvenly(pageGroups, Math.min(pageGroups.length, maxReferences));
  const selectedReferences = [];
  const selectedUrls = new Set();
  let selectedAny = true;

  while (selectedReferences.length < maxReferences && selectedAny) {
    selectedAny = false;

    for (const group of selectedPageGroups) {
      if (selectedReferences.length >= maxReferences) {
        break;
      }

      const candidate = group.candidates[group.nextIndex];
      group.nextIndex += 1;
      if (!candidate || selectedUrls.has(candidate.url)) {
        continue;
      }

      selectedUrls.add(candidate.url);
      selectedReferences.push({
        url: candidate.url,
        pageNumber: candidate.pageNumber,
        contextText: candidate.contextText,
      });
      selectedAny = true;
    }
  }

  return selectedReferences;
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

    // Clean options for question types that do not use options
    questions.forEach((q) => {
      if (q.questionType !== 'multiple-choice' && q.questionType !== 'image-based') {
        q.options = undefined;
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
      let pdfImageUrls = [];
      let pdfImageCandidates = [];
      let availableImageReferences = [];

      if (!isPdfDocument) {
        documentText = await extractTextFromDocument(req.file);
        if (!documentText || !documentText.trim()) {
          return res.status(400).json({ message: 'The uploaded document does not contain readable text.' });
        }
      } else {
        try {
          const visualAssets = await extractPdfVisualAssets(req.file.buffer);
          pdfImageUrls = visualAssets.pageImageUrls;
          pdfImageCandidates = visualAssets.imageCandidates;
          const promptImageReferenceLimit = parsePositiveInteger(
            process.env.OPENAI_IMAGE_REFERENCE_LIMIT,
            DEFAULT_IMAGE_REFERENCE_LIMIT
          );
          availableImageReferences = buildImageReferencesForPrompt(
            pdfImageCandidates,
            promptImageReferenceLimit
          );

          if (availableImageReferences.length === 0) {
            availableImageReferences = buildImageReferencesFromPageImages(pdfImageUrls);
          }
        } catch (pdfImageError) {
          console.warn('Unable to extract PDF page images:', pdfImageError.message);
          pdfImageUrls = [];
          pdfImageCandidates = [];
          availableImageReferences = [];
        }
      }

      const availableImageUrls = pdfImageCandidates.length > 0
        ? pdfImageCandidates.map((candidate) => candidate.url)
        : pdfImageUrls;

      const generationResult = await generateQuizFromDocument({
        documentText,
        questionCount: rawQuestionCount,
        fileName: req.file.originalname,
        documentBuffer: req.file.buffer,
        mimeType: req.file.mimetype,
        availableImageUrls,
        availableImageReferences,
      });
      const imageAttachmentResult = await attachGeneratedImagesToQuizQuestions(generationResult.quiz, {
        pdfImageCandidates,
      });

      return res.status(200).json({
        message: 'Quiz generated successfully.',
        quiz: imageAttachmentResult.quiz,
        metadata: {
          model: generationResult.model,
          wasSourceTruncated: generationResult.wasSourceTruncated,
          usedPdfInput: generationResult.usedPdfInput,
          availableImageCount: generationResult.availableImageCount,
          availablePdfCropCount: pdfImageCandidates.length,
          assignedPdfCropCount: imageAttachmentResult.assignedPdfCropCount,
          attemptedPdfCropCount: imageAttachmentResult.attemptedPdfCropCount,
          generatedImageCount: imageAttachmentResult.generatedImageCount,
          attemptedImageCount: imageAttachmentResult.attemptedImageCount,
          imageGenerationModel: imageAttachmentResult.imageGenerationModel,
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

    // Clean options for question types that do not use options
    questions.forEach((q) => {
      if (q.questionType !== 'multiple-choice' && q.questionType !== 'image-based') {
        q.options = undefined;
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

    const usesOptions = question.questionType === 'multiple-choice' || question.questionType === 'image-based';
    if (usesOptions && question.options.length === 0) {
      question.options = ['New Option'];
    }
    if (!usesOptions) {
      question.options = undefined;
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
