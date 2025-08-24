import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, Menu, Search, X, Pen, Highlighter, Eraser, Share2, FileEdit, BookOpen, Settings as SettingsIcon, Download, Map, Languages, Copy } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { toast } from 'sonner';

// react-pdf import
import { Document, Page, pdfjs } from 'react-pdf';


interface PdfDetailPageProps {
  pdfId: string;
  pdfName: string;
  onBack: () => void;
  isDarkMode: boolean;
}

type Tool = 'pen' | 'highlighter' | 'eraser';

interface DrawingPoint {
  x: number;
  y: number;
  tool: Tool;
  color: string;
  size: number;
}

interface DrawingPath {
  points: DrawingPoint[];
  tool: Tool;
  color: string;
  size: number;
  pageId: number;
}

const COLORS = ['#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff'];
const SIZES = [2, 5, 10];

const LANGUAGE_OPTIONS = [
  { value: 'ko-to-en', label: '한국어 → 영어' },
  { value: 'en-to-ko', label: 'English → 한국어' },
  { value: 'ko-to-ja', label: '한국어 → 日本語' },
  { value: 'ja-to-ko', label: '日本語 → 한국어' },
  { value: 'ko-to-zh', label: '한국어 → 中文' },
  { value: 'zh-to-ko', label: '中文 → 한국어' },
];
export function PdfDetailPage({ pdfId, pdfName, onBack, isDarkMode }: PdfDetailPageProps) {
  
  // react-pdf 워커 설정 - public 폴더의 워커 사용
  useEffect(() => {
    // public 폴더의 워커 파일 사용
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
    console.log('PDF 워커 설정 완료:', pdfjs.GlobalWorkerOptions.workerSrc);
  }, []);
  
  // PDF 상태
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 사이드바 상태 - 상호 배타적
  const [mapSidebarOpen, setMapSidebarOpen] = useState(false);
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(361);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isResizing, setIsResizing] = useState(false);
  const [pageInputValue, setPageInputValue] = useState('1');
  
  // AI 튜터 탭 상태 - 번역 탭 추가
  const [activeTab, setActiveTab] = useState<'summary' | 'translate' | 'quiz' | 'chat'>('summary');
  const [aiMessage, setAiMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{id: string, type: 'user' | 'ai', message: string}>>([]);
  
  // 번역 관련 상태
  const [translateLanguage, setTranslateLanguage] = useState('ko-to-en');
  const [translatedContent, setTranslatedContent] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  
  // 퀴즈 설정 상태
  const [showQuizSettings, setShowQuizSettings] = useState(false);
  const [quizType, setQuizType] = useState<'ox' | 'multiple4' | 'multiple5' | 'fillblank'>('multiple5');
  const [quizCount, setQuizCount] = useState(5);
  
  // 필기 도구 상태
  const [currentTool, setCurrentTool] = useState<Tool>('pen');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [currentSize, setCurrentSize] = useState(2);
  const [isDrawing, setIsDrawing] = useState(false);
  const [paths, setPaths] = useState<DrawingPath[]>([]);
  const [currentPath, setCurrentPath] = useState<DrawingPoint[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const pdfViewerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<{ [key: number]: HTMLCanvasElement }>({});
  
    // PDF 다운로드 및 로드
  const loadPdf = async () => {
    try {
      console.log('PDF 로드 시작, PDF ID:', pdfId);
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/pdfs/${pdfId}/download`, {
        method: 'GET',
        credentials: 'include'
      });

      console.log('PDF 다운로드 응답 상태:', response.status, response.statusText);
      console.log('PDF 다운로드 응답 헤더:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('PDF 다운로드 실패:', errorText);
        throw new Error(`PDF를 다운로드할 수 없습니다. (${response.status})`);
      }

      const pdfBlob = await response.blob();
      console.log('PDF Blob 생성 완료, 크기:', pdfBlob.size, '타입:', pdfBlob.type);
      
      const url = URL.createObjectURL(pdfBlob);
      console.log('PDF URL 생성:', url);
      setPdfUrl(url);
      setIsLoading(false);
      
    } catch (error) {
      console.error('PDF 로드 에러:', error);
      setError(error instanceof Error ? error.message : 'PDF를 로드할 수 없습니다.');
      setIsLoading(false);
    }
  };

  // 컴포넌트 마운트 시 PDF 로드
  useEffect(() => {
    loadPdf();
  }, [pdfId]);
  
  // 채팅 자동 스크롤을 위한 ref
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);

  // 사이드바 상호 배타적 제어
  const handleMapSidebarToggle = () => {
    if (aiSidebarOpen) {
      setAiSidebarOpen(false);
    }
    setMapSidebarOpen(!mapSidebarOpen);
  };

  const handleAiSidebarToggle = () => {
    if (mapSidebarOpen) {
      setMapSidebarOpen(false);
    }
    setAiSidebarOpen(!aiSidebarOpen);
  };

  // 번역 기능
  const handleTranslate = async () => {
    setIsTranslating(true);
    
    // 번역 시뮬레이션
    setTimeout(() => {
      const mockTranslations: { [key: string]: string } = {
        'ko-to-en': `This document covers basic data preprocessing techniques for machine learning. The main contents include feature scaling and shifting, PCA for dimensionality reduction, NMF for sparse data decomposition, t-SNE for data visualization, and one-hot encoding for categorical data processing.

**Key Concepts:**

**Feature Scaling and Shifting**
Many machine learning algorithms are sensitive to data scale. Features need to be adjusted through scaling and shifting.
- Goal: Adjust all features to have zero mean and unit variance
- Importance: Apply the same adjustments to both training and test datasets
- Unbalanced feature scales cause weight scale imbalances

**Gradient Descent Optimization**
Solves the problem where Gradient Descent shows different speeds depending on weight direction, causing oscillating movements and slowing convergence speed.`,
        'en-to-ko': `이 자료는 머신러닝의 기본적인 데이터 전처리 기법들을 다룹니다. 주요 내용은 특성 스케일링 및 이동, 차원 축소를 위한 PCA, 희소 데이터 분해를 위한 NMF, 데이터 시각화를 위한 t-SNE, 그리고 범주형 데이터 처리를 위한 원-핫 인코딩입니다.

**주요 개념:**

**특성 스케일링 및 이동 (Feature Scaling and Shifting)**
많은 머신러닝 알고리즘은 데이터의 스케일에 민감하게 반응합니다. 스케일링과 이동을 통해 특성들을 조정해야 합니다.
- 목표: 모든 특성이 제로 평균과 단위 분산을 갖도록 조정
- 중요성: 훈련 데이터셋과 테스트 데이터셋에 동일한 조정 적용
- 불균형한 특성 스케일은 가중치 스케일 불균형을 야기

**경사 하강법 최적화**
경사 하강법(Gradient Descent)이 가중치 방향에 따라 다른 속도를 보여 진동하는 움직임을 유발하고 수렴 속도를 늦추는 문제를 해결합니다.`,
        'ko-to-ja': `この資料は機械学習の基本的なデータ前処理技法を扱います。主な内容は特徴スケーリングと移動、次元削減のためのPCA、疎データ分解のためのNMF、データ可視化のためのt-SNE、そしてカテゴリカルデータ処理のためのワンホットエンコーディングです。

**主要概念：**

**特徴スケーリングと移動**
多くの機械学習アルゴリズムはデータのスケールに敏感に反応します。スケーリングと移動を通じて特徴を調整する必要があります。
- 目標：すべての特徴がゼロ平均と単位分散を持つように調整
- 重要性：訓練データセットとテストデータセットに同じ調整を適用
- 不均衡な特徴スケールは重みスケール不均衡を引き起こす

**勾配降下法最適化**
勾配降下法が重み方向によって異なる速度を示し、振動する動きを引き起こし、収束速度を遅くする問題を解決します。`,
        'ja-to-ko': `이 자료는 머신러닝의 기본적인 데이터 전처리 기법들을 다룹니다. 주요 내용은 특성 스케일링 및 이동, 차원 축소를 위한 PCA, 희소 데이터 분해를 위한 NMF, 데이터 시각화를 위한 t-SNE, 그리고 범주형 데이터 처리를 위한 원-핫 인코딩입니다.`,
        'ko-to-zh': `本资料涵盖机器学习的基本数据预处理技术。主要内容包括特征缩放和移位、用于降维的PCA、用于稀疏数据分解的NMF、用于数据可视化的t-SNE，以及用于分类数据处理的独热编码。

**主要概念：**

**特征缩放和移位**
许多机器学习算法对数据规模敏感。需要通过缩放和移位来调整特征。
- 目标：调整所有特征使其具有零均值和单位方差
- 重要性：对训练数据集和测试数据集应用相同的调整
- 不平衡的特征尺度会导致权重尺度不平衡

**梯度下降优化**
解决梯度下降根据权重方向显示不同速度，导致振荡运动并减慢收敛速度的问题。`,
        'zh-to-ko': `이 자료는 머신러닝의 기본적인 데이터 전처리 기법들을 다룹니다. 주요 내용은 특성 스케일링 및 이동, 차원 축소를 위한 PCA, 희소 데이터 분해를 위한 NMF, 데이터 시각화를 위한 t-SNE, 그리고 범주형 데이터 처리를 위한 원-핫 인코딩입니다.`,
      };
      
      setTranslatedContent(mockTranslations[translateLanguage] || '번역 결과가 없습니다.');
      setIsTranslating(false);
      toast.success('번역이 완료되었습니다.');
    }, 2000);
  };

  // 번역 결과 복사
  const handleCopyTranslation = async () => {
    try {
      await navigator.clipboard.writeText(translatedContent);
      toast.success('번역 결과가 클립보드에 복사되었습니다.');
    } catch (err) {
      toast.error('복사에 실패했습니다.');
    }
  };



  // 캔버스 다시 그리기
  const redrawCanvas = useCallback((pageId: number) => {
    const canvas = canvasRefs.current[pageId];
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 해당 페이지의 저장된 경로들 그리기
    const pagePaths = paths.filter(path => path.pageId === pageId);
    pagePaths.forEach(path => {
      if (path.points.length < 2) return;

      ctx.beginPath();
      ctx.moveTo(path.points[0].x, path.points[0].y);

      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
      }

      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (path.tool === 'highlighter') {
        ctx.globalAlpha = 0.3;
      } else {
        ctx.globalAlpha = 1;
      }

      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    // 현재 그리고 있는 경로 그리기
    if (currentPath.length > 1 && currentPath[0] && currentPath[0].x !== undefined) {
      ctx.beginPath();
      ctx.moveTo(currentPath[0].x, currentPath[0].y);

      for (let i = 1; i < currentPath.length; i++) {
        ctx.lineTo(currentPath[i].x, currentPath[i].y);
      }

      ctx.strokeStyle = currentColor;
      ctx.lineWidth = currentSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (currentTool === 'highlighter') {
        ctx.globalAlpha = 0.3;
      } else {
        ctx.globalAlpha = 1;
      }

      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }, [paths, currentPath, currentColor, currentSize, currentTool]);

  // 캔버스 다시 그리기 트리거
  useEffect(() => {
    redrawCanvas(currentPage);
  }, [redrawCanvas, currentPage]);

  // 마우스 이벤트 핸들러
  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>, pageId: number) => {
    const canvas = canvasRefs.current[pageId];
    if (!canvas) return;

    const pos = getMousePos(e, canvas);
    setIsDrawing(true);
    
    if (currentTool === 'eraser') {
      // 지우개 모드: 드래그 경로를 저장하기 시작
      setCurrentPath([{ ...pos, tool: currentTool, color: currentColor, size: currentSize }]);
    } else {
      setCurrentPath([{ ...pos, tool: currentTool, color: currentColor, size: currentSize }]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>, pageId: number) => {
    const canvas = canvasRefs.current[pageId];
    if (!canvas || !isDrawing) return;

    const pos = getMousePos(e, canvas);

    if (currentTool === 'eraser') {
      // 지우개 드래그 중: 경로를 따라 지우기
      setCurrentPath(prev => [...prev, { ...pos, tool: currentTool, color: currentColor, size: currentSize }]);
      eraseAlongPath(pos.x, pos.y, pageId);
    } else {
      setCurrentPath(prev => [...prev, { ...pos, tool: currentTool, color: currentColor, size: currentSize }]);
    }
  };

  const handleMouseUp = (pageId: number) => {
    if (!isDrawing) return;
    
    setIsDrawing(false);
    
    if (currentTool !== 'eraser' && currentPath.length > 1) {
      setPaths(prev => [...prev, {
        points: currentPath,
        tool: currentTool,
        color: currentColor,
        size: currentSize,
        pageId: pageId
      }]);
    }
    setCurrentPath([]);
  };

  // 지우개 기능 - 드래그 경로를 따라 지우기
  const eraseAlongPath = (x: number, y: number, pageId: number) => {
    const eraseRadius = 15; // 지우개 반경
    
    setPaths(prev => prev.filter(path => {
      if (path.pageId !== pageId) return true;
      
      // 경로와 지우개 위치가 교차하는지 확인
      return !path.points.some(point => {
        const distance = Math.sqrt(
          Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2)
        );
        return distance <= eraseRadius + path.size / 2;
      });
    }));
  };

  // 스크롤로 페이지 변경
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!pdfViewerRef.current?.contains(e.target as Node)) return;
      
      e.preventDefault();
      
      if (e.deltaY > 0 && currentPage < totalPages) {
        setCurrentPage(prev => prev + 1);
      } else if (e.deltaY < 0 && currentPage > 1) {
        setCurrentPage(prev => prev - 1);
      }
    };

    const viewer = pdfViewerRef.current;
    if (viewer) {
      viewer.addEventListener('wheel', handleWheel, { passive: false });
      return () => viewer.removeEventListener('wheel', handleWheel);
    }
  }, [currentPage, totalPages]);

  // 전체 캔버스 지우기
  const clearAllCanvas = () => {
    setPaths(prev => prev.filter(path => path.pageId !== currentPage));
    setCurrentPath([]);
    
    const canvas = canvasRefs.current[currentPage];
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    toast.success(`페이지 ${currentPage} 필기를 지웠습니다.`);
  };

  // 리사이즈 핸들러
  const handleMouseDownResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMoveResize = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    
    // AI 사이드바와 PDF 맵 모두 오른쪽에서 리사이즈
    if (aiSidebarOpen || mapSidebarOpen) {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 240 && newWidth <= 500) {
        setSidebarWidth(newWidth);
      }
    }
  }, [isResizing, aiSidebarOpen, mapSidebarOpen]);

  const handleMouseUpResize = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMoveResize);
      document.addEventListener('mouseup', handleMouseUpResize);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMoveResize);
        document.removeEventListener('mouseup', handleMouseUpResize);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing, handleMouseMoveResize, handleMouseUpResize]);

  // 페이지 번호 입력 핸들러
  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPageInputValue(value);
  };

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNumber = parseInt(pageInputValue);
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    } else {
      setPageInputValue(currentPage.toString());
      toast.error(`1부터 ${totalPages}까지의 페이지 번호를 입력해주세요.`);
    }
  };

  const handlePageInputBlur = () => {
    handlePageInputSubmit({ preventDefault: () => {} } as React.FormEvent);
  };

  // 현재 페이지가 변경될 때 입력값도 동기화
  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

  // AI 메시지 전송 핸들러
  const handleSendAiMessage = () => {
    if (!aiMessage.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      type: 'user' as const,
      message: aiMessage
    };

    setChatHistory(prev => [...prev, userMessage]);

    // AI 응답 시뮬레이션
    setTimeout(() => {
      const aiResponse = {
        id: (Date.now() + 1).toString(),
        type: 'ai' as const,
        message: `"${pdfName}"에 대한 질문에 답변드리겠습니다. "${aiMessage}"에 대해서는 이 문서의 내용을 바탕으로 설명해드리면...`
      };
      setChatHistory(prev => [...prev, aiResponse]);
    }, 1000);

    setAiMessage('');
  };

  // 채팅 히스토리가 변경될 때 자동으로 스크롤을 아래로 이동
  useEffect(() => {
    if (chatMessagesEndRef.current) {
      chatMessagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory]);

  // 초기 챗봇 메시지 설정
  useEffect(() => {
    if (activeTab === 'chat' && chatHistory.length === 0) {
      const initialMessage = {
        id: 'initial',
        type: 'ai' as const,
        message: `안녕하세요! "${pdfName}"으로 학습한 AI 챗봇입니다. 이 문서에 대해 궁금한 점이나 이해하고 싶은 부분이 있으시면 마음껏 질문해주세요!`
      };
      setChatHistory([initialMessage]);
    }
  }, [activeTab, chatHistory.length, pdfName]);

  // 번역 탭이 활성화될 때 초기 번역 실행
  useEffect(() => {
    if (activeTab === 'translate' && !translatedContent) {
      handleTranslate();
    }
  }, [activeTab, translatedContent]);



  // AI 버튼 위치 계산 - 맵 사이드바가 열릴 때 동적으로 조정
  const getAiButtonRightPosition = () => {
    if (mapSidebarOpen) {
      return sidebarWidth + 32; // 사이드바 너비 + 기본 32px
    }
    return 32; // 기본 right-8 (32px)
  };

  return (
    <div className={`${isDarkMode ? 'bg-[#1a1a1e]' : 'bg-gray-50'} h-screen flex relative overflow-hidden`}>
      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex flex-col h-full">
        {/* 상단 헤더 - 고정 높이 */}
        <div className={`flex items-center p-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} flex-shrink-0 h-16`}>
          {/* 왼쪽 버튼들 */}
          <div className="flex items-center gap-4 flex-1">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onBack}
              className={`${isDarkMode ? 'text-white hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <ChevronLeft size={20} />
            </Button>
          </div>
          
          {/* 중앙 파일명 */}
          <div className="flex-1 flex justify-center">
            <h1 className={`${isDarkMode ? 'text-white' : 'text-gray-900'} text-lg font-medium text-center`}>{pdfName}</h1>
          </div>
          
          {/* 오른쪽 버튼들 */}
          <div className="flex items-center gap-4 flex-1 justify-end">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleMapSidebarToggle}
              className={`${isDarkMode ? 'text-white hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'} ${mapSidebarOpen ? 'bg-blue-500/20 text-blue-500' : ''}`}
            >
              <Map size={20} />
            </Button>
          </div>
        </div>

        {/* 필기 도구 바 - 고정 높이 */}
        <div className={`flex items-center justify-center gap-8 p-3 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} flex-shrink-0 h-18`}>
          {/* 필기 도구 */}
          <div className="flex items-center gap-4">
            <Button
              variant={currentTool === 'pen' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setCurrentTool('pen')}
              className="flex flex-col items-center gap-1 h-auto py-2 px-3"
            >
              <Pen size={16} />
              <span className="text-xs">필기</span>
            </Button>

            <Button
              variant={currentTool === 'highlighter' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setCurrentTool('highlighter')}
              className="flex flex-col items-center gap-1 h-auto py-2 px-3"
            >
              <Highlighter size={16} />
              <span className="text-xs">형광펜</span>
            </Button>

            <Button
              variant={currentTool === 'eraser' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setCurrentTool('eraser')}
              className="flex flex-col items-center gap-1 h-auto py-2 px-3"
            >
              <Eraser size={16} />
              <span className="text-xs">지우개</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllCanvas}
              className="flex flex-col items-center gap-1 h-auto py-2 px-3 text-red-500 hover:text-red-600"
            >
              <X size={16} />
              <span className="text-xs">전체지움</span>
            </Button>
          </div>

          {/* 색상 선택 */}
          <div className="flex items-center gap-2">
            <span className={`${isDarkMode ? 'text-white' : 'text-gray-700'} text-xs`}>색상:</span>
            {COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setCurrentColor(color)}
                className={`w-6 h-6 rounded border-2 ${
                  currentColor === color ? 'border-blue-500 scale-110' : isDarkMode ? 'border-gray-500' : 'border-gray-300'
                } transition-all hover:scale-105`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>

          {/* 굵기 선택 */}
          <div className="flex items-center gap-2">
            <span className={`${isDarkMode ? 'text-white' : 'text-gray-700'} text-xs`}>굵기:</span>
            {SIZES.map((size) => (
              <button
                key={size}
                onClick={() => setCurrentSize(size)}
                className={`w-8 h-8 rounded border transition-all hover:scale-105 ${
                  currentSize === size 
                    ? 'border-blue-500 bg-blue-500/20 scale-110' 
                    : isDarkMode ? 'border-gray-500 hover:border-gray-400' : 'border-gray-300 hover:border-gray-400'
                } flex items-center justify-center`}
              >
                <div
                  className={`${isDarkMode ? 'bg-white' : 'bg-gray-700'} rounded-full`}
                  style={{ width: `${size * 2}px`, height: `${size * 2}px` }}
                />
              </button>
            ))}
          </div>
        </div>

        {/* PDF 뷰어 및 캔버스 - 나머지 공간 전체 사용 */}
        <div className="flex-1 flex items-center justify-center overflow-hidden" ref={pdfViewerRef}>
          {/* 로딩 상태 */}
          {isLoading && (
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>PDF를 로드하는 중...</p>
            </div>
          )}

          {/* 에러 상태 */}
          {error && (
            <div className="text-center">
              <p className={`${isDarkMode ? 'text-red-400' : 'text-red-600'} mb-4`}>{error}</p>
              <Button onClick={loadPdf} className="bg-blue-500 hover:bg-blue-600 text-white">
                다시 시도
              </Button>
            </div>
          )}

                                           {/* react-pdf Document */}
                  <Document
                    file={pdfUrl}
                    onLoadSuccess={({ numPages }) => {
                      console.log('PDF 로드 성공, 페이지 수:', numPages);
                      setNumPages(numPages);
                      setTotalPages(numPages);
                    }}
                                         onLoadError={(error) => {
                       console.error('PDF 로드 에러:', error);
                       console.error('PDF 로드 에러 상세:', {
                         message: error.message,
                         name: error.name,
                         stack: error.stack,
                         pdfUrl: pdfUrl
                       });
                       setError(`PDF를 로드할 수 없습니다. (${error.message})`);
                     }}
                    onSourceError={(error) => {
                      console.error('PDF 소스 에러:', error);
                      setError('PDF 소스를 로드할 수 없습니다.');
                    }}
                    loading={
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                        <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>PDF를 로드하는 중...</p>
                      </div>
                    }
                  >
                    <Page
                      pageNumber={currentPage}
                      width={Math.min(window.innerWidth * 0.8, 800)}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                    />
                  </Document>
                  
                  {/* 페이지 정보 */}
                  <div className="text-center mt-4">
                    <span className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} text-sm`}>
                      페이지 {currentPage} / {numPages}
                    </span>
                    <div className="mt-1">
                      <span className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'} text-xs`}>
                        마우스 휠로 페이지를 이동할 수 있습니다
                      </span>
                    </div>
                  </div>
        </div>
      </div>

      {/* PDF 맵 사이드바 - 오른쪽 */}
      <div 
        className={`${isDarkMode ? 'bg-[#121214]' : 'bg-white'} transition-all duration-300 flex-shrink-0 relative border-l ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} h-full ${
          mapSidebarOpen ? '' : 'w-0 overflow-hidden'
        }`}
        style={mapSidebarOpen ? { width: `${sidebarWidth}px` } : {}}
      >
        <div className="p-4 h-full flex flex-col">
          {/* 상단 컨트롤 */}
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <div className="flex-1" />
            
            {/* 중앙 페이지 입력 */}
            <div className="flex items-center justify-center gap-1">
              <form onSubmit={handlePageInputSubmit} className="flex items-center gap-1">
                <div className="relative">
                  <input
                    type="text"
                    value={pageInputValue}
                    onChange={handlePageInputChange}
                    onBlur={handlePageInputBlur}
                    className={`w-10 text-center text-sm border rounded px-1 py-0.5 ${isDarkMode ? 'bg-[#3e3b3b] border-gray-600 text-[#efefef] focus:border-blue-500' : 'bg-white border-gray-300 text-gray-700 focus:border-blue-500'} outline-none transition-colors`}
                    style={{ fontSize: '12px' }}
                  />
                </div>
                <span className={`${isDarkMode ? 'text-[#efefef]' : 'text-gray-700'} text-sm`}>
                  / {totalPages}
                </span>
              </form>
            </div>
            
            <div className="flex-1 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMapSidebarOpen(false)}
                className={`${isDarkMode ? 'text-[#efefef] hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'} p-1`}
              >
                <X size={16} />
              </Button>
            </div>
          </div>

          {/* 검색창 */}
          <div className="mb-6 flex-shrink-0">
            <div className="relative">
              <Search size={16} className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              <Input
                type="text"
                placeholder="PDF에서 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`pl-10 ${isDarkMode ? 'bg-[#3e3b3b] border-gray-600 text-[#efefef] placeholder:text-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-500'}`}
              />
            </div>
          </div>

                     {/* PDF 페이지 미리보기 - 스크롤 가능 */}
           <div className="flex-1 overflow-y-auto space-y-4 pr-2">
             {Array.from(new Array(numPages), (el, index) => (
               <div key={`page_${index + 1}`} className="relative">
                 <div
                   className={`w-full rounded cursor-pointer transition-all hover:opacity-80 ${
                     currentPage === index + 1 ? 'ring-2 ring-blue-500' : ''
                   }`}
                   onClick={() => setCurrentPage(index + 1)}
                 >
                                                           <Document file={pdfUrl}>
                      <Page
                        pageNumber={index + 1}
                        width={200}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                      />
                    </Document>
                 </div>
                 <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                   {index + 1}
                 </div>
               </div>
             ))}
           </div>
        </div>

        {/* PDF 맵 사이드바 리사이즈 핸들 */}
        {mapSidebarOpen && (
          <div
            className="absolute left-0 top-0 w-1 h-full cursor-ew-resize bg-transparent hover:bg-gray-500 hover:bg-opacity-50 transition-colors group"
            onMouseDown={handleMouseDownResize}
          >
            <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </div>
        )}
      </div>

      {/* AI 튜터 버튼 - 오른쪽 하단 플로팅, 맵 사이드바에 따라 위치 조정 */}
      {!aiSidebarOpen && (
        <div 
          className="fixed bottom-8 z-50 transition-all duration-300"
          style={{ right: `${getAiButtonRightPosition()}px` }}
        >
          <Button
            onClick={handleAiSidebarToggle}
            className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200 border-0"
          >
            <div className="flex flex-col items-center justify-center">
              {/* AI 아이콘 */}
              <svg 
                className="w-6 h-6 mb-0.5" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
              <span className="text-xs font-medium">AI</span>
            </div>
          </Button>
        </div>
      )}

      {/* AI 튜터 사이드바 - 오른쪽 */}
      <div 
        className={`${isDarkMode ? 'bg-[#121214]' : 'bg-white'} transition-all duration-300 flex-shrink-0 relative border-l ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} h-full ${
          aiSidebarOpen ? '' : 'w-0 overflow-hidden'
        }`}
        style={aiSidebarOpen ? { width: `${sidebarWidth}px` } : {}}
      >
        <div className="flex flex-col h-full">
          {/* AI 사이드바 헤더 - 탭 */}
          <div className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            {/* 상단 닫기 버튼 */}
            <div className="flex justify-end p-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAiSidebarOpen(false)}
                className={`${isDarkMode ? 'text-[#efefef] hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'} p-1`}
              >
                <X size={16} />
              </Button>
            </div>
            
            {/* 탭 메뉴 - 번역 탭 추가 */}
            <div className="flex">
              <button
                onClick={() => setActiveTab('summary')}
                className={`flex-1 py-3 px-3 text-sm transition-colors border-b-2 ${
                  activeTab === 'summary'
                    ? 'border-blue-500 text-blue-500 bg-blue-500/10'
                    : `border-transparent ${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-700'}`
                }`}
              >
                요약
              </button>
              <button
                onClick={() => setActiveTab('translate')}
                className={`flex-1 py-3 px-3 text-sm transition-colors border-b-2 ${
                  activeTab === 'translate'
                    ? 'border-blue-500 text-blue-500 bg-blue-500/10'
                    : `border-transparent ${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-700'}`
                }`}
              >
                번역
              </button>
              <button
                onClick={() => setActiveTab('quiz')}
                className={`flex-1 py-3 px-3 text-sm transition-colors border-b-2 ${
                  activeTab === 'quiz'
                    ? 'border-blue-500 text-blue-500 bg-blue-500/10'
                    : `border-transparent ${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-700'}`
                }`}
              >
                퀴즈
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex-1 py-3 px-3 text-sm transition-colors border-b-2 ${
                  activeTab === 'chat'
                    ? 'border-blue-500 text-blue-500 bg-blue-500/10'
                    : `border-transparent ${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-700'}`
                }`}
              >
                챗봇질문
              </button>
            </div>
          </div>

          {/* 탭 콘텐츠 */}
          {activeTab === 'summary' && (
            <div className="flex flex-col h-full">
              {/* 액션 버튼들 */}
              <div className={`p-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className={`flex-1 ${isDarkMode ? 'border-gray-600 text-[#efefef] hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                  >
                    <FileEdit size={14} className="mr-2" />
                    문서로 수정하기
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`flex-1 ${isDarkMode ? 'border-gray-600 text-[#efefef] hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                  >
                    <Share2 size={14} className="mr-2" />
                    공유
                  </Button>
                </div>
              </div>

              {/* 요약 내용 */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="prose prose-sm max-w-none">
                  <h3 className={`${isDarkMode ? 'text-white' : 'text-gray-900'} mb-4`}>문서 요약</h3>
                  <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'} leading-relaxed mb-4`}>
                    본 자료는 머신러닝의 기본적인 데이터 전처리 기법들을 다룹니다. 주요 내용은 특성 스케일링 및 이동, 차원 축소를 위한 PCA, 희소 데이터 분해를 위한 NMF, 데이터 시각화를 위한 t-SNE, 그리고 범주형 데이터 처리를 위한 원-핫 인코딩입니다.
                  </p>
                  
                  <h4 className={`${isDarkMode ? 'text-white' : 'text-gray-900'} mb-3`}>주요 개념</h4>
                  <div className="space-y-3">
                    <div>
                      <h5 className="text-blue-400 mb-2">특성 스케일링 및 이동 (Scaling and Shifting)</h5>
                      <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'} text-sm leading-relaxed`}>
                        많은 머신러닝 알고리즘은 데이터의 스케일에 민감하게 반응합니다. 스케일링과 이동을 통해 특성들을 조정해야 합니다.
                      </p>
                      <ul className={`list-disc list-inside ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} text-sm mt-2 space-y-1`}>
                        <li>목표: 모든 특성이 제로 평균과 단위 분산을 갖도록 조정</li>
                        <li>중요성: 훈련 데이터셋과 테스트 데이터셋에 동일한 조정 적용</li>
                        <li>불균형한 특성 스케일은 가중치 스케일 불균형을 야기</li>
                      </ul>
                    </div>
                    
                    <div>
                      <h5 className="text-blue-400 mb-2">경사 하강법 최적화</h5>
                      <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'} text-sm leading-relaxed`}>
                        경사 하강법(Gradient Descent)이 가중치 방향에 따라 다른 속도를 보여 진동하는 움직임을 유발하고 수렴 속도를 늦추는 문제를 해결합니다.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'translate' && (
            <div className="flex flex-col h-full">
              {/* 번역 설정 및 액션 버튼들 */}
              <div className={`p-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className="space-y-3">
                  {/* 언어 선택 */}
                  <div>
                    <Label className={`${isDarkMode ? 'text-[#efefef]' : 'text-gray-700'} text-sm mb-2 block`}>
                      번역 언어
                    </Label>
                    <Select value={translateLanguage} onValueChange={setTranslateLanguage}>
                      <SelectTrigger className={`w-full ${isDarkMode ? 'bg-[#2A2A2E] border-gray-600 text-[#efefef]' : 'bg-white border-gray-300 text-gray-900'}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={isDarkMode ? 'bg-[#2A2A2E] border-gray-600' : 'bg-white border-gray-200'}>
                        {LANGUAGE_OPTIONS.map((option) => (
                          <SelectItem 
                            key={option.value} 
                            value={option.value}
                            className={isDarkMode ? 'text-[#efefef] hover:bg-gray-700' : 'text-gray-900 hover:bg-gray-100'}
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 액션 버튼들 */}
                  <div className="flex gap-2">
                    <Button
                      onClick={handleTranslate}
                      disabled={isTranslating}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                    >
                      <Languages size={14} className="mr-2" />
                      {isTranslating ? '번역 중...' : '번역하기'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyTranslation}
                      disabled={!translatedContent}
                      className={`${isDarkMode ? 'border-gray-600 text-[#efefef] hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                    >
                      <Copy size={14} className="mr-2" />
                      복사
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!translatedContent}
                      className={`${isDarkMode ? 'border-gray-600 text-[#efefef] hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                    >
                      <Share2 size={14} className="mr-2" />
                      공유
                    </Button>
                  </div>
                </div>
              </div>

              {/* 번역 결과 */}
              <div className="flex-1 overflow-y-auto p-4">
                {isTranslating ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                      <span className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>번역 중...</span>
                    </div>
                  </div>
                ) : translatedContent ? (
                  <div className="prose prose-sm max-w-none">
                    <h3 className={`${isDarkMode ? 'text-white' : 'text-gray-900'} mb-4 flex items-center`}>
                      <Languages size={16} className="mr-2" />
                      번역 결과
                    </h3>
                    <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'} p-4 rounded-lg border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                      <pre className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'} text-sm leading-relaxed whitespace-pre-wrap font-sans`}>
                        {translatedContent}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Languages size={48} className={`mx-auto mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
                    <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      번역하기 버튼을 클릭하여 문서를 번역하세요.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'quiz' && (
            <div className="flex flex-col h-full">
              {/* 액션 버튼들 */}
              <div className={`p-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className="flex gap-2 mb-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className={`flex-1 ${isDarkMode ? 'border-gray-600 text-[#efefef] hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                  >
                    <BookOpen size={14} className="mr-2" />
                    문제집으로 보기
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`flex-1 ${isDarkMode ? 'border-gray-600 text-[#efefef] hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                  >
                    <Share2 size={14} className="mr-2" />
                    공유
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowQuizSettings(true)}
                  className={`w-full ${isDarkMode ? 'border-gray-600 text-[#efefef] hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                >
                  <SettingsIcon size={14} className="mr-2" />
                  퀴즈 설정
                </Button>
              </div>

              {/* 퀴즈 내용 */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-6">
                  <div>
                    <h3 className={`${isDarkMode ? 'text-white' : 'text-gray-900'} text-lg mb-4`}>문제 1</h3>
                    <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-4 leading-relaxed`}>
                      데이터 전처리 과정에서 특징(feature)의 스케일링 및 시프팅을 수행하는 주요 목적이 아닌 것은 무엇입니까?
                    </p>
                    
                    <div className="space-y-3">
                      {[
                        "알고리즘이 데이터 스케일에 민감하게 반응하는 것을 방지하기 위함입니다.",
                        "각 특징이 동등하게 중요하게 다루어지도록 하여 특정 특징이 지배하는 것을 막기 위함입니다.",
                        "경사 하강법(GD)의 수렴 속도를 향상시켜 더 빠른 수렴을 유도하기 위함입니다.",
                        "훈련 데이터셋과 테스트 데이터셋에 동일한 조정을 적용하여 일관성을 유지하기 위함입니다.",
                        "데이터의 차원 수를 줄여 과적합 문제를 근본적으로 해결하기 위함입니다."
                      ].map((option, index) => (
                        <button
                          key={index}
                          className={`w-full text-left p-3 rounded border transition-colors ${isDarkMode ? 'border-gray-600 text-gray-300 hover:border-blue-500 hover:bg-blue-500/10' : 'border-gray-300 text-gray-700 hover:border-blue-500 hover:bg-blue-50'}`}
                        >
                          <span className="text-blue-400 mr-3">{index + 1}.</span>
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="flex flex-col h-full">
              {/* 채팅 히스토리 - 고정 높이와 스크롤 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                {chatHistory.map((chat) => (
                  <div key={chat.id} className={`flex ${chat.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] p-3 rounded-lg ${
                        chat.type === 'user'
                          ? 'bg-blue-500 text-white'
                          : isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-900'
                      }`}
                    >
                      <p className="text-sm leading-relaxed">{chat.message}</p>
                    </div>
                  </div>
                ))}
                {/* 자동 스크롤을 위한 끝점 */}
                <div ref={chatMessagesEndRef} />
              </div>

              {/* 메시지 입력 - 고정 */}
              <div className={`p-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} flex-shrink-0`}>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="AI 튜터에게 질문하세요..."
                    value={aiMessage}
                    onChange={(e) => setAiMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendAiMessage()}
                    className={`flex-1 ${isDarkMode ? 'bg-[#3e3b3b] border-gray-600 text-[#efefef] placeholder:text-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-500'}`}
                  />
                  <Button
                    onClick={handleSendAiMessage}
                    disabled={!aiMessage.trim()}
                    className="bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    전송
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* AI 사이드바 리사이즈 핸들 */}
        {aiSidebarOpen && (
          <div
            className="absolute left-0 top-0 w-1 h-full cursor-ew-resize bg-transparent hover:bg-gray-500 hover:bg-opacity-50 transition-colors group"
            onMouseDown={handleMouseDownResize}
          >
            <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </div>
        )}
      </div>

      {/* 퀴즈 설정 다이얼로그 */}
      <Dialog open={showQuizSettings} onOpenChange={setShowQuizSettings}>
        <DialogContent className={`${isDarkMode ? 'bg-[#121214] border-gray-600' : 'bg-white border-gray-200'} max-w-md`}>
          <DialogHeader>
            <DialogTitle className={isDarkMode ? 'text-[#efefef]' : 'text-gray-900'}>
              퀴즈 설정
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <div>
              <Label className={isDarkMode ? 'text-[#efefef]' : 'text-gray-700'}>
                문제 유형
              </Label>
              <Select value={quizType} onValueChange={(value: any) => setQuizType(value)}>
                <SelectTrigger className={`w-full mt-2 ${isDarkMode ? 'bg-[#2A2A2E] border-gray-600 text-[#efefef]' : 'bg-white border-gray-300 text-gray-900'}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={isDarkMode ? 'bg-[#2A2A2E] border-gray-600' : 'bg-white border-gray-200'}>
                  <SelectItem value="ox" className={isDarkMode ? 'text-[#efefef] hover:bg-gray-700' : 'text-gray-900 hover:bg-gray-100'}>OX 퀴즈</SelectItem>
                  <SelectItem value="multiple4" className={isDarkMode ? 'text-[#efefef] hover:bg-gray-700' : 'text-gray-900 hover:bg-gray-100'}>객관식 (4지선다)</SelectItem>
                  <SelectItem value="multiple5" className={isDarkMode ? 'text-[#efefef] hover:bg-gray-700' : 'text-gray-900 hover:bg-gray-100'}>객관식 (5지선다)</SelectItem>
                  <SelectItem value="fillblank" className={isDarkMode ? 'text-[#efefef] hover:bg-gray-700' : 'text-gray-900 hover:bg-gray-100'}>빈칸 채우기</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className={isDarkMode ? 'text-[#efefef]' : 'text-gray-700'}>
                문제 수: {quizCount}개
              </Label>
              <div className="mt-2">
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={quizCount}
                  onChange={(e) => setQuizCount(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1</span>
                  <span>10</span>
                  <span>20</span>
                </div>
              </div>
            </div>

            <Separator className={isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} />

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowQuizSettings(false)}
                className={`flex-1 ${isDarkMode ? 'border-gray-600 text-[#efefef] hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
              >
                취소
              </Button>
              <Button
                onClick={() => {
                  setShowQuizSettings(false);
                  toast.success(`${quizType === 'ox' ? 'OX' : quizType === 'multiple4' ? '4지선다' : quizType === 'multiple5' ? '5지선다' : '빈칸채우기'} 퀴즈 ${quizCount}문제로 설정되었습니다.`);
                }}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
              >
                적용
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}