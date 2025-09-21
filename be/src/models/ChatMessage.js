const { ObjectId } = require('mongodb');

class ChatMessage {
  constructor(db) {
    this.db = db;
    this.collection = db.collection('chatMessages');
  }

  // 채팅 메시지 생성
  async create(messageData) {
    try {
      const message = {
        ...messageData,
        _id: new ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await this.collection.insertOne(message);
      return result.insertedId;
    } catch (error) {
      console.error('채팅 메시지 생성 에러:', error);
      throw error;
    }
  }

  // PDF별 채팅 히스토리 조회
  async findByPdfId(pdfId, userId) {
    try {
      const messages = await this.collection
        .find({ 
          pdfId: new ObjectId(pdfId),
          userId: userId
        })
        .sort({ createdAt: 1 })
        .toArray();
      
      return messages;
    } catch (error) {
      console.error('채팅 히스토리 조회 에러:', error);
      throw error;
    }
  }

  // 채팅 메시지 업데이트 (스트리밍 중 내용 업데이트용)
  async updateById(messageId, updateData) {
    try {
      const result = await this.collection.updateOne(
        { _id: new ObjectId(messageId) },
        { 
          $set: { 
            ...updateData,
            updatedAt: new Date()
          }
        }
      );
      
      return result.modifiedCount > 0;
    } catch (error) {
      console.error('채팅 메시지 업데이트 에러:', error);
      throw error;
    }
  }

  // PDF별 모든 채팅 메시지 삭제
  async deleteByPdfId(pdfId, userId) {
    try {
      const result = await this.collection.deleteMany({
        pdfId: new ObjectId(pdfId),
        userId: userId
      });
      
      return result.deletedCount;
    } catch (error) {
      console.error('채팅 메시지 삭제 에러:', error);
      throw error;
    }
  }

  // 사용자별 모든 채팅 메시지 삭제
  async deleteByUserId(userId) {
    try {
      const result = await this.collection.deleteMany({
        userId: userId
      });
      
      return result.deletedCount;
    } catch (error) {
      console.error('사용자 채팅 메시지 삭제 에러:', error);
      throw error;
    }
  }
}

module.exports = ChatMessage;
