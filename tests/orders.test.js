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

describe('Orders GET endpoints', () => {
  test('GET /orders should return all orders', async () => {
    const res = await request(app).get('/orders');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /orders/:id should return 400 for invalid id', async () => {
    const res = await request(app).get('/orders/invalid-id');
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('message', 'Invalid order ID');
  });
});