import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Map,
  MessageCircle,
  Languages,
  Highlighter,
  Loader2,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from 'sonner';
import { HtmlRenderer } from './ui/html-renderer';

interface PdfDetailPageProps {
  pdfId: string;
  pdfName: string;
  onBack: () => void;
  isDarkMode: boolean;
}

// 마크다운을 HTML로 변환하는 개선된 함수
const markdownToHtml = (markdown: string): string => {
  if (!markdown || markdown.trim() === '') return '';

  let html = markdown
    // 코드 블록 먼저 처리 (다른 변환에 영향받지 않도록)
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    // 인라인 코드 처리
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // 헤더 변환 (3단계까지만)
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // 굵은 글씨 (코드 내부가 아닌 경우만)
    .replace(
      /(?<!<code[^>]*>)(?<!<pre[^>]*>)\*\*([^*]+)\*\*(?!<\/code>)(?!<\/pre>)/g,
      '<strong>$1</strong>'
    )
    // 기울임 (코드 내부가 아닌 경우만)
    .replace(
      /(?<!<code[^>]*>)(?<!<pre[^>]*>)\*([^*]+)\*(?!<\/code>)(?!<\/pre>)/g,
      '<em>$1</em>'
    )
    // 목록 처리
    .replace(/^(\d+)\. (.*$)/gim, '<li>$2</li>')
    .replace(/^[\*\-] (.*$)/gim, '<li>$1</li>')
    // 줄바꿈 처리
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  // 목록 감싸기 (연속된 li 태그들을 ul로 감싸기)
  html = html.replace(/(<li>.*?<\/li>(?:\s*<li>.*?<\/li>)*)/gs, '<ul>$1</ul>');

  // 문단 감싸기 (이미 태그가 없는 텍스트만)
  html = html.replace(
    /^(?!<[h|l|p|d|s|u|o])([^<].*?)(?=<[h|l|p|d|s|u|o]|$)/gm,
    '<p>$1</p>'
  );

  // 빈 태그 정리
  html = html
    .replace(/<p><\/p>/g, '')
    .replace(/<p><br><\/p>/g, '<br>')
    .replace(/<p>\s*<\/p>/g, '')
    .replace(/<ul>\s*<\/ul>/g, '');

  return html;
};

