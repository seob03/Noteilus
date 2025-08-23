require('dotenv').config({ path: '../.env' });
const { MongoClient } = require('mongodb');
const url = process.env.MONGODB_URI_KEY

let db;
let client;

async function connectDB() {
  if (db)
    return db;  // 이미 연결되어 있으면 재사용

  try {
    client = new MongoClient(url);
    await client.connect();
    db = client.db('noteilusDB');
    console.log('MongoDB 연결 성공');
    return db;
  } catch (err) {
    console.error('DB 연결 실패:', err);
    throw err;
  }
}

module.exports = connectDB;
