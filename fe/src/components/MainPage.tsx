import React, { useState, useEffect, useCallback } from 'react';
import { Menu, Settings, ChevronRight, ChevronDown, Plus, ArrowUpDown, CheckCircle2, Move, Trash2, Search, File, Folder, FileText } from 'lucide-react';
import { useDrag, useDrop, DragSourceMonitor } from 'react-dnd';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import FolderSelectDialog from './FolderSelectDialog';
import { toast } from 'sonner';
import { Portal } from './Portal'; // 새로 추가


interface Document {
  id: string;
  name: string;
  type: 'pdf' | 'folder';
  children?: Document[];
  previewImage?: string;
  folderId?: string;
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
  showAddMenu: boolean;
  onAddPdf: () => void;
  onAddFolder: () => void;
  onAddNote: () => void;
}>(({ doc, index, isDarkMode, selectionMode, selectedDocuments, onToggleSelection, onPdfClick, onFolderClick, onMainDrop, onNameDoubleClick, editingId, editingName, onNameChange, onNameKeyPress, onNameBlur, currentFolder, handleAddClick, showAddMenu, onAddPdf, onAddFolder, onAddNote }, ref) => {
  const anchorRef = React.useRef<HTMLDivElement | null>(null);
  const [menuPos, setMenuPos] = React.useState<{ left: number; top: number } | null>(null);

  React.useEffect(() => {
    if (showAddMenu && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setMenuPos({
        left: rect.left + rect.width / 2,
        top: rect.bottom + 12, // 버튼 아래로 12px
      });
    } else if (!showAddMenu) {
      setMenuPos(null);
    }
  }, [showAddMenu]);

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
      className="relative group overflow-visible"
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
        className={`w-full aspect-[1.414/1] rounded-xl flex items-center justify-center cursor-pointer transition-all shadow-sm relative ${
          !isDragging ? 'hover:scale-105' : ''
        } ${
          doc.id === 'add' 
            ? 'bg-[#d9d9d9] hover:bg-[#c9c9c9] overflow-visible' 
            : doc.type === 'folder'
            ? `bg-[#4f88b7] hover:bg-[#5a95c7] overflow-hidden ${isFolderTarget ? 'ring-4 ring-blue-400 ring-opacity-70 bg-[#5a95c7] scale-105' : ''}`
            : `bg-[#d9d9d9] hover:bg-[#c9c9c9] overflow-hidden ${isReorderTarget ? 'ring-2 ring-green-400 ring-opacity-70' : ''}`
        }`}
        onClick={(e) => {
          console.log('DraggableCard 클릭됨', { docId: doc.id, selectionMode, docType: doc.type });
          if (selectionMode && doc.id !== 'add') {
            onToggleSelection(doc.id);
          } else if (doc.type === 'folder') {
            onFolderClick(doc);
          } else if (doc.id === 'add') {
            console.log('+ 버튼 클릭됨, handleAddClick 호출');
            e.stopPropagation(); // 이벤트 전파 방지
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
          <div className="relative add-menu-container">
            {/* 위치 기준점(앵커) */}
            <div ref={anchorRef} className="absolute inset-0 pointer-events-none" />

            <Plus size={32} className="md:w-16 md:h-16 text-gray-600" />

            {/* 포털로 띄우는 토글 메뉴 */}
            {showAddMenu && menuPos && (
              <Portal>
                <div
                  id="add-menu-portal"
                  className={`rounded-xl shadow-xl border z-[1000000] ${
                    isDarkMode ? 'bg-[#2A2A2E] border-gray-600' : 'bg-white border-gray-200'
                  }`}
                  style={{
                    position: 'fixed',
                    left: `${menuPos.left}px`,
                    top: `${menuPos.top}px`,
                    transform: 'translateX(-50%)',
                    width: '300px',
                    maxWidth: '95vw',
                    boxShadow: '0 25px 50px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                      {/* 기존 onAddPdf / onAddFolder / onAddNote 버튼 그대로 복붙 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddPdf();
                        }}
                        className={`flex-1 flex flex-col items-center gap-3 px-4 py-4 sm:px-6 sm:py-5 text-center rounded-lg transition-all duration-200 ${
                          isDarkMode 
                            ? 'text-[#efefef] hover:bg-gray-700 hover:scale-[1.02]' 
                            : 'text-gray-700 hover:bg-gray-50 hover:scale-[1.02]'
                        } group`}
                      >
                        <div className={`p-2 sm:p-3 rounded-lg flex-shrink-0 ${
                          isDarkMode ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-50 text-blue-600'
                        } group-hover:scale-110 transition-transform`}>
                          <File size={20} className="sm:w-6 sm:h-6" />
                        </div>
                        <div className="font-medium text-sm sm:text-base leading-tight">
                          PDF 파일<br />추가
                        </div>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddFolder();
                        }}
                        className={`flex-1 flex flex-col items-center gap-3 px-4 py-4 sm:px-6 sm:py-5 text-center rounded-lg transition-all duration-200 ${
                          isDarkMode 
                            ? 'text-[#efefef] hover:bg-gray-700 hover:scale-[1.02]' 
                            : 'text-gray-700 hover:bg-gray-50 hover:scale-[1.02]'
                        } group`}
                      >
                        <div className={`p-2 sm:p-3 rounded-lg flex-shrink-0 ${
                          isDarkMode ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600'
                        } group-hover:scale-110 transition-transform`}>
                          <Folder size={20} className="sm:w-6 sm:h-6" />
                        </div>
                        <div className="font-medium text-sm sm:text-base leading-tight">
                          폴더<br />생성
                        </div>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddNote();
                        }}
                        className={`flex-1 flex flex-col items-center gap-3 px-4 py-4 sm:px-6 sm:py-5 text-center rounded-lg transition-all duration-200 ${
                          isDarkMode 
                            ? 'text-[#efefef] hover:bg-gray-700 hover:scale-[1.02]' 
                            : 'text-gray-700 hover:bg-gray-50 hover:scale-[1.02]'
                        } group`}
                      >
                        <div className={`p-2 sm:p-3 rounded-lg flex-shrink-0 ${
                          isDarkMode ? 'bg-green-500/10 text-green-400' : 'bg-green-50 text-green-600'
                        } group-hover:scale-110 transition-transform`}>
                          <FileText size={20} className="sm:w-6 sm:h-6" />
                        </div>
                        <div className="font-medium text-sm sm:text-base leading-tight">
                          빈 노트<br />생성
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </Portal>
            )}
          </div>
        ) : (
          // 나머지 기존 분기 유지
          doc.type === 'folder' ? (
            <div className="w-12 h-9 md:w-16 md:h-12 bg-[#64a3d7] rounded border-l-2 border-t-2 border-[#5a95c7]"></div>
          ) : doc.previewImage ? (
            <img src={doc.previewImage} alt={doc.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-10 h-12 md:w-12 md:h-16 bg-white rounded shadow-sm"></div>
          )
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
  
  // 드래그&드롭 상태
  const [isDragging, setIsDragging] = useState(false);
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
  
  // 추가 메뉴 상태
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showFolderCreateModal, setShowFolderCreateModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

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

  // 문서 목록 불러오기 (PDF + 폴더)
  const loadDocuments = async () => {
    if (!isLoggedIn) return;
    
    try {
      // PDF 목록 불러오기
      const pdfResponse = await fetch('/api/pdfs', {
        method: 'GET',
        credentials: 'include'
      });

      // 폴더 목록 불러오기
      const folderResponse = await fetch('/api/folders', {
        method: 'GET',
        credentials: 'include'
      });

      const documents: Document[] = [];

      if (pdfResponse.ok) {
        const pdfs = await pdfResponse.json();
        // PDF 데이터를 Document 형태로 변환
        const pdfDocuments: Document[] = pdfs.map((pdf: any) => ({
          id: pdf._id || pdf.id,
          name: pdf.originalName || pdf.name,
          type: 'pdf' as const,
          previewImage: undefined,
          folderId: pdf.folderId || null
        }));
        documents.push(...pdfDocuments);
      }

      if (folderResponse.ok) {
        const folderData = await folderResponse.json();
        // 폴더 데이터를 트리 구조로 변환
        const folderMap = new Map();
        const rootFolders: Document[] = [];

        // 모든 폴더를 맵에 추가
        folderData.folders.forEach((folder: any) => {
          folderMap.set(folder._id, {
            id: folder._id,
            name: folder.name,
            type: 'folder' as const,
            children: []
          });
        });

        // 부모-자식 관계 설정
        folderData.folders.forEach((folder: any) => {
          const folderDoc = folderMap.get(folder._id);
          if (folder.parentId) {
            const parentFolder = folderMap.get(folder.parentId);
            if (parentFolder) {
              parentFolder.children.push(folderDoc);
            }
          } else {
            rootFolders.push(folderDoc);
          }
        });

        documents.push(...rootFolders);
      }

      // PDF를 폴더에 분류
      const pdfsWithFolders = documents.filter(doc => doc.type === 'pdf' && doc.folderId);
      const pdfsWithoutFolders = documents.filter(doc => doc.type === 'pdf' && !doc.folderId);
      
      // 폴더 내부에 PDF 추가
      pdfsWithFolders.forEach(pdf => {
        const addToFolder = (folders: Document[]): boolean => {
          for (const folder of folders) {
            if (folder.id === pdf.folderId) {
              if (!folder.children) folder.children = [];
              folder.children.push(pdf);
              return true;
            }
            if (folder.children && addToFolder(folder.children)) {
              return true;
            }
          }
          return false;
        };
        addToFolder(documents.filter(doc => doc.type === 'folder'));
      });

      // 폴더가 없는 PDF들만 루트에 추가
      const finalDocuments = [
        ...documents.filter(doc => doc.type === 'folder'),
        ...pdfsWithoutFolders
      ];

      console.log('로드된 문서 구조:', {
        totalPdfs: documents.filter(doc => doc.type === 'pdf').length,
        pdfsWithFolders: pdfsWithFolders.length,
        pdfsWithoutFolders: pdfsWithoutFolders.length,
        folders: documents.filter(doc => doc.type === 'folder').length,
        finalDocuments: finalDocuments.length
      });

      // "추가" 버튼을 가장 앞에 고정
      setDocuments([{
        id: 'add',
        name: '추가',
        type: 'pdf'
      }, ...finalDocuments]);
    } catch (error) {
      console.error('문서 목록 불러오기 에러:', error);
    }
  };

  // 로그인 상태가 변경될 때 문서 목록 불러오기
  useEffect(() => {
    if (isLoggedIn) {
      loadDocuments();
    } else {
      // 로그아웃 시 문서 목록 초기화
      setDocuments([{
        id: 'add',
        name: '추가',
        type: 'pdf'
      }]);
    }
  }, [isLoggedIn]);

  // 외부 클릭 시 추가 메뉴 닫기
  // 기존 useEffect 교체
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // add-menu-container(트리거)나 포털 내부(#add-menu-portal)를 클릭한 경우는 유지
      if (
        showAddMenu &&
        !(
          target.closest('.add-menu-container') ||
          target.closest('#add-menu-portal')
        )
      ) {
        setShowAddMenu(false);
      }
    };

    if (showAddMenu) {
      const timeoutId = setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 100);

      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [showAddMenu]);


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

  const handleDragDrop = async (targetFolderId: string, draggedItem: any) => {
    if (draggedItem.id === targetFolderId) {
      toast.error('폴더를 자기 자신으로 이동할 수 없습니다.');
      return;
    }

    if (draggedItem.type === 'pdf') {
      try {
        // 백엔드 API 호출하여 PDF를 폴더에 추가
        const response = await fetch(`/api/folders/${targetFolderId}/pdfs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            pdfId: draggedItem.id
          })
        });

        if (response.ok) {
          moveDocument(draggedItem.id, targetFolderId);
          const targetFolder = documents.find(doc => doc.id === targetFolderId);
          toast.success(`"${draggedItem.name || '문서'}"를 "${targetFolder?.name || '폴더'}"로 이동했습니다.`);
        } else {
          const errorData = await response.json();
          toast.error(errorData.error || '파일 이동에 실패했습니다.');
        }
      } catch (error) {
        console.error('파일 이동 에러:', error);
        toast.error('파일 이동에 실패했습니다.');
      }
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

  const handleMainDrop = async (draggedItem: any, dropResult: any) => {
    if (!dropResult) return;

    if (dropResult.folderId) {
      if (draggedItem.id === dropResult.folderId) {
        toast.error('폴더를 자기 자신으로 이동할 수 없습니다.');
        return;
      }

      if (draggedItem.type === 'pdf') {
        try {
          // 백엔드 API 호출하여 PDF를 폴더에 추가
          const response = await fetch(`/api/folders/${dropResult.folderId}/pdfs`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              pdfId: draggedItem.id
            })
          });

          if (response.ok) {
            moveDocument(draggedItem.id, dropResult.folderId);
            toast.success(`"${draggedItem.name}"을(를) "${dropResult.folderName}"(으)로 이동했습니다.`);
          } else {
            const errorData = await response.json();
            toast.error(errorData.error || '파일 이동에 실패했습니다.');
          }
        } catch (error) {
          console.error('파일 이동 에러:', error);
          toast.error('파일 이동에 실패했습니다.');
        }
      } else if (draggedItem.type === 'folder') {
        // 폴더 이동은 나중에 구현
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

  // 문서 ID로 문서 찾기 헬퍼 함수
  const findDocumentById = (docs: Document[], id: string): Document | null => {
    for (const doc of docs) {
      if (doc.id === id) {
        return doc;
      }
      if (doc.children) {
        const found = findDocumentById(doc.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const handleNameSubmit = async () => {
    if (!editingId || !editingName.trim()) {
      setEditingId(null);
      return;
    }

    try {
      // 편집 중인 문서가 폴더인지 확인
      const editingDoc = findDocumentById(documents, editingId);
      if (!editingDoc) {
        setEditingId(null);
        return;
      }

      if (editingDoc.type === 'folder') {
        // 폴더 이름 변경 API 호출
        const response = await fetch(`/api/folders/${editingId}/rename`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            name: editingName.trim()
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          toast.error(errorData.error || '폴더 이름 변경에 실패했습니다.');
          return;
        }
      }
      // PDF 이름 변경은 나중에 구현 (현재는 클라이언트에서만 변경)

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
    } catch (error) {
      console.error('이름 변경 에러:', error);
      toast.error('이름 변경에 실패했습니다.');
    }
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

  // 폴더 삭제
  const handleDeleteFolder = async (folderId: string, folderName: string) => {
    if (!confirm(`"${folderName}" 폴더를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/folders/${folderId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        // 문서 목록에서 폴더 제거
        setDocuments(prevDocs => {
          const removeFolder = (docs: Document[]): Document[] => {
            return docs.filter(doc => {
              if (doc.id === folderId) {
                return false; // 폴더 제거
              }
              if (doc.children) {
                doc.children = removeFolder(doc.children);
              }
              return true;
            });
          };
          return removeFolder(prevDocs);
        });

        toast.success(`"${folderName}" 폴더가 삭제되었습니다.`);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || '폴더 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('폴더 삭제 에러:', error);
      toast.error('폴더 삭제에 실패했습니다.');
    }
  };

  const handleMoveSelectedDocuments = async (targetFolderId: string | null) => {
    const targetName = targetFolderId ? documents.find(doc => doc.id === targetFolderId)?.name : '내 문서';
    
    try {
      // 선택된 문서들을 순차적으로 이동
      for (const docId of selectedDocuments) {
        const doc = findDocumentById(documents, docId);
        if (doc && doc.type === 'pdf') {
          if (targetFolderId) {
            // 폴더로 이동
            const response = await fetch(`/api/folders/${targetFolderId}/pdfs`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include',
              body: JSON.stringify({
                pdfId: docId
              })
            });

            if (!response.ok) {
              const errorData = await response.json();
              toast.error(`${doc.name}: ${errorData.error || '이동에 실패했습니다.'}`);
              continue;
            }
          } else {
            // 루트로 이동 (폴더에서 제거)
            const currentDoc = findDocumentById(documents, docId);
            if (currentDoc && currentDoc.folderId) {
              const response = await fetch(`/api/folders/${currentDoc.folderId}/pdfs/${docId}`, {
                method: 'DELETE',
                credentials: 'include'
              });

              if (!response.ok) {
                const errorData = await response.json();
                toast.error(`${doc.name}: ${errorData.error || '이동에 실패했습니다.'}`);
                continue;
              }
            }
          }
          
          moveDocument(docId, targetFolderId);
        }
      }

      toast.success(`${selectedDocuments.length}개 문서를 "${targetName}"로 이동했습니다.`);
      setSelectedDocuments([]);
      setSelectionMode(false);
    } catch (error) {
      console.error('문서 이동 에러:', error);
      toast.error('문서 이동에 실패했습니다.');
    }
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
      console.log('현재 폴더:', currentFolder, '폴더 정보:', folder);
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

  const handleBreadcrumbDrop = async (targetFolderId: string | null, draggedItem: any) => {
    if (draggedItem.id === targetFolderId) {
      toast.error('폴더를 자기 자신으로 이동할 수 없습니다.');
      return;
    }

    const targetName = targetFolderId ? documents.find(doc => doc.id === targetFolderId)?.name : '내 문서';
    
    if (draggedItem.type === 'pdf') {
      if (targetFolderId) {
        try {
          // 백엔드 API 호출하여 PDF를 폴더에 추가
          const response = await fetch(`/api/folders/${targetFolderId}/pdfs`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              pdfId: draggedItem.id
            })
          });

          if (response.ok) {
            moveDocument(draggedItem.id, targetFolderId);
            toast.success(`"${draggedItem.name}"을(를) "${targetName}"(으)로 이동했습니다.`);
          } else {
            const errorData = await response.json();
            toast.error(errorData.error || '파일 이동에 실패했습니다.');
          }
        } catch (error) {
          console.error('파일 이동 에러:', error);
          toast.error('파일 이동에 실패했습니다.');
        }
      } else {
        // 루트로 이동 (폴더에서 제거)
        try {
          const currentDoc = findDocumentById(documents, draggedItem.id);
          if (currentDoc && currentDoc.folderId) {
            const response = await fetch(`/api/folders/${currentDoc.folderId}/pdfs/${draggedItem.id}`, {
              method: 'DELETE',
              credentials: 'include'
            });

            if (response.ok) {
              moveDocument(draggedItem.id, null);
              toast.success(`"${draggedItem.name}"을(를) "${targetName}"(으)로 이동했습니다.`);
            } else {
              const errorData = await response.json();
              toast.error(errorData.error || '파일 이동에 실패했습니다.');
            }
          } else {
            moveDocument(draggedItem.id, null);
            toast.success(`"${draggedItem.name}"을(를) "${targetName}"(으)로 이동했습니다.`);
          }
        } catch (error) {
          console.error('파일 이동 에러:', error);
          toast.error('파일 이동에 실패했습니다.');
        }
      }
    } else if (draggedItem.type === 'folder') {
      // 폴더 이동은 나중에 구현
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
      console.log('PDF 업로드 시작:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      });

      const formData = new FormData();
      formData.append('pdf', file);
      

      // 업로드 시작 알림
      const uploadToast = toast.loading('PDF 업로드 중...');

      const response = await fetch('/api/pdfs/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      console.log('PDF 업로드 응답:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('PDF 업로드 실패:', errorData);
        toast.dismiss(uploadToast);
        throw new Error(errorData.error || 'PDF 업로드에 실패했습니다.');
      }

      const result = await response.json();
      console.log('PDF 업로드 성공:', result);
      
             // 문서 목록 새로고침
       await loadDocuments();
      toast.dismiss(uploadToast);
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
        // 파일 크기 검증 (500MB)
        const maxSize = 500 * 1024 * 1024; // 500MB
        if (file.size > maxSize) {
          const sizeInMB = Math.round(file.size / (1024 * 1024));
          toast.error(`파일 크기가 500MB를 초과합니다. (현재: ${sizeInMB}MB)`);
          return;
        }
        
        // 파일 크기 경고 (100MB 이상시)
        const warningSize = 100 * 1024 * 1024; // 100MB
        if (file.size > warningSize) {
          const sizeInMB = Math.round(file.size / (1024 * 1024));
          toast.warning(`큰 파일입니다 (${sizeInMB}MB). 업로드에 시간이 걸릴 수 있습니다.`);
        }
        uploadPdfFile(file);
      } else {
        toast.error('PDF 파일만 업로드 가능합니다.');
      }
    }
    // 파일 입력 초기화
    event.target.value = '';
  };

  const handleAddClick = () => {
    console.log('handleAddClick 호출됨', { isLoggedIn, showAddMenu });
    if (!isLoggedIn) {
      setShowLoginModal(true);
    } else {
      console.log('showAddMenu 상태 변경:', !showAddMenu);
      setShowAddMenu(!showAddMenu);
    }
  };

  // PDF 파일 추가
  const handleAddPdf = () => {
    setShowAddMenu(false);
    const fileInput = document.getElementById('pdf-file-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  };

  // 폴더 추가
  const handleAddFolder = () => {
    setShowAddMenu(false);
    setShowFolderCreateModal(true);
    setNewFolderName('');
  };

  // 빈 노트 추가 (TODO: 나중에 구현)
  const handleAddNote = () => {
    setShowAddMenu(false);
    toast.info('빈 노트 기능은 곧 추가될 예정입니다.');
  };

  // 폴더 생성
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error('폴더 이름을 입력해주세요.');
      return;
    }

    try {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: newFolderName.trim(),
          parentId: currentFolder || null
        })
      });

      if (response.ok) {
        const data = await response.json();
        const newFolder: Document = {
          id: data.folder._id,
          name: data.folder.name,
          type: 'folder',
          children: []
        };

        if (currentFolder) {
          // 현재 폴더 내부에 추가
          setDocuments(prevDocs => {
            const newDocs = [...prevDocs];
            const updateFolder = (docs: Document[]): boolean => {
              for (let doc of docs) {
                if (doc.id === currentFolder && doc.type === 'folder') {
                  if (!doc.children) doc.children = [];
                  doc.children.push(newFolder);
                  return true;
                }
                if (doc.children && updateFolder(doc.children)) {
                  return true;
                }
              }
              return false;
            };
            updateFolder(newDocs);
            return newDocs;
          });
        } else {
          // 루트에 추가
          setDocuments(prevDocs => [...prevDocs, newFolder]);
        }

        toast.success(`"${newFolderName}" 폴더가 생성되었습니다.`);
        setShowFolderCreateModal(false);
        setNewFolderName('');
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || '폴더 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('폴더 생성 에러:', error);
      toast.error('폴더 생성에 실패했습니다.');
    }
  };

  // 드래그&드롭 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 메인 컨테이너를 완전히 벗어났을 때만 isDragging을 false로
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      setIsDragging(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (!isLoggedIn) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // PDF 파일만 필터링
    const pdfFiles = files.filter(file => file.type === 'application/pdf');
    const nonPdfFiles = files.filter(file => file.type !== 'application/pdf');

    // 비PDF 파일이 있으면 경고
    if (nonPdfFiles.length > 0) {
      toast.error('PDF 형식의 파일만 업로드 가능합니다!');
      return;
    }

    if (pdfFiles.length === 0) {
      toast.error('PDF 형식의 파일만 업로드 가능합니다!');
      return;
    }

    // 각 PDF 파일 업로드
    for (const file of pdfFiles) {
      // 파일 크기 검증 (500MB)
      const maxSize = 500 * 1024 * 1024; // 500MB
      if (file.size > maxSize) {
        const sizeInMB = Math.round(file.size / (1024 * 1024));
        toast.error(`파일 크기가 500MB를 초과합니다. (파일: ${file.name}, 크기: ${sizeInMB}MB)`);
        continue;
      }
      
      // 파일 크기 경고 (100MB 이상시)
      const warningSize = 100 * 1024 * 1024; // 100MB
      if (file.size > warningSize) {
        const sizeInMB = Math.round(file.size / (1024 * 1024));
        toast.warning(`큰 파일입니다 (${file.name}: ${sizeInMB}MB). 업로드에 시간이 걸릴 수 있습니다.`);
      }
      
      await uploadPdfFile(file);
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
                                               <div className="flex items-center group">
                         <DroppableFolder
                           folder={doc}
                           isDarkMode={isDarkMode}
                           onDrop={(draggedItem) => handleDragDrop(doc.id, draggedItem)}
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
                         <button
                           onClick={(e) => {
                             e.stopPropagation();
                             handleDeleteFolder(doc.id, doc.name);
                           }}
                           className={`ml-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-100 ${isDarkMode ? 'hover:bg-red-900' : ''}`}
                           title="폴더 삭제"
                         >
                           <Trash2 size={12} className="text-red-500" />
                         </button>
                       </div>
                        
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
      <div 
        className="flex-1 flex flex-col relative z-[100000]"
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
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
        <div className="flex-1 p-4 md:p-6 overflow-y-auto overflow-x-visible relative">
          {/* 드래그 오버레이 */}
          {isDragging && (
            <div className="absolute inset-0 bg-blue-500 bg-opacity-20 border-4 border-blue-400 border-dashed rounded-lg z-50 flex items-center justify-center">
              <div className="bg-white px-6 py-4 rounded-lg shadow-xl border-2 border-blue-400">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <File className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-blue-700 font-semibold text-lg">PDF 파일을 여기에 드롭하세요</p>
                    <p className="text-blue-600 text-sm">PDF 형식의 파일만 업로드 가능합니다</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6 relative">
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
                onFolderClick={(folder) => {
                  console.log('폴더 클릭됨:', folder);
                  setCurrentFolder(folder.id);
                }}
                onMainDrop={handleMainDrop}
                onNameDoubleClick={handleNameDoubleClick}
                editingId={editingId}
                editingName={editingName}
                onNameChange={handleNameChange}
                onNameKeyPress={handleNameKeyPress}
                onNameBlur={handleNameBlur}
                currentFolder={currentFolder}
                handleAddClick={handleAddClick}
                showAddMenu={showAddMenu}
                onAddPdf={handleAddPdf}
                onAddFolder={handleAddFolder}
                onAddNote={handleAddNote}
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
         title="이동할 폴더 선택"
         currentFolderId={currentFolder}
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

      {/* 폴더 생성 모달 */}
      <Dialog open={showFolderCreateModal} onOpenChange={setShowFolderCreateModal}>
        <DialogContent className={`${isDarkMode ? 'bg-[#121214] border-gray-600' : 'bg-white border-gray-200'} max-w-md`}>
          <DialogHeader>
            <DialogTitle className={isDarkMode ? 'text-[#efefef]' : 'text-gray-900'}>
              새 폴더 만들기
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} text-sm font-medium`}>
                폴더 이름
              </label>
              <Input
                type="text"
                placeholder="폴더 이름을 입력하세요"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateFolder();
                  } else if (e.key === 'Escape') {
                    setShowFolderCreateModal(false);
                    setNewFolderName('');
                  }
                }}
                className={`${isDarkMode ? 'bg-[#2A2A2E] border-gray-600 text-[#efefef] placeholder:text-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-500'}`}
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowFolderCreateModal(false);
                  setNewFolderName('');
                }}
                className={`${isDarkMode ? 'border-gray-600 text-[#efefef] hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
              >
                취소
              </Button>
              <Button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                추가
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