import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Folder, FileText, Plus, ChevronRight, ChevronDown } from 'lucide-react';

interface Folder {
  _id: string;
  name: string;
  parentId: string | null;
  items: Array<{
    id: string;
    type: 'pdf' | 'folder';
    name: string;
    addedAt: string;
  }>;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

interface FolderSelectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFolder: (folderId: string | null) => void;
  title?: string;
  currentFolderId?: string | null;
}

const FolderSelectDialog: React.FC<FolderSelectDialogProps> = ({
  isOpen,
  onClose,
  onSelectFolder,
  title = "폴더 선택",
  currentFolderId
}) => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(currentFolderId || null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);

  // 폴더 목록 조회
  const fetchFolders = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/folders', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setFolders(data.folders || []);
      } else {
        console.error('폴더 목록 조회 실패');
      }
    } catch (error) {
      console.error('폴더 목록 조회 에러:', error);
    } finally {
      setLoading(false);
    }
  };

  // 새 폴더 생성
  const createFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      setCreatingFolder(true);
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: newFolderName.trim(),
          parentId: selectedFolderId
        })
      });

      if (response.ok) {
        const data = await response.json();
        setFolders(prev => [...prev, data.folder]);
        setNewFolderName('');
        setShowNewFolderInput(false);
        // 새로 생성된 폴더를 선택
        setSelectedFolderId(data.folder._id);
      } else {
        const errorData = await response.json();
        alert(errorData.error || '폴더 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('폴더 생성 에러:', error);
      alert('폴더 생성에 실패했습니다.');
    } finally {
      setCreatingFolder(false);
    }
  };

  // 폴더 확장/축소 토글
  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  // 폴더 선택
  const selectFolder = (folderId: string | null) => {
    setSelectedFolderId(folderId);
  };

  // 확인 버튼 클릭
  const handleConfirm = () => {
    onSelectFolder(selectedFolderId);
    onClose();
  };

  // 폴더 트리 렌더링
  const renderFolderTree = (parentId: string | null = null, level: number = 0) => {
    const childFolders = folders.filter(folder => folder.parentId === parentId);
    
    return childFolders.map(folder => {
      const isExpanded = expandedFolders.has(folder._id);
      const isSelected = selectedFolderId === folder._id;
      const hasChildren = folders.some(f => f.parentId === folder._id);

      return (
        <div key={folder._id}>
          <div
            className={`flex items-center p-2 hover:bg-gray-100 cursor-pointer rounded ${
              isSelected ? 'bg-blue-100 border border-blue-300' : ''
            }`}
            style={{ paddingLeft: `${level * 20 + 12}px` }}
            onClick={() => selectFolder(folder._id)}
          >
            <div className="flex items-center flex-1">
              {hasChildren && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFolder(folder._id);
                  }}
                  className="p-1 hover:bg-gray-200 rounded mr-1"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
              )}
              <Folder className="w-4 h-4 mr-2 text-blue-500" />
              <span className="flex-1">{folder.name}</span>
              <span className="text-sm text-gray-500">({folder.itemCount})</span>
            </div>
          </div>
          
          {isExpanded && hasChildren && (
            <div>
              {renderFolderTree(folder._id, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  useEffect(() => {
    if (isOpen) {
      fetchFolders();
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedFolderId(currentFolderId || null);
  }, [currentFolderId]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* 새 폴더 생성 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>새 폴더 생성</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNewFolderInput(!showNewFolderInput)}
              >
                <Plus className="w-4 h-4 mr-1" />
                새 폴더
              </Button>
            </div>
            
            {showNewFolderInput && (
              <div className="flex space-x-2">
                <Input
                  placeholder="폴더 이름"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && createFolder()}
                />
                <Button
                  size="sm"
                  onClick={createFolder}
                  disabled={creatingFolder || !newFolderName.trim()}
                >
                  {creatingFolder ? '생성 중...' : '생성'}
                </Button>
              </div>
            )}
          </div>

          {/* 폴더 목록 */}
          <div className="border rounded-md max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500">로딩 중...</div>
            ) : (
              <div>
                {/* 루트 레벨 선택 */}
                <div
                  className={`flex items-center p-2 hover:bg-gray-100 cursor-pointer rounded ${
                    selectedFolderId === null ? 'bg-blue-100 border border-blue-300' : ''
                  }`}
                  onClick={() => selectFolder(null)}
                >
                  <FileText className="w-4 h-4 mr-2 text-gray-500" />
                  <span>루트 폴더</span>
                </div>
                
                {/* 폴더 트리 */}
                {renderFolderTree()}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button onClick={handleConfirm}>
            선택
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FolderSelectDialog;