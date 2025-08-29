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

  // 필기 데이터 저장
  async saveDrawingData(pdfId, drawingData) {
    const result = await this.collection.updateOne(
      { _id: ObjectId.createFromHexString(pdfId.toString()) },
      { $set: { drawingData: drawingData, lastModified: new Date() } }
    );
    return result;
  }

  // 필기 데이터 조회
  async getDrawingData(pdfId) {
    const pdf = await this.findById(pdfId);
    return pdf ? pdf.drawingData || {} : {};
  }

  // 특정 페이지의 필기 데이터 저장
  async savePageDrawingData(pdfId, pageNumber, pageDrawingData) {
    const result = await this.collection.updateOne(
      { _id: ObjectId.createFromHexString(pdfId.toString()) },
      { 
        $set: { 
          [`drawingData.${pageNumber}`]: pageDrawingData,
          lastModified: new Date()
        } 
      }
    );
    return result;
  }

  // 특정 페이지의 텍스트 메모 저장
  async savePageTextMemos(pdfId, pageNumber, textMemos) {
    const result = await this.collection.updateOne(
      { _id: ObjectId.createFromHexString(pdfId.toString()) },
      { 
        $set: { 
          [`textMemos.${pageNumber}`]: textMemos,
          lastModified: new Date()
        } 
      }
    );
    return result;
  }

  // 텍스트 메모 조회
  async getTextMemos(pdfId) {
    const pdf = await this.findById(pdfId);
    return pdf ? pdf.textMemos || {} : {};
  }
}

module.exports = PdfDocument;
