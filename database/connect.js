const { MongoClient } = require('mongodb');
require('dotenv').config();

let database;
let client;

const initDb = async (callback) => {
  try {
    if (database) {
      return callback(null, database);
    }

    if (!process.env.MONGODB_URI) {
      return callback(new Error('MONGODB_URI is not defined in the environment variables.'));
    }

    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();

    database = client.db();
    callback(null, database);
  } catch (err) {
    callback(err);
  }
};

const getDb = () => {
  if (!database) {
    throw new Error('Database not initialized. Call initDb first.');
  }
  return database;
};

const closeDb = async () => {
  try {
    if (client) {
      await client.close();
      client = null;
      database = null;
    }
  } catch (err) {
    console.error('Error closing database connection:', err.message);
  }
};

module.exports = { initDb, getDb, closeDb };