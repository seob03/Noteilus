const Folder = require('../models/Folder');
const PdfDocument = require('../models/PdfDocument');
const { ObjectId } = require('mongodb');

class FolderController {
  constructor(db) {
    this.folder = new Folder(db);
    this.pdfDocument = new PdfDocument(db);
  }

  // 폴더 생성
  async createFolder(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
      }

      const { name, parentId, description } = req.body;
      const userId = req.user.googleId || req.user.kakaoId;

      if (!name || name.trim() === '') {
        return res.status(400).json({ error: '폴더 이름을 입력해주세요.' });
      }

      // 같은 부모 폴더 내에서 중복 이름 확인
      const existingFolders = parentId 
        ? await this.folder.findSubFolders(parentId)
        : await this.folder.findRootFolders(userId);

      const duplicateName = existingFolders.find(folder => folder.name === name);
      if (duplicateName) {
        return res.status(400).json({ error: '같은 위치에 같은 이름의 폴더가 이미 존재합니다.' });
      }

      const folderData = {
        name: name.trim(),
        userId: userId,
        parentId: parentId ? ObjectId.createFromHexString(parentId) : null,
        description: description || ''
      };

      const folderId = await this.folder.create(folderData);
      const newFolder = await this.folder.findById(folderId);

      res.status(201).json({
        success: true,
        folder: newFolder
      });

    } catch (error) {
      console.error('폴더 생성 에러:', error);
      res.status(500).json({ error: '폴더 생성에 실패했습니다.' });
    }
  }

  // 사용자의 모든 폴더 조회
  async getUserFolders(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
      }

      const userId = req.user.googleId || req.user.kakaoId;
      const folders = await this.folder.findByUserId(userId);

      res.json({
        success: true,
        folders: folders
      });

    } catch (error) {
      console.error('폴더 조회 에러:', error);
      res.status(500).json({ error: '폴더 조회에 실패했습니다.' });
    }
  }

  // 특정 폴더 조회 (내용 포함)
  async getFolder(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
      }

      const { folderId } = req.params;
      const userId = req.user.googleId || req.user.kakaoId;

      if (!ObjectId.isValid(folderId)) {
        return res.status(400).json({ error: '유효하지 않은 폴더 ID입니다.' });
      }

      const folder = await this.folder.findById(folderId);
      if (!folder) {
        return res.status(404).json({ error: '폴더를 찾을 수 없습니다.' });
      }

      if (folder.userId !== userId) {
        return res.status(403).json({ error: '조회 권한이 없습니다.' });
      }

      // 폴더 경로 조회
      const folderPath = await this.folder.getFolderPath(folderId);

      // 하위 폴더들 조회
      const subFolders = await this.folder.findSubFolders(folderId);

      // 폴더 내 PDF 파일들 조회
      const pdfItems = [];
      if (folder.items && folder.items.length > 0) {
        const pdfIds = folder.items
          .filter(item => item.type === 'pdf')
          .map(item => item.id);

        if (pdfIds.length > 0) {
          const pdfs = await this.pdfDocument.collection.find({
            _id: { $in: pdfIds.map(id => ObjectId.createFromHexString(id)) }
          }).toArray();

          pdfItems.push(...pdfs);
        }
      }

      res.json({
        success: true,
        folder: folder,
        folderPath: folderPath,
        subFolders: subFolders,
        pdfItems: pdfItems
      });

    } catch (error) {
      console.error('폴더 조회 에러:', error);
      res.status(500).json({ error: '폴더 조회에 실패했습니다.' });
    }
  }

  // 폴더 재귀 삭제 (내부 함수)
  async deleteFolderRecursive(folderId, userId) {
    const folder = await this.folder.findById(folderId);
    if (!folder || folder.userId !== userId) {
      return;
    }

    // 폴더 내 PDF 파일들 삭제
    if (folder.items && folder.items.length > 0) {
      const pdfItems = folder.items.filter(item => item.type === 'pdf');
      
      for (const item of pdfItems) {
        try {
          const pdf = await this.pdfDocument.findById(item.id);
          if (pdf && pdf.userId === userId) {
            // S3에서 파일 삭제
            const AWS = require('aws-sdk');
            const s3 = new AWS.S3();
            const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;
            
            const deleteParams = {
              Bucket: BUCKET_NAME,
              Key: pdf.s3Key
            };
            
            await s3.deleteObject(deleteParams).promise();
            
            // DB에서 PDF 메타데이터 삭제
            await this.pdfDocument.deleteById(item.id);
          }
        } catch (error) {
          console.error(`PDF ${item.id} 삭제 에러:`, error);
        }
      }
    }

    // 하위 폴더들 재귀 삭제
    const subFolders = await this.folder.findSubFolders(folderId);
    for (const subFolder of subFolders) {
      await this.deleteFolderRecursive(subFolder._id.toString(), userId);
    }

    // 폴더 삭제
    await this.folder.deleteById(folderId);
  }

  // 폴더 삭제
  async deleteFolder(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
      }

      const { folderId } = req.params;
      const userId = req.user.googleId || req.user.kakaoId;

      if (!ObjectId.isValid(folderId)) {
        return res.status(400).json({ error: '유효하지 않은 폴더 ID입니다.' });
      }

      const folder = await this.folder.findById(folderId);
      if (!folder) {
        return res.status(404).json({ error: '폴더를 찾을 수 없습니다.' });
      }

      if (folder.userId !== userId) {
        return res.status(403).json({ error: '삭제 권한이 없습니다.' });
      }

      // 폴더 내 PDF 파일들 삭제
      if (folder.items && folder.items.length > 0) {
        const pdfItems = folder.items.filter(item => item.type === 'pdf');
        
        for (const item of pdfItems) {
          try {
            // PDF 파일 정보 조회
            const pdf = await this.pdfDocument.findById(item.id);
            if (pdf && pdf.userId === userId) {
              // S3에서 파일 삭제
              const AWS = require('aws-sdk');
              const s3 = new AWS.S3();
              const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;
              
              const deleteParams = {
                Bucket: BUCKET_NAME,
                Key: pdf.s3Key
              };
              
              await s3.deleteObject(deleteParams).promise();
              
              // DB에서 PDF 메타데이터 삭제
              await this.pdfDocument.deleteById(item.id);
            }
          } catch (error) {
            console.error(`PDF ${item.id} 삭제 에러:`, error);
            // 개별 PDF 삭제 실패해도 폴더 삭제는 계속 진행
          }
        }
      }

      // 하위 폴더들도 재귀적으로 삭제
      const subFolders = await this.folder.findSubFolders(folderId);
      for (const subFolder of subFolders) {
        try {
          // 재귀적으로 하위 폴더 삭제
          await this.deleteFolderRecursive(subFolder._id.toString(), userId);
        } catch (error) {
          console.error(`하위 폴더 ${subFolder._id} 삭제 에러:`, error);
        }
      }

      // 폴더 삭제
      await this.folder.deleteById(folderId);

      res.json({
        success: true,
        message: '폴더가 삭제되었습니다.'
      });

    } catch (error) {
      console.error('폴더 삭제 에러:', error);
      res.status(500).json({ error: '폴더 삭제에 실패했습니다.' });
    }
  }

  // 폴더 일괄 삭제
  async deleteMultipleFolders(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
      }

      const { folderIds } = req.body;

      if (!Array.isArray(folderIds) || folderIds.length === 0) {
        return res.status(400).json({ error: '삭제할 폴더 ID 목록이 필요합니다.' });
      }

      // 모든 폴더 ID 유효성 검사
      const invalidIds = folderIds.filter(id => !ObjectId.isValid(id));
      if (invalidIds.length > 0) {
        return res.status(400).json({ error: '유효하지 않은 폴더 ID가 포함되어 있습니다.' });
      }

      const userId = req.user.googleId || req.user.kakaoId;
      const results = {
        success: [],
        failed: [],
        notFound: [],
        unauthorized: []
      };

      // 각 폴더에 대해 삭제 처리
      for (const folderId of folderIds) {
        try {
          // DB에서 폴더 정보 조회
          const folder = await this.folder.findById(folderId);

          if (!folder) {
            results.notFound.push(folderId);
            continue;
          }

          // 권한 확인
          if (folder.userId !== userId) {
            results.unauthorized.push(folderId);
            continue;
          }

          // 폴더와 내부 파일들 모두 삭제
          await this.deleteFolderRecursive(folderId, userId);

          results.success.push(folderId);

        } catch (error) {
          console.error(`폴더 ${folderId} 삭제 에러:`, error);
          results.failed.push({ id: folderId, error: error.message });
        }
      }

      res.json({
        success: true,
        message: `${results.success.length}개의 폴더가 삭제되었습니다.`,
        results: {
          successCount: results.success.length,
          failedCount: results.failed.length,
          notFoundCount: results.notFound.length,
          unauthorizedCount: results.unauthorized.length,
          details: results
        }
      });

    } catch (error) {
      console.error('폴더 일괄 삭제 에러:', error);
      res.status(500).json({ error: '폴더 일괄 삭제에 실패했습니다.' });
    }
  }

  // 폴더 이름 변경
  async renameFolder(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
      }

      const { folderId } = req.params;
      const { name } = req.body;
      const userId = req.user.googleId || req.user.kakaoId;

      if (!ObjectId.isValid(folderId)) {
        return res.status(400).json({ error: '유효하지 않은 폴더 ID입니다.' });
      }

      if (!name || name.trim() === '') {
        return res.status(400).json({ error: '폴더 이름을 입력해주세요.' });
      }

      const folder = await this.folder.findById(folderId);
      if (!folder) {
        return res.status(404).json({ error: '폴더를 찾을 수 없습니다.' });
      }

      if (folder.userId !== userId) {
        return res.status(403).json({ error: '수정 권한이 없습니다.' });
      }

      // 같은 부모 폴더 내에서 중복 이름 확인
      const existingFolders = folder.parentId 
        ? await this.folder.findSubFolders(folder.parentId)
        : await this.folder.findRootFolders(userId);

      const duplicateName = existingFolders.find(f => 
        f.name === name.trim() && f._id.toString() !== folderId
      );
      if (duplicateName) {
        return res.status(400).json({ error: '같은 위치에 같은 이름의 폴더가 이미 존재합니다.' });
      }

      await this.folder.renameFolder(folderId, name.trim());
      const updatedFolder = await this.folder.findById(folderId);

      res.json({
        success: true,
        folder: updatedFolder
      });

    } catch (error) {
      console.error('폴더 이름 변경 에러:', error);
      res.status(500).json({ error: '폴더 이름 변경에 실패했습니다.' });
    }
  }

  // 폴더에 PDF 파일 추가
  async addPdfToFolder(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
      }

      const { folderId } = req.params;
      const { pdfId } = req.body;
      const userId = req.user.googleId || req.user.kakaoId;

      if (!ObjectId.isValid(folderId) || !ObjectId.isValid(pdfId)) {
        return res.status(400).json({ error: '유효하지 않은 ID입니다.' });
      }

      const folder = await this.folder.findById(folderId);
      if (!folder) {
        return res.status(404).json({ error: '폴더를 찾을 수 없습니다.' });
      }

      if (folder.userId !== userId) {
        return res.status(403).json({ error: '권한이 없습니다.' });
      }

      const pdf = await this.pdfDocument.findById(pdfId);
      if (!pdf) {
        return res.status(404).json({ error: 'PDF 파일을 찾을 수 없습니다.' });
      }

      if (pdf.userId !== userId) {
        return res.status(403).json({ error: 'PDF 파일에 대한 권한이 없습니다.' });
      }

      // 이미 폴더에 있는지 확인
      const existingItem = folder.items.find(item => 
        item.id === pdfId && item.type === 'pdf'
      );
      if (existingItem) {
        return res.status(400).json({ error: '이미 폴더에 포함된 파일입니다.' });
      }

      const item = {
        id: pdfId,
        type: 'pdf',
        name: pdf.originalName,
        addedAt: new Date()
      };

      await this.folder.addItem(folderId, item);
      
      // PDF 문서에도 폴더 정보 업데이트
      await this.pdfDocument.updateFolderInfo(pdfId, folderId);

      res.json({
        success: true,
        message: 'PDF 파일이 폴더에 추가되었습니다.'
      });

    } catch (error) {
      console.error('PDF 폴더 추가 에러:', error);
      res.status(500).json({ error: 'PDF 파일 추가에 실패했습니다.' });
    }
  }

  // 폴더에서 PDF 파일 제거
  async removePdfFromFolder(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
      }

      const { folderId, pdfId } = req.params;
      const userId = req.user.googleId || req.user.kakaoId;

      if (!ObjectId.isValid(folderId) || !ObjectId.isValid(pdfId)) {
        return res.status(400).json({ error: '유효하지 않은 ID입니다.' });
      }

      const folder = await this.folder.findById(folderId);
      if (!folder) {
        return res.status(404).json({ error: '폴더를 찾을 수 없습니다.' });
      }

      if (folder.userId !== userId) {
        return res.status(403).json({ error: '권한이 없습니다.' });
      }

      await this.folder.removeItem(folderId, pdfId, 'pdf');
      
      // PDF 문서에서 폴더 정보 제거
      await this.pdfDocument.removeFolderInfo(pdfId);

      res.json({
        success: true,
        message: 'PDF 파일이 폴더에서 제거되었습니다.'
      });

    } catch (error) {
      console.error('PDF 폴더 제거 에러:', error);
      res.status(500).json({ error: 'PDF 파일 제거에 실패했습니다.' });
    }
  }

  // 폴더 이동
  async moveFolder(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
      }

      const { folderId } = req.params;
      const { newParentId } = req.body;
      const userId = req.user.googleId || req.user.kakaoId;

      if (!ObjectId.isValid(folderId)) {
        return res.status(400).json({ error: '유효하지 않은 폴더 ID입니다.' });
      }

      if (newParentId && !ObjectId.isValid(newParentId)) {
        return res.status(400).json({ error: '유효하지 않은 부모 폴더 ID입니다.' });
      }

      const folder = await this.folder.findById(folderId);
      if (!folder) {
        return res.status(404).json({ error: '폴더를 찾을 수 없습니다.' });
      }

      if (folder.userId !== userId) {
        return res.status(403).json({ error: '권한이 없습니다.' });
      }

      // 자기 자신을 부모로 설정하려는 경우 방지
      if (newParentId === folderId) {
        return res.status(400).json({ error: '자기 자신을 부모 폴더로 설정할 수 없습니다.' });
      }

      // 새로운 부모 폴더가 존재하는지 확인
      if (newParentId) {
        const newParent = await this.folder.findById(newParentId);
        if (!newParent) {
          return res.status(404).json({ error: '부모 폴더를 찾을 수 없습니다.' });
        }
        if (newParent.userId !== userId) {
          return res.status(403).json({ error: '부모 폴더에 대한 권한이 없습니다.' });
        }
      }

      await this.folder.moveFolder(folderId, newParentId);
      const updatedFolder = await this.folder.findById(folderId);

      res.json({
        success: true,
        folder: updatedFolder
      });

    } catch (error) {
      console.error('폴더 이동 에러:', error);
      res.status(500).json({ error: '폴더 이동에 실패했습니다.' });
    }
  }
}

module.exports = { FolderController };
