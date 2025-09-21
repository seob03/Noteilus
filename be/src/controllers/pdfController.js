const multer = require('multer');
const AWS = require('aws-sdk');
const { ObjectId } = require('mongodb');
const PdfDocument = require('../models/PdfDocument');
const ChatMessage = require('../models/ChatMessage');
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
    this.chatMessage = new ChatMessage(db);
  }

  // OCR 처리 함수
  async processOCR(pdfBuffer) {
    try {
      const mistralApiKey = process.env.MISTRAL_API_KEY;
      if (!mistralApiKey) {
        return '';
      }

      // PDF를 base64로 인코딩
      const base64Pdf = pdfBuffer.toString('base64');
      
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
          return result.pages.map(page => page.markdown || '').join('\n\n');
        }
      } else {
        const errorText = await response.text();
        console.error('OCR 처리 실패 - 상태:', response.status);
        console.error('OCR 처리 실패 - 응답:', errorText);
      }
      
      return '';
    } catch (error) {
      console.error('OCR 처리 중 오류:', error);
      return '';
    }
  }

  // 텍스트 스팬 추출 함수
  async extractTextSpans(pdfBuffer) {
    try {
      const tempTextDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-text-mupdf-'));
      const tempPdfForText = path.join(tempTextDir, 'temp.pdf');
      fs.writeFileSync(tempPdfForText, pdfBuffer);
      const extractCmd = `python /app/src/utils/extract_text.py "${tempPdfForText}"`;
      const { stdout } = await execAsync(extractCmd);
      const parsed = JSON.parse(stdout);
      fs.rmSync(tempTextDir, { recursive: true, force: true });
      
      if (parsed && Array.isArray(parsed.pages)) {
        return parsed.pages.flatMap(p => Array.isArray(p.spans) ? p.spans : []);
      }
      return [];
    } catch (error) {
      console.error('PyMuPDF 텍스트 추출 실패:', error);
      return [];
    }
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

          // 1단계: DB에 메타데이터 먼저 저장 (상태: 업로드 중)
          const pdfData = {
            userId: userId,
            fileName: originalFileName,
            originalFileName: originalFileName,
            s3Key: fileName,
            s3Url: '',
            fileSize: file.size,
            uploadDate: new Date(),
            status: 'uploading',
            ocrText: '' // 초기값으로 빈 문자열
          };

          let pdfId = await this.pdfDocument.create(pdfData);

          // 2단계: S3 업로드
          const uploadParams = {
            Bucket: BUCKET_NAME,
            Key: fileName,
            Body: file.buffer,
            ContentType: file.mimetype,
            Metadata: {
              originalname: Buffer.from(originalFileName, 'utf8').toString('base64'),
              userid: userId.toString()
            }
          };

          const s3Result = await s3.upload(uploadParams).promise();

          // 3단계: 병렬 처리 - 모든 후처리 작업을 동시에 실행
          console.log('병렬 처리 시작 - OCR, 썸네일, SVG, 텍스트 추출');
          const startTime = Date.now();

          const [ocrResult, thumbnailResult, svgResult, textResult] = await Promise.allSettled([
            this.processOCR(file.buffer),
            this.generateThumbnail(file.buffer, userId),
            this.generateAllPagesSvg(file.buffer, userId),
            this.extractTextSpans(file.buffer)
          ]);

          const endTime = Date.now();
          console.log(`병렬 처리 완료 - 소요시간: ${endTime - startTime}ms`);

          // 결과 추출
          const ocrText = ocrResult.status === 'fulfilled' ? ocrResult.value : '';
          const thumbnailUrl = thumbnailResult.status === 'fulfilled' ? thumbnailResult.value : null;
          const allPagesSvg = svgResult.status === 'fulfilled' ? svgResult.value : null;
          const textSpans = textResult.status === 'fulfilled' ? textResult.value : null;

          // 에러 로깅
          if (ocrResult.status === 'rejected') {
            console.error('OCR 처리 실패:', ocrResult.reason);
          }
          if (thumbnailResult.status === 'rejected') {
            console.error('썸네일 생성 실패:', thumbnailResult.reason);
          }
          if (svgResult.status === 'rejected') {
            console.error('SVG 생성 실패:', svgResult.reason);
          }
          if (textResult.status === 'rejected') {
            console.error('텍스트 추출 실패:', textResult.reason);
          }
          

          // 4단계: DB 업데이트 (모든 처리 결과 저장)
          const crypto = require('crypto');
          const pdfHash = crypto.createHash('md5').update(file.buffer).digest('hex');
          
          const updateData = {
            s3Url: s3Result.Location,
            status: 'completed',
            pdfHash: pdfHash,
            ocrText: ocrText // OCR 결과 저장
          };

          // 썸네일 URL이 있으면 추가
          if (thumbnailUrl) {
            updateData.thumbnailUrl = thumbnailUrl;
            updateData.thumbnailType = 'svg';
          }

          // 전체 페이지 SVG 데이터가 있으면 추가
          if (allPagesSvg && allPagesSvg.length > 0) {
            updateData.allPagesSvg = allPagesSvg;
            updateData.totalPages = allPagesSvg.length;
          }

          // 텍스트 스팬 데이터 저장
          if (textSpans && textSpans.length > 0) {
            updateData.textSpans = textSpans;
          }

          await this.pdfDocument.updateById(pdfId, updateData);

          // 5단계: 응답 데이터 구성
          const responseData = {
            success: true,
            pdfId: pdfId,
            fileName: originalFileName,
            s3Url: s3Result.Location,
            processingTime: endTime - startTime, // 병렬 처리 소요시간 포함
            status: 'completed'
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

          console.log(`PDF 업로드 완료 - ID: ${pdfId}, 처리시간: ${endTime - startTime}ms`);
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

  // PDF 텍스트 기반 채팅 기능 (스트림 방식)
  async chatWithPdf(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
      }

      const { pdfId } = req.params;
      const { question, selectedText } = req.body;

      if (!ObjectId.isValid(pdfId)) {
        return res.status(400).json({ error: '유효하지 않은 PDF ID입니다.' });
      }

      if (!question || question.trim() === '') {
        return res.status(400).json({ error: '질문을 입력해주세요.' });
      }

      // DB에서 PDF 정보 조회
      const pdf = await this.pdfDocument.findById(pdfId);

      if (!pdf) {
        return res.status(404).json({ error: 'PDF를 찾을 수 없습니다.' });
      }

      // 권한 확인
      const userId = req.user.googleId || req.user.kakaoId;
      if (pdf.userId !== userId) {
        return res.status(403).json({ error: '조회 권한이 없습니다.' });
      }

      // OCR 텍스트가 없으면 에러
      if (!pdf.ocrText || pdf.ocrText.trim() === '') {
        return res.status(400).json({ error: 'PDF 텍스트가 없습니다.' });
      }

      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        return res.status(500).json({ error: 'OpenAI API 키가 설정되지 않았습니다.' });
      }

      // 사용자 메시지를 DB에 저장
      const userMessageId = await this.chatMessage.create({
        pdfId: new ObjectId(pdfId),
        userId: userId,
        type: 'user',
        message: question,
        selectedText: selectedText || null
      });

      // AI 응답 메시지 ID 생성 (스트리밍 중 업데이트용)
      const aiMessageId = await this.chatMessage.create({
        pdfId: new ObjectId(pdfId),
        userId: userId,
        type: 'ai',
        message: '', // 빈 메시지로 시작
        selectedText: selectedText || null
      });

      // 프롬프트 구성
      let contextText = pdf.ocrText;
      if (selectedText && selectedText.trim() !== '') {
        contextText = `선택된 텍스트: "${selectedText}"\n\n전체 문서 내용:\n${pdf.ocrText}`;
      }

      const systemPrompt = `당신은 PDF 문서 분석 전문가입니다. 사용자가 제공한 PDF 문서의 내용을 바탕으로 정확하고 도움이 되는 답변을 제공해주세요.

답변 가이드라인:
- PDF 문서의 내용을 정확히 참조하여 답변
- 선택된 텍스트가 있다면 해당 부분을 중점적으로 분석
- 구체적이고 실용적인 정보 제공
- 한국어로 자연스럽게 답변
- 문서에 없는 내용은 추측하지 말고 명시적으로 표시
- 필요시 문서의 관련 부분을 인용

답변 형식 (마크다운 사용):
- 제목: # 제목 (최대 3단계까지만 사용: # ## ###)
- 중요한 내용: **굵은 글씨** 또는 *기울임*
- 목록: * 항목 또는 - 항목 또는 1. 번호 목록
- 코드: \`인라인 코드\` 또는 \`\`\`코드 블록\`\`\`
- 문단 구분: 빈 줄로 구분
- 절대 사용하지 말 것: #### (4단계 헤더), 복잡한 마크다운 문법

예시 형식:
# 주요 내용
이것은 **중요한** 내용입니다.

## 세부 설명
* 기울임 텍스트
* 목록 항목 1
* 목록 항목 2

### 추가 정보
\`코드 예시\`를 포함할 수 있습니다.`;

      // 스트림 응답 설정
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

      // OpenAI API 호출 (스트림)
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: `문서 내용:\n${contextText}\n\n질문: ${question}`
            }
          ],
          stream: true,
          max_tokens: 2000,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API 호출 실패:', response.status, errorText);
        
        // 에러 메시지를 AI 메시지로 업데이트
        await this.chatMessage.updateById(aiMessageId, {
          message: 'AI 응답 생성에 실패했습니다.'
        });
        
        return res.status(500).json({ error: 'AI 응답 생성에 실패했습니다.' });
      }

      // 스트림 데이터 처리
      console.log('🚀 스트리밍 시작 - OpenAI API 응답 처리 시작');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let chunkCount = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('✅ 스트리밍 완료 - 총 청크 수:', chunkCount, '전체 응답 길이:', fullResponse.length);
            break;
          }

          chunkCount++;
          const chunk = decoder.decode(value, { stream: true });
          console.log(`📦 청크 #${chunkCount} 수신:`, chunk.length, 'bytes');
          
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              
              if (data === '[DONE]') {
                console.log('🏁 OpenAI 스트림 완료 신호 수신');
                // 최종 응답을 DB에 저장
                await this.chatMessage.updateById(aiMessageId, {
                  message: fullResponse
                });
                res.write('data: [DONE]\n\n');
                res.end();
                return;
              }

              if (data === '') {
                continue;
              }

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                
                if (content) {
                  fullResponse += content;
                  console.log('텍스트 청크 전송:', content);
                  // SSE 형식으로 전송
                  res.write(`data: ${JSON.stringify({ content })}\n\n`);
                  // 즉시 전송 보장
                  if (res.flush) {
                    res.flush();
                  }
                }
              } catch (parseError) {
                // JSON 파싱 에러는 무시하고 계속 진행
                console.log(' JSON 파싱 에러:', parseError.message, 'Data:', data);
                continue;
              }
            }
          }
        }
        
        // 최종 응답은 이미 [DONE] 신호에서 저장했으므로 여기서는 저장하지 않음
        
      } finally {
        reader.releaseLock();
        res.end();
        console.log('🔚 스트리밍 연결 종료');
      }

    } catch (error) {
      console.error('PDF 채팅 에러:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: '채팅 처리에 실패했습니다.' });
      }
    }
  }

  // PDF 채팅 히스토리 조회
  async getChatHistory(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
      }

      const { pdfId } = req.params;
      const userId = req.user.googleId || req.user.kakaoId;

      if (!ObjectId.isValid(pdfId)) {
        return res.status(400).json({ error: '유효하지 않은 PDF ID입니다.' });
      }

      if (!userId) {
        return res.status(400).json({ error: '사용자 ID를 찾을 수 없습니다.' });
      }

      // PDF 존재 및 권한 확인
      const pdf = await this.pdfDocument.findById(pdfId);
      if (!pdf) {
        return res.status(404).json({ error: 'PDF를 찾을 수 없습니다.' });
      }

      if (pdf.userId !== userId) {
        return res.status(403).json({ error: '조회 권한이 없습니다.' });
      }

      // 채팅 히스토리 조회
      const chatHistory = await this.chatMessage.findByPdfId(pdfId, userId);

      // 프론트엔드에서 필요한 형태로 변환
      const formattedHistory = chatHistory.map(msg => ({
        id: msg._id.toString(),
        type: msg.type,
        message: msg.message,
        createdAt: msg.createdAt
      }));

      res.json(formattedHistory);

    } catch (error) {
      console.error('채팅 히스토리 조회 에러:', error);
      res.status(500).json({ error: '채팅 히스토리를 가져올 수 없습니다.' });
    }
  }

  // PDF 채팅 히스토리 삭제
  async deleteChatHistory(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
      }

      const { pdfId } = req.params;
      const userId = req.user.googleId || req.user.kakaoId;

      if (!ObjectId.isValid(pdfId)) {
        return res.status(400).json({ error: '유효하지 않은 PDF ID입니다.' });
      }

      if (!userId) {
        return res.status(400).json({ error: '사용자 ID를 찾을 수 없습니다.' });
      }

      // PDF 존재 및 권한 확인
      const pdf = await this.pdfDocument.findById(pdfId);
      if (!pdf) {
        return res.status(404).json({ error: 'PDF를 찾을 수 없습니다.' });
      }

      if (pdf.userId !== userId) {
        return res.status(403).json({ error: '삭제 권한이 없습니다.' });
      }

      // 채팅 히스토리 삭제
      const deletedCount = await this.chatMessage.deleteByPdfId(pdfId, userId);

      res.json({ 
        success: true, 
        message: '채팅 히스토리가 삭제되었습니다.',
        deletedCount 
      });

    } catch (error) {
      console.error('채팅 히스토리 삭제 에러:', error);
      res.status(500).json({ error: '채팅 히스토리 삭제에 실패했습니다.' });
    }
  }
}
module.exports = { PdfController };