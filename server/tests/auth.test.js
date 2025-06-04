const request = require('supertest');
const app = require('../index'); // adjust if the Express app is exported

describe('POST /api/auth/login', () => {
  it('returns 401 for invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'wrong@example.com', password: 'badpass' });
    expect(res.statusCode).toBe(401);
  });
});
