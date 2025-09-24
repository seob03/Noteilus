const express = require('express');
const router = express.Router();
const NoteController = require('../controllers/noteController');

let noteController;

const setNoteController = (db) => {
  noteController = new NoteController(db);
};

const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }
  next();
};

// Create
router.post('/:pdfId/notes', requireAuth, async (req, res) => {
  if (!noteController) return res.status(500).json({ error: '서버 초기화 중입니다.' });
  await noteController.create(req, res);
});

// List all notes for pdf
router.get('/:pdfId/notes', requireAuth, async (req, res) => {
  if (!noteController) return res.status(500).json({ error: '서버 초기화 중입니다.' });
  await noteController.list(req, res);
});

// List notes by page
router.get('/:pdfId/notes/page/:pageNumber', requireAuth, async (req, res) => {
  if (!noteController) return res.status(500).json({ error: '서버 초기화 중입니다.' });
  await noteController.listByPage(req, res);
});

// Update (move/resize/edit)
router.put('/notes/:noteId', requireAuth, async (req, res) => {
  if (!noteController) return res.status(500).json({ error: '서버 초기화 중입니다.' });
  await noteController.update(req, res);
});

// Delete
router.delete('/notes/:noteId', requireAuth, async (req, res) => {
  if (!noteController) return res.status(500).json({ error: '서버 초기화 중입니다.' });
  await noteController.remove(req, res);
});

module.exports = { router, setNoteController };



