const { ObjectId } = require('mongodb');

class PdfDocument {
  constructor(db) {
    this.collection = db.collection('pdfs');
  }

  async create(pdfData) {
    const result = await this.collection.insertOne(pdfData);
    return result.insertedId;
  }

  async findByUserId(userId) {
    return await this.collection.find({ userId: userId }).toArray();
  }

  async findById(pdfId) {
    return await this.collection.findOne({ _id: new ObjectId(pdfId) });
  }

  async deleteById(pdfId) {
    return await this.collection.deleteOne({ _id: new ObjectId(pdfId) });
  }
}

module.exports = PdfDocument;
