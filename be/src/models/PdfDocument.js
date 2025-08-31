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

  // AI 요약 저장
  async saveAISummary(pdfId, summary) {
    const result = await this.collection.updateOne(
      { _id: ObjectId.createFromHexString(pdfId.toString()) },
      { 
        $set: { 
          aiSummary: summary,
          aiSummaryGeneratedAt: new Date(),
          lastModified: new Date()
        } 
      }
    );
    return result;
  }

  // AI 요약 조회
  async getAISummary(pdfId) {
    const pdf = await this.findById(pdfId);
    return pdf ? {
      summary: pdf.aiSummary,
      generatedAt: pdf.aiSummaryGeneratedAt
    } : null;
  }

  // AI 퀴즈 저장
  async saveAIQuiz(pdfId, quiz) {
    const result = await this.collection.updateOne(
      { _id: ObjectId.createFromHexString(pdfId.toString()) },
      { 
        $set: { 
          aiQuiz: quiz,
          aiQuizGeneratedAt: new Date(),
          lastModified: new Date()
        } 
      }
    );
    return result;
  }

  // AI 퀴즈 조회
  async getAIQuiz(pdfId) {
    const pdf = await this.findById(pdfId);
    return pdf ? {
      quiz: pdf.aiQuiz,
      generatedAt: pdf.aiQuizGeneratedAt
    } : null;
  }

  // AI 번역 저장
  async saveAITranslation(pdfId, targetLanguage, translation) {
    const result = await this.collection.updateOne(
      { _id: ObjectId.createFromHexString(pdfId.toString()) },
      { 
        $set: { 
          [`aiTranslations.${targetLanguage}`]: {
            translation: translation,
            generatedAt: new Date()
          },
          lastModified: new Date()
        } 
      }
    );
    return result;
  }

  // AI 번역 조회
  async getAITranslation(pdfId, targetLanguage) {
    const pdf = await this.findById(pdfId);
    if (!pdf || !pdf.aiTranslations) return null;
    return pdf.aiTranslations[targetLanguage] || null;
  }
}

module.exports = PdfDocument;
