const express = require('express');
const passport = require('passport');
const GoogleAuthController = require('../controllers/googleAuthController');

function createGoogleAuthRoutes(db) {
  const router = express.Router();
  const googleAuthController = new GoogleAuthController(db);

  /**
   * @route GET /auth/google
   * @desc 구글 로그인 시작
   */
  router.get('/google', (req, res, next) => {
    console.log('Google OAuth 시작');
    passport.authenticate('google', {
      scope: ['profile', 'email']
    })(req, res, next);
  });

  /**
   * @route GET /auth/google/callback
   * @desc 구글 로그인 콜백
   */
  router.get('/google/callback', 
    passport.authenticate('google', { 
      failureRedirect: '/auth/failure',
      session: true
    }),
    (req, res) => googleAuthController.loginCallback(req, res)
  );

  // 구글 로그인 실패
  router.get('/failure', (req, res) => googleAuthController.loginFailure(req, res));

  // 구글 로그아웃
  router.get('/logout', (req, res) => googleAuthController.logout(req, res));

  // 현재 구글 사용자 정보 조회
  router.get('/me', (req, res) => googleAuthController.getCurrentUser(req, res));

  return router;
}

module.exports = createGoogleAuthRoutes;
