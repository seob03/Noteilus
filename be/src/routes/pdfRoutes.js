const { PdfController } = require('../controllers/pdfController');

function createPdfRoutes(db) {
  const pdfController = new PdfController(db);

  return function(req, res, next) {
    const { method, url } = req;

    // PDF 업로드
    if (method === 'POST' && url === '/api/pdfs/upload') {
      return pdfController.uploadPdf(req, res);
    }

    // 사용자의 PDF 목록 조회
    if (method === 'GET' && url === '/api/pdfs') {
      return pdfController.getUserPdfs(req, res);
    }

    // PDF 다운로드
    if (method === 'GET' && url.match(/^\/api\/pdfs\/[^\/]+\/download$/)) {
      const pdfId = url.split('/')[3];
      req.params = { pdfId };
      return pdfController.downloadPdf(req, res);
    }

    // PDF 삭제
    if (method === 'DELETE' && url.match(/^\/api\/pdfs\/[^\/]+$/)) {
      const pdfId = url.split('/')[3];
      req.params = { pdfId };
      return pdfController.deletePdf(req, res);
    }

    // 매칭되지 않는 요청은 다음 미들웨어로
    next();
  };
}

module.exports = { createPdfRoutes };
