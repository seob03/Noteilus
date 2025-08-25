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
    return await this.collection.findOne({ _id: ObjectId.createFromHexString(pdfId.toString()) });
  }

  async deleteById(pdfId) {
    return await this.collection.deleteOne({ _id: ObjectId.createFromHexString(pdfId.toString()) });
  }

  async updateById(pdfId, updateData) {
    const result = await this.collection.updateOne(
      { _id: ObjectId.createFromHexString(pdfId.toString()) },
      { $set: updateData }
    );
    return result;
  }
}

module.exports = PdfDocument;
