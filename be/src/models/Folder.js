const { ObjectId } = require('mongodb');

class Folder {
  constructor(db) {
    this.collection = db.collection('folders');
  }

  // 폴더 생성
  async create(folderData) {
    const folder = {
      ...folderData,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [], // 폴더 내 아이템들 (하위 폴더, PDF 파일들)
      itemCount: 0
    };
    const result = await this.collection.insertOne(folder);
    return result.insertedId;
  }

  // 사용자의 모든 폴더 조회
  async findByUserId(userId) {
    return await this.collection.find({ userId: userId }).toArray();
  }

  // 특정 폴더 조회
  async findById(folderId) {
    return await this.collection.findOne({ _id: ObjectId.createFromHexString(folderId.toString()) });
  }

  // 폴더 삭제
  async deleteById(folderId) {
    return await this.collection.deleteOne({ _id: ObjectId.createFromHexString(folderId.toString()) });
  }

  // 폴더 업데이트
  async updateById(folderId, updateData) {
    const result = await this.collection.updateOne(
      { _id: ObjectId.createFromHexString(folderId.toString()) },
      { 
        $set: { 
          ...updateData,
          updatedAt: new Date()
        } 
      }
    );
    return result;
  }

  // 폴더에 아이템 추가 (PDF 또는 하위 폴더)
  async addItem(folderId, item) {
    const result = await this.collection.updateOne(
      { _id: ObjectId.createFromHexString(folderId.toString()) },
      { 
        $push: { items: item },
        $inc: { itemCount: 1 },
        $set: { updatedAt: new Date() }
      }
    );
    return result;
  }

  // 폴더에서 아이템 제거
  async removeItem(folderId, itemId, itemType) {
    const result = await this.collection.updateOne(
      { _id: ObjectId.createFromHexString(folderId.toString()) },
      { 
        $pull: { 
          items: { 
            id: itemId, 
            type: itemType 
          } 
        },
        $inc: { itemCount: -1 },
        $set: { updatedAt: new Date() }
      }
    );
    return result;
  }

  // 루트 폴더 조회 (parentId가 null인 폴더들)
  async findRootFolders(userId) {
    return await this.collection.find({ 
      userId: userId, 
      parentId: null 
    }).toArray();
  }

  // 특정 폴더의 하위 폴더들 조회
  async findSubFolders(parentId) {
    return await this.collection.find({ 
      parentId: ObjectId.createFromHexString(parentId.toString()) 
    }).toArray();
  }

  // 폴더 경로 조회 (루트부터 현재 폴더까지)
  async getFolderPath(folderId) {
    const path = [];
    let currentFolder = await this.findById(folderId);
    
    while (currentFolder) {
      path.unshift({
        id: currentFolder._id,
        name: currentFolder.name
      });
      
      if (currentFolder.parentId) {
        currentFolder = await this.findById(currentFolder.parentId);
      } else {
        break;
      }
    }
    
    return path;
  }

  // 폴더 이동 (다른 폴더로 이동)
  async moveFolder(folderId, newParentId) {
    const result = await this.collection.updateOne(
      { _id: ObjectId.createFromHexString(folderId.toString()) },
      { 
        $set: { 
          parentId: newParentId ? ObjectId.createFromHexString(newParentId.toString()) : null,
          updatedAt: new Date()
        } 
      }
    );
    return result;
  }

  // 폴더 이름 변경
  async renameFolder(folderId, newName) {
    const result = await this.collection.updateOne(
      { _id: ObjectId.createFromHexString(folderId.toString()) },
      { 
        $set: { 
          name: newName,
          updatedAt: new Date()
        } 
      }
    );
    return result;
  }
}

module.exports = Folder;
