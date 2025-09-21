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

  // PDF를 폴더에 추가할 때 폴더 정보 업데이트
  async updateFolderInfo(pdfId, folderId) {
    const result = await this.collection.updateOne(
      { _id: ObjectId.createFromHexString(pdfId.toString()) },
      { $set: { folderId: folderId } }
    );
    return result;
  }

  // 폴더에서 PDF 제거할 때 폴더 정보 제거
  async removeFolderInfo(pdfId) {
    const result = await this.collection.updateOne(
      { _id: ObjectId.createFromHexString(pdfId.toString()) },
      { $unset: { folderId: "" } }
    );
    return result;
  }



  // PDF 해시로 기존 SVG 캐시 찾기
  async findByPdfHash(userId, pdfHash) {
    return await this.collection.findOne({ 
      userId: userId, 
      pdfHash: pdfHash,
      allPagesSvg: { $exists: true, $ne: null }
    });
  }
}

module.exports = PdfDocument;
