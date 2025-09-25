const { ObjectId } = require('mongodb');

class Highlight {
  constructor(data) {
    this._id = data._id || new ObjectId();
    this.pdfId = new ObjectId(data.pdfId);
    this.userId = data.userId; // Google ID는 문자열이므로 ObjectId로 변환하지 않음
    this.text = data.text;
    this.pageNumber = data.pageNumber;
    this.startX = data.startX;
    this.startY = data.startY;
    this.endX = data.endX;
    this.endY = data.endY;
    this.pageWidth = data.pageWidth;
    this.pageHeight = data.pageHeight;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  // 하이라이트 생성
  static async create(db, data) {
    try {
      console.log('Highlight.create 호출됨');
      
      const highlight = new Highlight(data);
      
      const result = await db.collection('highlights').insertOne(highlight);
      
      const savedHighlight = { ...highlight, _id: result.insertedId };
      console.log('최종 저장된 하이라이트');
      
      return savedHighlight;
    } catch (error) {
      console.error('Highlight.create 에러:', error);
      throw error;
    }
  }

  // 하이라이트 조회 (PDF ID와 사용자 ID로)
  static async findByPdfAndUser(db, pdfId, userId) {
    return await db.collection('highlights').find({
      pdfId: new ObjectId(pdfId),
      userId: userId // Google ID는 문자열이므로 ObjectId로 변환하지 않음
    }).sort({ createdAt: 1 }).toArray();
  }

  // 특정 페이지의 하이라이트 조회
  static async findByPdfUserAndPage(db, pdfId, userId, pageNumber) {
    return await db.collection('highlights').find({
      pdfId: new ObjectId(pdfId),
      userId: userId, // Google ID는 문자열이므로 ObjectId로 변환하지 않음
      pageNumber: parseInt(pageNumber)
    }).sort({ createdAt: 1 }).toArray();
  }

  // 하이라이트 삭제
  static async deleteById(db, highlightId, userId) {
    const result = await db.collection('highlights').deleteOne({
      _id: new ObjectId(highlightId),
      userId: userId // Google ID는 문자열이므로 ObjectId로 변환하지 않음
    });
    return result.deletedCount > 0;
  }

  // 하이라이트 존재 확인
  static async findById(db, highlightId, userId) {
    return await db.collection('highlights').findOne({
      _id: new ObjectId(highlightId),
      userId: userId // Google ID는 문자열이므로 ObjectId로 변환하지 않음
    });
  }

  // 인덱스 생성
  static async createIndexes(db) {
    try {
      const collection = db.collection('highlights');
      
      // pdfId와 userId 복합 인덱스
      await collection.createIndex({ pdfId: 1, userId: 1 });
      
      // pdfId, userId, pageNumber 복합 인덱스
      await collection.createIndex({ pdfId: 1, userId: 1, pageNumber: 1 });
      
      console.log('하이라이트 컬렉션 인덱스 생성 완료');
    } catch (error) {
      console.error('하이라이트 인덱스 생성 에러:', error);
    }
  }
}

module.exports = Highlight;
