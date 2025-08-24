// 모듈 선언
const express = require('express');
const app = express();
const path = require('path');
const tmp = require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const connectDB = require('./db.js');

const session = require('express-session');
const passport = require('passport');
const cors = require('cors');

// oauth
const configurePassport = require('./src/config/passport');
const createGoogleAuthRoutes = require('./src/routes/googleAuthRoutes');
const createKakaoAuthRoutes = require('./src/routes/kakaoAuthRoutes');


// CORS 설정
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());

// 세션 설정
app.use(session({
  secret: process.env.SESSION_SECRET || '1234',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // 배포할 때는 true로 변경하기
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24시간
    sameSite: 'lax'
  },
  name: 'noteilus_session'
}));

// Passport 초기화
app.use(passport.initialize());
app.use(passport.session());

let server;
let dbInstance;

connectDB().then((db) => {
  dbInstance = db; // 종료 시 사용하기 위해 저장

  // DB 연결을 app.locals에 저장 (라우트에서 사용하기 위해)
  app.locals.db = db;

  // Passport 설정
  configurePassport(db);
  // 구글 인증 라우트 설정
  app.use('/auth', createGoogleAuthRoutes(db));
  // 카카오 인증 라우트 설정
  app.use('/auth', createKakaoAuthRoutes(db));

  server = app.listen(process.env.PORT || 8080, () => {
    console.log('API 서버 실행 성공');
  });

  // API 서버이므로 다른 라우트는 404 (정규식 사용)
  app.get(/.*/, (req, res) => {
    res.status(404).json({ error: 'API 엔드포인트를 찾을 수 없습니다' });
  });

}).catch((err) => {
  console.error('DB 연결 실패:', err);
});
