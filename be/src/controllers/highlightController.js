const Highlight = require('../models/Highlight');
const { ObjectId } = require('mongodb');

class HighlightController {
  constructor(db) {
    this.db = db;
  }

  // 하이라이트 생성
  async createHighlight(req, res) {
    try {
      console.log('🔍 하이라이트 생성 요청 받음');
      console.log('📥 요청 데이터:', req.body);
      console.log('📥 PDF ID:', req.params.pdfId);
      console.log('👤 사용자 정보 전체:', req.user);
      console.log('👤 사용자 ID (googleId):', req.user?.googleId);
      console.log('👤 사용자 ID (kakaoId):', req.user?.kakaoId);
      console.log('👤 사용자 ID (id):', req.user?.id);
      
      const { text, pageNumber, startX, startY, endX, endY, pageWidth, pageHeight } = req.body;
      const pdfId = req.params.pdfId;
      const userId = req.user?.googleId || req.user?.kakaoId || req.user?.id;

      if (!userId) {
        console.error('❌ 사용자 ID가 없습니다');
        return res.status(401).json({ error: '인증이 필요합니다.' });
      }

      // PDF 문서 존재 확인
      console.log('🔍 PDF 문서 확인 중...');
      console.log('🔍 PDF ID (ObjectId 변환 전):', pdfId);
      console.log('🔍 PDF ID (ObjectId 변환 후):', new ObjectId(pdfId));
      
      // 먼저 모든 PDF 문서 목록 확인
      const allPdfs = await this.db.collection('pdfs').find({}).toArray();
      console.log('📚 모든 PDF 문서 목록:', allPdfs.map(pdf => ({ id: pdf._id.toString(), name: pdf.fileName })));
      
      const pdfDoc = await this.db.collection('pdfs').findOne({ _id: new ObjectId(pdfId) });
      if (!pdfDoc) {
        console.error('❌ PDF 문서를 찾을 수 없습니다:', pdfId);
        return res.status(404).json({ error: 'PDF 문서를 찾을 수 없습니다.' });
      }
      console.log('✅ PDF 문서 확인 완료:', pdfDoc.name);

      // 하이라이트 데이터 생성
      const highlightData = {
        pdfId,
        userId,
        text,
        pageNumber,
        startX,
        startY,
        endX,
        endY,
        pageWidth,
        pageHeight,
      };

      console.log('💾 하이라이트 데이터 생성 중...');
      const savedHighlight = await Highlight.create(this.db, highlightData);
      console.log('✅ 하이라이트 저장 완료:', savedHighlight);
      
      res.status(201).json(savedHighlight);
    } catch (error) {
      console.error('❌ 하이라이트 생성 에러:', error);
      res.status(500).json({ error: '하이라이트 생성에 실패했습니다.' });
    }
  }

  // 하이라이트 목록 조회
  async getHighlights(req, res) {
    try {
      const pdfId = req.params.pdfId;
      const userId = req.user.googleId || req.user.kakaoId;

      // PDF 문서 존재 확인
      const pdfDoc = await this.db.collection('pdfs').findOne({ _id: new ObjectId(pdfId) });
      if (!pdfDoc) {
        return res.status(404).json({ error: 'PDF 문서를 찾을 수 없습니다.' });
      }

      // 사용자의 하이라이트 목록 조회
      const highlights = await Highlight.findByPdfAndUser(this.db, pdfId, userId);
      res.json(highlights);
    } catch (error) {
      console.error('하이라이트 조회 에러:', error);
      res.status(500).json({ error: '하이라이트 조회에 실패했습니다.' });
    }
  }

  // 하이라이트 삭제
  async deleteHighlight(req, res) {
    try {
      const highlightId = req.params.highlightId;
      const userId = req.user.googleId || req.user.kakaoId;

      // 하이라이트 존재 확인 및 소유자 확인
      const highlight = await Highlight.findById(this.db, highlightId, userId);
      if (!highlight) {
        return res.status(404).json({ error: '하이라이트를 찾을 수 없습니다.' });
      }

      const deleted = await Highlight.deleteById(this.db, highlightId, userId);
      if (deleted) {
        res.json({ message: '하이라이트가 삭제되었습니다.' });
      } else {
        res.status(500).json({ error: '하이라이트 삭제에 실패했습니다.' });
      }
    } catch (error) {
      console.error('하이라이트 삭제 에러:', error);
      res.status(500).json({ error: '하이라이트 삭제에 실패했습니다.' });
    }
  }

  // 특정 페이지의 하이라이트 조회
  async getHighlightsByPage(req, res) {
    try {
      const pdfId = req.params.pdfId;
      const pageNumber = parseInt(req.params.pageNumber);
      const userId = req.user.googleId || req.user.kakaoId;

      // PDF 문서 존재 확인
      const pdfDoc = await this.db.collection('pdfs').findOne({ _id: new ObjectId(pdfId) });
      if (!pdfDoc) {
        return res.status(404).json({ error: 'PDF 문서를 찾을 수 없습니다.' });
      }

      // 특정 페이지의 하이라이트 조회
      const highlights = await Highlight.findByPdfUserAndPage(this.db, pdfId, userId, pageNumber);
      res.json(highlights);
    } catch (error) {
      console.error('페이지 하이라이트 조회 에러:', error);
      res.status(500).json({ error: '페이지 하이라이트 조회에 실패했습니다.' });
    }
  }
}

module.exports = HighlightController;
