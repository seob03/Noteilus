const Note = require('../models/Note');
const { ObjectId } = require('mongodb');

class NoteController {
  constructor(db) {
    this.db = db;
  }

  async create(req, res) {
    try {
      const pdfId = req.params.pdfId;
      const userId = req.user?.googleId || req.user?.kakaoId || req.user?.id;
      if (!userId) return res.status(401).json({ error: '인증이 필요합니다.' });

      const pdfDoc = await this.db.collection('pdfs').findOne({ _id: new ObjectId(pdfId) });
      if (!pdfDoc) return res.status(404).json({ error: 'PDF 문서를 찾을 수 없습니다.' });

      const { text, pageNumber, x, y, width, height, pageWidth, pageHeight, fontSize, color, bold, italic, underline, minimized } = req.body;
      const noteData = { pdfId, userId, text, pageNumber, x, y, width, height, pageWidth, pageHeight, fontSize, color, bold, italic, underline, minimized };
      const saved = await Note.create(this.db, noteData);
      res.status(201).json(saved);
    } catch (err) {
      console.error('노트 생성 에러:', err);
      res.status(500).json({ error: '노트 생성에 실패했습니다.' });
    }
  }

  async list(req, res) {
    try {
      const pdfId = req.params.pdfId;
      const userId = req.user?.googleId || req.user?.kakaoId || req.user?.id;
      if (!userId) return res.status(401).json({ error: '인증이 필요합니다.' });

      const pdfDoc = await this.db.collection('pdfs').findOne({ _id: new ObjectId(pdfId) });
      if (!pdfDoc) return res.status(404).json({ error: 'PDF 문서를 찾을 수 없습니다.' });

      const notes = await Note.findByPdfAndUser(this.db, pdfId, userId);
      res.json(notes);
    } catch (err) {
      console.error('노트 목록 에러:', err);
      res.status(500).json({ error: '노트 조회에 실패했습니다.' });
    }
  }

  async listByPage(req, res) {
    try {
      const pdfId = req.params.pdfId;
      const pageNumber = parseInt(req.params.pageNumber);
      const userId = req.user?.googleId || req.user?.kakaoId || req.user?.id;
      if (!userId) return res.status(401).json({ error: '인증이 필요합니다.' });

      const pdfDoc = await this.db.collection('pdfs').findOne({ _id: new ObjectId(pdfId) });
      if (!pdfDoc) return res.status(404).json({ error: 'PDF 문서를 찾을 수 없습니다.' });

      const notes = await Note.findByPdfUserAndPage(this.db, pdfId, userId, pageNumber);
      res.json(notes);
    } catch (err) {
      console.error('노트 페이지별 조회 에러:', err);
      res.status(500).json({ error: '노트 조회에 실패했습니다.' });
    }
  }

  async update(req, res) {
    try {
      const noteId = req.params.noteId;
      const userId = req.user?.googleId || req.user?.kakaoId || req.user?.id;
      if (!userId) return res.status(401).json({ error: '인증이 필요합니다.' });

      const updates = {};
      const allowed = ['text', 'x', 'y', 'width', 'height', 'fontSize', 'color', 'bold', 'italic', 'underline', 'minimized'];
      for (const key of allowed) {
        if (key in req.body) updates[key] = req.body[key];
      }

      const updated = await Note.updateById(this.db, noteId, userId, updates);
      if (!updated) return res.status(404).json({ error: '노트를 찾을 수 없습니다.' });
      res.json(updated);
    } catch (err) {
      console.error('노트 업데이트 에러:', err);
      res.status(500).json({ error: '노트 업데이트에 실패했습니다.' });
    }
  }

  async remove(req, res) {
    try {
      const noteId = req.params.noteId;
      const userId = req.user?.googleId || req.user?.kakaoId || req.user?.id;
      if (!userId) return res.status(401).json({ error: '인증이 필요합니다.' });

      const note = await Note.findById(this.db, noteId, userId);
      if (!note) return res.status(404).json({ error: '노트를 찾을 수 없습니다.' });

      const deleted = await Note.deleteById(this.db, noteId, userId);
      if (!deleted) return res.status(500).json({ error: '노트 삭제에 실패했습니다.' });
      res.json({ message: '노트가 삭제되었습니다.' });
    } catch (err) {
      console.error('노트 삭제 에러:', err);
      res.status(500).json({ error: '노트 삭제에 실패했습니다.' });
    }
  }
}

module.exports = NoteController;


