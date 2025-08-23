// 모듈 선언
const express = require('express');
const app = express();
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const connectDB = require('./db.js');

let server;
let dbInstance;

connectDB().then((db) => {
  dbInstance = db; // 종료 시 사용하기 위해 저장

  // DB 연결을 app.locals에 저장 (라우트에서 사용하기 위해)
  app.locals.db = db;

  server = app.listen(process.env.PORT || 8080, () => {
    console.log('API 서버 실행중');
  });

  // API 서버이므로 다른 라우트는 404 (정규식 사용)
  app.get(/.*/, (req, res) => {
    res.status(404).json({ error: 'API 엔드포인트를 찾을 수 없습니다' });
  });

}).catch((err) => {
  console.error('DB 연결 실패:', err);
});
