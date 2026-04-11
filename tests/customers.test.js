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

describe('Customers GET endpoints', () => {
  test('GET /customers should return all customers', async () => {
    const res = await request(app).get('/customers');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /customers/:id should return 400 for invalid id', async () => {
    const res = await request(app).get('/customers/invalid-id');
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('message', 'Invalid customer ID');
  });
});