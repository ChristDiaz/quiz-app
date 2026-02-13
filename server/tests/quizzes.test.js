process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

jest.mock('../models/Quiz', () => {
  const MockQuiz = jest.fn();
  MockQuiz.findById = jest.fn();
  MockQuiz.find = jest.fn();
  return MockQuiz;
});

jest.mock('../utils/aiQuizMetadataGenerator', () => ({
  generateMergedQuizMetadata: jest.fn(),
}));

const request = require('supertest');
const Quiz = require('../models/Quiz');
const { generateMergedQuizMetadata } = require('../utils/aiQuizMetadataGenerator');
const app = require('../index');

afterEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/quizzes/merge', () => {
  it('returns 400 when fewer than two quizzes are selected', async () => {
    const res = await request(app).post('/api/quizzes/merge').send({
      quizIds: ['507f191e810c19729de860ea'],
    });

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual(
      expect.objectContaining({
        message: 'Select at least 2 quizzes to merge.',
      })
    );
    expect(Quiz.find).not.toHaveBeenCalled();
  });

  it('returns 404 when one or more selected quizzes are missing', async () => {
    const quizIds = ['507f191e810c19729de860ea', '507f191e810c19729de860eb'];
    Quiz.find.mockResolvedValue([
      {
        _id: quizIds[0],
        title: 'Quiz A',
        description: 'Only one quiz returned.',
        questions: [],
      },
    ]);

    const res = await request(app).post('/api/quizzes/merge').send({ quizIds });

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual(
      expect.objectContaining({
        message: 'One or more selected quizzes were not found.',
      })
    );
    expect(generateMergedQuizMetadata).not.toHaveBeenCalled();
  });

  it('merges quizzes and creates a new quiz with AI-generated metadata', async () => {
    const quizIds = ['507f191e810c19729de860ea', '507f191e810c19729de860eb'];
    const sourceQuizzes = [
      {
        _id: quizIds[0],
        title: 'Cell Biology',
        description: 'Core cell structure concepts.',
        questions: [
          {
            questionType: 'multiple-choice',
            questionText: 'What is DNA?',
            options: ['A molecule', 'An organelle'],
            correctAnswer: 'A molecule',
          },
        ],
      },
      {
        _id: quizIds[1],
        title: 'Basic Chemistry',
        description: 'Atoms and matter fundamentals.',
        questions: [
          {
            questionType: 'true-false',
            questionText: 'Atoms are the basic units of matter.',
            correctAnswer: 'true',
          },
        ],
      },
    ];

    Quiz.find.mockResolvedValue(sourceQuizzes);
    generateMergedQuizMetadata.mockResolvedValue({
      title: 'Biology and Chemistry Foundations',
      description: 'Review core ideas in cell biology and basic chemistry.',
    });

    const savedQuiz = {
      _id: '507f191e810c19729de860ff',
      title: 'Biology and Chemistry Foundations',
      description: 'Review core ideas in cell biology and basic chemistry.',
      questions: [
        {
          questionType: 'multiple-choice',
          questionText: 'What is DNA?',
          options: ['A molecule', 'An organelle'],
          correctAnswer: 'A molecule',
        },
        {
          questionType: 'true-false',
          questionText: 'Atoms are the basic units of matter.',
          correctAnswer: 'True',
        },
      ],
    };

    const save = jest.fn().mockResolvedValue(savedQuiz);
    Quiz.mockImplementationOnce((payload) => ({ ...payload, save }));

    const res = await request(app).post('/api/quizzes/merge').send({ quizIds });

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        message: 'Quizzes merged successfully.',
        quiz: savedQuiz,
        metadata: expect.objectContaining({
          ignoredDuplicateQuestionCount: 0,
        }),
      })
    );
    expect(generateMergedQuizMetadata).toHaveBeenCalledTimes(1);
    expect(generateMergedQuizMetadata).toHaveBeenCalledWith(sourceQuizzes);
    expect(Quiz.find).toHaveBeenCalledWith({ _id: { $in: quizIds } });
    expect(Quiz).toHaveBeenCalledTimes(1);
    expect(Quiz).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Biology and Chemistry Foundations',
        description: 'Review core ideas in cell biology and basic chemistry.',
      })
    );
  });

  it('ignores duplicated questions during merge and returns duplicate count', async () => {
    const quizIds = ['507f191e810c19729de860ea', '507f191e810c19729de860eb'];
    const sourceQuizzes = [
      {
        _id: quizIds[0],
        title: 'Biology Basics',
        description: 'Foundations.',
        questions: [
          {
            questionType: 'multiple-choice',
            questionText: 'What is DNA?',
            options: ['A molecule', 'An organelle'],
            correctAnswer: 'A molecule',
          },
        ],
      },
      {
        _id: quizIds[1],
        title: 'More Biology',
        description: 'Additional questions.',
        questions: [
          {
            questionType: 'multiple-choice',
            questionText: '   What is DNA?   ',
            options: ['A molecule', 'A vitamin'],
            correctAnswer: 'A molecule',
          },
          {
            questionType: 'true-false',
            questionText: 'Cells contain DNA.',
            correctAnswer: 'true',
          },
        ],
      },
    ];

    Quiz.find.mockResolvedValue(sourceQuizzes);
    generateMergedQuizMetadata.mockResolvedValue({
      title: 'Biology Essentials',
      description: 'Review key biology concepts.',
    });

    const savedQuiz = {
      _id: '507f191e810c19729de860fd',
      title: 'Biology Essentials',
      description: 'Review key biology concepts.',
      questions: [
        {
          questionType: 'multiple-choice',
          questionText: 'What is DNA?',
          options: ['A molecule', 'An organelle'],
          correctAnswer: 'A molecule',
        },
        {
          questionType: 'true-false',
          questionText: 'Cells contain DNA.',
          correctAnswer: 'True',
        },
      ],
    };

    const save = jest.fn().mockResolvedValue(savedQuiz);
    Quiz.mockImplementationOnce((payload) => ({ ...payload, save }));

    const res = await request(app).post('/api/quizzes/merge').send({ quizIds });

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        message: 'Quizzes merged successfully.',
        quiz: savedQuiz,
        metadata: expect.objectContaining({
          ignoredDuplicateQuestionCount: 1,
        }),
      })
    );
    expect(Quiz).toHaveBeenCalledWith(
      expect.objectContaining({
        questions: [
          expect.objectContaining({ questionText: 'What is DNA?' }),
          expect.objectContaining({ questionText: 'Cells contain DNA.' }),
        ],
      })
    );
  });
});

