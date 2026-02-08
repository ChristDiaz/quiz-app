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

  it('returns 502 with auth guidance when OpenAI credentials are invalid', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: jest.fn().mockResolvedValue({
        error: { message: 'Incorrect API key provided.' },
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
        message: 'OpenAI authentication failed. Check OPENAI_API_KEY.',
      })
    );
  });

  it('retries without json_schema when model does not support strict response format', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({
          error: { message: 'response_format json_schema is not supported for this model' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: 'Fallback Quiz',
                  description: 'Generated with fallback mode.',
                  questions: [
                    {
                      questionType: 'true-false',
                      questionText: 'Earth has one moon.',
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
      .field('questionCount', '1')
      .attach('document', Buffer.from('Earth has one moon.'), 'notes.txt');

    expect(res.statusCode).toBe(200);
    expect(res.body.quiz.title).toBe('Fallback Quiz');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('uses OpenAI responses API for PDF uploads', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        output_text: JSON.stringify({
          title: 'PDF Quiz',
          description: 'Generated from pdf input',
          questions: [
            {
              questionType: 'multiple-choice',
              questionText: 'What is photosynthesis?',
              options: ['A chemical process in plants', 'A planet', 'A type of rock', 'A language'],
              correctAnswer: 'A chemical process in plants',
            },
          ],
        }),
      }),
    });

    const res = await request(app)
      .post('/api/quizzes/generate-from-document')
      .set('Authorization', `Bearer ${buildToken()}`)
      .field('questionCount', '1')
      .attach('document', Buffer.from('%PDF-1.4 fake pdf bytes'), 'chapter-1.pdf');

    expect(res.statusCode).toBe(200);
    expect(res.body.metadata).toEqual(
      expect.objectContaining({
        usedPdfInput: true,
      })
    );
    expect(global.fetch.mock.calls[0][0]).toContain('/v1/responses');
  });
});
