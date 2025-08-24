const express = require('express');
const passport = require('passport');
const KakaoAuthController = require('../controllers/kakaoAuthController');

function createKakaoAuthRoutes(db) {
  const router = express.Router();
  const kakaoAuthController = new KakaoAuthController(db);

  /**
   * @route GET /auth/kakao
   * @desc 카카오 로그인 시작
   */
  router.get('/kakao', (req, res, next) => {
    console.log('Kakao OAuth 시작');
    passport.authenticate('kakao', {
      scope: ['profile_nickname', 'profile_image']
    })(req, res, next);
  });

  /**
   * @route GET /auth/kakao/callback
   * @desc 카카오 로그인 콜백
   */
  router.get('/kakao/callback',
    passport.authenticate('kakao', {
      failureRedirect: '/auth/failure',
      session: true
    }),
    (req, res) => kakaoAuthController.loginCallback(req, res)
  );

  // 카카오 로그인 실패
  router.get('/failure', (req, res) => kakaoAuthController.loginFailure(req, res));

  // 카카오 로그아웃
  router.get('/logout', (req, res) => kakaoAuthController.logout(req, res));

  // 현재 카카오 사용자 정보 조회
  router.get('/me', (req, res) => kakaoAuthController.getCurrentUser(req, res));

  return router;
}

module.exports = createKakaoAuthRoutes;
