const multer = require('multer');
const AWS = require('aws-sdk');
const { ObjectId } = require('mongodb');
const PdfDocument = require('../models/PdfDocument');

// AWS S3 설정
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'ap-northeast-2'
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'noteilus-pdfs';

// Multer 설정 - 메모리에 파일 저장 (S3로 업로드 후 삭제)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // PDF 파일만 허용
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('PDF 파일만 업로드 가능합니다.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB 제한
  }
});

class PdfController {
  constructor(db) {
    this.db = db;
    this.pdfDocument = new PdfDocument(db);
  }

  // PDF 업로드
  async uploadPdf(req, res) {
    try {
      // 로그인 확인
      if (!req.user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
      }

      // multer 미들웨어 실행
      upload.single('pdf')(req, res, async (err) => {
        if (err) {
          return res.status(400).json({ error: err.message });
        }

        if (!req.file) {
          return res.status(400).json({ error: 'PDF 파일을 선택해주세요.' });
        }

        try {
          const file = req.file;
          // 사용자 ID 가져오기 (googleId 또는 kakaoId)
          const userId = req.user.googleId || req.user.kakaoId;
          
          if (!userId) {
            return res.status(400).json({ error: '사용자 ID를 찾을 수 없습니다.' });
          }
          
          // S3에 업로드할 파일명 생성
          const fileName = `pdfs/${userId}/${Date.now()}-${Math.round(Math.random() * 1E9)}.pdf`;
          
          // S3 업로드 파라미터 - 모든 파일명을 "test"로 설정
          const uploadParams = {
            Bucket: BUCKET_NAME,
            Key: fileName,
            Body: file.buffer,
            ContentType: file.mimetype,
            Metadata: {
              originalname: 'test.pdf',
              userid: userId.toString()
            }
          };

          // S3에 파일 업로드
          const s3Result = await s3.upload(uploadParams).promise();
          
          // DB에 메타데이터 저장
          const pdfData = {
            userId: userId,
            fileName: 'test.pdf',  // 모든 파일명을 "test"로 설정
            originalFileName: file.originalname,  // 원본 파일명은 별도 저장
            s3Key: fileName,
            s3Url: s3Result.Location,
            fileSize: file.size,
            uploadDate: new Date()
          };

          const pdfId = await this.pdfDocument.create(pdfData);

          res.status(201).json({
            success: true,
            pdfId: pdfId,
            fileName: 'test.pdf',
            s3Url: s3Result.Location
          });

        } catch (error) {
          console.error('PDF 업로드 에러:', error);
          res.status(500).json({ error: 'PDF 업로드에 실패했습니다.' });
        }
      });

    } catch (error) {
      console.error('PDF 업로드 에러:', error);
      res.status(500).json({ error: 'PDF 업로드에 실패했습니다.' });
    }
  }

  // 사용자의 PDF 목록 조회
  async getUserPdfs(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
      }

      const userId = req.user.googleId || req.user.kakaoId;
      
      if (!userId) {
        return res.status(400).json({ error: '사용자 ID를 찾을 수 없습니다.' });
      }
      
      const pdfs = await this.pdfDocument.findByUserId(userId);
      
      // 프론트엔드에서 필요한 형태로 변환
      const formattedPdfs = pdfs.map(pdf => ({
        id: pdf._id.toString(),
        name: pdf.fileName,  // "test.pdf"로 표시
        type: 'pdf',
        previewImage: undefined,
        uploadDate: pdf.uploadDate
      }));

      res.json(formattedPdfs);

    } catch (error) {
      console.error('PDF 목록 조회 에러:', error);
      res.status(500).json({ error: 'PDF 목록을 가져올 수 없습니다.' });
    }
  }

  // PDF 다운로드 (S3에서 직접 다운로드)
  async downloadPdf(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
      }

      const { pdfId } = req.params;

      if (!ObjectId.isValid(pdfId)) {
        return res.status(400).json({ error: '유효하지 않은 PDF ID입니다.' });
      }

      // DB에서 PDF 정보 조회
      const pdf = await this.pdfDocument.findById(pdfId);
      
      if (!pdf) {
        return res.status(404).json({ error: 'PDF를 찾을 수 없습니다.' });
      }

      // 권한 확인 (본인의 PDF만 다운로드 가능)
      const userId = req.user.googleId || req.user.kakaoId;
      if (pdf.userId !== userId) {
        return res.status(403).json({ error: '다운로드 권한이 없습니다.' });
      }

      // S3에서 파일 다운로드
      const downloadParams = {
        Bucket: BUCKET_NAME,
        Key: pdf.s3Key
      };

      const s3Object = await s3.getObject(downloadParams).promise();
      
      // PDF 파일 응답
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${pdf.fileName}"`);
      res.send(s3Object.Body);

    } catch (error) {
      console.error('PDF 다운로드 에러:', error);
      res.status(500).json({ error: 'PDF 다운로드에 실패했습니다.' });
    }
  }

  // PDF 삭제
  async deletePdf(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
      }

      const { pdfId } = req.params;

      if (!ObjectId.isValid(pdfId)) {
        return res.status(400).json({ error: '유효하지 않은 PDF ID입니다.' });
      }

      // DB에서 PDF 정보 조회
      const pdf = await this.pdfDocument.findById(pdfId);
      
      if (!pdf) {
        return res.status(404).json({ error: 'PDF를 찾을 수 없습니다.' });
      }

      // 권한 확인 (본인의 PDF만 삭제 가능)
      const userId = req.user.googleId || req.user.kakaoId;
      if (pdf.userId !== userId) {
        return res.status(403).json({ error: '삭제 권한이 없습니다.' });
      }

      // S3에서 파일 삭제
      const deleteParams = {
        Bucket: BUCKET_NAME,
        Key: pdf.s3Key
      };

      await s3.deleteObject(deleteParams).promise();

      // DB에서 메타데이터 삭제
      await this.pdfDocument.deleteById(pdfId);

      res.json({ success: true, message: 'PDF가 삭제되었습니다.' });

    } catch (error) {
      console.error('PDF 삭제 에러:', error);
      res.status(500).json({ error: 'PDF 삭제에 실패했습니다.' });
    }
  }
}

module.exports = { PdfController };
