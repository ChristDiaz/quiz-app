process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

jest.mock('../models/User', () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const app = require('../index');

const buildToken = (id = '507f1f77bcf86cd799439011') =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '1h' });

afterEach(() => {
  jest.clearAllMocks();
});

describe('PATCH /api/users/me', () => {
  it('updates profile details', async () => {
    const userDoc = {
      _id: '507f1f77bcf86cd799439011',
      username: 'oldname',
      email: 'old@example.com',
      save: jest.fn().mockResolvedValue(),
      toObject: jest.fn().mockReturnValue({
        _id: '507f1f77bcf86cd799439011',
        username: 'newname',
        email: 'new@example.com',
      }),
    };

    User.findById.mockResolvedValue(userDoc);
    User.findOne.mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${buildToken()}`)
      .send({ username: 'newname', email: 'new@example.com' });

    expect(res.statusCode).toBe(200);
    expect(userDoc.save).toHaveBeenCalled();
    expect(res.body).toEqual(
      expect.objectContaining({
        message: 'Profile updated successfully.',
        user: expect.objectContaining({
          username: 'newname',
          email: 'new@example.com',
        }),
      })
    );
  });

  it('returns 400 when username is taken', async () => {
    User.findById.mockResolvedValue({
      _id: '507f1f77bcf86cd799439011',
      username: 'current',
      email: 'current@example.com',
    });
    User.findOne.mockResolvedValue({
      _id: '507f1f77bcf86cd799439012',
      username: 'taken',
    });

    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${buildToken()}`)
      .send({ username: 'taken' });

    expect(res.statusCode).toBe(400);
  });
});

describe('PATCH /api/auth/password', () => {
  it('updates password when current password is valid', async () => {
    const comparePassword = jest.fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const userDoc = {
      _id: '507f1f77bcf86cd799439011',
      comparePassword,
      save: jest.fn().mockResolvedValue(),
    };

    User.findById.mockResolvedValue(userDoc);

    const res = await request(app)
      .patch('/api/auth/password')
      .set('Authorization', `Bearer ${buildToken()}`)
      .send({ currentPassword: 'OldPass1!', newPassword: 'NewPass1!' });

    expect(res.statusCode).toBe(200);
    expect(userDoc.save).toHaveBeenCalled();
  });
});