export function PdfDetailPage({
  pdfId,
  pdfName,
  onBack,
  isDarkMode,
}: PdfDetailPageProps) {
  // SVG PDF 뷰어 관련 상태
  const [allPagesSvg, setAllPagesSvg] = useState<Array<{
    pageNumber: number;
    svgUrl: string;
  }> | null>(null);
  const [svgLoading, setSvgLoading] = useState<boolean>(false);
  const [loadedPages, setLoadedPages] = useState<Set<number>>(new Set());
  const [preloadRange] = useState<number>(2); // 현재 페이지 +-2 페이지 미리 로드

  // 텍스트 레이어 상태 (PyMuPDF 결과 사용)
  const [textSpans, setTextSpans] = useState<Array<{
    id: string;
    text: string;
    x0: number; // PDF 포인트 좌표
    y0: number;
    x1: number;
    y1: number;
    fontSize: number; // 포인트
    font: string;
    pageNumber: number;
    pageWidth?: number;
    pageHeight?: number;
  }> | null>(null);
  const [showTextLayer, setShowTextLayer] = useState<boolean>(true);

  // 더 이상 필요하지 않은 함수들 제거됨

  // 워커 설정은 App.tsx에서 전역적으로 처리됨

  // PDF 상태
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // PDF 크기 조정 상태
  const [pdfScale, setPdfScale] = useState<number>(1);
  const [pdfDimensions, setPdfDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [containerDimensions, setContainerDimensions] = useState<{
    width: number;
    height: number;
  }>({ width: 0, height: 0 });
  const [renderedSize, setRenderedSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // PDF 콘텐츠 전용 줌 상태
  const [pdfZoom, setPdfZoom] = useState<number>(1);

  // 사이드바 상태 - 상호 배타적
  const [mapSidebarOpen, setMapSidebarOpen] = useState(false);
  const [aiSidebarOpen, setAiSidebarOpen] = useState(true);
  const [aiSidebarWidth, setAiSidebarWidth] = useState(() =>
    Math.floor(window.innerWidth * 0.27)
  );
  const [mapSidebarWidth, setMapSidebarWidth] = useState(240);

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isResizing, setIsResizing] = useState(false);
  const [pageInputValue, setPageInputValue] = useState('1');

  // AI 사이드바는 항상 채팅만 표시
  const [inputMessage, setInputMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<
    Array<{ id: string; type: 'user' | 'ai'; message: string }>
  >([]);

  // 질문 컨텍스트 상태
  const [questionContext, setQuestionContext] = useState<{
    text: string;
    pageNumber: number;
  } | null>(null);

  // 채팅 히스토리 로드 (DB에서)
  const loadChatHistory = useCallback(async () => {
    try {
      const response = await fetch(`/api/pdfs/${pdfId}/chat`, {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const history = await response.json();
        setChatHistory(history);
        return history;
      } else {
        console.error('채팅 히스토리 로드 실패:', response.status);
        return [];
      }
    } catch (error) {
      console.error('채팅 히스토리 로드 에러:', error);
      return [];
    }
  }, [pdfId]);

  // 텍스트 선택 관련 상태
  const [selectedText, setSelectedText] = useState<string>('');
  const [selectedTextPageNumber, setSelectedTextPageNumber] = useState<
    number | null
  >(null);
  const [selectionPosition, setSelectionPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [showTextActions, setShowTextActions] = useState<boolean>(false);

  // questionContext로 통합되어 제거됨

  // 채팅 전용 상태만 유지

  const containerRef = useRef<HTMLDivElement>(null);
  const pdfViewerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  // 화면 크기 감지 및 PDF 크기 조정
  const calculatePdfScale = useCallback(() => {
    const viewer = pdfViewerRef.current;
    if (!viewer || !pdfDimensions) return;
    
    const viewerRect = viewer.getBoundingClientRect();
    const availableWidth = viewerRect.width - 48; // 좌우 여백
    const availableHeight = viewerRect.height - 80; // 페이지 네비 여백

    const widthScale = availableWidth / pdfDimensions.width;
    const heightScale = availableHeight / pdfDimensions.height;
    const finalScale = Math.min(widthScale, heightScale);

    setPdfScale(finalScale);
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

  // 더 이상 필요하지 않은 함수들 제거됨

  // PDF 목록에서 SVG 데이터 가져오기
  const fetchPdfSvgData = async () => {
    try {
      setSvgLoading(true);

      const response = await fetch('/api/pdfs', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`PDF 목록을 가져올 수 없습니다. (${response.status})`);
      }

      const pdfs = await response.json();

      // 현재 PDF의 SVG 데이터 찾기
      const currentPdf = pdfs.find((pdf: any) => pdf.id === pdfId);

      if (
        currentPdf &&
        currentPdf.allPagesSvg &&
        Array.isArray(currentPdf.allPagesSvg) &&
        currentPdf.allPagesSvg.length > 0
      ) {
        setAllPagesSvg(currentPdf.allPagesSvg);

        // SVG 뷰어 사용 시 페이지 수 설정
        setNumPages(currentPdf.allPagesSvg.length);
        setTotalPages(currentPdf.allPagesSvg.length);
      } else {
      }

      // 텍스트 스팬 데이터 설정 (PyMuPDF spans)
      if (
        currentPdf &&
        currentPdf.textSpans &&
        Array.isArray(currentPdf.textSpans)
      ) {
        setTextSpans(currentPdf.textSpans);
        setShowTextLayer(true); // 텍스트 스팬 로드 시 자동 표시
      }
    } catch (error) {
      console.error('PDF SVG 데이터 가져오기 에러:', error);
    } finally {
      setSvgLoading(false);
    }
  };

  // PDF 다운로드 및 로드
  const loadPdf = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // SVG 데이터 먼저 확인
      await fetchPdfSvgData();

      const response = await fetch(`/api/pdfs/${pdfId}/download`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('PDF 다운로드 실패:', errorText);
        throw new Error(`PDF를 다운로드할 수 없습니다. (${response.status})`);
      }

      const pdfBlob = await response.blob();

      const url = URL.createObjectURL(pdfBlob);
      setPdfUrl(url);
      setIsLoading(false);
    } catch (error) {
      console.error('PDF 로드 에러:', error);
      setError(
        error instanceof Error ? error.message : 'PDF를 로드할 수 없습니다.'
      );
      setIsLoading(false);
    }
  };

  // 컴포넌트 마운트 시 PDF 로드
  useEffect(() => {
    loadPdf();
  }, [pdfId]);

  // 더 이상 자동 로드 불필요

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

  // 텍스트 선택 처리 함수들
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      const selectedText = selection.toString().trim();
      setSelectedText(selectedText);

      // 선택된 텍스트의 위치 계산
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // 선택된 텍스트가 포함된 페이지 번호 찾기
      const selectedElement = range.commonAncestorContainer;
      let pageNumber = currentPage; // 기본값은 현재 페이지

      // 선택된 요소의 부모들을 순회하면서 페이지 정보를 찾음
      let element =
        selectedElement.nodeType === Node.TEXT_NODE
          ? selectedElement.parentElement
          : (selectedElement as Element);

      while (element && element !== document.body) {
        // SVG 페이지 컨테이너를 찾음
        if (element.classList?.contains('svg-page')) {
          // 현재 표시되는 페이지가 선택된 페이지
          pageNumber = currentPage;
          break;
        }
        // 텍스트 레이어에서 페이지 정보를 찾음
        if (element.getAttribute && element.getAttribute('data-page')) {
          pageNumber = parseInt(
            element.getAttribute('data-page') || currentPage.toString()
          );
          break;
        }
        element = element.parentElement;
      }

      setSelectedTextPageNumber(pageNumber);

      setSelectionPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 10, // 선택된 텍스트 위에 표시
      });

      setShowTextActions(true);
    } else {
      setShowTextActions(false);
      setSelectedText('');
      setSelectedTextPageNumber(null);
      setSelectionPosition(null);
    }
  }, [currentPage]);

  // PDF 채팅 API 호출 함수
  const chatWithPdf = useCallback(
    async (question: string, selectedText?: string) => {
      if (!pdfId) return;

      // AI 사이드바 열기
      if (!aiSidebarOpen) {
        handleAiSidebarToggle();
      }

      // 임시로 사용자 메시지를 UI에 표시 (실제 저장은 백엔드에서)
      const tempUserMessage = {
        id: `temp_user_${Date.now()}`,
        type: 'user' as const,
        message: question,
      };
      setChatHistory((prev) => [...prev, tempUserMessage]);

      // 임시 AI 메시지 ID 생성
      const tempAiMessageId = `temp_ai_${Date.now()}`;
      const tempAiMessage = {
        id: tempAiMessageId,
        type: 'ai' as const,
        message: '',
      };
      setChatHistory((prev) => [...prev, tempAiMessage]);

      try {
        const response = await fetch(`/api/pdfs/${pdfId}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            question,
            selectedText,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || '채팅 요청에 실패했습니다.');
        }

        // 스트림 응답 처리
        console.log('🌐 프론트엔드 스트리밍 시작');
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('스트림을 읽을 수 없습니다.');
        }

        const decoder = new TextDecoder();
        let fullResponse = '';
        let chunkCount = 0;

        // 타이핑 효과를 위한 함수
        const updateDisplayText = (text: string) => {
          setChatHistory((prev) =>
            prev.map((msg) =>
              msg.id === tempAiMessageId ? { ...msg, message: text } : msg
            )
          );
        };

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              console.log(
                '✅ 프론트엔드 스트리밍 완료 - 총 청크:',
                chunkCount,
                '전체 길이:',
                fullResponse.length
              );
              break;
            }

            chunkCount++;
            const chunk = decoder.decode(value, { stream: true });
            console.log(
              `📥 프론트엔드 청크 #${chunkCount} 수신:`,
              chunk.length,
              'bytes'
            );

            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();

                if (data === '[DONE]') {
                  console.log('🏁 프론트엔드 완료 신호 수신');
                  // 완료 신호 수신 시에는 더 이상 업데이트하지 않음
                  break;
                }

                if (data === '') {
                  continue;
                }

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.content;

                  if (content) {
                    fullResponse += content;
                    console.log(
                      '💬 프론트엔드 텍스트 업데이트:',
                      content,
                      '| 누적:',
                      fullResponse.length,
                      '자'
                    );

                    // 즉시 UI 업데이트 (배칭 방지)
                    updateDisplayText(fullResponse);

                    // 약간의 지연을 두어 타이핑 효과 강화
                    await new Promise((resolve) => setTimeout(resolve, 5));
                  }
                } catch (parseError) {
                  // JSON 파싱 에러는 무시하고 계속 진행
                  console.log(
                    '❌ 프론트엔드 JSON 파싱 에러:',
                    parseError.message,
                    'Data:',
                    data
                  );
                  continue;
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
          console.log('🔚 프론트엔드 스트리밍 연결 종료');
        }

        // 채팅 완료 후 DB에서 최신 히스토리 다시 로드
        await loadChatHistory();
      } catch (error) {
        console.error('PDF 채팅 에러:', error);
        // 에러 메시지를 AI 메시지로 업데이트
        setChatHistory((prev) =>
          prev.map((msg) =>
            msg.id === tempAiMessageId
              ? {
                  ...msg,
                  message: `에러: ${
                    error instanceof Error
                      ? error.message
                      : '알 수 없는 오류가 발생했습니다.'
                  }`,
                }
              : msg
          )
        );
      }
    },
    [pdfId, aiSidebarOpen, handleAiSidebarToggle, loadChatHistory]
  );

  // 텍스트 액션 버튼 함수들
  const handleAskQuestion = useCallback(() => {
    if (selectedText && selectedTextPageNumber) {
      // 질문 컨텍스트 설정 (채팅창 위에 표시)
      setQuestionContext({
        text: selectedText,
        pageNumber: selectedTextPageNumber,
      });
      setShowTextActions(false);
      // AI 사이드바가 닫혀있다면 열기
      if (!aiSidebarOpen) {
        handleAiSidebarToggle();
      }

      setShowTextActions(false);
      setSelectedText('');
      setSelectionPosition(null);
    }
  }, [selectedText, aiSidebarOpen, handleAiSidebarToggle]);

  const handleTranslateText = useCallback(() => {
    if (selectedText) {
      const translateMessage = `다음 텍스트를 번역해주세요: "${selectedText}"`;
      setInputMessage(translateMessage);
      setShowTextActions(false);
      // AI 사이드바가 닫혀있다면 열기
      if (!aiSidebarOpen) {
        handleAiSidebarToggle();
      }
    }
  }, [selectedText, selectedTextPageNumber, aiSidebarOpen]);

  const handleHighlightText = useCallback(() => {
    if (selectedText && selectedTextPageNumber) {
      toast.success(
        `${selectedTextPageNumber}페이지 텍스트가 하이라이트되었습니다: "${selectedText.substring(
          0,
          30
        )}${selectedText.length > 30 ? '...' : ''}"`
      );
      setShowTextActions(false);
    }
  }, [selectedText, selectedTextPageNumber]);

  // 더 이상 필요하지 않은 함수 제거됨

  // 리사이즈 핸들러
  const handleMouseDownResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMoveResize = useCallback(
    (e: MouseEvent) => {
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
    },
    [isResizing, aiSidebarOpen, mapSidebarOpen]
  );

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

  // 페이지 변경 시 미리 로드할 페이지들 계산
  useEffect(() => {
    if (!allPagesSvg) return;

    const pagesToLoad = new Set<number>();

    // 현재 페이지와 주변 페이지들 추가
    for (
      let i = Math.max(1, currentPage - preloadRange);
      i <= Math.min(allPagesSvg.length, currentPage + preloadRange);
      i++
    ) {
      pagesToLoad.add(i);
    }

    // 이미 로드된 페이지들과 비교하여 새로 로드할 페이지들만 추출
    const newPagesToLoad = Array.from(pagesToLoad).filter(
      (pageNum) => !loadedPages.has(pageNum)
    );

    if (newPagesToLoad.length > 0) {
      console.log('미리 로드할 페이지들:', newPagesToLoad);
      // 실제로는 이미지 preload는 브라우저가 자동으로 처리하므로
      // 여기서는 로드된 페이지 목록만 업데이트
      setLoadedPages((prev) => new Set([...prev, ...newPagesToLoad]));
    }
  }, [currentPage, allPagesSvg, preloadRange, loadedPages]);

  // 컨텍스트 액션 핸들러 (설명해줘, 요약해줘)
  const handleContextAction = useCallback(
    (action: 'explain' | 'summarize') => {
      if (!questionContext) return;

      let actionMessage = '';
      if (action === 'explain') {
        actionMessage = `[${questionContext.pageNumber}페이지에서 선택한 텍스트 설명 요청] "${questionContext.text}"\n\n이 텍스트에 대해 자세히 설명해주세요.`;
      } else if (action === 'summarize') {
        actionMessage = `[${questionContext.pageNumber}페이지에서 선택한 텍스트 요약 요청] "${questionContext.text}"\n\n이 텍스트를 요약해주세요.`;
      }

      // chatWithPdf 함수 호출
      chatWithPdf(actionMessage, questionContext.text);

      // 액션 실행 후 컨텍스트 제거
      setQuestionContext(null);
    },
    [questionContext]
  );

  // AI 메시지 전송 핸들러
  const handleSendAiMessage = () => {
    if (!inputMessage.trim()) return;

    const question = inputMessage;
    setInputMessage(''); // 입력창 비우기

    // 질문 컨텍스트가 있으면 함께 전달
    const selectedTextToSend = questionContext
      ? `[${questionContext.pageNumber}페이지에서 선택한 텍스트 참고] "${questionContext.text}"\n\n질문: ${question}`
      : question;

    // chatWithPdf 함수 호출
    chatWithPdf(selectedTextToSend, questionContext?.text);

    // 메시지 전송 후 컨텍스트 제거
    setQuestionContext(null);
  };

  // 채팅 히스토리가 변경될 때 자동으로 스크롤을 아래로 이동
  useEffect(() => {
    if (chatMessagesEndRef.current) {
      chatMessagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory]);

  // 초기 챗봇 메시지 설정 및 저장된 히스토리 로드
  useEffect(() => {
    const initializeChat = async () => {
      const savedHistory = await loadChatHistory();

      if (savedHistory.length === 0) {
        const initialMessage = {
          id: 'initial',
          type: 'ai' as const,
          message: `안녕하세요! "${pdfName}"으로 학습한 AI 챗봇입니다. 이 문서에 대해 궁금한 점이나 이해하고 싶은 부분이 있으시면 마음껏 질문해주세요!`,
        };
        setChatHistory([initialMessage]);
      }
    };

    initializeChat();
  }, [pdfName, loadChatHistory]);

  // 텍스트 선택 이벤트 리스너
  useEffect(() => {
    const handleSelectionChange = () => {
      // 약간의 지연을 두어 선택이 완료된 후 처리
      setTimeout(handleTextSelection, 100);
    };

    const handleClickOutside = (event: MouseEvent) => {
      // 텍스트 액션 버튼 외부 클릭 시 숨기기
      const target = event.target as Element;
      if (!target.closest('.text-action-buttons')) {
        setShowTextActions(false);
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('mouseup', handleSelectionChange);
    document.addEventListener('click', handleClickOutside);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('mouseup', handleSelectionChange);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [handleTextSelection]);

  // 페이지 이동 함수들
  const goToNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  }, [currentPage, totalPages]);

  const goToPrevPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  }, [currentPage]);

  // PDF 줌 제어 함수들
  const handleZoomIn = useCallback(() => {
    setPdfZoom((prev) => Math.min(prev + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setPdfZoom((prev) => Math.max(prev - 0.25, 1));
  }, []);

  const handleZoomReset = useCallback(() => {
    setPdfZoom(1);
  }, []);

  // 키보드 이벤트 (페이지 이동)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // input, textarea, 또는 contenteditable 요소에 포커스가 있으면 무시
      const activeElement = document.activeElement;
      const isTyping =
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.getAttribute('contenteditable') === 'true');

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
  }, [
    goToNextPage,
    goToPrevPage,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
  ]);

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
    <div
      className={`${
        isDarkMode ? 'bg-[#1a1a1e]' : 'bg-gray-50'
      } h-screen flex relative`}
    >
      {/* 텍스트 선택 시 플로팅 액션 버튼들 */}
      {showTextActions && selectionPosition && (
        <div
          className='fixed z-50 text-action-buttons'
          style={{
            left: `${selectionPosition.x}px`,
            top: `${selectionPosition.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div
            className={`flex items-center gap-1 ${
              isDarkMode ? 'bg-gray-800' : 'bg-white'
            } rounded-lg shadow-lg border ${
              isDarkMode ? 'border-gray-600' : 'border-gray-200'
            } p-1`}
          >
            <Button
              size='sm'
              variant='ghost'
              onClick={handleAskQuestion}
              className={`h-8 px-2 text-xs ${
                isDarkMode
                  ? 'hover:bg-gray-700 text-gray-300'
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
              title='질문하기'
            >
              <MessageCircle size={14} className='mr-1' />
              질문
            </Button>
            <Button
              size='sm'
              variant='ghost'
              onClick={handleTranslateText}
              className={`h-8 px-2 text-xs ${
                isDarkMode
                  ? 'hover:bg-gray-700 text-gray-300'
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
              title='번역하기'
            >
              <Languages size={14} className='mr-1' />
              번역
            </Button>
            <Button
              size='sm'
              variant='ghost'
              onClick={handleHighlightText}
              className={`h-8 px-2 text-xs ${
                isDarkMode
                  ? 'hover:bg-gray-700 text-gray-300'
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
              title='하이라이트'
            >
              <Highlighter size={14} className='mr-1' />
              강조
            </Button>
          </div>
        </div>
      )}
      {/* 메인 콘텐츠 */}
      <div
        className='flex-1 flex flex-col h-full'
        style={{ minWidth: '400px' }}
      >
        {/* 상단 헤더 - 고정 높이 */}
        <div
          className={`flex items-center p-4 border-b ${
            isDarkMode ? 'border-gray-700' : 'border-gray-200'
          } flex-shrink-0 h-16`}
        >
          {/* 왼쪽 버튼들 */}
          <div className='flex items-center gap-4 flex-1'>
            <Button
              variant='ghost'
              size='sm'
              onClick={onBack}
              className={`${
                isDarkMode
                  ? 'text-white hover:bg-gray-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <ChevronLeft size={20} />
            </Button>
          </div>

          {/* 중앙 파일명 */}
          <div className='flex-1 flex justify-center'>
            <h1
              className={`${
                isDarkMode ? 'text-white' : 'text-gray-900'
              } text-lg font-medium text-center truncate max-w-[60%] px-2`}
            >
              {pdfName}
            </h1>
          </div>

          {/* 오른쪽 버튼들 */}
          <div className='flex items-center gap-4 flex-1 justify-end'>
            {/* 텍스트 레이어 기본 활성화 - 토글 제거 */}

            <Button
              variant='ghost'
              size='sm'
              onClick={handleMapSidebarToggle}
              className={`${
                isDarkMode
                  ? 'text-white hover:bg-gray-700'
                  : 'text-gray-600 hover:bg-gray-100'
              } ${mapSidebarOpen ? 'bg-blue-500/20 text-blue-500' : ''}`}
            >
              <Map size={20} />
            </Button>
          </div>
        </div>

        {/* PDF 뷰어 및 캔버스 - 브라우저 높이에서 헤더를 뺀 나머지 공간 사용 */}
        <div
          className='flex flex-col items-center px-4 py-4'
          style={{ height: 'calc(100vh - 64px)', paddingTop: '0.75cm' }}
          ref={pdfViewerRef}
        >

          {/* 에러 상태 */}
          {error && (
            <div className='text-center'>
              <p
                className={`${
                  isDarkMode ? 'text-red-400' : 'text-red-600'
                } mb-4`}
              >
                {error}
              </p>
              <Button
                onClick={loadPdf}
                className='bg-blue-500 hover:bg-blue-600 text-white'
              >
                다시 시도
              </Button>
            </div>
          )}

          {/* PDF 컨테이너 - 페이지 네비게이션 공간 확보 */}
          <div className='flex-1 flex flex-col items-center min-h-0' style={{ maxHeight: 'calc(100vh - 64px - 80px)' }}>
            {/* SVG PDF 뷰어 또는 react-pdf Document */}
            {/* 상단 공간 확보는 컨테이너 margin-top으로 처리됨 */}

            <div
              className='relative inline-block flex-shrink-0'
              ref={containerRef}
              style={{
                transform: `scale(${pdfZoom})`,
                transformOrigin: 'center center',
                transition: 'transform 0.2s ease-in-out',
              }}
            >
            {allPagesSvg && !svgLoading ? (
              // SVG 뷰어
              <div>
                <div className='w-full flex items-center justify-center' style={{ maxHeight: '80vh' }}>
                  {allPagesSvg.map((pageData) => {
                      const shouldRender =
                        pageData.pageNumber === currentPage ||
                        (loadedPages.has(pageData.pageNumber) &&
                          Math.abs(pageData.pageNumber - currentPage) <=
                            preloadRange);

                      return (
                        <div
                          key={pageData.pageNumber}
                          className={`svg-page ${
                            pageData.pageNumber === currentPage
                              ? 'block'
                              : 'hidden'
                          } ${
                            isDarkMode
                              ? 'border-gray-700/60'
                              : 'border-gray-200/80'
                          } bg-white rounded-2xl shadow-xl border-2 overflow-hidden mx-auto p-5`}
                          style={{
                            transform: `scale(${pdfScale})`,
                            transformOrigin: 'center center',
                            transition: 'transform 0.2s ease-in-out',
                            display:
                              pageData.pageNumber === currentPage
                                ? 'flex'
                                : 'none',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {shouldRender ? (
                            <div className='relative'>
                              <img
                                src={pageData.svgUrl}
                                alt={`페이지 ${pageData.pageNumber}`}
                                style={{
                                  width: '100%',
                                  height: 'auto',
                                  display: 'block',
                                }}
                                loading={
                                  pageData.pageNumber === currentPage
                                    ? 'eager'
                                    : 'lazy'
                                }
                                onLoad={(e) => {
                                  if (pageData.pageNumber === currentPage) {
                                    // 현재 페이지의 SVG가 로드되면 크기 정보 업데이트
                                    const img = e.target as HTMLImageElement;
                                    if (img && img.naturalWidth && img.naturalHeight) {
                                      setPdfDimensions({
                                        width: img.naturalWidth,
                                        height: img.naturalHeight,
                                      });
                                      
                                      // 크기 설정 후 스케일 재계산
                                      setTimeout(() => {
                                        calculatePdfScale();
                                      }, 100);
                                      
                                      const rect = img.getBoundingClientRect();
                                      setRenderedSize({
                                        width: rect.width,
                                        height: rect.height,
                                      });
                                    }
                                  }
                                }}
                                onError={(e) => {
                                  console.error(
                                    `SVG 페이지 ${pageData.pageNumber} 로드 실패:`,
                                    e
                                  );
                                }}
                              />

                              {/* 텍스트 레이어 (정규화 좌표를 퍼센트로 매핑) */}
                              {showTextLayer &&
                                textSpans &&
                                textSpans.length > 0 &&
                                renderedSize && (
                                  <div
                                    className='absolute inset-0 text-overlay'
                                    style={{
                                      zIndex: 10,
                                      pointerEvents: 'auto',
                                      userSelect: 'text',
                                    }}
                                  >
                                    {textSpans
                                      .filter(
                                        (s) =>
                                          s.pageNumber ===
                                            pageData.pageNumber &&
                                          s.pageWidth &&
                                          s.pageHeight
                                      )
                                      .map((span) => (
                                        <div
                                          key={span.id}
                                          className='absolute pointer-events-auto cursor-text select-text'
                                          style={{
                                            left: `${
                                              (span.x0 /
                                                (span.pageWidth || 1)) *
                                              renderedSize.width
                                            }px`,
                                            top: `${
                                              (span.y0 /
                                                (span.pageHeight || 1)) *
                                              renderedSize.height
                                            }px`,
                                            width: `${
                                              ((span.x1 - span.x0) /
                                                (span.pageWidth || 1)) *
                                              renderedSize.width
                                            }px`,
                                            height: `${
                                              ((span.y1 - span.y0) /
                                                (span.pageHeight || 1)) *
                                              renderedSize.height
                                            }px`,
                                            color: 'transparent',
                                            WebkitTextFillColor: 'transparent',
                                            textShadow: 'none',
                                            lineHeight: `${
                                              (span.fontSize /
                                                (span.pageHeight || 1)) *
                                              renderedSize.height
                                            }px`,
                                            fontSize: `${
                                              (span.fontSize /
                                                (span.pageHeight || 1)) *
                                              renderedSize.height
                                            }px`,
                                            fontFamily:
                                              span.font || 'sans-serif',
                                            whiteSpace: 'pre',
                                            overflow: 'visible',
                                            userSelect: 'text',
                                            WebkitUserSelect: 'text',
                                            MozUserSelect: 'text',
                                          }}
                                        >
                                          {span.text}
                                        </div>
                                      ))}
                                    {/* Selection styling for smoother highlight */}
                                    <style>{`
                                            .text-overlay ::selection { 
                                              background: ${'rgba(46, 170, 220, 0.25)'};
                                              color: transparent;
                                            }
                                            .dark .text-overlay ::selection {
                                              background: rgba(99, 179, 237, 0.25);
                                              color: transparent;
                                            }
                                          `}</style>
                                  </div>
                                )}
                            </div>
                          ) : (
                            null
                          )}
                        </div>
                      );
                  })}
                </div>
              </div>
            ) : (
              <div className='text-center p-8'>
                <div className='inline-flex items-center gap-2'>
                  <Loader2 className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} h-5 w-5 animate-spin`} />
                  <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    데이터 불러오는 중...
                  </p>
                </div>
              </div>
            )}
            </div>

            {/* 페이지 네비게이션 - PDF 바로 아래 고정 위치 (줌 영향 받지 않음) */}
            <div className='flex items-center justify-center gap-4 mt-4 mb-4 flex-shrink-0' style={{ height: '60px' }}>
            {currentPage > 1 && (
              <Button
                variant='outline'
                size='sm'
                onClick={goToPrevPage}
                className={`px-3 py-2 ${
                  isDarkMode
                    ? 'border-gray-600 text-[#efefef] hover:bg-gray-700'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <ChevronLeft size={16} />
              </Button>
            )}

            <span
              className={`${
                isDarkMode ? 'text-gray-300' : 'text-gray-600'
              } text-sm px-4`}
            >
              페이지 {currentPage} / {numPages}
            </span>

            {currentPage < totalPages && (
              <Button
                variant='outline'
                size='sm'
                onClick={goToNextPage}
                className={`px-3 py-2 ${
                  isDarkMode
                    ? 'border-gray-600 text-[#efefef] hover:bg-gray-700'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <ChevronRight size={16} />
              </Button>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* PDF 맵 사이드바 - 오른쪽 */}
      <div
        className={`${
          isDarkMode ? 'bg-[#121214]' : 'bg-white'
        } transition-all duration-300 flex-shrink-0 relative border-l ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        } h-full ${mapSidebarOpen ? '' : 'w-0 overflow-hidden'}`}
        style={mapSidebarOpen ? { width: `${mapSidebarWidth}px` } : {}}
      >
        <div
          className='p-4 h-full flex flex-col'
          style={{ minWidth: '240px', maxWidth: '500px' }}
        >
          {/* 상단 컨트롤 */}
          <div className='flex items-center justify-between mb-4 flex-shrink-0'>
            <div className='flex-1' />

            {/* 중앙 페이지 입력 */}
            <div className='flex items-center justify-center gap-1'>
              <form
                onSubmit={handlePageInputSubmit}
                className='flex items-center gap-1'
              >
                <div className='relative'>
                  <input
                    type='text'
                    value={pageInputValue}
                    onChange={handlePageInputChange}
                    onBlur={handlePageInputBlur}
                    className={`w-10 text-center text-sm border rounded px-1 py-0.5 ${
                      isDarkMode
                        ? 'bg-[#3e3b3b] border-gray-600 text-[#efefef] focus:border-blue-500'
                        : 'bg-white border-gray-300 text-gray-700 focus:border-blue-500'
                    } outline-none transition-colors`}
                    style={{ fontSize: '12px' }}
                  />
                </div>
                <span
                  className={`${
                    isDarkMode ? 'text-[#efefef]' : 'text-gray-700'
                  } text-sm`}
                >
                  / {totalPages}
                </span>
              </form>
            </div>

            <div className='flex-1 flex justify-end'>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => setMapSidebarOpen(false)}
                className={`${
                  isDarkMode
                    ? 'text-[#efefef] hover:bg-gray-700'
                    : 'text-gray-600 hover:bg-gray-100'
                } p-1`}
              >
                <X size={16} />
              </Button>
            </div>
          </div>

          {/* 검색창 */}
          <div className='mb-6 flex-shrink-0'>
            <div className='relative'>
              <Search
                size={16}
                className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}
              />
              <Input
                type='text'
                placeholder='PDF에서 검색...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`pl-10 ${
                  isDarkMode
                    ? 'bg-[#3e3b3b] border-gray-600 text-[#efefef] placeholder:text-gray-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-500'
                }`}
              />
            </div>
          </div>

          {/* SVG 페이지 미리보기 - 스크롤 가능 */}
          <div className='flex-1 overflow-y-auto space-y-4 pr-2 flex flex-col items-center'>
            {allPagesSvg ? (
              allPagesSvg.map((pageData) => (
                <div key={`page_${pageData.pageNumber}`} className='relative'>
                  <div
                    className={`w-full rounded cursor-pointer transition-all hover:opacity-80 ${
                      currentPage === pageData.pageNumber
                        ? 'ring-2 ring-blue-500'
                        : ''
                    }`}
                    onClick={() => setCurrentPage(pageData.pageNumber)}
                  >
                    <div className='w-full max-w-[200px] mx-auto bg-white rounded shadow'>
                      <img
                        src={pageData.svgUrl}
                        alt={`페이지 ${pageData.pageNumber}`}
                        style={{
                          width: '100%',
                          height: 'auto',
                          maxWidth: '200px',
                        }}
                      />
                    </div>
                  </div>
                  <div className='absolute bottom-2 left-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded'>
                    {pageData.pageNumber}
                  </div>
                </div>
              ))
            ) : (
              <div className='text-center p-4 text-gray-500'>
                <p>SVG 미리보기를 사용할 수 없습니다</p>
              </div>
            )}
          </div>
        </div>

        {/* PDF 맵 사이드바 리사이즈 핸들 */}
        {mapSidebarOpen && (
          <div
            className='absolute left-0 top-0 w-1 h-full cursor-ew-resize bg-transparent hover:bg-gray-500 hover:bg-opacity-50 transition-colors group'
            onMouseDown={handleMouseDownResize}
          >
            <div className='absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-gray-500 opacity-0 group-hover:opacity-100 transition-opacity'></div>
          </div>
        )}
      </div>

      {/* AI 튜터 버튼 - 오른쪽 하단 플로팅, 맵 사이드바에 따라 위치 조정 */}
      {!aiSidebarOpen && (
        <div
          className='fixed bottom-8 z-50 transition-all duration-300'
          style={{ right: `${getAiButtonRightPosition()}px` }}
        >
          <Button
            onClick={handleAiSidebarToggle}
            className='w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200 border-0'
          >
            <div className='flex flex-col items-center justify-center'>
              {/* AI 아이콘 */}
              <svg
                className='w-6 h-6 mb-0.5'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
              >
                <path d='M12 2L2 7l10 5 10-5-10-5z' />
                <path d='M2 17l10 5 10-5' />
                <path d='M2 12l10 5 10-5' />
              </svg>
              <span className='text-xs font-medium'>AI</span>
            </div>
          </Button>
        </div>
      )}

      {/* AI 튜터 사이드바 - 오른쪽 */}
      <div
        className={`${
          isDarkMode ? 'bg-[#121214]' : 'bg-white'
        } transition-all duration-300 flex-shrink-0 relative border-l ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        } h-screen ${aiSidebarOpen ? '' : 'w-0 overflow-hidden'}`}
        style={aiSidebarOpen ? { width: `${aiSidebarWidth}px` } : {}}
      >
        <div className='flex flex-col h-full'>
          {/* AI 사이드바 헤더 - PDF 헤더 높이와 동일하게 */}
          <div
            className={`border-b ${
              isDarkMode ? 'border-gray-700' : 'border-gray-200'
            } flex-shrink-0 h-16`}
          >
            {/* 상단 닫기 버튼 - PDF 헤더와 동일한 높이 및 패딩 */}
            <div className='flex justify-end items-center h-full p-4'>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => setAiSidebarOpen(false)}
                className={`${
                  isDarkMode
                    ? 'text-[#efefef] hover:bg-gray-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <X size={16} />
              </Button>
            </div>
          </div>

          {/* 채팅 기능만 유지 */}
          <div className='flex flex-col flex-1 min-h-0'>
            {/* 채팅 히스토리 - 고정 높이와 스크롤 */}
            <div className='flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 min-h-0'>
              {chatHistory.map((chat) => (
                <div
                  key={chat.id}
                  className={`flex ${
                    chat.type === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-lg ${
                      chat.type === 'user'
                        ? 'bg-blue-500 text-white'
                        : isDarkMode
                        ? 'bg-gray-700 text-white'
                        : 'bg-gray-200 text-gray-900'
                    }`}
                  >
                    {chat.type === 'ai' ? (
                      <div className='text-sm leading-relaxed'>
                        <HtmlRenderer
                          html={markdownToHtml(chat.message)}
                          isDarkMode={isDarkMode}
                        />
                      </div>
                    ) : (
                      <p className='text-sm leading-relaxed'>{chat.message}</p>
                    )}
                  </div>
                </div>
              ))}
              {/* 자동 스크롤을 위한 끝점 */}
              <div ref={chatMessagesEndRef} />
            </div>

            {/* 컨텍스트 액션 버튼들 - 컨텍스트 UI 바로 위 */}
            {questionContext && (
              <div className='flex-shrink-0 p-3'>
                <div className='flex gap-2 mb-3'>
                  <Button
                    size='sm'
                    onClick={() => handleContextAction('explain')}
                    className={`h-8 px-4 text-sm border ${
                      isDarkMode
                        ? 'border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white bg-transparent'
                        : 'border-blue-500 text-blue-600 hover:bg-blue-500 hover:text-white bg-transparent'
                    } transition-all duration-200`}
                  >
                    설명해줘
                  </Button>
                  <Button
                    size='sm'
                    onClick={() => handleContextAction('summarize')}
                    className={`h-8 px-4 text-sm border ${
                      isDarkMode
                        ? 'border-green-500 text-green-400 hover:bg-green-500 hover:text-white bg-transparent'
                        : 'border-green-500 text-green-600 hover:bg-green-500 hover:text-white bg-transparent'
                    } transition-all duration-200`}
                  >
                    요약해줘
                  </Button>
                </div>
              </div>
            )}

            {/* 질문 컨텍스트 표시 - 채팅창 바로 위 */}
            {questionContext && (
              <div
                className={`p-3 border-t ${
                  isDarkMode
                    ? 'border-gray-700 bg-gray-800'
                    : 'border-gray-200 bg-blue-50'
                } flex-shrink-0`}
              >
                <div className='flex items-center justify-between'>
                  <div className='flex-1 min-w-0'>
                    <div
                      className={`text-xs ${
                        isDarkMode ? 'text-gray-400' : 'text-blue-600'
                      } mb-1`}
                    >
                      {questionContext.pageNumber}페이지에서 선택된 텍스트
                    </div>
                    <div
                      className={`text-sm ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      } truncate`}
                    >
                      "{questionContext.text}"
                    </div>
                  </div>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => setQuestionContext(null)}
                    className={`ml-2 h-6 w-6 p-0 ${
                      isDarkMode
                        ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <X size={14} />
                  </Button>
                </div>
              </div>
            )}

            {/* 메시지 입력 - 고정 */}
            <div
              className={`p-4 border-t ${
                isDarkMode ? 'border-gray-700' : 'border-gray-200'
              } flex-shrink-0`}
            >
              <div className='flex gap-2'>
                <Input
                  type='text'
                  placeholder={
                    questionContext
                      ? '선택된 텍스트에 대해 질문하세요...'
                      : 'AI 튜터에게 질문하세요...'
                  }
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendAiMessage();
                    }
                  }}
                  className={`flex-1 ${
                    isDarkMode
                      ? 'bg-[#3e3b3b] border-gray-600 text-[#efefef] placeholder:text-gray-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-500'
                  }`}
                />
                <Button
                  onClick={handleSendAiMessage}
                  disabled={!inputMessage.trim()}
                  className='bg-blue-500 hover:bg-blue-600 text-white'
                >
                  전송
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* AI 사이드바 리사이즈 핸들 */}
        {aiSidebarOpen && (
          <div
            className='absolute left-0 top-0 w-1 h-full cursor-ew-resize bg-transparent hover:bg-gray-500 hover:bg-opacity-50 transition-colors group'
            onMouseDown={handleMouseDownResize}
          >
            <div className='absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-gray-500 opacity-0 group-hover:opacity-100 transition-opacity'></div>
          </div>
        )}
      </div>
    </div>
  );
}
