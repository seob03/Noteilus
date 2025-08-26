const multer = require('multer');
const AWS = require('aws-sdk');
const { ObjectId } = require('mongodb');
const PdfDocument = require('../models/PdfDocument');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'ap-northeast-2'
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'noteilus-bucket';

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
    fileSize: 500 * 1024 * 1024 // 500MB
  },
  preservePath: true
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
          
          // 한국어 파일명 디코딩 처리
          let originalFileName = file.originalname;
          try {
            // UTF-8로 디코딩 시도
            originalFileName = decodeURIComponent(escape(file.originalname));
          } catch (decodeError) {
            originalFileName = file.originalname;
          }
          
          // 사용자 ID 가져오기 (googleId 또는 kakaoId)
          const userId = req.user.googleId || req.user.kakaoId;
          
          if (!userId) {
            return res.status(400).json({ error: '사용자 ID를 찾을 수 없습니다.' });
          }
          
          // S3에 업로드할 파일명 생성
          const fileName = `pdfs/${userId}/${Date.now()}-${Math.round(Math.random() * 1E9)}.pdf`;

          // 여기에 mistral API로 OCR 작업한 뒤, 해당 결과를 아래 DB 저장할 때 같이 저장, 필드명은 ocrText로 저장해줘줘
          let ocrText = '';
          try {
            const mistralApiKey = process.env.MISTRAL_API_KEY;
            if (mistralApiKey) {
              console.log('Mistral API 키 확인됨, OCR 처리 시작...');
              
              // PDF를 base64로 인코딩
              const base64Pdf = file.buffer.toString('base64');
              console.log('PDF base64 인코딩 완료, 크기:', base64Pdf.length);
              
              // Mistral AI OCR API 호출
              const response = await fetch('https://api.mistral.ai/v1/ocr', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${mistralApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: "mistral-ocr-latest",
                  document: {
                    type: "document_url",
                    document_url: `data:application/pdf;base64,${base64Pdf}`
                  },
                  include_image_base64: true
                })
              });

              console.log('Mistral API 응답 상태:', response.status, response.statusText);
              console.log('Mistral API 응답 헤더:', Object.fromEntries(response.headers.entries()));

              if (response.ok) {
                const result = await response.json();
                // OCR 결과에서 모든 페이지의 markdown 텍스트를 추출
                if (result.pages && result.pages.length > 0) {
                  ocrText = result.pages.map(page => page.markdown || '').join('\n\n');
                }
                console.log('OCR 처리 완료:', originalFileName);
                console.log('OCR 결과 길이:', ocrText.length);
              } else {
                const errorText = await response.text();
                console.error('OCR 처리 실패 - 상태:', response.status);
                console.error('OCR 처리 실패 - 응답:', errorText);
                
                // JSON 파싱 시도
                try {
                  const errorJson = JSON.parse(errorText);
                  console.error('OCR 처리 실패 - JSON:', errorJson);
                } catch (parseError) {
                  console.error('OCR 처리 실패 - 텍스트 응답:', errorText);
                }
              }
            } else {
              console.log('Mistral API 키가 설정되지 않음, OCR 처리 건너뜀');
            }
          } catch (ocrError) {
            console.error('OCR 처리 중 오류:', ocrError);
            console.error('OCR 오류 상세:', ocrError.message);
            console.error('OCR 오류 스택:', ocrError.stack);
            // OCR 실패해도 PDF 업로드는 계속 진행
          }

          
          // 1단계: DB에 메타데이터 먼저 저장 (상태: 업로드 중)
          const pdfData = {
            userId: userId,
            fileName: originalFileName,  // 디코딩된 파일명 저장
            originalFileName: originalFileName,  // 디코딩된 파일명 저장
            s3Key: fileName,
            s3Url: '',  // 임시로 빈 값
            fileSize: file.size,
            uploadDate: new Date(),
            status: 'uploading',  // 업로드 상태 추가
            ocrText: ocrText  // OCR 결과 저장
          };

          let pdfId = null; // 변수 스코프를 위해 선언
          pdfId = await this.pdfDocument.create(pdfData);

            // 2단계: S3 업로드 파라미터
            const uploadParams = {
              Bucket: BUCKET_NAME,
              Key: fileName,
              Body: file.buffer,
              ContentType: file.mimetype,
              Metadata: {
                originalname: Buffer.from(originalFileName, 'utf8').toString('base64'), // Base64로 인코딩
                userid: userId.toString()
              }
            };

          // 3단계: S3에 파일 업로드
          const s3Result = await s3.upload(uploadParams).promise();

          // 4단계: DB 업데이트 (S3 URL 추가, 상태 완료)
          await this.pdfDocument.updateById(pdfId, {
            s3Url: s3Result.Location,
            status: 'completed'
          });

          res.status(201).json({
            success: true,
            pdfId: pdfId,
            fileName: originalFileName,
            s3Url: s3Result.Location
          });

        } catch (error) {
          console.error('PDF 업로드 에러:', error);
          
          // S3 업로드 실패 시 DB에서 해당 레코드 삭제
          if (pdfId) {
            try {
              await this.pdfDocument.deleteById(pdfId);
            } catch (deleteError) {
              console.error('DB 레코드 삭제 실패:', deleteError);
            }
          }
          
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
        name: pdf.fileName,  // 실제 파일명 표시
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
      
      // PDF 파일 응답 (한국어 파일명 처리)
      res.setHeader('Content-Type', 'application/pdf');
      
      // 한국어 파일명을 위한 UTF-8 인코딩 처리
      const encodedFileName = encodeURIComponent(pdf.fileName);
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodedFileName}`);
      
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
