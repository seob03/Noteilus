import React, { useState, useEffect, useCallback } from 'react';
import { Menu, Settings, ChevronRight, ChevronDown, Plus, ArrowUpDown, CheckCircle2, Move, Trash2, Search } from 'lucide-react';
import { useDrag, useDrop, DragSourceMonitor } from 'react-dnd';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { FolderSelectDialog } from './FolderSelectDialog';
import { toast } from 'sonner';

interface Document {
  id: string;
  name: string;
  type: 'pdf' | 'folder';
  children?: Document[];
  previewImage?: string;
}

interface BreadcrumbItem {
  text: string;
  action: (() => void) | null;
  folderId: string | null;
}

interface MainPageProps {
  isDarkMode: boolean;
  isLoggedIn: boolean;
  userEmail: string | null;
  userName: string;
  userPicture: string | null;
  userId: string | null;
  onSettingsClick: () => void;
  onLoginClick: () => void;
  onPdfClick: (doc: Document) => void;
}

const ItemTypes = {
  DOCUMENT: 'document',
};

// 드래그 가능한 사이드바 아이템 컴포넌트
const DraggableDocument = React.forwardRef<HTMLDivElement, { 
  doc: Document; 
  children: React.ReactNode; 
  isDarkMode: boolean; 
  onClick?: () => void;
  onNameDoubleClick: (doc: Document) => void;
  editingId: string | null;
  editingName: string;
  onNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onNameKeyPress: (e: React.KeyboardEvent) => void;
  onNameBlur: () => void;
}>(({ doc, children, isDarkMode, onClick, onNameDoubleClick, editingId, editingName, onNameChange, onNameKeyPress, onNameBlur }, ref) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.DOCUMENT,
    item: { id: doc.id, type: doc.type, name: doc.name },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const combinedRef = (node: HTMLDivElement | null) => {
    drag(node);
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  };

  return (
    <div
      ref={combinedRef}
      style={{ opacity: isDragging ? 0.5 : 1 }}
      className={`flex items-center gap-1 py-1 px-2 ml-4 md:ml-6 rounded cursor-pointer ${isDarkMode ? 'text-[#efefef] hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'} transition-colors text-sm`}
      onClick={onClick}
    >
      <div className="w-4 h-4 flex items-center justify-center">
        {/* 빈 공간으로 들여쓰기 정렬 */}
      </div>
      {editingId === doc.id ? (
        <input
          type="text"
          value={editingName}
          onChange={onNameChange}
          onKeyDown={onNameKeyPress}
          onBlur={onNameBlur}
          className={`flex-1 bg-transparent border border-blue-500 rounded px-1 text-sm ${
            isDarkMode ? 'text-[#efefef]' : 'text-gray-700'
          }`}
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span 
          className="truncate cursor-pointer hover:bg-opacity-20 hover:bg-gray-500 rounded px-1 transition-colors"
          onDoubleClick={(e) => {
            e.stopPropagation();
            onNameDoubleClick(doc);
          }}
          title="더블클릭하여 이름 변경"
        >
          {doc.name}
        </span>
      )}
    </div>
  );
});

// 드롭 가능한 폴더 컴포넌트
const DroppableFolder = React.forwardRef<HTMLDivElement, { 
  folder: Document; 
  children: React.ReactNode; 
  isDarkMode: boolean; 
  onDrop: (draggedItem: any) => void; 
  onClick?: () => void;
  onNameDoubleClick: (doc: Document) => void;
  editingId: string | null;
  editingName: string;
  onNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onNameKeyPress: (e: React.KeyboardEvent) => void;
  onNameBlur: () => void;
  expandedFolders: string[];
}>(({ folder, children, isDarkMode, onDrop, onClick, onNameDoubleClick, editingId, editingName, onNameChange, onNameKeyPress, onNameBlur, expandedFolders }, ref) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: ItemTypes.DOCUMENT,
    drop: (item) => onDrop(item),
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  const combinedRef = (node: HTMLDivElement | null) => {
    drop(node);
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  };

  return (
    <div
      ref={combinedRef}
      style={{ backgroundColor: isOver ? (isDarkMode ? '#374151' : '#f3f4f6') : 'transparent' }}
      className={`flex items-center gap-1 py-1 px-2 ml-4 md:ml-6 rounded cursor-pointer ${isDarkMode ? 'text-[#efefef] hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'} transition-colors text-sm`}
      onClick={onClick}
    >
      <div className="w-4 h-4 flex items-center justify-center">
        {expandedFolders.includes(folder.id) ? 
          <ChevronDown size={12} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} /> : 
          <ChevronRight size={12} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} />
        }
      </div>
      {editingId === folder.id ? (
        <input
          type="text"
          value={editingName}
          onChange={onNameChange}
          onKeyDown={onNameKeyPress}
          onBlur={onNameBlur}
          className={`flex-1 bg-transparent border border-blue-500 rounded px-1 text-sm ${
            isDarkMode ? 'text-[#efefef]' : 'text-gray-700'
          }`}
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span 
          className="truncate cursor-pointer hover:bg-opacity-20 hover:bg-gray-500 rounded px-1 transition-colors"
          onDoubleClick={(e) => {
            e.stopPropagation();
            onNameDoubleClick(folder);
          }}
          title="더블클릭하여 이름 변경"
        >
          {folder.name}
        </span>
      )}
    </div>
  );
});

