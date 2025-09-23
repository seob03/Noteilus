const express = require('express');
const router = express.Router();
const passport = require('passport');
const HighlightController = require('../controllers/highlightController');

// HighlightController 인스턴스 생성 (db는 server.js에서 주입)
let highlightController;

// db 주입 함수
const setHighlightController = (db) => {
  highlightController = new HighlightController(db);
};

// 인증 미들웨어
const requireAuth = (req, res, next) => {
  console.log('🔐 인증 미들웨어 실행');
  console.log('📥 요청 헤더:', req.headers);
  console.log('🍪 쿠키:', req.headers.cookie);
  
  if (!req.user) {
    console.error('❌ 사용자 정보 없음');
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }
  
  console.log('✅ 인증 성공:', req.user.id);
  next();
};

// 하이라이트 생성
router.post('/:pdfId/highlights', requireAuth, async (req, res) => {
  console.log('🚀 하이라이트 생성 라우트 도달');
  console.log('📥 요청 파라미터:', req.params);
  console.log('📥 요청 바디:', req.body);
  console.log('👤 사용자 정보:', req.user);
  
  if (!highlightController) {
    console.error('❌ highlightController가 초기화되지 않음');
    return res.status(500).json({ error: '서버 초기화 중입니다.' });
  }
  await highlightController.createHighlight(req, res);
});

// 하이라이트 목록 조회
router.get('/:pdfId/highlights', requireAuth, async (req, res) => {
  if (!highlightController) {
    return res.status(500).json({ error: '서버 초기화 중입니다.' });
  }
  await highlightController.getHighlights(req, res);
});

// 특정 페이지의 하이라이트 조회
router.get('/:pdfId/highlights/page/:pageNumber', requireAuth, async (req, res) => {
  if (!highlightController) {
    return res.status(500).json({ error: '서버 초기화 중입니다.' });
  }
  await highlightController.getHighlightsByPage(req, res);
});

// 하이라이트 삭제
router.delete('/highlights/:highlightId', requireAuth, async (req, res) => {
  if (!highlightController) {
    return res.status(500).json({ error: '서버 초기화 중입니다.' });
  }
  await highlightController.deleteHighlight(req, res);
});

module.exports = { router, setHighlightController };
