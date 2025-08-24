class KakaoUser {
    constructor(db) {
      this.db = db;
      this.collection = db.collection('kakao_users');
    }
  
    async findByKakaoId(kakaoId) {
      return await this.collection.findOne({ kakaoId });
    }
  
    async findByKakaoEmail(email) {
      return await this.collection.findOne({ email });
    }
  
    async kakaoUserCreate(userData) {
      const user = {
        kakaoId: userData.kakaoId,
        email: userData.email,
        name: userData.name,
        picture: userData.picture,
        createdAt: new Date(),
        updatedAt: new Date()
      };
  
      const result = await this.collection.insertOne(user);
      return { ...user, _id: result.insertedId };
    }
  
    async updateOrCreate(userData) {
      const existingUser = await this.findByKakaoId(userData.kakaoId);
  
      if (existingUser) {
        // 기존 사용자 정보 업데이트
        const updateData = {
          name: userData.name,
          picture: userData.picture,
          updatedAt: new Date()
        };
  
        await this.collection.updateOne(
          { kakaoId: userData.kakaoId },
          { $set: updateData }
        );
  
        return { ...existingUser, ...updateData };
      } else {
        // 카카오 새 사용자 생성
        return await this.kakaoUserCreate(userData);
      }
    }
  }
  
  module.exports = KakaoUser;
  