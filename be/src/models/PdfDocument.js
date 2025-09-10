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
