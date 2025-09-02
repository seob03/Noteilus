import React, { useEffect, useRef } from 'react';

interface LatexRendererProps {
  math: string;
  display?: boolean;
  isDarkMode?: boolean;
}

export const LatexRenderer: React.FC<LatexRendererProps> = ({ math, display = false, isDarkMode = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const renderMath = () => {
      if (!containerRef.current) return;

      // math prop이 문자열이 아닌 경우 안전하게 처리
      const mathString = typeof math === 'string' ? math : String(math);

      try {
        const katex = (window as any).katex;
        
        if (!katex) {
          console.warn('KaTeX가 로드되지 않았습니다.');
          // 폴백: 원본 텍스트 표시
          containerRef.current.innerHTML = `<span style="color: ${isDarkMode ? '#ff6b6b' : '#cc0000'}; font-family: monospace;">${mathString}</span>`;
          return;
        }

        // 컨테이너 초기화
        containerRef.current.innerHTML = '';
        
        if (display) {
          // 블록 수식
          const blockElement = document.createElement('div');
          blockElement.style.textAlign = 'center';
          blockElement.style.margin = '1rem 0';
          blockElement.style.fontSize = '1.1em';
          blockElement.style.fontWeight = '500';
          
          try {
            katex.render(mathString, blockElement, {
              displayMode: true,
              throwOnError: false,
              errorColor: '#cc0000',
              strict: false,
              trust: true
            });
          } catch (katexError) {
            console.warn('KaTeX 렌더링 실패, 폴백 처리:', katexError);
            blockElement.innerHTML = `<span style="color: ${isDarkMode ? '#ff6b6b' : '#cc0000'}; font-family: 'Courier New', monospace; font-size: 0.9em;">$${mathString}$</span>`;
          }
          
          containerRef.current.appendChild(blockElement);
        } else {
          // 인라인 수식
          const inlineElement = document.createElement('span');
          
          try {
            katex.render(mathString, inlineElement, {
              displayMode: false,
              throwOnError: false,
              errorColor: '#cc0000',
              strict: false,
              trust: true
            });
          } catch (katexError) {
            console.warn('KaTeX 인라인 렌더링 실패, 폴백 처리:', katexError);
            inlineElement.innerHTML = `<span style="color: ${isDarkMode ? '#ff6b6b' : '#cc0000'}; font-family: 'Courier New', monospace; font-size: 0.9em;">$${mathString}$</span>`;
          }
          
          containerRef.current.appendChild(inlineElement);
        }
      } catch (error) {
        console.error('KaTeX 렌더링 오류:', error);
        // 폴백: 원본 텍스트 표시 (더 안전한 처리)
        containerRef.current.innerHTML = `<span style="color: ${isDarkMode ? '#ff6b6b' : '#cc0000'}; font-family: 'Courier New', monospace; font-size: 0.9em;">$${mathString}$</span>`;
      }
    };

    // KaTeX가 로드될 때까지 대기
    if ((window as any).katex) {
      renderMath();
    } else {
      // KaTeX 로드 대기
      const checkKatex = () => {
        if ((window as any).katex) {
          renderMath();
        } else {
          setTimeout(checkKatex, 100);
        }
      };
      checkKatex();
    }
  }, [math, display, isDarkMode]);

  // math prop이 문자열이 아닌 경우를 위한 안전한 렌더링
  const mathString = typeof math === 'string' ? math : String(math);

  return (
    <div 
      ref={containerRef}
      className={`${isDarkMode ? 'text-gray-200' : 'text-gray-800'} ${display ? 'my-4' : 'inline'}`}
      // KaTeX가 로드되지 않은 경우를 위한 기본 텍스트
      data-math={mathString}
    />
  );
};
