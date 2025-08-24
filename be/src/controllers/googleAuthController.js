const GoogleUser = require('../models/GoogleUser');

class GoogleAuthController {
  constructor(db) {
    this.userModel = new GoogleUser(db);
  }

  // 구글 로그인 성공 시 호출
  async googleLoginSuccess(profile) {
    try {
      const userData = {
        googleId: profile.id,
        email: profile.emails[0].value,
        name: profile.displayName,
        picture: profile.photos[0]?.value || null
      };

      const user = await this.userModel.updateOrCreate(userData);
      return user;
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
    }
  }

  // 로그인 상태 확인
  async checkAuthStatus(userId) {
    try {
      const user = await this.userModel.findByGoogleId(userId);
      return user;
    } catch (error) {
      console.error('Auth status check error:', error);
      throw error;
    }
  }

  // 로그아웃
  async logout(req, res) {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: '로그아웃 실패' });
      }
      res.json({ message: '로그아웃 성공' });
    });
  }

  // 현재 사용자 정보 조회
  async getCurrentUser(req, res) {
    if (req.isAuthenticated()) {
      res.json({
        user: {
          id: req.user.googleId,
          email: req.user.email,
          name: req.user.name,
          picture: req.user.picture
        }
      });
    } else {
      res.status(401).json({ error: '로그인이 필요합니다' });
    }
  }

  // 로그인 실패 처리
  async loginFailure(req, res) {
    res.status(401).json({ error: '로그인 실패' });
  }

  // 로그인 콜백 처리
  async loginCallback(req, res) {
    console.log('구글 로그인 콜백');
    // 로그인 성공 시 프론트엔드로 리다이렉트
    res.redirect(process.env.FRONTEND_URL || 'http://localhost:3000');
  }
}

module.exports = GoogleAuthController;
