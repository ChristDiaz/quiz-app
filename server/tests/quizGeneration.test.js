process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-openai-key';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../index');

const buildToken = (id = '507f1f77bcf86cd799439011') =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '1h' });

describe('POST /api/quizzes/generate-from-document', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('returns generated quiz data', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'Solar System Basics',
                description: 'Short quiz about planets.',
                questions: [
                  {
                    questionType: 'multiple-choice',
                    questionText: 'Which planet is known as the Red Planet?',
                    options: ['Earth', 'Mars', 'Jupiter', 'Venus'],
                    correctAnswer: 'Mars',
                  },
                  {
                    questionType: 'true-false',
                    questionText: 'The Sun is a star.',
                    correctAnswer: 'True',
                  },
                ],
              }),
            },
          },
        ],
      }),
    });

    const res = await request(app)
      .post('/api/quizzes/generate-from-document')
      .set('Authorization', `Bearer ${buildToken()}`)
      .field('questionCount', '2')
      .attach('document', Buffer.from('Mars is known as the Red Planet.'), 'notes.txt');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        message: 'Quiz generated successfully.',
        quiz: expect.objectContaining({
          title: 'Solar System Basics',
          description: 'Short quiz about planets.',
          questions: expect.arrayContaining([
            expect.objectContaining({
              questionType: 'multiple-choice',
              correctAnswer: 'Mars',
            }),
          ]),
        }),
      })
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns 400 when file is missing', async () => {
    const res = await request(app)
      .post('/api/quizzes/generate-from-document')
      .set('Authorization', `Bearer ${buildToken()}`)
      .field('questionCount', '5');

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/upload a document/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns 502 when OpenAI request fails', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      json: jest.fn().mockResolvedValue({
        error: { message: 'upstream request failed' },
      }),
    });

    const res = await request(app)
      .post('/api/quizzes/generate-from-document')
      .set('Authorization', `Bearer ${buildToken()}`)
      .field('questionCount', '2')
      .attach('document', Buffer.from('Document content for testing'), 'notes.txt');

    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual(
      expect.objectContaining({
        message: 'Failed to generate quiz from document. Please try again.',
      })
    );
  });
});
