import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, Menu, Search, X, Pen, Highlighter, Eraser, Square, Circle, Share2, FileEdit, BookOpen, Settings as SettingsIcon, Download, Map, Languages, Copy } from 'lucide-react';
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

// 캔버스 필기 상태 관리
interface DrawingPath {
  x: number;
  y: number;
}

interface DrawingStroke {
  points: DrawingPath[];
  color: string;
  size: number;
  tool: 'pen' | 'highlighter' | 'eraser' | 'rectangle' | 'circle' | 'line';
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
  
  // PDF 크기 조정 상태
  const [pdfScale, setPdfScale] = useState<number>(1);
  const [pdfDimensions, setPdfDimensions] = useState<{width: number, height: number} | null>(null);
  const [containerDimensions, setContainerDimensions] = useState<{width: number, height: number}>({width: 0, height: 0});
  
  // 사이드바 상태 - 상호 배타적
  const [mapSidebarOpen, setMapSidebarOpen] = useState(false);
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  
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
  
  // 캔버스 필기 상태
  const [drawingData, setDrawingData] = useState<{ [key: number]: DrawingStroke[] }>({});
  const drawingDataRef = useRef<{ [key: number]: DrawingStroke[] }>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const pdfViewerRef = useRef<HTMLDivElement>(null);
  const excalidrawRef = useRef<HTMLCanvasElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  
  // 화면 크기 감지 및 PDF 크기 조정
  const calculatePdfScale = useCallback(() => {
    const viewer = pdfViewerRef.current;
    if (!viewer || !pdfDimensions) return;
    
    const viewerRect = viewer.getBoundingClientRect();
    const availableWidth = viewerRect.width - 40; // 좌우 마진
    const availableHeight = viewerRect.height - 120; // 상하 마진 (헤더 + 푸터)
    
    // 비율에 따른 스케일 계산
    const widthScale = availableWidth / pdfDimensions.width;
    const heightScale = availableHeight / pdfDimensions.height;
    
    // 위아래가 꽉 차도록 하되, 카드가 잘리지 않도록 비율 선택
    const newScale = Math.min(widthScale, heightScale);
    
    console.log('크기 계산:', {
      availableWidth,
      availableHeight,
      pdfWidth: pdfDimensions.width,
      pdfHeight: pdfDimensions.height,
      widthScale,
      heightScale,
      newScale,
      mapSidebarOpen,
      aiSidebarOpen
    });
    
    setPdfScale(newScale);
  }, [pdfDimensions, mapSidebarOpen, aiSidebarOpen]);
  
