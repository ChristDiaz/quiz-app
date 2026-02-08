process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

jest.mock('../models/User', () => ({
  findOne: jest.fn(),
}));

const request = require('supertest');
const User = require('../models/User');
const app = require('../index');

afterEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/auth/login', () => {
  it('returns 401 for invalid credentials', async () => {
    User.findOne.mockResolvedValue(null);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'wrong@example.com', password: 'badpass' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 200 and token for valid credentials', async () => {
    User.findOne.mockResolvedValue({
      _id: '507f1f77bcf86cd799439011',
      username: 'tester',
      email: 'tester@example.com',
      comparePassword: jest.fn().mockResolvedValue(true),
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'tester@example.com', password: 'goodpass' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        message: 'Login successful.',
        token: expect.any(String),
        user: {
          id: '507f1f77bcf86cd799439011',
          username: 'tester',
          email: 'tester@example.com',
        },
      })
    );
  });
});
