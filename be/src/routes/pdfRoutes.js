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

  /**
   * @route POST /api/pdfs/:pdfId/drawing
   * @desc 특정 페이지의 필기 데이터 저장
   */
  router.post('/:pdfId/drawing', (req, res) => pdfController.saveDrawingData(req, res));

  /**
   * @route GET /api/pdfs/:pdfId/drawing
   * @desc PDF의 모든 필기 데이터 조회
   */
  router.get('/:pdfId/drawing', (req, res) => pdfController.getDrawingData(req, res));

  /**
   * @route POST /api/pdfs/:pdfId/textmemos
   * @desc 특정 PDF의 텍스트 메모 저장
   */
  router.post('/:pdfId/textmemos', (req, res) => pdfController.saveTextMemos(req, res));

  /**
   * @route GET /api/pdfs/:pdfId/textmemos
   * @desc 특정 PDF의 모든 텍스트 메모 조회
   */
  router.get('/:pdfId/textmemos', (req, res) => pdfController.getTextMemos(req, res));

  return router;
}

module.exports = { createPdfRoutes };