  // 컴포넌트 마운트 및 리사이즈 이벤트
  useEffect(() => {
    const handleResize = () => {
      calculatePdfScale();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculatePdfScale]);
  
  // PDF 로드 시 크기 계산
  useEffect(() => {
    if (pdfDimensions) {
      calculatePdfScale();
    }
  }, [pdfDimensions, calculatePdfScale]);
  
  // 사이드바 상태 변경 시 크기 재계산
  useEffect(() => {
    if (pdfDimensions) {
      // 사이드바 애니메이션 완료 후 크기 재계산
      const timer = setTimeout(() => {
        calculatePdfScale();
      }, 300); // 사이드바 애니메이션 시간과 동일
      return () => clearTimeout(timer);
    }
  }, [mapSidebarOpen, aiSidebarOpen, calculatePdfScale]);
  
  // 캔버스 필기 상태
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<DrawingPath[]>([]);
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  
  // 도형 그리기 상태
  const [startPoint, setStartPoint] = useState<DrawingPath | null>(null);
  const [previewShape, setPreviewShape] = useState<DrawingPath | null>(null);
  
  // 필기 도구 상태
  const [currentTool, setCurrentTool] = useState<'pen' | 'highlighter' | 'eraser' | 'rectangle' | 'circle' | 'line'>('pen');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [currentSize, setCurrentSize] = useState(2);
  
  // 실행취소/다시실행 상태 - 페이지별로 관리
  const [undoStacks, setUndoStacks] = useState<{ [pageNumber: number]: DrawingStroke[][] }>({});
  const [redoStacks, setRedoStacks] = useState<{ [pageNumber: number]: DrawingStroke[][] }>({});
  
  // 현재 페이지의 undo/redo 스택을 쉽게 접근하기 위한 헬퍼 함수들
  const getCurrentUndoStack = () => undoStacks[currentPage] || [];
  const getCurrentRedoStack = () => redoStacks[currentPage] || [];
  
  const setCurrentUndoStack = (newStack: DrawingStroke[][]) => {
    setUndoStacks(prev => ({
      ...prev,
      [currentPage]: newStack
    }));
  };
  
  const setCurrentRedoStack = (newStack: DrawingStroke[][]) => {
    setRedoStacks(prev => ({
      ...prev,
      [currentPage]: newStack
    }));
  };
  
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

  // 컴포넌트 마운트 시 PDF 로드 및 필기 데이터 로드
  useEffect(() => {
    loadPdf();
    loadDrawingDataFromServer();
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



  // 캔버스 필기 데이터 관리
  const saveDrawingData = useCallback((pageId: number, data: DrawingStroke[]) => {
    const newData = {
      ...drawingDataRef.current,
      [pageId]: data
    };
    drawingDataRef.current = newData;
    setDrawingData(newData);
  }, []);

  // strokes 상태 변경 시 자동으로 서버에 저장
  useEffect(() => {
    if (strokes.length > 0 || drawingDataRef.current[currentPage]) {
      // 디바운싱을 위해 약간의 지연 후 저장
      const timeoutId = setTimeout(() => {
        saveDrawingDataToServer(currentPage, strokes);
      }, 500); // 500ms 지연

      return () => clearTimeout(timeoutId);
    }
  }, [strokes, currentPage]);

  // 서버에 필기 데이터 저장
  const saveDrawingDataToServer = async (pageId: number, data: DrawingStroke[]) => {
    try {
      const response = await fetch(`/api/pdfs/${pdfId}/drawing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          pageNumber: pageId,
          drawingData: data
        })
      });

      if (!response.ok) {
        console.error('필기 데이터 저장 실패:', response.status);
        return;
      }

      console.log(`페이지 ${pageId} 필기 데이터 서버 저장 완료`);
    } catch (error) {
      console.error('필기 데이터 저장 에러:', error);
    }
  };

  // 서버에서 필기 데이터 로드
  const loadDrawingDataFromServer = async () => {
    try {
      const response = await fetch(`/api/pdfs/${pdfId}/drawing`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        console.error('필기 데이터 로드 실패:', response.status);
        return;
      }

      const result = await response.json();
      if (result.success && result.drawingData) {
        console.log('서버에서 필기 데이터 로드 완료:', result.drawingData);
        
        // 서버 데이터를 로컬 상태에 반영
        const serverData = result.drawingData;
        drawingDataRef.current = serverData;
        setDrawingData(serverData);
        
        // 현재 페이지의 데이터가 있으면 로드
        if (serverData[currentPage]) {
          setStrokes(serverData[currentPage]);
          setPreviousStrokes(serverData[currentPage]);
          previousStrokesRef.current = [...serverData[currentPage]];
        }
      }
    } catch (error) {
      console.error('필기 데이터 로드 에러:', error);
    }
  };

  // 페이지 변경 시 캔버스 필기 데이터 로드
  useEffect(() => {
    console.log('📄 페이지 변경 감지 - 페이지:', currentPage);
    const savedData = drawingDataRef.current[currentPage];
    if (savedData) {
      console.log('📂 저장된 데이터 로드 - strokes:', savedData.length, '개');
      setStrokes(savedData);
      setPreviousStrokes(savedData); // previousStrokes도 함께 업데이트
      previousStrokesRef.current = [...savedData]; // ref도 함께 업데이트
    } else {
      console.log('📂 새 페이지 - 빈 상태로 초기화');
      setStrokes([]);
      setPreviousStrokes([]);
      previousStrokesRef.current = []; // ref도 함께 초기화
    }
    setCurrentPath([]);
    setIsDrawing(false);
    
    // 페이지 변경 시에만 undo/redo 스택 초기화
    // console.log('🗑️ 페이지 변경으로 undo/redo 스택 초기화');
    // setUndoStack([]);
    // setRedoStack([]);
    setIsInitialLoad(true); // 페이지 변경 시 초기 로드 플래그 리셋
  }, [currentPage]);

  // test useEffect(() => {
  //   // 서버 데이터 받아오면 페이지 재 랜더링
  //     renderCanvas();
  // }, [drawingData]);

  // strokes 변경 시 undo 스택에 저장 (단, 초기 로드 시에는 제외)
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [previousStrokes, setPreviousStrokes] = useState<DrawingStroke[]>([]);
  const previousStrokesRef = useRef<DrawingStroke[]>([]);
  const isUndoRedoActionRef = useRef(false);
  
  // 이제 undoStack은 handleMouseUp에서 직접 관리하므로 이 useEffect는 단순화
  useEffect(() => {
    console.log('🔄 strokes 상태 업데이트 - 현재 개수:', strokes.length, 'undoStack.length:', getCurrentUndoStack().length);
  }, [strokes, undoStacks, currentPage]);

  // 페이지 변경 시 캔버스 다시 그리기
  useEffect(() => {
    // 페이지 변경 시 약간의 지연을 두고 캔버스 렌더링 (DOM 업데이트 완료 후)
    const renderCanvas = () => {
      const canvas = excalidrawRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // 캔버스 크기 설정
          canvas.width = canvas.offsetWidth;
          canvas.height = canvas.offsetHeight;
          
          // 기존 경로들 다시 그리기
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // 모든 스트로크 그리기
          strokes.forEach(stroke => {
            if (stroke.points.length < 1) return;
            
            // 지우개는 그리지 않음 (이미 제거됨)
            if (stroke.tool === 'eraser') return;
            
            // 스타일 설정
            ctx.strokeStyle = stroke.color;
            ctx.lineWidth = stroke.size;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            if (stroke.tool === 'highlighter') {
              // 하이라이터: 반투명 처리
              const color = stroke.color;
              if (color.startsWith('#')) {
                // hex 색상을 rgba로 변환
                const r = parseInt(color.slice(1, 3), 16);
                const g = parseInt(color.slice(3, 5), 16);
                const b = parseInt(color.slice(5, 7), 16);
                ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.5)`; // 50% 투명도
              } else {
                ctx.strokeStyle = stroke.color;
              }
              ctx.lineWidth = stroke.size * 2;
            }
            
            ctx.beginPath();
            
            if (stroke.tool === 'rectangle') {
              // 사각형 그리기
              if (stroke.points.length >= 2) {
                const startX = stroke.points[0].x;
                const startY = stroke.points[0].y;
                const endX = stroke.points[1].x;
                const endY = stroke.points[1].y;
                const width = endX - startX;
                const height = endY - startY;
                
                ctx.rect(startX, startY, width, height);
                ctx.stroke();
              }
            } else if (stroke.tool === 'circle') {
              // 원 그리기
              if (stroke.points.length >= 2) {
                const centerX = stroke.points[0].x;
                const centerY = stroke.points[0].y;
                const endX = stroke.points[1].x;
                const endY = stroke.points[1].y;
                const radius = Math.sqrt(Math.pow(endX - centerX, 2) + Math.pow(endY - centerY, 2));
                
                ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
                ctx.stroke();
              }
            } else {
              // 일반 선 그리기 (pen, highlighter, line)
              if (stroke.points.length >= 2) {
                ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
                
                for (let i = 1; i < stroke.points.length; i++) {
                  ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
                }
                
                ctx.stroke();
              }
            }
          });
        }
      }
    };

    // 페이지 변경 시에는 약간의 지연을 두고 렌더링
    if (currentPage) {
      setTimeout(renderCanvas, 10);
    } else {
      renderCanvas();
    }
  }, [strokes, isDarkMode, currentPage, numPages]); // currentPage 의존성 추가

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

  // 캔버스 필기 이벤트 핸들러
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = excalidrawRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsDrawing(true);
    
    if (currentTool === 'rectangle' || currentTool === 'circle') {
      // 도형 그리기: 시작점 설정
      setStartPoint({ x, y });
      setPreviewShape({ x, y });
    } else {
      // 일반 그리기: 경로 시작
      setCurrentPath([{ x, y }]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const canvas = excalidrawRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (currentTool === 'rectangle' || currentTool === 'circle') {
      // 도형 그리기: 미리보기 업데이트
      setPreviewShape({ x, y });
      drawPath();
    } else {
      // 일반 그리기: 경로에 점 추가
      setCurrentPath(prev => [...prev, { x, y }]);
      drawPath();
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    
    if (currentTool === 'rectangle' || currentTool === 'circle') {
      // 도형 그리기 완료
      if (!startPoint || !previewShape) return;
      
      console.log(`${currentTool} 그리기 완료 - 시작:`, startPoint, '끝:', previewShape);
      
      // 항상 현재 상태를 undoStack에 저장
      console.log('📚 undoStack에 현재 상태 저장 - undoStack.length:', getCurrentUndoStack().length);
      setCurrentUndoStack([...getCurrentUndoStack(), [...strokes]]);
      setCurrentRedoStack([]);
      
      // 도형을 두 점으로 표현
      const shapeStroke: DrawingStroke = {
        points: [startPoint, previewShape],
        color: currentColor,
        size: currentSize,
        tool: currentTool
      };
      
      const newStrokes = [...strokes, shapeStroke];
      console.log('📐 새로운 도형 추가 완료 - 이전:', strokes.length, '개 → 새로:', newStrokes.length, '개');
      setStrokes(newStrokes);
      saveDrawingData(currentPage, newStrokes);
      
      // 도형 그리기 상태 초기화
      setStartPoint(null);
      setPreviewShape(null);
    } else if (currentPath.length > 0) {
      console.log('마우스업 - 현재 strokes 수:', strokes.length);
      console.log('마우스업 - previousStrokesRef:', previousStrokesRef.current.length);
      
      if (currentTool === 'eraser') {
        console.log('🧽 지우개 사용 시작 - 현재 strokes:', strokes.length, '개');
        
        // 지우개: 해당 영역의 스트로크들을 제거
        const erasedStrokes = strokes.filter(stroke => {
          // 지우개 경로와 겹치는 스트로크들을 제거
          return !stroke.points.some(point => 
            currentPath.some(eraserPoint => {
              const distance = Math.sqrt(
                Math.pow(point.x - eraserPoint.x, 2) + 
                Math.pow(point.y - eraserPoint.y, 2)
              );
              return distance < currentSize * 3; // 지우개 크기
            })
          );
        });
        
        // 실제로 지워진 것이 있을 때만 undoStack에 저장
        if (erasedStrokes.length < strokes.length) {
          console.log('📚 지우개 - undoStack에 현재 상태 저장 - undoStack.length:', getCurrentUndoStack().length);
          setCurrentUndoStack([...getCurrentUndoStack(), [...strokes]]);
          // redo 스택 초기화
          setCurrentRedoStack([]);
        } else {
          console.log('⚠️ 아무것도 지워지지 않아서 undoStack 저장 안함');
        }
        
        console.log('🧽 지우개 완료 - 이전:', strokes.length, '개 → 남은:', erasedStrokes.length, '개');
        setStrokes(erasedStrokes);
        saveDrawingData(currentPage, erasedStrokes);
      } else {
        // 일반 그리기 도구
        console.log('🎨 새로운 stroke 추가 시작 - 현재 strokes:', strokes.length, '개');
        
        // 항상 현재 상태를 undoStack에 저장 (첫 번째 stroke도 포함)
        console.log('📚 undoStack에 현재 상태 저장 - undoStack.length:', getCurrentUndoStack().length);
        setCurrentUndoStack([...getCurrentUndoStack(), [...strokes]]);
        
        // redo 스택 초기화 (새로운 액션 시)
        setCurrentRedoStack([]);
        
        const newStroke: DrawingStroke = {
          points: [...currentPath],
          color: currentColor,
          size: currentSize,
          tool: currentTool
        };
        
        const newStrokes = [...strokes, newStroke];
        console.log('�� 새로운 stroke 추가 완료 - 이전:', strokes.length, '개 → 새로:', newStrokes.length, '개');
        setStrokes(newStrokes);
        saveDrawingData(currentPage, newStrokes);
      }
      
      setCurrentPath([]);
    }
    
    // 모든 경우에 그리기 상태 종료
    setIsDrawing(false);
  };

  const drawPath = () => {
    const canvas = excalidrawRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // 캔버스 크기 설정
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    // 기존 스트로크들 다시 그리기
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 모든 스트로크 그리기
    strokes.forEach(stroke => {
      if (stroke.points.length < 1) return;
      
      // 지우개는 그리지 않음 (이미 제거됨)
      if (stroke.tool === 'eraser') return;
      
      // 스타일 설정
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      if (stroke.tool === 'highlighter') {
        // 하이라이터: 반투명 처리
        const color = stroke.color;
        if (color.startsWith('#')) {
          // hex 색상을 rgba로 변환
          const r = parseInt(color.slice(1, 3), 16);
          const g = parseInt(color.slice(3, 5), 16);
          const b = parseInt(color.slice(5, 7), 16);
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.5)`; // 50% 투명도
        } else {
          ctx.strokeStyle = stroke.color;
        }
        ctx.lineWidth = stroke.size * 2;
      }
      
      ctx.beginPath();
      
      if (stroke.tool === 'rectangle') {
        // 사각형 그리기
        if (stroke.points.length >= 2) {
          const startX = stroke.points[0].x;
          const startY = stroke.points[0].y;
          const endX = stroke.points[1].x;
          const endY = stroke.points[1].y;
          const width = endX - startX;
          const height = endY - startY;
          
          ctx.rect(startX, startY, width, height);
          ctx.stroke();
        }
      } else if (stroke.tool === 'circle') {
        // 원 그리기
        if (stroke.points.length >= 2) {
          const centerX = stroke.points[0].x;
          const centerY = stroke.points[0].y;
          const endX = stroke.points[1].x;
          const endY = stroke.points[1].y;
          const radius = Math.sqrt(Math.pow(endX - centerX, 2) + Math.pow(endY - centerY, 2));
          
          ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
          ctx.stroke();
        }
      } else {
        // 일반 선 그리기 (pen, highlighter, line)
        if (stroke.points.length >= 2) {
          ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
          
          for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
          }
          
          ctx.stroke();
        }
      }
    });
    
    // 현재 그리는 중인 미리보기 그리기
    if (isDrawing) {
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = currentSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      if (currentTool === 'highlighter') {
        // 하이라이터: 반투명 처리
        if (currentColor.startsWith('#')) {
          // hex 색상을 rgba로 변환
          const r = parseInt(currentColor.slice(1, 3), 16);
          const g = parseInt(currentColor.slice(3, 5), 16);
          const b = parseInt(currentColor.slice(5, 7), 16);
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.5)`; // 50% 투명도
        }
        ctx.lineWidth = currentSize * 2;
      }
      
      ctx.beginPath();
      
      if (currentTool === 'rectangle' && startPoint && previewShape) {
        // 사각형 미리보기
        const width = previewShape.x - startPoint.x;
        const height = previewShape.y - startPoint.y;
        ctx.rect(startPoint.x, startPoint.y, width, height);
        ctx.stroke();
      } else if (currentTool === 'circle' && startPoint && previewShape) {
        // 원 미리보기
        const radius = Math.sqrt(
          Math.pow(previewShape.x - startPoint.x, 2) + 
          Math.pow(previewShape.y - startPoint.y, 2)
        );
        ctx.arc(startPoint.x, startPoint.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (currentPath.length > 1 && currentTool !== 'eraser') {
        // 일반 선 미리보기
        ctx.moveTo(currentPath[0].x, currentPath[0].y);
        
        for (let i = 1; i < currentPath.length; i++) {
          ctx.lineTo(currentPath[i].x, currentPath[i].y);
        }
        
        ctx.stroke();
      }
    }
  };

  // 전체 캔버스 지우기
  const clearAllCanvas = () => {
    setStrokes([]);
    setCurrentPath([]);
    setIsDrawing(false);
    saveDrawingData(currentPage, []); // 로컬 상태 업데이트 (자동 저장됨)
    
    const canvas = excalidrawRef.current;
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

  // 실행취소 함수
  const handleUndo = useCallback(() => {
    console.log('실행취소 시도 - undo 스택:', getCurrentUndoStack().length, '개 항목');
    if (getCurrentUndoStack().length > 0) {
      const targetStrokes = getCurrentUndoStack()[getCurrentUndoStack().length - 1];
      const newUndoStack = getCurrentUndoStack().slice(0, -1);
      // redoStack에는 실행취소 전의 현재 상태를 저장
      const newRedoStack = [...getCurrentRedoStack(), strokes];
      
      console.log('실행취소 실행 - 복원할 strokes:', targetStrokes.length, '개');
      
      // 플래그 설정하여 useEffect 실행 방지
      isUndoRedoActionRef.current = true;
      
      // 상태 업데이트
             setStrokes(targetStrokes);
       setCurrentUndoStack(newUndoStack);
       setCurrentRedoStack(newRedoStack);
       setPreviousStrokes(targetStrokes);
       previousStrokesRef.current = [...targetStrokes];
       saveDrawingData(currentPage, targetStrokes); // 로컬 상태 업데이트 (자동 저장됨)
       
       toast.success('실행 취소되었습니다.');
    } else {
      console.log('실행취소 실패 - undo 스택이 비어있음');
    }
  }, [undoStacks, redoStacks, strokes, currentPage, saveDrawingData]);

  // 다시실행 함수
  const handleRedo = useCallback(() => {
    if (getCurrentRedoStack().length > 0) {
      const targetStrokes = getCurrentRedoStack()[getCurrentRedoStack().length - 1];
      const newRedoStack = getCurrentRedoStack().slice(0, -1);
      const newUndoStack = [...getCurrentUndoStack(), strokes];
      
      // 플래그 설정하여 useEffect 실행 방지
      isUndoRedoActionRef.current = true;
      
      // 상태 업데이트
             setStrokes(targetStrokes);
       setCurrentRedoStack(newRedoStack);
       setCurrentUndoStack(newUndoStack);
       setPreviousStrokes(targetStrokes);
       previousStrokesRef.current = [...targetStrokes];
       saveDrawingData(currentPage, targetStrokes); // 로컬 상태 업데이트 (자동 저장됨)
       
       toast.success('다시 실행되었습니다.');
    }
  }, [undoStacks, redoStacks, strokes, currentPage, saveDrawingData]);

  // 페이지 이동 함수들
  const goToNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  }, [currentPage, totalPages]);

  const goToPrevPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  }, [currentPage]);

  // 키보드 이벤트 (실행취소/다시실행 + 페이지 이동)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // input, textarea, 또는 contenteditable 요소에 포커스가 있으면 무시
      const activeElement = document.activeElement;
      const isTyping = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.getAttribute('contenteditable') === 'true'
      );

      if (isTyping) return;

      // Ctrl/Cmd + Z/Y: 실행취소/다시실행
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          handleUndo();
        } else if ((e.key === 'y') || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault();
          handleRedo();
        }
      } 
      // 방향키: 페이지 이동
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        goToNextPage();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrevPage();
      }
      // 스페이스바: 페이지 이동
      else if (e.key === ' ') {
        e.preventDefault();
        if (e.shiftKey) {
          goToPrevPage(); // Shift + Space: 이전 페이지
        } else {
          goToNextPage(); // Space: 다음 페이지
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, goToNextPage, goToPrevPage]);



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
          <div className={`flex items-center justify-between p-3 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} flex-shrink-0 h-18`}>
            {/* 왼쪽 도구들 */}
            <div className="flex items-center gap-4">
                             {/* 그리기 도구들 */}
               <div className="flex items-center gap-2">
                 <Button
                   variant={currentTool === 'pen' ? 'default' : 'ghost'}
                   size="sm"
                   onClick={() => setCurrentTool('pen')}
                   className="flex flex-col items-center gap-1 h-auto py-2 px-3"
                 >
                   <Pen size={16} />
                   <span className="text-xs">펜</span>
                 </Button>
                 <Button
                   variant={currentTool === 'highlighter' ? 'default' : 'ghost'}
                   size="sm"
                   onClick={() => setCurrentTool('highlighter')}
                   className="flex flex-col items-center gap-1 h-auto py-2 px-3"
                 >
                   <Highlighter size={16} />
                   <span className="text-xs">하이라이터</span>
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
                   variant={currentTool === 'rectangle' ? 'default' : 'ghost'}
                   size="sm"
                   onClick={() => setCurrentTool('rectangle')}
                   className="flex flex-col items-center gap-1 h-auto py-2 px-3"
                 >
                   <Square size={16} />
                   <span className="text-xs">사각형</span>
                 </Button>
                 <Button
                   variant={currentTool === 'circle' ? 'default' : 'ghost'}
                   size="sm"
                   onClick={() => setCurrentTool('circle')}
                   className="flex flex-col items-center gap-1 h-auto py-2 px-3"
                 >
                   <Circle size={16} />
                   <span className="text-xs">원</span>
                 </Button>
               </div>

              {/* 색상 선택 */}
              <div className="flex items-center gap-2">
                <span className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} text-xs`}>색상:</span>
                <div className="flex gap-1">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setCurrentColor(color)}
                      className={`w-6 h-6 rounded border-2 transition-all ${
                        currentColor === color ? 'border-gray-800 scale-110' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              {/* 선 굵기 선택 */}
              <div className="flex items-center gap-2">
                <span className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} text-xs`}>굵기:</span>
                <div className="flex gap-1">
                  {SIZES.map((size) => (
                    <button
                      key={size}
                      onClick={() => setCurrentSize(size)}
                      className={`px-2 py-1 rounded text-xs transition-all ${
                        currentSize === size
                          ? 'bg-blue-500 text-white'
                          : isDarkMode
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

                                             {/* 실행취소/다시실행 */}
                <div className="flex items-center gap-1">
                  <Button
                    variant={getCurrentUndoStack().length > 0 ? "default" : "ghost"}
                    size="sm"
                    onClick={() => {
                      console.log('실행취소 버튼 클릭 - undoStack:', getCurrentUndoStack().length, '개');
                      console.log('undoStack 내용:', getCurrentUndoStack());
                      handleUndo();
                    }}
                    disabled={getCurrentUndoStack().length === 0}
                    className={`flex flex-col items-center gap-1 h-auto py-2 px-2 ${
                      getCurrentUndoStack().length > 0 
                        ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-md' 
                        : 'text-gray-600 hover:text-gray-800 disabled:opacity-50'
                    }`}
                    title={`실행취소 가능: ${getCurrentUndoStack().length}개 단계`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                    <span className="text-xs">실행취소({getCurrentUndoStack().length})</span>
                  </Button>
                  <Button
                    variant={getCurrentRedoStack().length > 0 ? "default" : "ghost"}
                    size="sm"
                    onClick={handleRedo}
                    disabled={getCurrentRedoStack().length === 0}
                    className={`flex flex-col items-center gap-1 h-auto py-2 px-2 ${
                      getCurrentRedoStack().length > 0 
                        ? 'bg-green-500 text-white hover:bg-green-600 shadow-md' 
                        : 'text-gray-600 hover:text-gray-800 disabled:opacity-50'
                    }`}
                    title={`다시실행 가능: ${getCurrentRedoStack().length}개 단계`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                    </svg>
                    <span className="text-xs">다시실행</span>
                  </Button>
                </div>

               {/* 전체 지우기 */}
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

                         {/* 오른쪽 안내 메시지 */}
             <div className="flex items-center gap-2">
               <span className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} text-sm`}>
                 {currentTool === 'pen' ? '펜으로 필기' : 
                  currentTool === 'highlighter' ? '하이라이터로 강조' :
                  currentTool === 'eraser' ? '지우개로 지우기' :
                  currentTool === 'rectangle' ? '드래그해서 사각형 그리기' :
                  currentTool === 'circle' ? '드래그해서 원 그리기' : '도구 선택'}
               </span>
             </div>
          </div>

        {/* PDF 뷰어 및 캔버스 - 나머지 공간 전체 사용 */}
        <div className="flex-1 flex flex-col items-center justify-center overflow-hidden" ref={pdfViewerRef}>
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

                                           {/* react-pdf Document with Excalidraw overlay */}
                  <div className="relative inline-block" ref={containerRef}>
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
                      scale={pdfScale}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      onLoadSuccess={(page) => {
                        const viewport = page.getViewport({ scale: 1.0 });
                        setPdfDimensions({
                          width: viewport.width,
                          height: viewport.height
                        });
                        console.log('PDF 페이지 크기:', { width: viewport.width, height: viewport.height });
                      }}
                    />
                  </Document>
                  <div className="absolute inset-0 pointer-events-none">
                    {pdfUrl && (
                      <div className="w-full h-full pointer-events-auto excalidraw-container">
                        <canvas
                          ref={excalidrawRef}
                          className="w-full h-full"
                          style={{
                            background: 'transparent',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            zIndex: 1
                          }}
                          onMouseDown={handleMouseDown}
                          onMouseMove={handleMouseMove}
                          onMouseUp={handleMouseUp}
                          onMouseLeave={handleMouseUp}
                        />
                      </div>
                    )}
                  </div>
                  </div>
                   
           {/* 페이지 정보 - PDF 아래에 위치 */}
           <div className="text-center mt-4">
             <span className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} text-sm`}>
               페이지 {currentPage} / {numPages}
             </span>
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
        <div className="p-4 h-full flex flex-col" style={{ minWidth: '240px', maxWidth: '500px' }}>
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
           <div className="flex-1 overflow-y-auto space-y-4 pr-2 flex flex-col items-center">
             {Array.from(new Array(numPages), (el, index) => (
               <div key={`page_${index + 1}`} className="relative">
                 <div
                   className={`w-full rounded cursor-pointer transition-all hover:opacity-80 ${
                     currentPage === index + 1 ? 'ring-2 ring-blue-500' : ''
                   }`}
                   onClick={() => setCurrentPage(index + 1)}
                 >
                   <div className="w-full max-w-[200px] mx-auto">
                     <Document file={pdfUrl}>
                       <Page
                         pageNumber={index + 1}
                         width={200}
                         renderTextLayer={false}
                         renderAnnotationLayer={false}
                       />
                     </Document>
                   </div>
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