import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Menu, Search, X, Pen, Highlighter, Eraser, Square, Circle, Share2, FileEdit, BookOpen, Settings as SettingsIcon, Download, Map, Languages, Copy, Type, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { toast } from 'sonner';
import { HtmlRenderer } from './ui/html-renderer';
import { LatexRenderer } from './ui/latex-renderer';


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
  tool: 'pen' | 'highlighter' | 'eraser' | 'rectangle' | 'circle' | 'line' | 'text';
  text?: string; // 텍스트 메모용
}

interface TextMemo {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
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
  
  // LaTeX 수식 파싱 헬퍼 함수
  const parseLatexContent = (content: string) => {
    // 더 정확한 LaTeX 수식 패턴 매칭
    // 블록 수식: $$...$$ (줄바꿈 포함 가능)
    // 인라인 수식: $...$ (줄바꿈 제외)
    // 독립적인 LaTeX 명령어: \\[4pt], \\, \quad 등
    // \text{} 명령어가 포함된 수식도 안전하게 처리
    const parts = content.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]*\$|\\\\\[[^\]]*\]|\\\\[a-zA-Z]+|\\[a-zA-Z]+(?:\{[^}]*\})*)/g);
    return parts;
  };

  // LaTeX 수식 유효성 검사 함수
  const isValidLatex = (math: string) => {
    // 기본적인 LaTeX 문법 검사
    // 괄호 짝 맞추기, 명령어 구조 등
    try {
      // \text{} 명령어의 중괄호 짝 맞추기 검사
      const textMatches = math.match(/\\text\{/g);
      const textEndMatches = math.match(/\}/g);
      if (textMatches && textEndMatches) {
        if (textMatches.length > textEndMatches.length) {
          return false; // 중괄호가 닫히지 않음
        }
      }
      
      // 독립적인 LaTeX 명령어 검사 (\\[4pt], \\, \quad 등)
      if (math.match(/^\\\\\[[^\]]*\]$/) || // \\[4pt] 형태
          math.match(/^\\\\[a-zA-Z]+$/) ||   // \\ 명령어
          math.match(/^\\[a-zA-Z]+(?:\{[^}]*\})*$/)) { // \quad, \text{} 등
        return true;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  };

  // 코드 블록 내 마크다운 포맷팅 처리 함수
  const processCodeBlockFormatting = (content: string) => {
    // 볼드 처리 (**text** 또는 __text__)
    const boldRegex = /\*\*(.*?)\*\*|__(.*?)__/g;
    const parts: (string | React.ReactElement)[] = [];
    let lastIndex = 0;
    let match;
    
    while ((match = boldRegex.exec(content)) !== null) {
      // 매치 이전 텍스트 추가
      if (match.index > lastIndex) {
        parts.push(content.slice(lastIndex, match.index));
      }
      
      // 볼드 텍스트 추가
      const boldText = match[1] || match[2];
      parts.push(
        <strong key={`bold-${match.index}`} className={`${isDarkMode ? 'text-white' : 'text-gray-900'} font-semibold ${isDarkMode ? 'text-yellow-300' : 'text-yellow-700'}`}>
          {boldText}
        </strong>
      );
      
      lastIndex = match.index + match[0].length;
    }
    
    // 남은 텍스트 추가
    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex));
    }
    
    return parts.length > 0 ? parts : [content];
  };

  // 워커 설정은 App.tsx에서 전역적으로 처리됨
  
  // PDF 상태
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // PDF 크기 조정 상태
  const [pdfScale, setPdfScale] = useState<number>(1);
  const [pdfDimensions, setPdfDimensions] = useState<{width: number, height: number} | null>(null);
  const [containerDimensions, setContainerDimensions] = useState<{width: number, height: number}>({width: 0, height: 0});
  
  // PDF 콘텐츠 전용 줌 상태
  const [pdfZoom, setPdfZoom] = useState<number>(1);
  
  // 사이드바 상태 - 상호 배타적
  const [mapSidebarOpen, setMapSidebarOpen] = useState(false);
  const [aiSidebarOpen, setAiSidebarOpen] = useState(true);
  const [aiSidebarWidth, setAiSidebarWidth] = useState(() => Math.floor(window.innerWidth * 0.27));
  const [mapSidebarWidth, setMapSidebarWidth] = useState(240);
  
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
  
  // 요약 결과를 번역에서 재활용하기 위한 상태
  const [summaryForTranslation, setSummaryForTranslation] = useState<string>('');
  
  // 퀴즈 설정 상태
  const [showQuizSettings, setShowQuizSettings] = useState(false);
  const [quizType, setQuizType] = useState<'ox' | 'multiple4' | 'multiple5' | 'fillblank'>('multiple5');

  // AI 관련 상태
  const [summary, setSummary] = useState<string>('');
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [quiz, setQuiz] = useState<any>(null);
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(false);
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
  }, [pdfDimensions, mapSidebarOpen, aiSidebarOpen, aiSidebarWidth, mapSidebarWidth]);
  
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
  const [currentTool, setCurrentTool] = useState<'pen' | 'highlighter' | 'eraser' | 'rectangle' | 'circle' | 'line' | 'text'>('pen');
  
  // 텍스트 메모 상태
  const [textMemos, setTextMemos] = useState<{ [key: number]: TextMemo[] }>({});
  const [isEditingText, setIsEditingText] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [textPosition, setTextPosition] = useState<{x: number, y: number} | null>(null);
  const [fontSize, setFontSize] = useState(16);
  
  
  const [currentColor, setCurrentColor] = useState('#000000');
  const [currentSize, setCurrentSize] = useState(2);

  // AI API 호출 함수들
  const fetchSummary = async () => {
    try {
      setIsLoadingSummary(true);
      const response = await fetch(`/api/pdfs/${pdfId}/summary`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('요약 요청에 실패했습니다.');
      }

      const data = await response.json();
      setSummary(data.summary);
      
      // 요약 결과를 번역에서도 사용할 수 있도록 저장
      setSummaryForTranslation(data.summary);
      
      // 캐시된 데이터인지 확인하고 사용자에게 알림
      if (data.fromCache) {
        console.log('기존 저장된 요약을 불러왔습니다.');
      } else {
        console.log('새로운 요약을 생성했습니다.');
      }
    } catch (error) {
      console.error('요약 요청 에러:', error);
      toast.error('요약을 가져오는데 실패했습니다.');
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const fetchTranslation = async (targetLanguage: string) => {
    try {
      setIsTranslating(true);
      
      // 먼저 요약이 있는지 확인 (summaryForTranslation 우선 사용)
      if (!summaryForTranslation) {
        console.log('요약이 없습니다. 먼저 요약을 생성합니다.');
        toast.info('요약을 먼저 생성한 후 번역을 진행합니다.');
        await fetchSummary();
      }
      
      const response = await fetch(`/api/pdfs/${pdfId}/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          targetLanguage,
          sourceContent: summaryForTranslation || summary // 요약 결과를 번역 API에 전달
        }),
      });

      if (!response.ok) {
        throw new Error('번역 요청에 실패했습니다.');
      }

      const data = await response.json();
      setTranslatedContent(data.translation);
      
      // 캐시된 데이터인지 확인하고 사용자에게 알림
      if (data.fromCache) {
        console.log('기존 저장된 번역을 불러왔습니다.');
        toast.success('기존 번역을 불러왔습니다.');
      } else {
        console.log('새로운 번역을 생성했습니다.');
        toast.success('번역이 완료되었습니다.');
      }
    } catch (error) {
      console.error('번역 요청 에러:', error);
      toast.error('번역에 실패했습니다.');
    } finally {
      setIsTranslating(false);
    }
  };

  const fetchQuiz = async () => {
    try {
      setIsLoadingQuiz(true);
      const response = await fetch(`/api/pdfs/${pdfId}/quiz`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('퀴즈 요청에 실패했습니다.');
      }

      const data = await response.json();
      setQuiz(data.quiz);
      
      // 캐시된 데이터인지 확인하고 사용자에게 알림
      if (data.fromCache) {
        console.log('기존 저장된 퀴즈를 불러왔습니다.');
      } else {
        console.log('새로운 퀴즈를 생성했습니다.');
      }
    } catch (error) {
      console.error('퀴즈 요청 에러:', error);
      toast.error('퀴즈를 가져오는데 실패했습니다.');
    } finally {
      setIsLoadingQuiz(false);
    }
  };
  
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
    loadTextMemosFromServer();
  }, [pdfId]);

  // PDF 로드 완료 후 AI 정보 자동 로드
  useEffect(() => {
    if (pdfUrl && !isLoading && !error) {
      // AI 정보 자동 로드
      fetchSummary();
      fetchQuiz();
    }
  }, [pdfUrl, isLoading, error]);
  
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
    // 요약이 없으면 먼저 요약 생성 안내
    if (!summaryForTranslation && !summary) {
      toast.info('요약을 먼저 생성한 후 번역을 진행합니다.');
      await fetchSummary();
      // 요약 생성 완료 후 번역 실행
      setTimeout(() => fetchTranslation(translateLanguage), 1000);
    } else {
      await fetchTranslation(translateLanguage);
    }
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

  // 텍스트 메모를 서버에 저장하는 함수
  const saveTextMemosToServer = async (pageId: number, memos: TextMemo[]) => {
    try {
      const response = await fetch(`/api/pdfs/${pdfId}/textmemos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          pageNumber: pageId,
          textMemos: memos
        })
      });

      if (!response.ok) {
        console.error('텍스트 메모 저장 실패:', response.status);
        return;
      }

      console.log(`페이지 ${pageId} 텍스트 메모 서버 저장 완료`);
    } catch (error) {
      console.error('텍스트 메모 저장 에러:', error);
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

  // 서버에서 텍스트 메모 로드
  const loadTextMemosFromServer = async () => {
    try {
      const response = await fetch(`/api/pdfs/${pdfId}/textmemos`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        console.error('텍스트 메모 로드 실패:', response.status);
        return;
      }

      const result = await response.json();
      if (result.success && result.textMemos) {
        console.log('서버에서 텍스트 메모 로드 완료:', result.textMemos);
        setTextMemos(result.textMemos);
      }
    } catch (error) {
      console.error('텍스트 메모 로드 에러:', error);
    }
  };

  // 페이지 변경 시 캔버스 필기 데이터 로드
  useEffect(() => {
    console.log('페이지 변경 감지 - 페이지:', currentPage);
    const savedData = drawingDataRef.current[currentPage];
    if (savedData) {
      console.log('저장된 데이터 로드 - strokes:', savedData.length, '개');
      setStrokes(savedData);
      setPreviousStrokes(savedData); // previousStrokes도 함께 업데이트
      previousStrokesRef.current = [...savedData]; // ref도 함께 업데이트
    } else {
      console.log('새 페이지 - 빈 상태로 초기화');
      setStrokes([]);
      setPreviousStrokes([]);
      previousStrokesRef.current = []; // ref도 함께 초기화
    }
    setCurrentPath([]);
    setIsDrawing(false); 
    setIsInitialLoad(true); // 페이지 변경 시 초기 로드 플래그 리셋
  }, [currentPage]);

  // strokes 변경 시 undo 스택에 저장 (단, 초기 로드 시에는 제외)
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [previousStrokes, setPreviousStrokes] = useState<DrawingStroke[]>([]);
  const previousStrokesRef = useRef<DrawingStroke[]>([]);
  const isUndoRedoActionRef = useRef(false);
  
  // 이제 undoStack은 handleMouseUp에서 직접 관리하므로 이 useEffect는 단순화
  useEffect(() => {
    console.log('strokes 상태 업데이트 - 현재 개수:', strokes.length, 'undoStack.length:', getCurrentUndoStack().length);
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
  }, [strokes, isDarkMode, currentPage, numPages]); // numPages는 첫 랜더링에서 필기 보이게 하기 위해 추가


  // 캔버스 필기 이벤트 핸들러
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = excalidrawRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsDrawing(true);
    
    if (currentTool === 'text') {
      // 기존 텍스트 메모 클릭 체크 (편집을 위해)
      const currentPageMemos = textMemos[currentPage] || [];
      const clickedMemo = currentPageMemos.find(memo => {
        const padding = 4;
        const canvas = excalidrawRef.current;
        if (!canvas) return false;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;
        
        ctx.font = `${memo.fontSize}px Arial`;
        const textMetrics = ctx.measureText(memo.text);
        const textHeight = memo.fontSize;
        
        return x >= memo.x - padding &&
               x <= memo.x + textMetrics.width + padding &&
               y >= memo.y - padding &&
               y <= memo.y + textHeight + padding;
      });
      
      if (clickedMemo && e.detail === 2) {
        // 더블클릭으로 기존 텍스트 편집
        handleTextEdit(clickedMemo.id);
      } else {
        // 새 텍스트 메모 추가
        setTextPosition({ x, y });
        setIsEditingText(true);
        setTextInput('');
      }
    } else if (currentTool === 'rectangle' || currentTool === 'circle') {
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

  const handleMouseUp = (e?: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    if (currentTool === 'rectangle' || currentTool === 'circle') {
      // 도형 그리기 완료
      if (!startPoint || !previewShape) return;
      
      console.log(`${currentTool} 그리기 완료 - 시작:`, startPoint, '끝:', previewShape);
      
      // 항상 현재 상태를 undoStack에 저장
      console.log('undoStack에 현재 상태 저장 - undoStack.length:', getCurrentUndoStack().length);
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
      setStrokes(newStrokes);
      saveDrawingData(currentPage, newStrokes);
      
      // 도형 그리기 상태 초기화
      setStartPoint(null);
      setPreviewShape(null);
    } else if (currentPath.length > 0) {
      console.log('마우스업 - 현재 strokes 수:', strokes.length);
      console.log('마우스업 - previousStrokesRef:', previousStrokesRef.current.length);
      
      if (currentTool === 'eraser') {
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
          console.log('지우개 - undoStack에 현재 상태 저장 - undoStack.length:', getCurrentUndoStack().length);
          setCurrentUndoStack([...getCurrentUndoStack(), [...strokes]]);
          // redo 스택 초기화
          setCurrentRedoStack([]);
        } else {
          console.log('아무것도 지워지지 않아서 undoStack 저장 안함');
        }
        
        console.log('지우개 완료 - 이전:', strokes.length, '개 → 남은:', erasedStrokes.length, '개');
        setStrokes(erasedStrokes);
        saveDrawingData(currentPage, erasedStrokes);
      } else {
        // 항상 현재 상태를 undoStack에 저장 (첫 번째 stroke도 포함)
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
    
    // 텍스트 메모들 렌더링
    const currentPageMemos = textMemos[currentPage] || [];
    currentPageMemos.forEach(memo => {
      ctx.font = `${memo.fontSize}px Arial`;
      ctx.fillStyle = memo.color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      
      // 텍스트 배경 (선택사항)
      const textMetrics = ctx.measureText(memo.text);
      const textHeight = memo.fontSize;
      const padding = 4;
      
      // 반투명 배경
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillRect(
        memo.x - padding, 
        memo.y - padding, 
        textMetrics.width + padding * 2, 
        textHeight + padding * 2
      );
      
      // 텍스트 그리기
      ctx.fillStyle = memo.color;
      ctx.fillText(memo.text, memo.x, memo.y);
      
      // 테두리 (편집 가능함을 나타내기 위해)
      ctx.strokeStyle = memo.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(
        memo.x - padding, 
        memo.y - padding, 
        textMetrics.width + padding * 2, 
        textHeight + padding * 2
      );
    });
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
    
    const newWidth = window.innerWidth - e.clientX;
    
    // AI 사이드바 리사이즈
    if (aiSidebarOpen) {
      if (newWidth >= 240 && newWidth <= 1000) {
        setAiSidebarWidth(newWidth);
      }
    }
    // PDF 맵 사이드바 리사이즈
    else if (mapSidebarOpen) {
      if (newWidth >= 240 && newWidth <= 500) {
        setMapSidebarWidth(newWidth);
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

  // 텍스트 메모 관련 함수들
  const handleTextSubmit = () => {
    if (!textInput.trim() || !textPosition) return;
    
    const newMemo: TextMemo = {
      id: `text_${Date.now()}`,
      x: textPosition.x,
      y: textPosition.y,
      text: textInput.trim(),
      color: currentColor,
      fontSize: fontSize
    };
    
    setTextMemos(prev => ({
      ...prev,
      [currentPage]: [...(prev[currentPage] || []), newMemo]
    }));
    
    // 입력 상태 초기화
    setIsEditingText(false);
    setTextInput('');
    setTextPosition(null);
    
    // 캔버스 다시 그리기
    setTimeout(() => drawPath(), 10);
  };

  const handleTextCancel = () => {
    setIsEditingText(false);
    setTextInput('');
    setTextPosition(null);
    setEditingTextId(null);
  };

  const handleTextEdit = (memoId: string) => {
    const memo = textMemos[currentPage]?.find(m => m.id === memoId);
    if (memo) {
      setTextInput(memo.text);
      setTextPosition({ x: memo.x, y: memo.y });
      setIsEditingText(true);
      setEditingTextId(memoId);
    }
  };

  const handleTextUpdate = () => {
    if (!editingTextId || !textInput.trim()) return;
    
    setTextMemos(prev => ({
      ...prev,
      [currentPage]: prev[currentPage]?.map(memo =>
        memo.id === editingTextId
          ? { ...memo, text: textInput.trim() }
          : memo
      ) || []
    }));
    
    handleTextCancel();
    
    // 캔버스 다시 그리기
    setTimeout(() => drawPath(), 10);
  };

  const handleTextDelete = (memoId: string) => {
    setTextMemos(prev => ({
      ...prev,
      [currentPage]: prev[currentPage]?.filter(memo => memo.id !== memoId) || []
    }));
    
    // 캔버스 다시 그리기
    setTimeout(() => drawPath(), 10);
  };


  // 현재 페이지가 변경될 때 입력값도 동기화
  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);
  
  // 텍스트 메모나 페이지 변경 시 캔버스 다시 그리기
  useEffect(() => {
    const timer = setTimeout(() => {
      drawPath();
    }, 50);
    return () => clearTimeout(timer);
  }, [textMemos, currentPage, strokes]);

  // 텍스트 메모 자동 저장
  useEffect(() => {
    if (!pdfId) return;
    
    const timeoutId = setTimeout(() => {
      saveTextMemosToServer(currentPage, textMemos[currentPage] || []);
    }, 500); // 500ms 지연

    return () => clearTimeout(timeoutId);
  }, [textMemos, currentPage, pdfId]);

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
      // 요약이 이미 있으면 바로 번역, 없으면 요약 먼저 생성
      if (summaryForTranslation || summary) {
        handleTranslate();
      } else {
        console.log('번역 탭 활성화: 요약이 없어서 먼저 요약을 생성합니다.');
        fetchSummary().then(() => {
          // 요약 생성 완료 후 번역 실행
          setTimeout(() => handleTranslate(), 500);
        });
      }
    }
  }, [activeTab, translatedContent, summaryForTranslation, summary]);

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

  // PDF 줌 제어 함수들
  const handleZoomIn = useCallback(() => {
    setPdfZoom(prev => Math.min(prev + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setPdfZoom(prev => Math.max(prev - 0.25, 1));
  }, []);

  const handleZoomReset = useCallback(() => {
    setPdfZoom(1);
  }, []);

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
        // Ctrl/Cmd + Plus/Minus: PDF 줌 인/아웃 (브라우저 줌 대신)
        else if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          handleZoomIn();
        } else if (e.key === '-') {
          e.preventDefault();
          handleZoomOut();
        } else if (e.key === '0') {
          e.preventDefault();
          handleZoomReset();
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
  }, [handleUndo, handleRedo, goToNextPage, goToPrevPage, handleZoomIn, handleZoomOut, handleZoomReset]);

  // PDF 콘텐츠 줌 제어 (Ctrl + 휠로 PDF만 줌)
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // PDF 뷰어 영역에서만 작동하도록 확인
      const pdfViewer = pdfViewerRef.current;
      if (!pdfViewer?.contains(e.target as Node)) return;
      
      // Ctrl/Cmd + 휠인지 확인
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault(); // 브라우저 줌 방지
        
        if (e.deltaY < 0) {
          // 휠 위로: 확대
          handleZoomIn();
        } else {
          // 휠 아래로: 축소
          handleZoomOut();
        }
      }
    };

    // PDF 뷰어에 이벤트 리스너 추가
    const pdfViewer = pdfViewerRef.current;
    if (pdfViewer) {
      pdfViewer.addEventListener('wheel', handleWheel, { passive: false });
      return () => pdfViewer.removeEventListener('wheel', handleWheel);
    }
  }, [handleZoomIn, handleZoomOut]);

  // AI 버튼 위치 계산 - 맵 사이드바가 열릴 때 동적으로 조정
  const getAiButtonRightPosition = () => {
    if (mapSidebarOpen) {
      return mapSidebarWidth + 32; // 맵 사이드바 너비 + 기본 32px
    }
    return 32; // 기본 right-8 (32px)
  };

  return (
    <div className={`${isDarkMode ? 'bg-[#1a1a1e]' : 'bg-gray-50'} h-screen flex relative overflow-x-auto`}>
      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex flex-col h-full" style={{ minWidth: '400px' }}>
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
                 <Button
                   variant={currentTool === 'text' ? 'default' : 'ghost'}
                   size="sm"
                   onClick={() => setCurrentTool('text')}
                   className="flex flex-col items-center gap-1 h-auto py-2 px-3"
                 >
                   <Type size={16} />
                   <span className="text-xs">텍스트</span>
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

               {/* 줌 컨트롤 - 확대 시에만 표시 */}
               {pdfZoom > 1 && (
                 <div className="flex items-center gap-2">
                   <Button
                     variant="ghost"
                     size="sm"
                     onClick={handleZoomReset}
                     className="flex flex-col items-center gap-1 h-auto py-2 px-3"
                   >
                     <RotateCcw size={16} />
                     <span className="text-xs">초기화</span>
                   </Button>
                   <span className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} text-xs`}>
                     {Math.round(pdfZoom * 100)}%
                   </span>
                 </div>
               )}
            </div>

                         {/* 오른쪽 안내 메시지 */}
             <div className="flex items-center gap-2">
               <span className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} text-sm`}>
                 {currentTool === 'pen' ? '펜으로 필기' : 
                  currentTool === 'highlighter' ? '하이라이터로 강조' :
                  currentTool === 'eraser' ? '지우개로 지우기' :
                  currentTool === 'rectangle' ? '드래그해서 사각형 그리기' :
                  currentTool === 'circle' ? '드래그해서 원 그리기' :
                  currentTool === 'text' ? '클릭해서 텍스트 메모 추가' : '도구 선택'}
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
                  <div 
                    className="relative inline-block" 
                    ref={containerRef}
                    style={{
                      transform: `scale(${pdfZoom})`,
                      transformOrigin: 'center center',
                      transition: 'transform 0.2s ease-in-out'
                    }}
                  >
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
                  
                  {/* 텍스트 입력 오버레이 */}
                  {isEditingText && textPosition && (
                    <div 
                      className={`absolute z-50 ${isDarkMode ? 'bg-[#2A2A2E] border-gray-600' : 'bg-white border-gray-300'} border rounded-lg shadow-lg p-3 min-w-[220px]`}
                      style={{
                        left: textPosition.x,
                        top: textPosition.y,
                        transform: 'translate(10px, -10px)' // 클릭 위치에서 약간 오프셋
                      }}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                            텍스트 메모
                          </span>
                          <div className="flex items-center gap-2">
                            <select
                              value={fontSize}
                              onChange={(e) => setFontSize(Number(e.target.value))}
                              className={`text-xs border rounded px-1 py-0.5 ${isDarkMode ? 'bg-[#1A1A1E] border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-700'}`}
                            >
                              <option value={12}>12px</option>
                              <option value={14}>14px</option>
                              <option value={16}>16px</option>
                              <option value={18}>18px</option>
                              <option value={20}>20px</option>
                            </select>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleTextCancel}
                              className={`p-1 h-auto ${isDarkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
                            >
                              <X size={14} />
                            </Button>
                          </div>
                        </div>
                        
                        <textarea
                          value={textInput}
                          onChange={(e) => setTextInput(e.target.value)}
                          placeholder="메모를 입력하세요..."
                          className={`w-full px-2 py-1 text-sm border rounded resize-none ${
                            isDarkMode 
                              ? 'bg-[#1A1A1E] border-gray-600 text-gray-200 placeholder:text-gray-400' 
                              : 'bg-white border-gray-300 text-gray-700 placeholder:text-gray-500'
                          }`}
                          rows={3}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              editingTextId ? handleTextUpdate() : handleTextSubmit();
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              handleTextCancel();
                            }
                          }}
                        />
                        
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleTextCancel}
                            className={`text-xs ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}`}
                          >
                            취소
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={editingTextId ? handleTextUpdate : handleTextSubmit}
                            disabled={!textInput.trim()}
                            className="text-xs bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {editingTextId ? '수정' : '추가'}
                          </Button>
                        </div>
                        
                        <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} text-center`}>
                          Enter: 추가 | Shift+Enter: 줄바꿈 | Esc: 취소
                        </div>
                      </div>
                    </div>
                  )}
                  </div>
           
           {/* 페이지 네비게이션 - PDF 아래에 위치 (줌 영향 받지 않음) */}
           <div className="flex items-center justify-center gap-4 mt-4">
             {currentPage > 1 && (
               <Button
                 variant="outline"
                 size="sm"
                 onClick={goToPrevPage}
                 className={`px-3 py-2 ${isDarkMode ? 'border-gray-600 text-[#efefef] hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
               >
                 <ChevronLeft size={16} />
               </Button>
             )}
             
             <span className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} text-sm px-4`}>
               페이지 {currentPage} / {numPages}
             </span>
             
             {currentPage < totalPages && (
               <Button
                 variant="outline"
                 size="sm"
                 onClick={goToNextPage}
                 className={`px-3 py-2 ${isDarkMode ? 'border-gray-600 text-[#efefef] hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
               >
                 <ChevronRight size={16} />
               </Button>
             )}
           </div>
        </div>
      </div>

      {/* PDF 맵 사이드바 - 오른쪽 */}
      <div 
        className={`${isDarkMode ? 'bg-[#121214]' : 'bg-white'} transition-all duration-300 flex-shrink-0 relative border-l ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} h-full ${
          mapSidebarOpen ? '' : 'w-0 overflow-hidden'
        }`}
        style={mapSidebarOpen ? { width: `${mapSidebarWidth}px` } : {}}
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
        style={aiSidebarOpen ? { width: `${aiSidebarWidth}px` } : {}}
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
                {isLoadingSummary ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                      <span className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>요약 중...</span>
                    </div>
                  </div>
                                 ) : summary ? (
                   <div className="prose prose-sm max-w-none">
                     <h3 className={`${isDarkMode ? 'text-white' : 'text-gray-900'} mb-4 flex items-center`}>
                       <FileEdit size={16} className="mr-2" />
                       문서 요약
                     </h3>
                     <div className={`${isDarkMode ? 'bg-gradient-to-br from-gray-800 to-gray-900' : 'bg-gradient-to-br from-gray-50 to-white'} p-6 rounded-xl border ${isDarkMode ? 'border-gray-700 shadow-lg' : 'border-gray-200 shadow-md'} backdrop-blur-sm`}>
                       <div className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'} text-sm leading-relaxed prose prose-sm max-w-none ${isDarkMode ? 'prose-invert' : ''}`}>
                         <HtmlRenderer html={summary} isDarkMode={isDarkMode} />
                       </div>
                     </div>
                   </div>
                ) : (
                  <div className="text-center py-8">
                    <FileEdit size={48} className={`mx-auto mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
                    <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      요약을 생성하는 중입니다...
                    </p>
                  </div>
                )}
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
                      disabled={isTranslating || isLoadingSummary}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50"
                    >
                      <Languages size={14} className="mr-2" />
                      {isTranslating || isLoadingSummary 
                        ? (isLoadingSummary ? '요약 생성 중...' : '번역 중...') 
                        : '번역하기'
                      }
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
                      <span className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        {!summaryForTranslation && !summary ? '요약 생성 중...' : '번역 중...'}
                      </span>
                    </div>
                  </div>
                                 ) : translatedContent ? (
                   <div className="prose prose-sm max-w-none">
                     <h3 className={`${isDarkMode ? 'text-white' : 'text-gray-900'} mb-4 flex items-center`}>
                       <Languages size={16} className="mr-2" />
                       번역 결과
                     </h3>
                     <div className={`${isDarkMode ? 'bg-gradient-to-br from-gray-800 to-gray-900' : 'bg-gradient-to-br from-gray-50 to-white'} p-6 rounded-xl border ${isDarkMode ? 'border-gray-700 shadow-lg' : 'border-gray-200 shadow-md'} backdrop-blur-sm`}>
                       <div className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'} text-sm leading-relaxed prose prose-sm max-w-none ${isDarkMode ? 'prose-invert' : ''}`}>
                         <HtmlRenderer html={translatedContent} isDarkMode={isDarkMode} />
                       </div>
                     </div>
                   </div>
                ) : (
                  <div className="text-center py-8">
                    <Languages size={48} className={`mx-auto mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
                    <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-4`}>
                      번역하기 버튼을 클릭하여 문서를 번역하세요.
                    </p>
                    {!summaryForTranslation && !summary && (
                      <div className={`${isDarkMode ? 'bg-yellow-900/20 border-yellow-700' : 'bg-yellow-50 border-yellow-200'} border rounded-lg p-3`}>
                        <p className={`${isDarkMode ? 'text-yellow-300' : 'text-yellow-700'} text-sm`}>
                          💡 <strong>팁:</strong> 요약을 먼저 생성하면 더 정확한 번역 결과를 얻을 수 있습니다.
                        </p>
                      </div>
                    )}
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
                {isLoadingQuiz ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                      <span className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>퀴즈 생성 중...</span>
                    </div>
                  </div>
                ) : quiz ? (
                  <div className="space-y-6">
                    {quiz.questions && quiz.questions.map((question: any, index: number) => (
                      <div key={index}>
                        <h3 className={`${isDarkMode ? 'text-white' : 'text-gray-900'} text-lg mb-4`}>
                          문제 {index + 1}
                        </h3>
                        <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-4 leading-relaxed`}>
                          {question.question}
                        </p>
                        
                        <div className="space-y-3">
                          {question.options && question.options.map((option: string, optionIndex: number) => (
                            <button
                              key={optionIndex}
                              className={`w-full text-left p-3 rounded border transition-colors ${isDarkMode ? 'border-gray-600 text-gray-300 hover:border-blue-500 hover:bg-blue-500/10' : 'border-gray-300 text-gray-700 hover:border-blue-500 hover:bg-blue-50'}`}
                            >
                              <span className="text-blue-400 mr-3">{optionIndex + 1}.</span>
                              {option}
                            </button>
                          ))}
                        </div>
                        
                        <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded">
                          <p className="text-green-800 text-sm">
                            <strong>정답:</strong> {question.answer}번
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <BookOpen size={48} className={`mx-auto mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
                    <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      퀴즈를 생성하는 중입니다...
                    </p>
                  </div>
                )}
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