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

      try {
        const katex = (window as any).katex;
        
        if (!katex) {
          console.warn('KaTeX가 로드되지 않았습니다.');
          // 폴백: 원본 텍스트 표시
          containerRef.current.innerHTML = `<span style="color: ${isDarkMode ? '#ff6b6b' : '#cc0000'}; font-family: monospace;">${math}</span>`;
          return;
        }

        // 컨테이너 초기화
        containerRef.current.innerHTML = '';
        
        if (display) {
          // 블록 수식
          const blockElement = document.createElement('div');
          blockElement.style.textAlign = 'center';
          blockElement.style.margin = '1rem 0';
          katex.render(math, blockElement, {
            displayMode: true,
            throwOnError: false,
            errorColor: '#cc0000'
          });
          containerRef.current.appendChild(blockElement);
        } else {
          // 인라인 수식
          const inlineElement = document.createElement('span');
          katex.render(math, inlineElement, {
            displayMode: false,
            throwOnError: false,
            errorColor: '#cc0000'
          });
          containerRef.current.appendChild(inlineElement);
        }
      } catch (error) {
        console.error('KaTeX 렌더링 오류:', error);
        // 폴백: 원본 텍스트 표시
        containerRef.current.innerHTML = `<span style="color: ${isDarkMode ? '#ff6b6b' : '#cc0000'}; font-family: monospace;">${math}</span>`;
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

  return (
    <div 
      ref={containerRef}
      className={`${isDarkMode ? 'text-gray-200' : 'text-gray-800'} ${display ? 'my-4' : 'inline'}`}
    />
  );
};
