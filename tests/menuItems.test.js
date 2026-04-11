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

describe('MenuItems GET endpoints', () => {
  test('GET /menuItems should return all menu items', async () => {
    const res = await request(app).get('/menuItems');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /menuItems/:id should return 400 for invalid id', async () => {
    const res = await request(app).get('/menuItems/invalid-id');
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('message', 'Invalid menu item ID');
  });
});