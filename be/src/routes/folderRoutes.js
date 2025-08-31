const express = require('express');
const { FolderController } = require('../controllers/folderController');

function createFolderRoutes(db) {
  const router = express.Router();
  const folderController = new FolderController(db);

  /**
   * @route POST /api/folders
   * @desc 새 폴더 생성
   */
  router.post('/', (req, res) => folderController.createFolder(req, res));

  /**
   * @route GET /api/folders
   * @desc 사용자의 모든 폴더 조회
   */
  router.get('/', (req, res) => folderController.getUserFolders(req, res));

  /**
   * @route GET /api/folders/:folderId
   * @desc 특정 폴더 조회 (내용 포함)
   */
  router.get('/:folderId', (req, res) => folderController.getFolder(req, res));

  /**
   * @route DELETE /api/folders/:folderId
   * @desc 폴더 삭제
   */
  router.delete('/:folderId', (req, res) => folderController.deleteFolder(req, res));

  /**
   * @route PUT /api/folders/:folderId/rename
   * @desc 폴더 이름 변경
   */
  router.put('/:folderId/rename', (req, res) => folderController.renameFolder(req, res));

  /**
   * @route PUT /api/folders/:folderId/move
   * @desc 폴더 이동
   */
  router.put('/:folderId/move', (req, res) => folderController.moveFolder(req, res));

  /**
   * @route POST /api/folders/:folderId/pdfs
   * @desc 폴더에 PDF 파일 추가
   */
  router.post('/:folderId/pdfs', (req, res) => folderController.addPdfToFolder(req, res));

  /**
   * @route DELETE /api/folders/:folderId/pdfs/:pdfId
   * @desc 폴더에서 PDF 파일 제거
   */
  router.delete('/:folderId/pdfs/:pdfId', (req, res) => folderController.removePdfFromFolder(req, res));

  return router;
}

module.exports = { createFolderRoutes };
