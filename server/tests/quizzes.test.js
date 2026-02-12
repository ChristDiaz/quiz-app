process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

jest.mock('../models/Quiz', () => ({
  findById: jest.fn(),
}));

const request = require('supertest');
const Quiz = require('../models/Quiz');
const app = require('../index');

afterEach(() => {
  jest.clearAllMocks();
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
