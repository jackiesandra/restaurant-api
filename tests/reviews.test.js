const request = require('supertest');
const app = require('../server');
const mongodb = require('../database/connect');

beforeAll((done) => {
  mongodb.initDb((err) => {
    done(err);
  });
});

afterAll(async () => {
  await mongodb.closeDb();
});

describe('Reviews GET endpoints', () => {
  test('GET /reviews should return all reviews', async () => {
    const res = await request(app).get('/reviews');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /reviews/:id should return 400 for invalid id', async () => {
    const res = await request(app).get('/reviews/invalid-id');
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('message', 'Invalid review ID');
  });
});