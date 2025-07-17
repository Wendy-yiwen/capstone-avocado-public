const request = require('supertest');
const app = require('../../server');  // Because server.js is in the initialpage directory

describe('Node.js API tests', () => {
  // TEST /roles API
  it('GET /roles returns roles list', async () => {
    const res = await request(app).get('/roles');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // TEST /login API (Passing in mockData)
  it('POST /login with invalid user', async () => {
    const res = await request(app)
      .post('/login')
      .send({ username: 'z0000000', password: 'wrongpassword' });
    expect(res.statusCode).toBe(401);
    expect(res.body.status).toBe('fail');
  });

  // TEST /register API (Passing in missing fields)
  it('POST /register with missing fields', async () => {
    const res = await request(app)
      .post('/register')
      .send({ zid: 'z0000001' });  // Missing other fields
    expect(res.statusCode).toBe(400);
    expect(res.body.status).toBe('fail');
  });
});
