const express = require('express');

function createCommonAuthRoutes() {
  const router = express.Router();

  // 통합된 현재 사용자 정보 조회
  router.get('/me', (req, res) => {
    if (req.isAuthenticated()) {
      const user = req.user;
      
      res.json({
        user: {
          id: user.googleId || user.kakaoId,
          email: user.email,
          name: user.name,
          picture: user.picture,
          googleId: user.googleId || null,
          kakaoId: user.kakaoId || null
        }
      });
    } else {
      res.status(401).json({ error: '로그인이 필요합니다' });
    }
  });

  // 통합된 로그아웃
  router.get('/logout', (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: '로그아웃 실패' });
      }
      res.json({ message: '로그아웃 성공' });
    });
  });

  return router;
}

module.exports = createCommonAuthRoutes;