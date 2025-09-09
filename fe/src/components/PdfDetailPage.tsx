import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Menu, Search, X, Share2, FileEdit, BookOpen, Settings as SettingsIcon, Download, Map, Languages, Copy, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
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
  
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfViewerRef = useRef<HTMLDivElement>(null);
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

  // 키보드 이벤트 (페이지 이동)
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

      // Ctrl/Cmd + Plus/Minus: PDF 줌 인/아웃 (브라우저 줌 대신)
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
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
  }, [goToNextPage, goToPrevPage, handleZoomIn, handleZoomOut, handleZoomReset]);

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

                  {/* react-pdf Document */}
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