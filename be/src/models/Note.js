const { ObjectId } = require('mongodb');

class Note {
  constructor(data) {
    this._id = data._id || new ObjectId();
    this.pdfId = new ObjectId(data.pdfId);
    this.userId = data.userId; // googleId or kakaoId (string)
    this.text = data.text || '';
    this.pageNumber = data.pageNumber; // 1-based
    // Position and size are in PDF page coordinate space (unscaled)
    this.x = data.x; // top-left x
    this.y = data.y; // top-left y
    this.width = data.width; // box width
    this.height = data.height; // box height
    // Text styling
    this.fontSize = typeof data.fontSize === 'number' ? data.fontSize : 14;
    this.color = data.color || '#111827'; // gray-900
    this.bold = typeof data.bold === 'boolean' ? data.bold : false;
    // Store page size at creation time for reliable scaling if needed
    this.pageWidth = data.pageWidth;
    this.pageHeight = data.pageHeight;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  static async create(db, data) {
    const note = new Note(data);
    const result = await db.collection('notes').insertOne(note);
    return { ...note, _id: result.insertedId };
  }

  static async findByPdfAndUser(db, pdfId, userId) {
    return await db
      .collection('notes')
      .find({ pdfId: new ObjectId(pdfId), userId })
      .sort({ createdAt: 1 })
      .toArray();
  }

  static async findByPdfUserAndPage(db, pdfId, userId, pageNumber) {
    return await db
      .collection('notes')
      .find({ pdfId: new ObjectId(pdfId), userId, pageNumber: parseInt(pageNumber) })
      .sort({ createdAt: 1 })
      .toArray();
  }

  static async updateById(db, noteId, userId, updates) {
    updates.updatedAt = new Date();
    const result = await db.collection('notes').findOneAndUpdate(
      { _id: new ObjectId(noteId), userId },
      { $set: updates },
      { returnDocument: 'after' }
    );
    return result.value;
  }

  static async deleteById(db, noteId, userId) {
    const result = await db.collection('notes').deleteOne({ _id: new ObjectId(noteId), userId });
    return result.deletedCount > 0;
  }

  static async findById(db, noteId, userId) {
    return await db.collection('notes').findOne({ _id: new ObjectId(noteId), userId });
  }

  static async createIndexes(db) {
    try {
      const collection = db.collection('notes');
      await collection.createIndex({ pdfId: 1, userId: 1 });
      await collection.createIndex({ pdfId: 1, userId: 1, pageNumber: 1 });
    } catch (error) {
      console.error('노트 인덱스 생성 에러:', error);
    }
  }
}

module.exports = Note;


