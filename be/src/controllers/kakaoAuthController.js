const KakaoUser = require('../models/KakaoUser');

class KakaoAuthController {
  constructor(db) {
    this.userModel = new KakaoUser(db);
  }

  // 카카오 로그인 성공 시 호출
  async kakaoLoginSuccess(profile) {
    try { 
      const userData = {
        kakaoId: profile.id,
        email: profile._json.kakao_account?.email || null,
        name: profile.displayName,
        picture: profile._json.properties?.profile_image || null
      };
      const user = await this.userModel.updateOrCreate(userData);ㅁ
      return user;
    } catch (error) {
      console.error('Kakao login error:', error);
      throw error;
    }
  }

  // 카카오 로그인 상태 확인
  async checkAuthStatus(userId) {
    try {
      const user = await this.userModel.findByKakaoId(userId);
      return user;
    } catch (error) {
      console.error('Kakao auth status check error:', error);
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
          id: req.user.kakaoId,
          kakaoId: req.user.kakaoId,
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
    console.log('카카오 로그인 콜백 시작');
    
    if (!req.isAuthenticated()) {
      console.error('카카오 로그인 실패: 인증되지 않음');
      return res.redirect(process.env.FRONTEND_URL || 'http://localhost');
    }
    
    console.log('카카오 로그인 성공, 리다이렉트 중...');
    // 로그인 성공 시 프론트엔드로 리다이렉트
    res.redirect(process.env.FRONTEND_URL || 'http://localhost');
  }
}

module.exports = KakaoAuthController;
