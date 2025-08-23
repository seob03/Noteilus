import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ChevronRight, ChevronDown, Search, Folder } from 'lucide-react';

interface Document {
  id: string;
  name: string;
  type: 'pdf' | 'folder';
  children?: Document[];
}

interface FolderSelectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFolder: (folderId: string | null) => void;
  documents: Document[];
  isDarkMode: boolean;
}

export function FolderSelectDialog({ isOpen, onClose, onSelectFolder, documents, isDarkMode }: FolderSelectDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<string[]>([]);

  const toggleFolderExpansion = (folderId: string) => {
    setExpandedFolders(prev => 
      prev.includes(folderId)
        ? prev.filter(id => id !== folderId)
        : [...prev, folderId]
    );
  };

  const handleSelectFolder = (folderId: string | null) => {
    onSelectFolder(folderId);
    onClose();
  };

  const folders = documents.filter(doc => doc.type === 'folder');
  const filteredFolders = folders.filter(folder => 
    folder.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const FolderItem = ({ folder, level = 0 }: { folder: Document; level?: number }) => (
    <div key={folder.id} style={{ marginLeft: `${level * 20}px` }}>
      <div
        className={`flex items-center gap-2 py-2 px-3 rounded cursor-pointer ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} transition-colors`}
        onClick={() => handleSelectFolder(folder.id)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFolderExpansion(folder.id);
          }}
          className="flex items-center justify-center w-4 h-4"
        >
          {folder.children && folder.children.length > 0 ? (
            expandedFolders.includes(folder.id) ? 
              <ChevronDown size={14} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} /> : 
              <ChevronRight size={14} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} />
          ) : (
            <div className="w-4 h-4" />
          )}
        </button>
        <Folder size={16} className={isDarkMode ? 'text-blue-400' : 'text-blue-600'} />
        <span className={`${isDarkMode ? 'text-[#efefef]' : 'text-gray-700'} text-sm`}>{folder.name}</span>
      </div>
      
      {/* 하위 폴더들 */}
      {expandedFolders.includes(folder.id) && folder.children && (
        <div>
          {folder.children.filter(child => child.type === 'folder').map(subfolder => (
            <FolderItem key={subfolder.id} folder={subfolder} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`${isDarkMode ? 'bg-[#121214] border-gray-600' : 'bg-white border-gray-200'} max-w-md`}>
        <DialogHeader>
          <DialogTitle className={isDarkMode ? 'text-[#efefef]' : 'text-gray-900'}>
            이동할 폴더 선택
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* 검색창 */}
          <div className="relative">
            <Search size={16} className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
            <Input
              type="text"
              placeholder="폴더 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`pl-10 ${isDarkMode ? 'bg-[#2A2A2E] border-gray-600 text-[#efefef] placeholder:text-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-500'}`}
            />
          </div>

          {/* 루트 폴더 옵션 */}
          <div
            className={`flex items-center gap-2 py-2 px-3 rounded cursor-pointer ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} transition-colors`}
            onClick={() => handleSelectFolder(null)}
          >
            <div className="w-4 h-4" />
            <Folder size={16} className={isDarkMode ? 'text-blue-400' : 'text-blue-600'} />
            <span className={`${isDarkMode ? 'text-[#efefef]' : 'text-gray-700'} text-sm`}>내 문서 (루트)</span>
          </div>

          {/* 폴더 목록 */}
          <div className="max-h-64 overflow-y-auto space-y-1">
            {filteredFolders.map(folder => (
              <FolderItem key={folder.id} folder={folder} />
            ))}
          </div>

          {/* 버튼들 */}
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className={`flex-1 ${isDarkMode ? 'border-gray-600 text-[#efefef] hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              취소
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}