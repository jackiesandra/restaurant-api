const request = require('supertest');
const { MongoClient, ObjectId } = require('mongodb');
const mongodb = require('../database/connect');

let app;
let connection;
let db;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';

  connection = await MongoClient.connect(process.env.MONGODB_URI);
  db = connection.db();

  mongodb.getDb = () => db;

  app = require('../server');
});

afterAll(async () => {
  if (connection) {
    await connection.close();
  }
});

describe('Users Routes', () => {
  test('GET /users should return all users', async () => {
    const response = await request(app).get('/users');
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  test('GET /users/:id should return 400 for invalid user id', async () => {
    const response = await request(app).get('/users/invalid-id');
    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('Invalid user ID');
  });

  test('GET /users/:id should return 404 for non-existing valid user id', async () => {
    const fakeId = new ObjectId().toString();
    const response = await request(app).get(`/users/${fakeId}`);
    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe('User not found');
  });
});