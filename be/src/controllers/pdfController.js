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
        _id: pdf._id.toString(),
        id: pdf._id.toString(),
        name: pdf.fileName,  // 실제 파일명 표시
        originalName: pdf.fileName,
        type: 'pdf',
        previewImage: undefined,
        folderId: pdf.folderId || null,
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

  // 필기 데이터 저장
  async saveDrawingData(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
      }

      const { pdfId } = req.params;
      const { pageNumber, drawingData } = req.body;

      if (!ObjectId.isValid(pdfId)) {
        return res.status(400).json({ error: '유효하지 않은 PDF ID입니다.' });
      }

      if (pageNumber === undefined || !drawingData) {
        return res.status(400).json({ error: '페이지 번호와 필기 데이터가 필요합니다.' });
      }

      // DB에서 PDF 정보 조회
      const pdf = await this.pdfDocument.findById(pdfId);
      
      if (!pdf) {
        return res.status(404).json({ error: 'PDF를 찾을 수 없습니다.' });
      }

      // 권한 확인 (본인의 PDF만 수정 가능)
      const userId = req.user.googleId || req.user.kakaoId;
      if (pdf.userId !== userId) {
        return res.status(403).json({ error: '수정 권한이 없습니다.' });
      }

      // 필기 데이터 저장
      await this.pdfDocument.savePageDrawingData(pdfId, pageNumber, drawingData);

      res.json({ 
        success: true, 
        message: `페이지 ${pageNumber}의 필기 데이터가 저장되었습니다.` 
      });

    } catch (error) {
      console.error('필기 데이터 저장 에러:', error);
      res.status(500).json({ error: '필기 데이터 저장에 실패했습니다.' });
    }
  }

  // 필기 데이터 조회
  async getDrawingData(req, res) {
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

      // 권한 확인 (본인의 PDF만 조회 가능)
      const userId = req.user.googleId || req.user.kakaoId;
      if (pdf.userId !== userId) {
        return res.status(403).json({ error: '조회 권한이 없습니다.' });
      }

      // 필기 데이터 조회
      const drawingData = await this.pdfDocument.getDrawingData(pdfId);

      res.json({ 
        success: true, 
        drawingData: drawingData 
      });

    } catch (error) {
      console.error('필기 데이터 조회 에러:', error);
      res.status(500).json({ error: '필기 데이터 조회에 실패했습니다.' });
    }
  }

  // 텍스트 메모 저장
  async saveTextMemos(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
      }

      const { pdfId } = req.params;
      const { pageNumber, textMemos } = req.body;

      if (!ObjectId.isValid(pdfId)) {
        return res.status(400).json({ error: '유효하지 않은 PDF ID입니다.' });
      }

      if (pageNumber === undefined || !textMemos) {
        return res.status(400).json({ error: '페이지 번호와 텍스트 메모 데이터가 필요합니다.' });
      }

      // DB에서 PDF 정보 조회
      const pdf = await this.pdfDocument.findById(pdfId);
      
      if (!pdf) {
        return res.status(404).json({ error: 'PDF를 찾을 수 없습니다.' });
      }

      // 권한 확인 (본인의 PDF만 수정 가능)
      const userId = req.user.googleId || req.user.kakaoId;
      if (pdf.userId !== userId) {
        return res.status(403).json({ error: '수정 권한이 없습니다.' });
      }

      // 텍스트 메모 데이터 저장
      await this.pdfDocument.savePageTextMemos(pdfId, pageNumber, textMemos);

      res.json({ 
        success: true, 
        message: `페이지 ${pageNumber}의 텍스트 메모가 저장되었습니다.` 
      });

    } catch (error) {
      console.error('텍스트 메모 저장 에러:', error);
      res.status(500).json({ error: '텍스트 메모 저장에 실패했습니다.' });
    }
  }

  // 텍스트 메모 조회
  async getTextMemos(req, res) {
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

      // 권한 확인 (본인의 PDF만 조회 가능)
      const userId = req.user.googleId || req.user.kakaoId;
      if (pdf.userId !== userId) {
        return res.status(403).json({ error: '조회 권한이 없습니다.' });
      }

      // 텍스트 메모 데이터 조회
      const textMemos = await this.pdfDocument.getTextMemos(pdfId);

      res.json({ 
        success: true, 
        textMemos: textMemos 
      });

    } catch (error) {
      console.error('텍스트 메모 조회 에러:', error);
      res.status(500).json({ error: '텍스트 메모 조회에 실패했습니다.' });
    }
  }

  // AI 정리 기능
  async getSummary(req, res) {
    try {
      console.log('AI 정리 요청 시작 - PDF ID:', req.params.pdfId);
      
      if (!req.user) {
        console.log('사용자 인증 실패');
        return res.status(401).json({ error: '로그인이 필요합니다.' });
      }

      const { pdfId } = req.params;

      if (!ObjectId.isValid(pdfId)) {
        console.log('유효하지 않은 PDF ID:', pdfId);
        return res.status(400).json({ error: '유효하지 않은 PDF ID입니다.' });
      }

      // DB에서 PDF 정보 조회
      const pdf = await this.pdfDocument.findById(pdfId);
      
      if (!pdf) {
        console.log('PDF를 찾을 수 없음:', pdfId);
        return res.status(404).json({ error: 'PDF를 찾을 수 없습니다.' });
      }

      // 권한 확인 (본인의 PDF만 조회 가능)
      const userId = req.user.googleId || req.user.kakaoId;
      if (pdf.userId !== userId) {
        console.log('권한 없음 - 요청자:', userId, 'PDF 소유자:', pdf.userId);
        return res.status(403).json({ error: '조회 권한이 없습니다.' });
      }

      // OCR 텍스트가 없으면 에러
      if (!pdf.ocrText || pdf.ocrText.trim() === '') {
        console.log('OCR 텍스트 없음 - PDF ID:', pdfId);
        return res.status(400).json({ error: 'OCR 텍스트가 없습니다. PDF를 다시 업로드해주세요.' });
      }

      // 기존에 저장된 정리이 있는지 확인
      const existingSummary = await this.pdfDocument.getAISummary(pdfId);
      if (existingSummary && existingSummary.summary) {
        console.log('기존 저장된 정리 발견 - DB에서 반환');
        return res.json({ 
          success: true, 
          summary: existingSummary.summary,
          fromCache: true,
          generatedAt: existingSummary.generatedAt
        });
      }

      console.log('새로운 정리 생성 시작 - OCR 텍스트 길이:', pdf.ocrText.length);

      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        console.log('OpenAI API 키 미설정');
        return res.status(500).json({ error: 'OpenAI API 키가 설정되지 않았습니다.' });
      }

      console.log('OpenAI API 키 확인됨');

      // OpenAI API 호출
      console.log('OpenAI API 호출 시작 - 참고로 5-mini로 호출함');
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5-mini',
          messages: [
            {
              role: 'system',
              content: `Role (역할): 당신은 매우 꼼꼼하고 상세한 문서 정리 전문가입니다. 제공된 OCR 텍스트의 모든 중요한 내용을 놓치지 않고 매우 상세하게 정리해주세요. 대충 정리하지 말고, 원본의 모든 핵심 정보를 포함하여 최대한 자세하고 완벽한 정리를 만들어주세요.
              Context (맥락): 저는 PDF 문서에서 OCR을 통해 추출된 마크다운 형식의 텍스트를 제공할 것입니다. 이 텍스트는 원본 문서의 구조를 최대한 반영하고 있습니다. 저는 이 원본 텍스트에서 오직 핵심 학습 내용만을 구조적으로 이해하고, 미려한 형식으로 정리된 정리본을 한국어로 받고 싶습니다. 불필요한 정보를 걸러내고 순도 높은 학습 자료를 얻는 것이 주된 목표입니다.
              Objective (목표): 제공된 OCR 마크다운 텍스트를 매우 상세하고 완벽한 정리본으로 만들어주세요. 절대 대충 정리하지 말고, 원본의 모든 중요한 내용을 놓치지 않고 최대한 자세하게 정리해주세요. 특히 원본 문서의 핵심 학습 내용과 논리적 구조를 최대한 보존하면서 정리하는 것이 중요합니다. 시험이나 학습에 직접적으로 관련 없는 부분(예: 강의 소개, 강사 정보, 강의 날짜, 프로그램 일정, 불필요한 서론 및 결론 등)은 절대 포함하지 말고, 학습 내용만을 선별하여 정리리해주세요. 반드시 모든 중요한 섹션과 세부사항을 포함하여 완전한 정리를 만들어주세요.
              또한 OCR 내용에서 테이블(표)로 정리된 내용들이 있다면 반드시 모두 정리본에 포함해야합니다.
              Style (스타일): 정리리본은 전문적이면서도 명료한 문체를 사용해야 합니다. 원본 내용의 의도를 정확하게 전달하면서도, 최대한 자세히 정리해 주세요. 정보의 계층적 중요도를 시각적으로 명확하게 나타내어, 학습자가 빠르게 핵심을 파악할 수 있도록 해주세요.
              Tone (어조): 정보 전달에 중점을 둔 객관적이고 중립적인 어조를 유지해 주세요. 독자가 내용을 쉽게 신뢰하고 집중할 수 있도록 전문성을 담아 전달해 주세요.
              Audience (독자): 이 정리본은 해당 분야에 대한 기본적인 이해는 있으나, 원본 문서 전체를 읽을 시간이 부족하며 핵심 학습 내용만을 효율적으로 습득하고자 하는 전문가 또는 학습자를 대상으로 합니다.
              Response Format (응답 형식): 결과물은 다음 HTML 형식의 지침을 엄격히 준수하여 작성해 주세요:
                  • 제외할 부분: 학습 내용과 직접 관련 없는 서론, 결론, 강의 목차, 날짜, 프로그램 안내, 강사 소개, 불필요한 예시의 반복과 ![img-1.jpeg](img-1.jpeg)과 같은 이미지 파일 등은 정리본에서 완전히 배제하고, 핵심 정보 위주로 빠르게 확인할 수 있도록 해 주세요.
                  • 제목 및 소제목: 원본 문서의 목차나 섹션처럼 보이는 핵심 학습 내용 부분은 <h1>, <h2>, <h3> 등의 적절한 HTML 헤딩 태그를 사용하여 계층 구조를 명확히 표현해 주세요. 더 나은 가독성을 위해 헤딩별로 구분을 위한 적절한 줄바꿈을 사용해 주세요.
                  • 핵심 키워드 강조: <strong>태그를 사용하여 명확하게 강조해 주세요.
                  • 공식 및 수식: 문서 내에 등장하는 공식이나 수학적 표현은 LaTeX 문법을 사용하여 깔끔하게 렌더링될 수 있도록 해주세요. 블록 수식의 경우 <div class="math-display">$$수식$$</div> 형식으로, 인라인 수식의 경우 <span class="math-inline">$수식$</span> 형식으로 직접 작성해주세요. 특히 수식 내의 특수문자나 기호는 LaTeX 문법에 맞게 정확히 변환해주세요.
                  • 코드 블록: 만약 원본 텍스트에 프로그래밍 코드가 포함되어 있다면, 해당 코드를 <pre><code class="language-언어명">코드내용</code></pre> 형식으로 정확히 삽입해 주세요. 이는 코드 가독성을 높이고 AI가 코드를 명확히 구분하여 처리하도록 합니다.
                  • 리스트: 내용 정리 시 <ol> (순서가 있는 리스트)나 <ul> (순서 없는 리스트)를 적절히 활용하여 가독성을 높여주세요. 특히 넘버링 리스트는 작업의 순서나 우선순위를 제시할 때, 불릿 리스트는 복잡한 요구사항을 항목별로 명확히 제시할 때 유용합니다.
                  • 구조 유지: 원본 텍스트의 논리적 흐름과 섹션별 구조를 최대한 보존하면서 정리해 주세요.
                  • 불필요한 설명 생략: 학습 내용과 직접 관련 없는 서론, 결론, 강의 목차, 날짜, 프로그램 안내, 강사 소개, 불필요한 예시의 반복 등은 정리본에서 완전히 배제하고, 핵심 정보 위주로 빠르게 확인할 수 있도록 해 주세요.
                  • 분량: 정리본의 전체 길이는 원본 텍스트의 핵심 정보와 중요도를 고려하되, 필수적인 학습 정보를 충분히 담을 수 있도록 상세하게 작성해 주세요.
                  • 언어: 결과물은 반드시 한국어로 작성되어야 합니다.
                  • 참고(중요): 제 질문에 답변 없이 절대 대답하지 말고 요약된 HTML 텍스트만 대답해주세요.`
            },
            {
              role: 'user',
              content: `요약할 문서: ${pdf.ocrText}`
            }
          ],
          max_completion_tokens: 20000
        })
      });

      console.log('line: 608 // OpenAI API 응답 상태:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API 호출 실패:', response.status, errorText);
        return res.status(500).json({ error: 'AI 정리 처리에 실패했습니다.' });
      }

      const result = await response.json();
      const summary = result.choices[0].message.content;

      console.log('AI 정리 완료 - 길이:', summary.length);

      // DB에 정리 저장
      await this.pdfDocument.saveAISummary(pdfId, summary);
      console.log('정리 DB 저장 완료');

      res.json({ 
        success: true, 
        summary: summary,
        fromCache: false
      });

    } catch (error) {
      console.error('AI 정리 에러:', error);
      res.status(500).json({ error: 'AI 정리 처리에 실패했습니다.' });
    }
  }

  // AI 번역 기능 (정리본 기반)
  async getTranslation(req, res) {
    try {
      console.log('AI 번역 요청 시작 - PDF ID:', req.params.pdfId);
      
      if (!req.user) {
        console.log('사용자 인증 실패');
        return res.status(401).json({ error: '로그인이 필요합니다.' });
      }

      const { pdfId } = req.params;
      const { targetLanguage, sourceContent } = req.body;

      if (!ObjectId.isValid(pdfId)) {
        console.log('유효하지 않은 PDF ID:', pdfId);
        return res.status(400).json({ error: '유효하지 않은 PDF ID입니다.' });
      }

      if (!targetLanguage) {
        console.log('번역 언어 미지정');
        return res.status(400).json({ error: '번역할 언어를 지정해주세요.' });
      }

      // DB에서 PDF 정보 조회
      const pdf = await this.pdfDocument.findById(pdfId);
      
      if (!pdf) {
        console.log('PDF를 찾을 수 없음:', pdfId);
        return res.status(404).json({ error: 'PDF를 찾을 수 없습니다.' });
      }

      // 권한 확인 (본인의 PDF만 조회 가능)
      const userId = req.user.googleId || req.user.kakaoId;
      if (pdf.userId !== userId) {
        console.log('권한 없음 - 요청자:', userId, 'PDF 소유자:', pdf.userId);
        return res.status(403).json({ error: '조회 권한이 없습니다.' });
      }

      // OCR 텍스트가 없으면 에러
      if (!pdf.ocrText || pdf.ocrText.trim() === '') {
        console.log('OCR 텍스트 없음 - PDF ID:', pdfId);
        return res.status(400).json({ error: 'OCR 텍스트가 없습니다. PDF를 다시 업로드해주세요.' });
      }

      // 기존에 저장된 번역이 있는지 확인
      const existingTranslation = await this.pdfDocument.getAITranslation(pdfId, targetLanguage);
      if (existingTranslation && existingTranslation.translation) {
        console.log('기존 저장된 번역 발견 - DB에서 반환');
        return res.json({ 
          success: true, 
          translation: existingTranslation.translation,
          targetLanguage: targetLanguage,
          fromCache: true,
          generatedAt: existingTranslation.generatedAt
        });
      }

      console.log('새로운 번역 생성 시작');

      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        console.log('OpenAI API 키 미설정');
        return res.status(500).json({ error: 'OpenAI API 키가 설정되지 않았습니다.' });
      }

      console.log('OpenAI API 키 확인됨');

      // 1단계: 정리본 확인 (프론트엔드에서 전달받은 정리본 우선 사용)
      console.log('1단계: 정리본 확인');
      let summary;

      if (sourceContent && sourceContent.trim() !== '') {
        console.log('프론트엔드에서 전달받은 정리본 사용');
        summary = sourceContent;
      } else {
        // 프론트엔드에서 정리본을 전달하지 않은 경우, DB에서 기존 정리본 확인
        console.log('프론트엔드 정리본 없음 - DB에서 기존 정리본 확인');
        let existingSummary = await this.pdfDocument.getAISummary(pdfId);
        
        if (existingSummary && existingSummary.summary) {
          console.log('기존 정리본 발견 - 재사용');
          summary = existingSummary.summary;
        } else {
          console.log('기존 정리본 없음 - 새로 생성')
          const summaryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
                  content: '당신은 문서 정리 전문가입니다. 주어진 문서의 내용과 길이에 맞게 상세하게 정리를 해주세요. 중요한 정보를 누락하지 말고, 문서의 복잡도에 따라 충분히 상세하게 정리리해주세요. 구조화된 형태로 작성해주세요.'
                },
                {
                  role: 'user',
                  content: `당신은 문서 정리 전문가입니다. 주어진 문서의 내용과 길이에 맞게 상세하게 정리를 해주세요. 중요한 정보를 누락하지 말고, 문서의 복잡도에 따라 충분히 상세하게 정리리해주세요. 구조화된 형태로 작성해주세요. 
                    Role (역할): 당신은 전문 문서 정리 정리 전문가이자 정보 구조화 전문가입니다. 제공될 OCR 마크다운 텍스트를 분석하여, 원본 문서의 핵심 내용을 정확하고 고급스럽게 정리하되, 특히 학습 목적에 불필요한 서론, 결론, 강의 목차, 날짜, 과정 안내 등 부수적인 정보는 과감히 제외하고 순수한 학습 내용만을 추출하여 가독성 높은 마크다운 형식으로 재구성하는 데 탁월한 능력을 가지고 있습니다.
                    Context (맥락): 저는 PDF 문서에서 OCR을 통해 추출된 마크다운 형식의 텍스트를 제공할 것입니다. 이 텍스트는 원본 문서의 구조를 최대한 반영하고 있습니다. 저는 이 원본 텍스트에서 오직 핵심 학습 내용만을 구조적으로 이해하고, 미려한 형식으로 정리된 정리본을 한국어로 받고 싶습니다. 불필요한 정보를 걸러내고 순도 높은 학습 자료를 얻는 것이 주된 목표입니다.
                    Objective (목표): 제공된 OCR 마크다운 텍스트를 매우 상세하고 완벽한 정리본으로 만들어주세요. 절대 대충 정리하지 말고, 원본의 모든 중요한 내용을 놓치지 않고 최대한 자세하게 정리해주세요. 특히 원본 문서의 핵심 학습 내용과 논리적 구조를 최대한 보존하면서 정리하는 것이 중요합니다. 시험이나 학습에 직접적으로 관련 없는 부분(예: 강의 소개, 강사 정보, 강의 날짜, 프로그램 일정, 불필요한 서론 및 결론 등)은 절대 포함하지 말고, 학습 내용만을 선별하여 정리리해주세요. 반드시 모든 중요한 섹션과 세부사항을 포함하여 완전한 정리를 만들어주세요.
                    또한 OCR 내용 테이블로 정리된 내용이 있다면 반드시 정리본에 포함해야합니다.
                    Style (스타일): 정리리본은 매우 상세하고 꼼꼼한 문체를 사용해야 합니다. 원본 내용의 의도를 정확하게 전달하면서도, 절대 대충 정리하지 말고 최대한 자세하고 완벽하게 정리해 주세요. 모든 중요한 세부사항을 놓치지 말고, 정보의 계층적 중요도를 시각적으로 명확하게 나타내어, 학습자가 빠르게 핵심을 파악할 수 있도록 해주세요.
                    Tone (어조): 정보 전달에 중점을 둔 객관적이고 중립적인 어조를 유지해 주세요. 독자가 내용을 쉽게 신뢰하고 집중할 수 있도록 전문성을 담아 전달해 주세요.
                    Audience (독자): 이 정리본은 해당 분야에 대한 기본적인 이해는 있으나, 원본 문서 전체를 읽을 시간이 부족하며 핵심 학습 내용만을 효율적으로 습득하고자 하는 전문가 또는 학습자를 대상으로 합니다.
                    Response Format (응답 형식): 결과물은 다음 HTML 형식의 지침을 엄격히 준수하여 작성해 주세요:
                        • 제외할 부분: 학습 내용과 직접 관련 없는 서론, 결론, 강의 목차, 날짜, 프로그램 안내, 강사 소개, 불필요한 예시의 반복과 ![img-1.jpeg](img-1.jpeg)과 같은 이미지 파일 등은 정리본에서 완전히 배제하고, 핵심 정보 위주로 빠르게 확인할 수 있도록 해 주세요.
                        • 제목 및 소제목: 원본 문서의 목차나 섹션처럼 보이는 핵심 학습 내용 부분은 <h1>, <h2>, <h3> 등의 적절한 HTML 헤딩 태그를 사용하여 계층 구조를 명확히 표현해 주세요. 더 나은 가독성을 위해 헤딩별로 구분을 위한 적절한 줄바꿈을 사용해 주세요.
                        • 핵심 키워드 강조: <strong>태그를 사용하여 명확하게 강조해 주세요.
                        • 공식 및 수식: 문서 내에 등장하는 공식이나 수학적 표현은 LaTeX 문법을 사용하여 깔끔하게 렌더링될 수 있도록 해주세요. 블록 수식의 경우 <div class="math-display">$$수식$$</div> 형식으로, 인라인 수식의 경우 <span class="math-inline">$수식$</span> 형식으로 직접 작성해주세요. 특히 수식 내의 특수문자나 기호는 LaTeX 문법에 맞게 정확히 변환해주세요.
                        • 코드 블록: 만약 원본 텍스트에 프로그래밍 코드가 포함되어 있다면, 해당 코드를 <pre><code class="language-언어명">코드내용</code></pre> 형식으로 정확히 삽입해 주세요. 이는 코드 가독성을 높이고 AI가 코드를 명확히 구분하여 처리하도록 합니다.
                        • 리스트: 내용 정리 시 <ol> (순서가 있는 리스트)나 <ul> (순서 없는 리스트)를 적절히 활용하여 가독성을 높여주세요. 특히 넘버링 리스트는 작업의 순서나 우선순위를 제시할 때, 불릿 리스트는 복잡한 요구사항을 항목별로 명확히 제시할 때 유용합니다.
                        • 구조 유지: 원본 텍스트의 논리적 흐름과 섹션별 구조를 최대한 보존하면서 정리해 주세요.
                        • 불필요한 설명 생략: 학습 내용과 직접 관련 없는 서론, 결론, 강의 목차, 날짜, 프로그램 안내, 강사 소개, 불필요한 예시의 반복 등은 정리본에서 완전히 배제하고, 핵심 정보 위주로 빠르게 확인할 수 있도록 해 주세요.
                        • 분량: 정리본의 전체 길이는 원본 텍스트의 핵심 정보와 중요도를 고려하되, 필수적인 학습 정보를 충분히 담을 수 있도록 상세하게 작성해 주세요.
                        • 언어: 결과물은 반드시 한국어로 작성되어야 합니다. ${pdf.ocrText}`
                }
               
              ],
              max_tokens: 15000,
              temperature: 0.3
            })
          });

          if (!summaryResponse.ok) {
            const errorText = await summaryResponse.text();
            console.error('정리본 생성 실패:', summaryResponse.status, errorText);
            return res.status(500).json({ error: 'AI 정리 처리에 실패했습니다.' });
          }

          const summaryResult = await summaryResponse.json();
          summary = summaryResult.choices[0].message.content;
          console.log('정리본 생성 완료 - 길이:', summary.length);
          
          // 새로 생성된 정리본을 DB에 저장
          await this.pdfDocument.saveAISummary(pdfId, summary);
          console.log('정리본 DB 저장 완료');
        }
      }

      // 2단계: 정리본을 번역
      console.log('2단계: 정리본 번역 시작');
      const translationResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
              content: '당신은 전문 번역가입니다. 주어진 HTML 형식의 텍스트를 자연스럽고 정확하게 번역해주세요. HTML 태그는 그대로 유지하면서 내용만 번역해주세요. 특히 LaTeX 수식($$...$$ 또는 $...$)은 그대로 유지하고 번역하지 마세요.'
            },
            {
              role: 'user',
              content: `다음 HTML 형식의 정리본을 ${targetLanguage}로 번역해주세요. HTML 태그(<h1>, <h2>, <strong>, <ul>, <ol> 등)는 그대로 유지하고 내용만 번역해주세요. LaTeX 수식($$...$$ 또는 $...$)은 번역하지 말고 그대로 유지해주세요:\n\n${summary}`
            }
          ],
          max_tokens: 15000,
          temperature: 0.3
        })
      });

      if (!translationResponse.ok) {
        const errorText = await translationResponse.text();
        console.error('번역 실패:', translationResponse.status, errorText);
        return res.status(500).json({ error: 'AI 번역 처리에 실패했습니다.' });
      }

      const translationResult = await translationResponse.json();
      const translation = translationResult.choices[0].message.content;

      console.log('번역 완료 - 길이:', translation.length);

      // DB에 번역 저장
      await this.pdfDocument.saveAITranslation(pdfId, targetLanguage, translation);
      console.log('번역 DB 저장 완료');

      res.json({ 
        success: true, 
        translation: translation,
        targetLanguage: targetLanguage,
        fromCache: false
      });

    } catch (error) {
      console.error('AI 번역 에러:', error);
      res.status(500).json({ error: 'AI 번역 처리에 실패했습니다.' });
    }
  }

  // AI 퀴즈 생성 기능
  async getQuiz(req, res) {
    try {
      console.log('AI 퀴즈 요청 시작 - PDF ID:', req.params.pdfId);
      
      if (!req.user) {
        console.log('사용자 인증 실패');
        return res.status(401).json({ error: '로그인이 필요합니다.' });
      }

      const { pdfId } = req.params;

      if (!ObjectId.isValid(pdfId)) {
        console.log('유효하지 않은 PDF ID:', pdfId);
        return res.status(400).json({ error: '유효하지 않은 PDF ID입니다.' });
      }

      // DB에서 PDF 정보 조회
      const pdf = await this.pdfDocument.findById(pdfId);
      
      if (!pdf) {
        console.log('PDF를 찾을 수 없음:', pdfId);
        return res.status(404).json({ error: 'PDF를 찾을 수 없습니다.' });
      }

      // 권한 확인 (본인의 PDF만 조회 가능)
      const userId = req.user.googleId || req.user.kakaoId;
      if (pdf.userId !== userId) {
        console.log('권한 없음 - 요청자:', userId, 'PDF 소유자:', pdf.userId);
        return res.status(403).json({ error: '조회 권한이 없습니다.' });
      }

      // OCR 텍스트가 없으면 에러
      if (!pdf.ocrText || pdf.ocrText.trim() === '') {
        console.log('OCR 텍스트 없음 - PDF ID:', pdfId);
        return res.status(400).json({ error: 'OCR 텍스트가 없습니다. PDF를 다시 업로드해주세요.' });
      }

      // 기존에 저장된 퀴즈가 있는지 확인
      const existingQuiz = await this.pdfDocument.getAIQuiz(pdfId);
      if (existingQuiz && existingQuiz.quiz) {
        console.log('기존 저장된 퀴즈 발견 - DB에서 반환');
        return res.json({ 
          success: true, 
          quiz: existingQuiz.quiz,
          fromCache: true,
          generatedAt: existingQuiz.generatedAt
        });
      }

      console.log('새로운 퀴즈 생성 시작 - OCR 텍스트 길이:', pdf.ocrText.length);

      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        console.log('OpenAI API 키 미설정');
        return res.status(500).json({ error: 'OpenAI API 키가 설정되지 않았습니다.' });
      }

      console.log('OpenAI API 키 확인됨');

      // OpenAI API 호출
      console.log('OpenAI API 호출 시작');
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
              content: '당신은 교육 전문가입니다. 주어진 문서를 바탕으로 핵심적인 객관식 문제 3개를 생성해주세요. 각 문제는 4개의 보기를 가지며, 정답은 1번부터 4번까지의 번호로 표시해주세요. JSON 형식으로 응답해주세요.'
            },
            {
              role: 'user',
              content: `다음 문서를 바탕으로 객관식 문제 3개를 생성해주세요. JSON 형식으로 응답해주세요:\n\n${pdf.ocrText}`
            }
          ],
          max_tokens: 15000,
          temperature: 0.5
        })
      });

      console.log('OpenAI API 응답 상태:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API 호출 실패:', response.status, errorText);
        return res.status(500).json({ error: 'AI 퀴즈 생성에 실패했습니다.' });
      }

      const result = await response.json();
      const quizContent = result.choices[0].message.content;

      console.log('AI 퀴즈 응답 내용:', quizContent.substring(0, 200) + '...');

      // JSON 파싱 시도 (마크다운 코드 블록 처리)
      let quiz;
      try {
        // 마크다운 코드 블록 제거
        let cleanContent = quizContent.trim();
        if (cleanContent.startsWith('```json')) {
          cleanContent = cleanContent.replace(/^```json\s*/, '');
        }
        if (cleanContent.startsWith('```')) {
          cleanContent = cleanContent.replace(/^```\s*/, '');
        }
        if (cleanContent.endsWith('```')) {
          cleanContent = cleanContent.replace(/\s*```$/, '');
        }
        
        console.log('정리된 퀴즈 내용:', cleanContent.substring(0, 200) + '...');
        quiz = JSON.parse(cleanContent);
        console.log('퀴즈 JSON 파싱 성공');
      } catch (parseError) {
        console.error('퀴즈 JSON 파싱 실패:', parseError);
        console.error('원본 내용:', quizContent);
        return res.status(500).json({ error: '퀴즈 형식이 올바르지 않습니다.' });
      }

      console.log('AI 퀴즈 생성 완료 - 문제 수:', quiz.questions ? quiz.questions.length : 0);

      // DB에 퀴즈 저장
      await this.pdfDocument.saveAIQuiz(pdfId, quiz);
      console.log('퀴즈 DB 저장 완료');

      res.json({ 
        success: true, 
        quiz: quiz,
        fromCache: false
      });

    } catch (error) {
      console.error('AI 퀴즈 에러:', error);
      res.status(500).json({ error: 'AI 퀴즈 생성에 실패했습니다.' });
    }
  }
}

module.exports = { PdfController };
