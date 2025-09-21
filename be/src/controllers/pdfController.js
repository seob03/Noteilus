const multer = require('multer');
const AWS = require('aws-sdk');
const { ObjectId } = require('mongodb');
const PdfDocument = require('../models/PdfDocument');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'ap-northeast-2'
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'noteilus-bucket';

// exec을 Promise로 변환
const execAsync = promisify(exec);

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

  // SVG 썸네일 생성 함수 (단일 방식)
  async generateThumbnail(pdfBuffer, userId) {
    try {
      // 임시 디렉토리 생성
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-svg-thumbnail-'));
      const tempPdfPath = path.join(tempDir, 'temp.pdf');
      const tempSvgPath = path.join(tempDir, 'page-1.svg');

      // PDF 버퍼를 임시 파일로 저장
      fs.writeFileSync(tempPdfPath, pdfBuffer);

      // Poppler의 pdftocairo를 사용하여 SVG로 변환
      const command = `pdftocairo -svg -f 1 -l 1 "${tempPdfPath}" "${tempSvgPath}"`;
      const { stdout, stderr } = await execAsync(command);
      
      // SVG 파일이 생성되었는지 확인
      if (!fs.existsSync(tempSvgPath)) {
        throw new Error('SVG 파일 생성 실패 - 파일이 존재하지 않음');
      }

      // 생성된 SVG 파일 읽기
      const svgBuffer = fs.readFileSync(tempSvgPath);

      // SVG 파일이 비어있는지 확인
      if (svgBuffer.length === 0) {
        throw new Error('SVG 파일이 비어있음');
      }

      // S3에 SVG 업로드
      const svgKey = `thumbnails/${userId}/${Date.now()}-${Math.round(Math.random() * 1E9)}.svg`;
      const uploadParams = {
        Bucket: BUCKET_NAME,
        Key: svgKey,
        Body: svgBuffer,
        ContentType: 'image/svg+xml'
      };

      const uploadResult = await s3.upload(uploadParams).promise();

      // 임시 파일들 정리
      fs.rmSync(tempDir, { recursive: true, force: true });

      return uploadResult.Location; // S3 URL 반환

    } catch (error) {
      console.error('SVG 썸네일 생성 에러:', error);
      throw error;
    }
  }



  // 단일 페이지 SVG 처리 함수 (병렬 처리용)
  async processSinglePageSvg(tempDir, tempPdfPath, pageNum, userId) {
    try {
      const tempSvgPath = path.join(tempDir, `page-${pageNum}.svg`);
      
      // Poppler의 pdftocairo를 사용하여 특정 페이지를 SVG로 변환
      const command = `pdftocairo -svg -f ${pageNum} -l ${pageNum} "${tempPdfPath}" "${tempSvgPath}"`;
      
      const { stdout, stderr } = await execAsync(command);
      
      // SVG 파일이 생성되었는지 확인
      if (!fs.existsSync(tempSvgPath)) {
        throw new Error(`SVG 파일 생성 실패`);
      }

      // 생성된 SVG 파일 읽기
      const svgBuffer = fs.readFileSync(tempSvgPath);

      // SVG 파일이 비어있는지 확인
      if (svgBuffer.length === 0) {
        throw new Error(`SVG 파일이 비어있음`);
      }

      // S3에 SVG 업로드 (병렬 처리 최적화)
      const svgKey = `pdf-pages/${userId}/${Date.now()}-${Math.round(Math.random() * 1E9)}-page-${pageNum}.svg`;
      
      const uploadParams = {
        Bucket: BUCKET_NAME,
        Key: svgKey,
        Body: svgBuffer,
        ContentType: 'image/svg+xml',
        // S3 업로드 최적화 옵션
        ServerSideEncryption: 'AES256',
        CacheControl: 'public, max-age=31536000' // 1년 캐시
      };

      const uploadResult = await s3.upload(uploadParams).promise();

      return {
        pageNumber: pageNum,
        svgUrl: uploadResult.Location
      };

    } catch (error) {
      console.error(`페이지 ${pageNum} SVG 생성 실패:`, error);
      throw error;
    }
  }

  // PDF의 모든 페이지를 SVG로 변환하는 함수
  async generateAllPagesSvg(pdfBuffer, userId) {
    try {
      console.log('전체 페이지 SVG 생성 함수 시작, userId:', userId);
      
      // PDF 해시 생성 (캐싱용)
      const crypto = require('crypto');
      const pdfHash = crypto.createHash('md5').update(pdfBuffer).digest('hex');
      console.log('PDF 해시:', pdfHash);
      
      // 기존 SVG 캐시 확인 (같은 PDF가 이미 처리되었는지)
      const existingPdf = await this.pdfDocument.findByPdfHash(userId, pdfHash);
      
      if (existingPdf && existingPdf.allPagesSvg && existingPdf.allPagesSvg.length > 0) {
        console.log('기존 SVG 캐시 발견, 재사용:', existingPdf.allPagesSvg.length, '페이지');
        return existingPdf.allPagesSvg;
      }
      
      // 임시 디렉토리 생성
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-all-svg-'));
      const tempPdfPath = path.join(tempDir, 'temp.pdf');

      // PDF 버퍼를 임시 파일로 저장
      fs.writeFileSync(tempPdfPath, pdfBuffer);

      // PDF 페이지 수 확인
      const pageCountCommand = `pdfinfo "${tempPdfPath}" | grep Pages | awk '{print $2}'`;
      const { stdout: pageCountOutput } = await execAsync(pageCountCommand);
      const totalPages = parseInt(pageCountOutput.trim());

      if (totalPages === 0) {
        throw new Error('PDF 페이지 수를 확인할 수 없습니다.');
      }

      // 병렬 처리를 위한 배치 크기 설정 (CPU 코어 수에 맞게 동적 조정)
      const CPU_CORES = os.cpus().length;
      const BATCH_SIZE = Math.max(2, Math.min(CPU_CORES, 8)); // 최소 2, 최대 8
      console.log(`CPU 코어 수: ${CPU_CORES}, 배치 크기: ${BATCH_SIZE}`);
      const svgUrls = [];

      // 페이지를 배치로 나누어 병렬 처리
      for (let batchStart = 1; batchStart <= totalPages; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, totalPages);
        console.log(`배치 처리: 페이지 ${batchStart}-${batchEnd}/${totalPages}`);
        
        // 현재 배치의 페이지들을 병렬로 처리
        const batchPromises = [];
        for (let pageNum = batchStart; pageNum <= batchEnd; pageNum++) {
          batchPromises.push(this.processSinglePageSvg(tempDir, tempPdfPath, pageNum, userId));
        }
        
        // 배치 내 모든 페이지 처리 완료 대기
        const batchResults = await Promise.allSettled(batchPromises);
        
        // 성공한 결과들만 수집
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            svgUrls.push(result.value);
          } else if (result.status === 'rejected') {
            console.error(`페이지 ${batchStart + index} 처리 실패:`, result.reason);
          }
        });
      }

      // 임시 파일들 정리
      fs.rmSync(tempDir, { recursive: true, force: true });

      return svgUrls;

    } catch (error) {
      console.error('전체 페이지 SVG 생성 에러:', error);
      console.error('전체 페이지 SVG 생성 에러 상세:', error.message);
      console.error('전체 페이지 SVG 생성 에러 스택:', error.stack);
      throw error;
    }
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

          // Mistral Document AI로 OCR 작업 시작
          let ocrText = '';
          try {
            const mistralApiKey = process.env.MISTRAL_API_KEY;
            if (mistralApiKey) {
              // PDF를 base64로 인코딩
              const base64Pdf = file.buffer.toString('base64');
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

              if (response.ok) {
                const result = await response.json();
                // OCR 결과에서 모든 페이지의 markdown 텍스트를 추출
                if (result.pages && result.pages.length > 0) {
                  ocrText = result.pages.map(page => page.markdown || '').join('\n\n');
                }
                // console.log('OCR 응답 전체 구조:', JSON.stringify(result, null, 2));
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

          // 4단계: SVG 썸네일 생성
          let thumbnailUrl = null;
          try {
            thumbnailUrl = await this.generateThumbnail(file.buffer, userId);
          } catch (thumbnailError) {
            console.error('SVG 썸네일 생성 실패:', thumbnailError);
            // 썸네일 생성 실패해도 PDF 업로드는 계속 진행
          }

          // 5단계: 전체 페이지 SVG 생성 (PDF 뷰어용)
          let allPagesSvg = null;
          try {
            allPagesSvg = await this.generateAllPagesSvg(file.buffer, userId);
          } catch (svgError) {
            console.error('전체 페이지 SVG 생성 실패:', svgError);
            console.error('SVG 에러 상세:', svgError.message);
            console.error('SVG 에러 스택:', svgError.stack);
            // SVG 생성 실패해도 PDF 업로드는 계속 진행
          }
          // 6단계: PyMuPDF로 텍스트 스팬 추출 (폰트/사이즈 포함)
          let textSpans = null;
          try {
            const tempTextDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-text-mupdf-'));
            const tempPdfForText = path.join(tempTextDir, 'temp.pdf');
            fs.writeFileSync(tempPdfForText, file.buffer);
            const extractCmd = `python /app/src/utils/extract_text.py "${tempPdfForText}"`;
            const { stdout } = await execAsync(extractCmd);
            const parsed = JSON.parse(stdout);
            if (parsed && Array.isArray(parsed.pages)) {
              textSpans = parsed.pages.flatMap(p => Array.isArray(p.spans) ? p.spans : []);
            }
            fs.rmSync(tempTextDir, { recursive: true, force: true });
          } catch (textErr) {
            console.error('PyMuPDF 텍스트 추출 실패:', textErr);
          }
          

          // 7단계: DB 업데이트 (S3 URL, 썸네일 데이터, SVG 페이지 데이터, 텍스트 스팬 추가, 상태 완료)
          const crypto = require('crypto');
          const pdfHash = crypto.createHash('md5').update(file.buffer).digest('hex');
          
          const updateData = {
            s3Url: s3Result.Location,
            status: 'completed',
            pdfHash: pdfHash // PDF 해시 저장 (캐싱용)
          };

          // 썸네일 URL이 있으면 추가
          if (thumbnailUrl) {
            updateData.thumbnailUrl = thumbnailUrl;
            updateData.thumbnailType = 'svg';
          }

          // 전체 페이지 SVG 데이터가 있으면 추가
          if (allPagesSvg && allPagesSvg.length > 0) {
            updateData.allPagesSvg = allPagesSvg; // 전체 페이지 SVG URL 배열 저장
            updateData.totalPages = allPagesSvg.length; // 총 페이지 수 저장
          }

          // 텍스트 스팬 데이터 저장
          if (textSpans && textSpans.length > 0) {
            updateData.textSpans = textSpans;
          }

          await this.pdfDocument.updateById(pdfId, updateData);

          const responseData = {
            success: true,
            pdfId: pdfId,
            fileName: originalFileName,
            s3Url: s3Result.Location
          };

          // 썸네일 URL이 있으면 응답에 포함
          if (thumbnailUrl) {
            responseData.thumbnailUrl = thumbnailUrl;
            responseData.thumbnailType = 'svg';
          }

          // 전체 페이지 SVG 데이터가 있으면 응답에 포함
          if (allPagesSvg && allPagesSvg.length > 0) {
            responseData.allPagesSvg = allPagesSvg;
            responseData.totalPages = allPagesSvg.length;
          }

          if (textSpans && textSpans.length > 0) {
            responseData.textSpans = textSpans;
          }

          res.status(201).json(responseData);

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
      const formattedPdfs = pdfs.map(pdf => {
        return {
          _id: pdf._id.toString(),
          id: pdf._id.toString(),
          name: pdf.fileName,  // 실제 파일명 표시
          originalName: pdf.fileName,
          type: 'pdf',
        previewImage: pdf.thumbnailUrl || undefined, // SVG 썸네일 URL
        thumbnailType: pdf.thumbnailType || 'svg', // 썸네일 타입
          allPagesSvg: pdf.allPagesSvg || undefined, // 전체 페이지 SVG URL 배열
          totalPages: pdf.totalPages || undefined, // 총 페이지 수
          textSpans: pdf.textSpans || undefined,
          folderId: pdf.folderId || null,
          uploadDate: pdf.uploadDate
        };
      });

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