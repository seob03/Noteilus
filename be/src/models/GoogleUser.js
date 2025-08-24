class GoogleUser {
    constructor(db) {
      this.db = db;
      this.collection = db.collection('google_users');
    }
  
    async findByGoogleId(googleId) {
      return await this.collection.findOne({ googleId });
    }
  
    async findByEmail(email) {
      return await this.collection.findOne({ email });
    }
  
    async create(userData) {
      const user = {
        googleId: userData.googleId,
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
      const existingUser = await this.findByGoogleId(userData.googleId);
  
      if (existingUser) {
        // 기존 사용자 정보 업데이트
        const updateData = {
          name: userData.name,
          picture: userData.picture,
          updatedAt: new Date()
        };
  
        await this.collection.updateOne(
          { googleId: userData.googleId },
          { $set: updateData }
        );
  
        return { ...existingUser, ...updateData };
      } else {
        // 새 사용자 생성
        return await this.create(userData);
      }
    }
  }
  
  module.exports = GoogleUser;
  