// 메인화면용 드래그 가능한 문서 카드 컴포넌트
const DraggableCard = React.forwardRef<HTMLDivElement, { 
  doc: Document; 
  index: number;
  isDarkMode: boolean; 
  selectionMode: boolean; 
  selectedDocuments: string[]; 
  onToggleSelection: (id: string) => void;
  onPdfClick: (doc: Document) => void;
  onFolderClick: (doc: Document) => void;
  onMainDrop: (draggedItem: any, dropResult: any) => void;
  onNameDoubleClick: (doc: Document) => void;
  editingId: string | null;
  editingName: string;
  onNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onNameKeyPress: (e: React.KeyboardEvent) => void;
  onNameBlur: () => void;
  currentFolder: string | null;
  handleAddClick: () => void;
}>(({ doc, index, isDarkMode, selectionMode, selectedDocuments, onToggleSelection, onPdfClick, onFolderClick, onMainDrop, onNameDoubleClick, editingId, editingName, onNameChange, onNameKeyPress, onNameBlur, currentFolder, handleAddClick }, ref) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.DOCUMENT,
    item: { id: doc.id, type: doc.type, name: doc.name, index: doc.id === 'add' ? -1 : index },
    end: (item, monitor: DragSourceMonitor) => {
      const dropResult = monitor.getDropResult();
      if (item && dropResult) {
        onMainDrop(item, dropResult);
      }
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: ItemTypes.DOCUMENT,
    drop: (draggedItem: any, monitor) => {
      if (draggedItem.id === doc.id) return null;
      
      if (doc.type === 'folder') {
        return { folderId: doc.id, folderName: doc.name };
      }
      
      if (doc.id !== 'add' && draggedItem.index !== -1) {
        return { 
          reorder: true, 
          targetIndex: doc.id === 'add' ? -1 : index,
          currentFolder: currentFolder
        };
      }
      
      return null;
    },
    canDrop: (draggedItem: any) => {
      return draggedItem.id !== doc.id && draggedItem.index !== -1;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }));

  const combinedRef = (node: HTMLDivElement | null) => {
    if (doc.id !== 'add') {
      drag(node);
      drop(node);
    }
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  };

  const isDropTarget = isOver && canDrop;
  const isReorderTarget = isDropTarget && doc.type !== 'folder';
  const isFolderTarget = isDropTarget && doc.type === 'folder';

  return (
    <div 
      ref={combinedRef}
      className="relative group"
      style={{ opacity: isDragging ? 0.3 : 1 }}
    >
      {selectionMode && doc.id !== 'add' && (
        <button
          onClick={() => onToggleSelection(doc.id)}
          className={`absolute top-2 right-2 z-10 w-6 h-6 md:w-7 md:h-7 rounded border-2 flex items-center justify-center transition-colors ${
            selectedDocuments.includes(doc.id)
              ? 'bg-blue-500 border-blue-500 text-white'
              : 'bg-transparent border-gray-400 hover:border-gray-300'
          }`}
        >
          {selectedDocuments.includes(doc.id) && <CheckCircle2 size={14} className="md:w-5 md:h-5" />}
        </button>
      )}

      {isDragging && (
        <div className="absolute inset-0 bg-blue-500 bg-opacity-30 rounded-xl border-2 border-blue-400 border-dashed z-20 flex items-center justify-center">
          <span className="text-blue-700 font-medium bg-white px-2 py-1 rounded text-sm">
            이동 중...
          </span>
        </div>
      )}

      {isReorderTarget && (
        <div className="absolute -top-1 left-0 right-0 h-1 bg-blue-500 rounded z-30"></div>
      )}

      <div 
        className={`w-full aspect-[1.414/1] rounded-xl flex items-center justify-center cursor-pointer transition-all shadow-sm overflow-hidden relative ${
          !isDragging ? 'hover:scale-105' : ''
        } ${
          doc.id === 'add' 
            ? 'bg-[#d9d9d9] hover:bg-[#c9c9c9]' 
            : doc.type === 'folder'
            ? `bg-[#4f88b7] hover:bg-[#5a95c7] ${isFolderTarget ? 'ring-4 ring-blue-400 ring-opacity-70 bg-[#5a95c7] scale-105' : ''}`
            : `bg-[#d9d9d9] hover:bg-[#c9c9c9] ${isReorderTarget ? 'ring-2 ring-green-400 ring-opacity-70' : ''}`
        }`}
        onClick={() => {
          if (selectionMode && doc.id !== 'add') {
            onToggleSelection(doc.id);
          } else if (doc.type === 'folder') {
            onFolderClick(doc);
          } else if (doc.id === 'add') {
            handleAddClick();
          } else if (doc.type === 'pdf') {
            onPdfClick(doc);
          }
        }}
      >
        {isFolderTarget && (
          <div className="absolute inset-0 bg-blue-500 bg-opacity-30 rounded-xl border-2 border-blue-400 border-dashed flex items-center justify-center z-10">
            <div className="bg-white px-3 py-2 rounded-lg shadow-lg">
              <span className="text-blue-700 font-medium text-sm">폴더로 이동</span>
            </div>
          </div>
        )}

        {isReorderTarget && (
          <div className="absolute inset-0 bg-green-500 bg-opacity-20 rounded-xl border-2 border-green-400 border-dashed flex items-center justify-center z-10">
            <div className="bg-white px-3 py-2 rounded-lg shadow-lg">
              <span className="text-green-700 font-medium text-sm">순서 변경</span>
            </div>
          </div>
        )}
        
        {doc.id === 'add' ? (
          <Plus size={32} className="md:w-16 md:h-16 text-gray-600" />
        ) : doc.type === 'folder' ? (
          <div className="w-12 h-9 md:w-16 md:h-12 bg-[#64a3d7] rounded border-l-2 border-t-2 border-[#5a95c7]"></div>
        ) : doc.previewImage ? (
          <img
            src={doc.previewImage}
            alt={doc.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-10 h-12 md:w-12 md:h-16 bg-white rounded shadow-sm"></div>
        )}
      </div>

      <div className="mt-2 md:mt-3 px-1">
        {editingId === doc.id ? (
          <input
            type="text"
            value={editingName}
            onChange={onNameChange}
            onKeyDown={onNameKeyPress}
            onBlur={onNameBlur}
            className={`w-full text-center text-sm md:text-base bg-transparent border-2 border-blue-500 rounded px-2 py-1 ${
              isDarkMode ? 'text-[#efefef]' : 'text-gray-700'
            }`}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <p 
            className={`${isDarkMode ? 'text-[#efefef]' : 'text-gray-700'} text-center text-sm md:text-base truncate cursor-pointer hover:bg-opacity-10 hover:bg-gray-500 rounded px-1 py-1 transition-colors`}
            onDoubleClick={() => onNameDoubleClick(doc)}
            title="더블클릭하여 이름 변경"
          >
            {doc.name}
          </p>
        )}
      </div>
    </div>
  );
});

// 드롭 가능한 브레드크럼 컴포넌트
const DroppableBreadcrumb: React.FC<{
  targetFolderId: string | null;
  text: string;
  action: (() => void) | null;
  isDarkMode: boolean;
  onDrop: (targetFolderId: string | null, draggedItem: any) => void;
}> = ({ targetFolderId, text, action, isDarkMode, onDrop }) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: ItemTypes.DOCUMENT,
    drop: (draggedItem) => {
      onDrop(targetFolderId, draggedItem);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  if (action) {
    return (
      <div ref={drop as unknown as React.RefObject<HTMLDivElement>}>
        <button
          onClick={action}
          className={`${isDarkMode ? 'text-[#efefef] hover:text-white' : 'text-gray-700 hover:text-gray-900'} transition-colors text-lg md:text-xl font-medium truncate hover:underline relative ${
            isOver ? 'bg-blue-500 bg-opacity-20 px-2 py-1 rounded' : ''
          }`}
          title={isOver ? '여기로 이동' : undefined}
        >
          {isOver && (
            <div className="absolute inset-0 bg-blue-500 bg-opacity-30 rounded border-2 border-blue-400 border-dashed -z-10"></div>
          )}
          {text}
        </button>
      </div>
    );
  }

  return (
    <div ref={drop as unknown as React.RefObject<HTMLDivElement>}>
      <h1 
        className={`${isDarkMode ? 'text-[#efefef]' : 'text-gray-900'} text-lg md:text-xl font-medium truncate relative ${
          isOver ? 'bg-blue-500 bg-opacity-20 px-2 py-1 rounded' : ''
        }`}
        title={isOver ? '여기로 이동' : undefined}
      >
        {isOver && (
          <div className="absolute inset-0 bg-blue-500 bg-opacity-30 rounded border-2 border-blue-400 border-dashed -z-10"></div>
        )}
        {text}
      </h1>
    </div>
  );
};

DraggableDocument.displayName = 'DraggableDocument';
DroppableFolder.displayName = 'DroppableFolder';
DraggableCard.displayName = 'DraggableCard';

export function MainPage({ isDarkMode, isLoggedIn, userEmail, userName, userPicture, userId, onSettingsClick, onLoginClick, onPdfClick }: MainPageProps) {
  // 로그인 상태 디버깅
  console.log('MainPage - isLoggedIn:', isLoggedIn);
  console.log('MainPage - userEmail:', userEmail);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [documentsExpanded, setDocumentsExpanded] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<string[]>(['folder1']);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // 이름 편집 상태
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // 문서 구조 상태
  const [documents, setDocuments] = useState<Document[]>([
    {
      id: 'add',
      name: '추가',
      type: 'pdf'
    }
  ]);

  // 화면 크기 감지
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    };
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // 리사이즈 핸들러
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    
    const newWidth = e.clientX;
    if (newWidth >= 240 && newWidth <= 500) {
      setSidebarWidth(newWidth);
    }
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // 문서 이동 함수
  const moveDocument = (documentId: string, targetFolderId: string | null) => {
    setDocuments(prevDocs => {
      const newDocs = [...prevDocs];
      
      const removeFromArray = (arr: Document[]): Document | null => {
        for (let i = 0; i < arr.length; i++) {
          if (arr[i].id === documentId) {
            return arr.splice(i, 1)[0];
          }
          if (arr[i].children) {
            const found = removeFromArray(arr[i].children!);
            if (found) return found;
          }
        }
        return null;
      };

      const removedDoc = removeFromArray(newDocs);
      if (!removedDoc) return prevDocs;

      if (targetFolderId === null) {
        newDocs.push(removedDoc);
      } else {
        const addToFolder = (arr: Document[]): boolean => {
          for (let doc of arr) {
            if (doc.id === targetFolderId && doc.type === 'folder') {
              if (!doc.children) doc.children = [];
              doc.children.push(removedDoc);
              return true;
            }
            if (doc.children && addToFolder(doc.children)) {
              return true;
            }
          }
          return false;
        };
        addToFolder(newDocs);
      }

      return newDocs;
    });
  };

  const handleDrop = (targetFolderId: string, draggedItem: any) => {
    if (draggedItem.id === targetFolderId) {
      toast.error('폴더를 자기 자신으로 이동할 수 없습니다.');
      return;
    }

    if (draggedItem.type === 'pdf') {
      moveDocument(draggedItem.id, targetFolderId);
      const targetFolder = documents.find(doc => doc.id === targetFolderId);
      toast.success(`"${draggedItem.name || '문서'}"를 "${targetFolder?.name || '폴더'}"로 이동했습니다.`);
    }
  };

  const reorderDocuments = (draggedIndex: number, targetIndex: number, folderId?: string) => {
    setDocuments(prevDocs => {
      const newDocs = [...prevDocs];
      
      if (folderId) {
        const folder = newDocs.find(doc => doc.id === folderId);
        if (folder && folder.children) {
          const [movedItem] = folder.children.splice(draggedIndex, 1);
          folder.children.splice(targetIndex, 0, movedItem);
        }
      } else {
        const actualDocs = newDocs.filter(doc => doc.id !== 'add');
        const addButton = newDocs.find(doc => doc.id === 'add');
        
        const [movedItem] = actualDocs.splice(draggedIndex, 1);
        actualDocs.splice(targetIndex, 0, movedItem);
        
        return addButton ? [addButton, ...actualDocs] : actualDocs;
      }
      
      return newDocs;
    });
  };

  const handleMainDrop = (draggedItem: any, dropResult: any) => {
    if (!dropResult) return;

    if (dropResult.folderId) {
      if (draggedItem.id === dropResult.folderId) {
        toast.error('폴더를 자기 자신으로 이동할 수 없습니다.');
        return;
      }

      if (draggedItem.type === 'pdf' || draggedItem.type === 'folder') {
        moveDocument(draggedItem.id, dropResult.folderId);
        toast.success(`"${draggedItem.name}"을(를) "${dropResult.folderName}"(으)로 이동했습니다.`);
      }
    }
    else if (dropResult.reorder && draggedItem.index !== dropResult.targetIndex) {
      reorderDocuments(draggedItem.index, dropResult.targetIndex, dropResult.currentFolder);
      toast.success(`"${draggedItem.name}"의 순서를 변경했습니다.`);
    }
  };

  const handleNameDoubleClick = (doc: Document) => {
    if (doc.id === 'add') return;
    setEditingId(doc.id);
    setEditingName(doc.name);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingName(e.target.value);
  };

  const handleNameSubmit = () => {
    if (!editingId || !editingName.trim()) {
      setEditingId(null);
      return;
    }

    setDocuments(prevDocs => {
      const updateName = (docs: Document[]): Document[] => {
        return docs.map(doc => {
          if (doc.id === editingId) {
            return { ...doc, name: editingName.trim() };
          }
          if (doc.children) {
            return { ...doc, children: updateName(doc.children) };
          }
          return doc;
        });
      };
      return updateName(prevDocs);
    });

    toast.success('이름이 변경되었습니다.');
    setEditingId(null);
    setEditingName('');
  };

  const handleNameKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSubmit();
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setEditingName('');
    }
  };

  const handleNameBlur = () => {
    handleNameSubmit();
  };

  const handleMoveSelectedDocuments = (targetFolderId: string | null) => {
    const targetName = targetFolderId ? documents.find(doc => doc.id === targetFolderId)?.name : '내 문서';
    
    selectedDocuments.forEach(docId => {
      moveDocument(docId, targetFolderId);
    });

    toast.success(`${selectedDocuments.length}개 문서를 "${targetName}"로 이동했습니다.`);
    setSelectedDocuments([]);
    setSelectionMode(false);
  };

  const toggleDocumentSelection = (id: string) => {
    setSelectedDocuments(prev => 
      prev.includes(id) 
        ? prev.filter(docId => docId !== id)
        : [...prev, id]
    );
  };

  const toggleFolderExpansion = (folderId: string) => {
    setExpandedFolders(prev => 
      prev.includes(folderId)
        ? prev.filter(id => id !== folderId)
        : [...prev, folderId]
    );
  };

  const handleSort = (sortType: string) => {
    console.log('정렬:', sortType);
  };

  const getCurrentDocuments = () => {
    if (currentFolder) {
      const folder = documents.find(doc => doc.id === currentFolder);
      return folder?.children || [];
    }
    return documents;
  };

  const getBreadcrumbElements = (): BreadcrumbItem[] => {
    if (currentFolder) {
      const folder = documents.find(doc => doc.id === currentFolder);
      return [
        { text: '내 문서', action: () => setCurrentFolder(null), folderId: null },
        { text: folder?.name || '', action: null, folderId: currentFolder }
      ];
    }
    return [{ text: '내 문서', action: null, folderId: null }];
  };

  const handleBreadcrumbDrop = (targetFolderId: string | null, draggedItem: any) => {
    if (draggedItem.id === targetFolderId) {
      toast.error('폴더를 자기 자신으로 이동할 수 없습니다.');
      return;
    }

    const targetName = targetFolderId ? documents.find(doc => doc.id === targetFolderId)?.name : '내 문서';
    
    if (draggedItem.type === 'pdf' || draggedItem.type === 'folder') {
      moveDocument(draggedItem.id, targetFolderId);
      toast.success(`"${draggedItem.name}"을(를) "${targetName}"(으)로 이동했습니다.`);
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // PDF 파일 업로드 함수
  const uploadPdfFile = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('pdf', file);

      const response = await fetch('/api/pdfs/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'PDF 업로드에 실패했습니다.');
      }

      const result = await response.json();
      
      // 새로 업로드된 PDF를 문서 목록에 추가
      const newPdf: Document = {
        id: result.pdfId,
        name: result.fileName,
        type: 'pdf',
        previewImage: undefined
      };

      setDocuments(prev => [...prev.filter(doc => doc.id !== 'add'), newPdf, prev.find(doc => doc.id === 'add')!]);
      toast.success('PDF가 성공적으로 업로드되었습니다!');
      
    } catch (error) {
      console.error('PDF 업로드 에러:', error);
      toast.error(error instanceof Error ? error.message : 'PDF 업로드에 실패했습니다.');
    }
  };

  // 파일 선택 핸들러
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'application/pdf') {
        uploadPdfFile(file);
      } else {
        toast.error('PDF 파일만 업로드 가능합니다.');
      }
    }
    // 파일 입력 초기화
    event.target.value = '';
  };

  const handleAddClick = () => {
    if (!isLoggedIn) {
      setShowLoginModal(true);
    } else {
      // 숨겨진 파일 입력 트리거
      const fileInput = document.getElementById('pdf-file-input') as HTMLInputElement;
      if (fileInput) {
        fileInput.click();
      }
    }
  };

  // 검색 필터링
  const filteredDocuments = getCurrentDocuments().filter(doc => {
    if (!searchQuery) return true;
    return doc.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // 사이드바에서 검색된 문서들 (전체 문서에서 검색)
  const searchResults = React.useMemo(() => {
    if (!searchQuery) return [];
    
    const searchInDocuments = (docs: Document[], path: string[] = []): Document[] => {
      const results: Document[] = [];
      
      docs.forEach(doc => {
        if (doc.name.toLowerCase().includes(searchQuery.toLowerCase())) {
          results.push(doc);
        }
        
        if (doc.children) {
          const childResults = searchInDocuments(doc.children, [...path, doc.name]);
          results.push(...childResults);
        }
      });
      
      return results;
    };
    
    return searchInDocuments(documents.filter(doc => doc.id !== 'add'));
  }, [searchQuery, documents]);

  return (
    <div className={`${isDarkMode ? 'bg-[#1A1A1E] dark' : 'bg-[#f5f5f5]'} min-h-screen flex relative`}>
      {/* 모바일 오버레이 */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 좌측 사이드바 */}
      <div 
        className={`${isDarkMode ? 'bg-[#121214]' : 'bg-white'} transition-all duration-300 flex-shrink-0 relative border-r ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} ${
          isMobile 
            ? `fixed left-0 top-0 h-full z-50 ${sidebarOpen ? 'w-80' : 'w-0 overflow-hidden'}`
            : `${sidebarOpen ? '' : 'w-0 overflow-hidden'}`
        }`}
        style={!isMobile && sidebarOpen ? { width: `${sidebarWidth}px` } : {}}
      >
        <div className="p-4 md:p-6 h-full overflow-y-auto">
          {/* 상단 계정 섹션 */}
          <div className={`flex items-center justify-between mb-6 pb-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center overflow-hidden">
                {isLoggedIn && userPicture ? (
                  <img 
                    src={userPicture} 
                    alt="프로필" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-white text-sm font-medium">
                    {isLoggedIn ? (userEmail ? userEmail.charAt(0).toUpperCase() : userName.charAt(0).toUpperCase()) : 'G'}
                  </span>
                )}
              </div>
              <div className="flex flex-col">
                <span className={`${isDarkMode ? 'text-[#efefef]' : 'text-gray-700'} text-sm font-medium`}>
                  {isLoggedIn ? userName : 'Guest User'}
                </span>
                <span className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'} text-xs`}>
                  {isLoggedIn ? '로그인됨' : '게스트'}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onSettingsClick}
              className={`${isDarkMode ? 'text-gray-400 hover:text-[#efefef] hover:bg-gray-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
            >
              <Settings size={16} />
            </Button>
          </div>

          {/* 검색 섹션 */}
          <div className="mb-6">
            <div className="relative">
              <Search size={16} className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              <Input
                type="text"
                placeholder="문서 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`pl-10 ${isDarkMode ? 'bg-[#2A2A2E] border-gray-600 text-[#efefef] placeholder:text-gray-400' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-500'}`}
              />
            </div>
            
            {/* 검색 결과 표시 */}
            {searchQuery && (
              <div className="mt-3">
                <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} text-xs mb-2`}>
                  검색 결과 ({searchResults.length}개)
                </p>
                <div className="space-y-1">
                  {searchResults.slice(0, 5).map(doc => (
                    <div
                      key={doc.id}
                      className={`p-2 rounded cursor-pointer transition-colors ${isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-700'}`}
                      onClick={() => {
                        if (doc.type === 'pdf') {
                          onPdfClick(doc);
                        } else if (doc.type === 'folder') {
                          setCurrentFolder(doc.id);
                        }
                      }}
                    >
                      <span className="text-sm truncate">{doc.name}</span>
                      <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'} ml-2`}>
                        {doc.type === 'pdf' ? 'PDF' : '폴더'}
                      </span>
                    </div>
                  ))}
                  {searchResults.length > 5 && (
                    <p className={`${isDarkMode ? 'text-gray-500' : 'text-gray-400'} text-xs`}>
                      +{searchResults.length - 5}개 더...
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 문서 트리 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setDocumentsExpanded(!documentsExpanded)}
                className={`flex items-center gap-2 py-1 px-2 rounded hover:bg-opacity-10 hover:bg-gray-500 transition-colors ${isDarkMode ? 'text-[#efefef]' : 'text-gray-700'}`}
              >
                {documentsExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <span className="font-medium">문서</span>
              </button>
            </div>

            {/* 문서 목록 */}
            {documentsExpanded && (
              <div className="ml-2 space-y-1">
                {documents.filter(doc => doc.id !== 'add').map(doc => (
                  <div key={doc.id}>
                    {doc.type === 'folder' ? (
                      <>
                        <DroppableFolder
                          folder={doc}
                          isDarkMode={isDarkMode}
                          onDrop={(draggedItem) => handleDrop(doc.id, draggedItem)}
                          onClick={() => {
                            toggleFolderExpansion(doc.id);
                            setCurrentFolder(doc.id);
                          }}
                          onNameDoubleClick={handleNameDoubleClick}
                          editingId={editingId}
                          editingName={editingName}
                          onNameChange={handleNameChange}
                          onNameKeyPress={handleNameKeyPress}
                          onNameBlur={handleNameBlur}
                          expandedFolders={expandedFolders}
                        >
                          {doc.name}
                        </DroppableFolder>
                        
                        {/* 폴더 내부 파일들 */}
                        {expandedFolders.includes(doc.id) && doc.children && (
                          <div className="ml-4 space-y-1">
                            {doc.children.map(child => (
                              <DraggableDocument
                                key={child.id}
                                doc={child}
                                isDarkMode={isDarkMode}
                                onClick={() => {
                                  if (child.type === 'pdf') {
                                    onPdfClick(child);
                                  }
                                }}
                                onNameDoubleClick={handleNameDoubleClick}
                                editingId={editingId}
                                editingName={editingName}
                                onNameChange={handleNameChange}
                                onNameKeyPress={handleNameKeyPress}
                                onNameBlur={handleNameBlur}
                              >
                                {child.name}
                              </DraggableDocument>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <DraggableDocument
                        doc={doc}
                        isDarkMode={isDarkMode}
                        onClick={() => {
                          if (doc.type === 'pdf') {
                            onPdfClick(doc);
                          }
                        }}
                        onNameDoubleClick={handleNameDoubleClick}
                        editingId={editingId}
                        editingName={editingName}
                        onNameChange={handleNameChange}
                        onNameKeyPress={handleNameKeyPress}
                        onNameBlur={handleNameBlur}
                      >
                        {doc.name}
                      </DraggableDocument>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 리사이즈 핸들 */}
        {!isMobile && sidebarOpen && (
          <div
            className="absolute right-0 top-0 w-1 h-full cursor-ew-resize bg-transparent hover:bg-gray-500 hover:bg-opacity-50 transition-colors group"
            onMouseDown={handleMouseDown}
          >
            <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </div>
        )}
      </div>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex flex-col">
        {/* 상단 헤더 */}
        <div className={`flex items-center justify-between p-4 md:p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
              className={`${isDarkMode ? 'text-[#efefef] hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <Menu size={20} />
            </Button>

            {/* 브레드크럼 */}
            <div className="flex items-center gap-2">
              {getBreadcrumbElements().map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <DroppableBreadcrumb
                    targetFolderId={item.folderId}
                    text={item.text}
                    action={item.action}
                    isDarkMode={isDarkMode}
                    onDrop={handleBreadcrumbDrop}
                  />
                  {index < getBreadcrumbElements().length - 1 && (
                    <ChevronRight size={16} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 우측 컨트롤 */}
          <div className="flex items-center gap-3">
            {selectionMode && selectedDocuments.length > 0 && (
              <div className="flex items-center gap-2">
                <span className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} text-sm`}>
                  {selectedDocuments.length}개 선택
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFolderDialog(true)}
                  className={`${isDarkMode ? 'border-gray-600 text-[#efefef] hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                >
                  <Move size={14} className="mr-2" />
                  이동
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedDocuments([]);
                    setSelectionMode(false);
                  }}
                  className={`${isDarkMode ? 'border-gray-600 text-[#efefef] hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                >
                  취소
                </Button>
              </div>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={`${isDarkMode ? 'border-gray-600 text-[#efefef] hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                >
                  <ArrowUpDown size={14} className="mr-2" />
                  정렬
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className={isDarkMode ? 'bg-[#2A2A2E] border-gray-600' : 'bg-white border-gray-200'}>
                <DropdownMenuItem onClick={() => handleSort('name')} className={isDarkMode ? 'text-[#efefef] hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}>
                  이름순
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSort('date')} className={isDarkMode ? 'text-[#efefef] hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}>
                  날짜순
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSort('type')} className={isDarkMode ? 'text-[#efefef] hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}>
                  유형순
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectionMode(!selectionMode)}
              className={`${isDarkMode ? 'border-gray-600 text-[#efefef] hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              <CheckCircle2 size={14} className="mr-2" />
              선택
            </Button>
          </div>
        </div>

        {/* 메인 콘텐츠 그리드 */}
        <div className="flex-1 p-4 md:p-6 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {filteredDocuments.map((doc, index) => (
              <DraggableCard
                key={doc.id}
                doc={doc}
                index={index}
                isDarkMode={isDarkMode}
                selectionMode={selectionMode}
                selectedDocuments={selectedDocuments}
                onToggleSelection={toggleDocumentSelection}
                onPdfClick={onPdfClick}
                onFolderClick={(folder) => setCurrentFolder(folder.id)}
                onMainDrop={handleMainDrop}
                onNameDoubleClick={handleNameDoubleClick}
                editingId={editingId}
                editingName={editingName}
                onNameChange={handleNameChange}
                onNameKeyPress={handleNameKeyPress}
                onNameBlur={handleNameBlur}
                currentFolder={currentFolder}
                handleAddClick={handleAddClick}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 폴더 선택 다이얼로그 */}
      <FolderSelectDialog
        isOpen={showFolderDialog}
        onClose={() => setShowFolderDialog(false)}
        onSelectFolder={handleMoveSelectedDocuments}
        documents={documents}
        isDarkMode={isDarkMode}
      />

      {/* 로그인 모달 */}
      <Dialog open={showLoginModal && !isLoggedIn} onOpenChange={setShowLoginModal}>
        <DialogContent className={`${isDarkMode ? 'bg-[#121214] border-gray-600' : 'bg-white border-gray-200'} max-w-md`}>
          <DialogHeader>
            <DialogTitle className={isDarkMode ? 'text-[#efefef]' : 'text-gray-900'}>
              로그인이 필요합니다
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} text-sm`}>
              새 문서를 추가하려면 로그인이 필요합니다.
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowLoginModal(false)}
                className={`${isDarkMode ? 'border-gray-600 text-[#efefef] hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
              >
                취소
              </Button>
              <Button
                onClick={() => {
                  setShowLoginModal(false);
                  onLoginClick();
                }}
                className="bg-blue-500 hover:bg-blue-600 text-white"
              >
                로그인
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 숨겨진 PDF 파일 입력 */}
      <input
        id="pdf-file-input"
        type="file"
        accept=".pdf"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
    </div>
  );
}