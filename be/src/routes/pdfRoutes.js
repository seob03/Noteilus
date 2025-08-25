const express = require('express');
const { PdfController } = require('../controllers/pdfController');

function createPdfRoutes(db) {
  const router = express.Router();
  const pdfController = new PdfController(db);

  /**
   * @route POST /api/pdfs/upload
   * @desc PDF 파일 업로드
   */
  router.post('/upload', (req, res) => pdfController.uploadPdf(req, res));

  /**
   * @route GET /api/pdfs
   * @desc 사용자의 PDF 목록 조회
   */
  router.get('/', (req, res) => pdfController.getUserPdfs(req, res));

  /**
   * @route GET /api/pdfs/:pdfId/download
   * @desc 특정 PDF 파일 다운로드
   */
  router.get('/:pdfId/download', (req, res) => pdfController.downloadPdf(req, res));

  /**
   * @route DELETE /api/pdfs/:pdfId
   * @desc 특정 PDF 파일 삭제
   */
  router.delete('/:pdfId', (req, res) => pdfController.deletePdf(req, res));

  return router;
}

module.exports = { createPdfRoutes };