describe('DELETE /api/quizzes/:quizId/questions/:questionId', () => {
  it('deletes the requested question', async () => {
    const quizDoc = {
      questions: [
        { _id: 'question-1' },
        { _id: 'question-2' },
      ],
      save: jest.fn().mockResolvedValue(),
    };

    Quiz.findById.mockResolvedValue(quizDoc);

    const res = await request(app).delete('/api/quizzes/quiz-1/questions/question-1');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        message: 'Question deleted successfully',
      })
    );
    expect(quizDoc.questions).toEqual([{ _id: 'question-2' }]);
    expect(quizDoc.save).toHaveBeenCalledTimes(1);
  });

  it('returns 404 when quiz does not exist', async () => {
    Quiz.findById.mockResolvedValue(null);

    const res = await request(app).delete('/api/quizzes/quiz-1/questions/question-1');

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual(
      expect.objectContaining({
        message: 'Quiz not found',
      })
    );
  });

  it('returns 404 when question does not exist', async () => {
    const quizDoc = {
      questions: [{ _id: 'question-2' }],
      save: jest.fn().mockResolvedValue(),
    };

    Quiz.findById.mockResolvedValue(quizDoc);

    const res = await request(app).delete('/api/quizzes/quiz-1/questions/question-1');

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual(
      expect.objectContaining({
        message: 'Question not found',
      })
    );
    expect(quizDoc.save).not.toHaveBeenCalled();
  });
});
