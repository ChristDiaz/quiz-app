const validateFields = require('../middleware/validateFields');

describe('validateFields middleware', () => {
  test('rejects unknown fields', () => {
    const middleware = validateFields(['name'], { name: 'string' });
    const req = { body: { name: 'Alice', extra: 'oops' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Invalid fields in request',
      invalidFields: ['extra']
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects invalid types', () => {
    const middleware = validateFields(['tags'], { tags: 'array' });
    const req = { body: { tags: 'not-an-array' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid type for field 'tags': expected array",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('passes valid payload', () => {
    const middleware = validateFields(['title', 'tags'], { title: 'string', tags: 'array' });
    const req = { body: { title: 'Quiz', tags: ['a', 'b'] } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
