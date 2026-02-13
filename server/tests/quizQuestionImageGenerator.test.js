process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.NODE_ENV = 'test';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

const fs = require('fs/promises');
const { attachGeneratedImagesToQuizQuestions } = require('../utils/quizQuestionImageGenerator');

describe('attachGeneratedImagesToQuizQuestions', () => {
  let originalFetch;
  let originalNodeEnv;
  let originalGenerateImagesFlag;
  let originalApiKey;
  let originalCropSelectorVersion;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = jest.fn();
    originalNodeEnv = process.env.NODE_ENV;
    originalGenerateImagesFlag = process.env.OPENAI_GENERATE_QUESTION_IMAGES;
    originalApiKey = process.env.OPENAI_API_KEY;
    originalCropSelectorVersion = process.env.OPENAI_CROP_SELECTOR_VERSION;
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.OPENAI_GENERATE_QUESTION_IMAGES = 'true';
    delete process.env.OPENAI_CROP_SELECTOR_VERSION;
    fs.mkdir.mockClear();
    fs.writeFile.mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.NODE_ENV = originalNodeEnv;
    process.env.OPENAI_GENERATE_QUESTION_IMAGES = originalGenerateImagesFlag;
    process.env.OPENAI_API_KEY = originalApiKey;
    if (typeof originalCropSelectorVersion === 'undefined') {
      delete process.env.OPENAI_CROP_SELECTOR_VERSION;
    } else {
      process.env.OPENAI_CROP_SELECTOR_VERSION = originalCropSelectorVersion;
    }
    jest.clearAllMocks();
  });

  it('assigns cropped PDF images to image-based questions when candidates are available', async () => {
    process.env.NODE_ENV = 'test';

    const quiz = {
      title: 'Fiber Optics',
      description: 'Connector inspection',
      questions: [
        {
          questionType: 'image-based',
          questionText: 'What defect is visible near the core?',
          options: ['Scratch', 'Clean'],
          correctAnswer: 'Scratch',
          sourcePage: 2,
          imageUrl: '/generated-media/pdf-pages/test-job/page-2.png',
        },
      ],
    };

    const result = await attachGeneratedImagesToQuizQuestions(quiz, {
      pdfImageCandidates: [
        {
          url: '/generated-media/pdf-pages/test-job/page-2-crop-1.png',
          pageNumber: 2,
          width: 420,
          height: 320,
          area: 134400,
        },
      ],
    });

    expect(result.assignedPdfCropCount).toBe(1);
    expect(result.attemptedPdfCropCount).toBe(1);
    expect(result.quiz.questions[0].imageUrl).toBe('/generated-media/pdf-pages/test-job/page-2-crop-1.png');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(fs.mkdir).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('promotes one multiple-choice question to image-based when crops exist but model returned none', async () => {
    process.env.NODE_ENV = 'test';

    const quiz = {
      title: 'Fiber Optics',
      description: 'Connector handling',
      questions: [
        {
          questionType: 'multiple-choice',
          questionText: 'What is the correct sequence before mating?',
          options: ['Inspect -> Clean -> Connect', 'Connect -> Inspect -> Clean'],
          correctAnswer: 'Inspect -> Clean -> Connect',
        },
      ],
    };

    const result = await attachGeneratedImagesToQuizQuestions(quiz, {
      pdfImageCandidates: [
        {
          url: '/generated-media/pdf-pages/test-job/page-6-crop-1.png',
          pageNumber: 6,
          sourceType: 'image-object',
          width: 500,
          height: 320,
          area: 160000,
          areaRatio: 0.32,
          pageText: 'inspect clean connect',
          contextText: 'inspect clean connect',
        },
      ],
    });

    expect(result.promotedImageQuestionCount).toBe(1);
    expect(result.assignedPdfCropCount).toBe(1);
    expect(result.quiz.questions[0].questionType).toBe('image-based');
    expect(result.quiz.questions[0].imageUrl).toBe('/generated-media/pdf-pages/test-job/page-6-crop-1.png');
    expect(result.quiz.questions[0].sourcePage).toBe(6);
  });

  it('does not promote multiple-choice questions when legacy selector v1 is enabled', async () => {
    process.env.NODE_ENV = 'test';
    process.env.OPENAI_CROP_SELECTOR_VERSION = 'v1';

    const quiz = {
      title: 'Fiber Optics',
      description: 'Connector handling',
      questions: [
        {
          questionType: 'multiple-choice',
          questionText: 'What is the correct sequence before mating?',
          options: ['Inspect -> Clean -> Connect', 'Connect -> Inspect -> Clean'],
          correctAnswer: 'Inspect -> Clean -> Connect',
        },
      ],
    };

    const result = await attachGeneratedImagesToQuizQuestions(quiz, {
      pdfImageCandidates: [
        {
          url: '/generated-media/pdf-pages/test-job/page-6-crop-1.png',
          pageNumber: 6,
          sourceType: 'image-object',
          width: 500,
          height: 320,
          area: 160000,
          areaRatio: 0.32,
          pageText: 'inspect clean connect',
          contextText: 'inspect clean connect',
        },
      ],
    });

    expect(result.cropSelectorVersion).toBe('v1');
    expect(result.promotedImageQuestionCount).toBe(0);
    expect(result.assignedPdfCropCount).toBe(0);
    expect(result.attemptedPdfCropCount).toBe(0);
    expect(result.quiz.questions[0].questionType).toBe('multiple-choice');
    expect(result.quiz.questions[0].imageUrl).toBeUndefined();
  });

  it('prefers crops from the page whose text best matches the question', async () => {
    process.env.NODE_ENV = 'test';

    const quiz = {
      title: 'Fiber Optics',
      description: 'Study quiz',
      questions: [
        {
          questionType: 'image-based',
          questionText: 'Which unit of competency includes inspect clean and handle optical fibre cable and connectors?',
          options: ['ICTCBL322', 'ICTTEN318'],
          correctAnswer: 'ICTTEN318',
          sourcePage: 1,
          imageUrl: '/generated-media/pdf-pages/test-job/page-1.png',
        },
      ],
    };

    const result = await attachGeneratedImagesToQuizQuestions(quiz, {
      pdfImageCandidates: [
        {
          url: '/generated-media/pdf-pages/test-job/page-1-crop-1.png',
          pageNumber: 1,
          width: 500,
          height: 300,
          area: 150000,
          areaRatio: 0.35,
          pageText: 'Learner guide cover page',
          contextText: 'Learner guide',
        },
        {
          url: '/generated-media/pdf-pages/test-job/page-8-crop-1.png',
          pageNumber: 8,
          width: 500,
          height: 300,
          area: 150000,
          areaRatio: 0.35,
          pageText: 'ICTTEN318 inspect clean and handle optical fibre cable and connectors',
          contextText: 'ICTTEN318 inspect clean and handle optical fibre cable and connectors',
        },
      ],
    });

    expect(result.assignedPdfCropCount).toBe(1);
    expect(result.quiz.questions[0].imageUrl).toBe('/generated-media/pdf-pages/test-job/page-8-crop-1.png');
    expect(result.quiz.questions[0].sourcePage).toBe(8);
  });

  it('can override an incorrect sourcePage using better crop context from another page', async () => {
    process.env.NODE_ENV = 'test';

    const quiz = {
      title: 'Fiber Optics',
      description: 'Study quiz',
      questions: [
        {
          questionType: 'image-based',
          questionText: 'Which label shows inspect then connect and if not clean then inspect again before mating?',
          options: [
            'Inspect -> Connect / if not clean then inspect again',
            'Connect -> Inspect -> Clean',
          ],
          correctAnswer: 'Inspect -> Connect / if not clean then inspect again',
          sourcePage: 1,
          imageUrl: '/generated-media/pdf-pages/test-job/page-1-crop-1.png',
        },
      ],
    };

    const result = await attachGeneratedImagesToQuizQuestions(quiz, {
      pdfImageCandidates: [
        {
          url: '/generated-media/pdf-pages/test-job/page-1-crop-1.png',
          pageNumber: 1,
          width: 520,
          height: 340,
          area: 176800,
          areaRatio: 0.38,
          pageText: '',
          contextText: 'Learner guide cover',
        },
        {
          url: '/generated-media/pdf-pages/test-job/page-6-crop-2.png',
          pageNumber: 6,
          width: 520,
          height: 340,
          area: 176800,
          areaRatio: 0.38,
          pageText: '',
          contextText: 'Inspect clean connect before mating process flow',
        },
      ],
    });

    expect(result.assignedPdfCropCount).toBe(1);
    expect(result.quiz.questions[0].imageUrl).toBe('/generated-media/pdf-pages/test-job/page-6-crop-2.png');
    expect(result.quiz.questions[0].sourcePage).toBe(6);
  });

  it('avoids table-of-contents text crops for visual cue questions when a non-toc image candidate exists', async () => {
    process.env.NODE_ENV = 'test';

    const quiz = {
      title: 'Fiber Optics',
      description: 'Study quiz',
      questions: [
        {
          questionType: 'image-based',
          questionText: 'Look at the image showing the inspection and cleaning flow. What is the correct sequence?',
          options: ['Inspect -> Clean -> Connect', 'Connect -> Inspect -> Clean'],
          correctAnswer: 'Inspect -> Clean -> Connect',
          sourcePage: 8,
        },
      ],
    };

    const result = await attachGeneratedImagesToQuizQuestions(quiz, {
      pdfImageCandidates: [
        {
          url: '/generated-media/pdf-pages/test-job/page-8-crop-1.png',
          pageNumber: 8,
          sourceType: 'text-block',
          width: 900,
          height: 220,
          area: 198000,
          areaRatio: 0.13,
          pageText: '11.1 Cleaning Procedure ... 60 11.1.1 Fibre Connector End-Face Inspection Zones ... 61',
          contextText: '11.1 Cleaning Procedure for Fibre Connectors and Adapters .... 60 11.1.1 Fibre Connector End-Face Inspection Zones ... 61',
        },
        {
          url: '/generated-media/pdf-pages/test-job/page-9-crop-2.png',
          pageNumber: 9,
          sourceType: 'image-object',
          width: 620,
          height: 410,
          area: 254200,
          areaRatio: 0.18,
          pageText: 'Inspect clean connect before mating process flow',
          contextText: 'Inspect clean connect process',
        },
      ],
    });

    expect(result.assignedPdfCropCount).toBe(1);
    expect(result.quiz.questions[0].imageUrl).toBe('/generated-media/pdf-pages/test-job/page-9-crop-2.png');
    expect(result.quiz.questions[0].sourcePage).toBe(9);
  });

  it('prefers non-toc image-object crops over toc-like text crops for visual cue questions', async () => {
    process.env.NODE_ENV = 'test';

    const quiz = {
      title: 'Fiber Optics',
      description: 'Study quiz',
      questions: [
        {
          questionType: 'image-based',
          questionText: 'Refer to the image. Which workflow step is mandatory before connector mating?',
          options: ['Inspect', 'Connect'],
          correctAnswer: 'Inspect',
          sourcePage: 8,
        },
      ],
    };

    const result = await attachGeneratedImagesToQuizQuestions(quiz, {
      pdfImageCandidates: [
        {
          url: '/generated-media/pdf-pages/test-job/page-8-crop-1.png',
          pageNumber: 8,
          sourceType: 'text-block',
          width: 900,
          height: 220,
          area: 198000,
          areaRatio: 0.13,
          pageText: '11.1 Cleaning Procedure ... 60 11.1.1 Fibre Connector End-Face Inspection Zones ... 61',
          contextText: '11.1 Cleaning Procedure for Fibre Connectors and Adapters .... 60 11.1.1 Fibre Connector End-Face Inspection Zones ... 61',
        },
        {
          url: '/generated-media/pdf-pages/test-job/page-10-crop-2.png',
          pageNumber: 10,
          sourceType: 'image-object',
          width: 620,
          height: 410,
          area: 254200,
          areaRatio: 0.18,
          pageText: 'fibre connector handling workflow',
          contextText: 'workflow',
        },
      ],
    });

    expect(result.assignedPdfCropCount).toBe(1);
    expect(result.quiz.questions[0].imageUrl).toBe('/generated-media/pdf-pages/test-job/page-10-crop-2.png');
    expect(result.quiz.questions[0].sourcePage).toBe(10);
  });

  it('can prefer a non-toc text-block crop for table questions when image-object crop is too small', async () => {
    process.env.NODE_ENV = 'test';

    const quiz = {
      title: 'Fibre Standards',
      description: 'Bending radius tables',
      questions: [
        {
          questionType: 'image-based',
          questionText: "Using the table shown in the image, which cable OD corresponds to a 75 mm minimum bending radius?",
          options: ['6.0 mm', '7.5 mm', '10.0 mm', '12.0 mm'],
          correctAnswer: '7.5 mm',
          sourcePage: 80,
        },
      ],
    };

    const result = await attachGeneratedImagesToQuizQuestions(quiz, {
      pdfImageCandidates: [
        {
          url: '/generated-media/pdf-pages/test-job/page-80-crop-1.png',
          pageNumber: 80,
          sourceType: 'image-object',
          width: 220,
          height: 120,
          area: 26400,
          areaRatio: 0.012,
          pageText: 'minimum bending radius 12 core optical fibre cable',
          contextText: 'Minimum Bending Radius – 12 Core Optical Fibre Cable',
        },
        {
          url: '/generated-media/pdf-pages/test-job/page-80-crop-2.png',
          pageNumber: 80,
          sourceType: 'text-block',
          width: 740,
          height: 360,
          area: 266400,
          areaRatio: 0.14,
          pageText: 'minimum bending radius table no load cable OD',
          contextText: 'Table 16 Minimum Bending Radius – 12 Core Optical Fibre Cable No Load Cable OD',
        },
      ],
    });

    expect(result.assignedPdfCropCount).toBe(1);
    expect(result.quiz.questions[0].imageUrl).toBe('/generated-media/pdf-pages/test-job/page-80-crop-2.png');
    expect(result.quiz.questions[0].sourcePage).toBe(80);
  });

  it('uses legacy selector v1 to prefer image-object crops for visual cue questions', async () => {
    process.env.NODE_ENV = 'test';
    process.env.OPENAI_CROP_SELECTOR_VERSION = 'v1';

    const quiz = {
      title: 'Fibre Standards',
      description: 'Bending radius tables',
      questions: [
        {
          questionType: 'image-based',
          questionText: "Using the table shown in the image, which cable OD corresponds to a 75 mm minimum bending radius?",
          options: ['6.0 mm', '7.5 mm', '10.0 mm', '12.0 mm'],
          correctAnswer: '7.5 mm',
          sourcePage: 80,
        },
      ],
    };

    const result = await attachGeneratedImagesToQuizQuestions(quiz, {
      pdfImageCandidates: [
        {
          url: '/generated-media/pdf-pages/test-job/page-80-crop-1.png',
          pageNumber: 80,
          sourceType: 'image-object',
          width: 220,
          height: 120,
          area: 26400,
          areaRatio: 0.012,
          pageText: 'minimum bending radius 12 core optical fibre cable',
          contextText: 'Minimum Bending Radius – 12 Core Optical Fibre Cable',
        },
        {
          url: '/generated-media/pdf-pages/test-job/page-80-crop-2.png',
          pageNumber: 80,
          sourceType: 'text-block',
          width: 740,
          height: 360,
          area: 266400,
          areaRatio: 0.14,
          pageText: 'minimum bending radius table no load cable OD',
          contextText: 'Table 16 Minimum Bending Radius – 12 Core Optical Fibre Cable No Load Cable OD',
        },
      ],
    });

    expect(result.cropSelectorVersion).toBe('v1');
    expect(result.assignedPdfCropCount).toBe(1);
    expect(result.quiz.questions[0].imageUrl).toBe('/generated-media/pdf-pages/test-job/page-80-crop-1.png');
    expect(result.quiz.questions[0].sourcePage).toBe(80);
  });

  it('generates fallback images only when explicitly enabled in non-test environments', async () => {
    process.env.NODE_ENV = 'development';
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        data: [{ b64_json: Buffer.from('fake-image-bytes').toString('base64') }],
      }),
    });

    const quiz = {
      title: 'Fiber Optics',
      description: 'Connector inspection',
      questions: [
        {
          questionType: 'image-based',
          questionText: 'What defect is visible near the core?',
          options: ['Scratch', 'Clean'],
          correctAnswer: 'Scratch',
          imageUrl: '/generated-media/pdf-pages/test-job/page-2.png',
        },
      ],
    };

    const result = await attachGeneratedImagesToQuizQuestions(quiz);

    expect(result.generatedImageCount).toBe(1);
    expect(result.attemptedImageCount).toBe(1);
    expect(result.quiz.questions[0].imageUrl).toMatch(
      /^\/generated-media\/quiz-images\/.+\/question-1\.png$/
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(fs.mkdir).toHaveBeenCalledTimes(1);
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
  });

  it('skips image generation by default when flag is not true', async () => {
    process.env.NODE_ENV = 'development';
    process.env.OPENAI_GENERATE_QUESTION_IMAGES = 'false';

    const quiz = {
      title: 'Test',
      description: 'Test',
      questions: [
        {
          questionType: 'image-based',
          questionText: 'Sample?',
          options: ['A', 'B'],
          correctAnswer: 'A',
          imageUrl: '',
        },
      ],
    };

    const result = await attachGeneratedImagesToQuizQuestions(quiz);

    expect(result.generatedImageCount).toBe(0);
    expect(result.attemptedImageCount).toBe(0);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(fs.mkdir).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
  });
});
