import React, { useEffect, useRef } from 'react';
import { LatexRenderer } from './latex-renderer';

interface HtmlRendererProps {
  html: string;
  isDarkMode?: boolean;
}

export const HtmlRenderer: React.FC<HtmlRendererProps> = ({ html, isDarkMode = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // HTML을 안전하게 렌더링
    containerRef.current.innerHTML = html;

    // CSS 스타일 적용
    const style = document.createElement('style');
    style.textContent = `
      .html-content {
        color: ${isDarkMode ? '#d1d5db' : '#374151'};
        line-height: 1.7;
      }
      
      .html-content h1 {
        color: ${isDarkMode ? '#ffffff' : '#111827'};
        font-size: 1.5rem;
        font-weight: bold;
        margin-bottom: 1rem;
        margin-top: 1.5rem;
        background: linear-gradient(to right, ${isDarkMode ? '#60a5fa' : '#2563eb'}, ${isDarkMode ? '#a78bfa' : '#7c3aed'});
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      
      .html-content h2 {
        color: ${isDarkMode ? '#93c5fd' : '#1d4ed8'};
        font-size: 1.25rem;
        font-weight: 600;
        margin-bottom: 0.75rem;
        margin-top: 1.25rem;
      }
      
      .html-content h3 {
        color: ${isDarkMode ? '#bfdbfe' : '#2563eb'};
        font-size: 1.125rem;
        font-weight: 500;
        margin-bottom: 0.5rem;
        margin-top: 1rem;
      }
      
      .html-content p {
        color: ${isDarkMode ? '#d1d5db' : '#374151'};
        margin-bottom: 0.75rem;
        line-height: 1.75;
      }
      
      .html-content ul {
        color: ${isDarkMode ? '#d1d5db' : '#374151'};
        list-style-type: disc;
        list-style-position: inside;
        margin-bottom: 0.75rem;
        margin-left: 1rem;
      }
      
      .html-content ol {
        color: ${isDarkMode ? '#d1d5db' : '#374151'};
        list-style-type: decimal;
        list-style-position: inside;
        margin-bottom: 0.75rem;
        margin-left: 1rem;
      }
      
      .html-content li {
        color: ${isDarkMode ? '#d1d5db' : '#374151'};
        margin-bottom: 0.25rem;
      }
      
      .html-content strong {
        color: ${isDarkMode ? '#fde047' : '#a16207'};
        font-weight: 600;
      }
      
      .html-content em {
        color: ${isDarkMode ? '#e5e7eb' : '#6b7280'};
        font-style: italic;
      }
      
      .html-content code {
        background-color: ${isDarkMode ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff'};
        color: ${isDarkMode ? '#93c5fd' : '#1e40af'};
        padding: 0.125rem 0.25rem;
        border-radius: 0.375rem;
        font-size: 0.75rem;
        font-family: monospace;
        border: 1px solid ${isDarkMode ? '#1e40af' : '#dbeafe'};
      }
      
      .html-content pre {
        background-color: ${isDarkMode ? '#374151' : '#f3f4f6'};
        color: ${isDarkMode ? '#e5e7eb' : '#1f2937'};
        padding: 1rem;
        border-radius: 0.5rem;
        font-size: 0.75rem;
        font-family: monospace;
        overflow-x: auto;
        margin-bottom: 0.75rem;
        border: 1px solid ${isDarkMode ? '#4b5563' : '#d1d5db'};
      }
      
      .html-content blockquote {
        border-left: 4px solid ${isDarkMode ? '#3b82f6' : '#dbeafe'};
        color: ${isDarkMode ? '#d1d5db' : '#6b7280'};
        background-color: ${isDarkMode ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff'};
        padding: 0.5rem 1rem;
        font-style: italic;
        margin-bottom: 0.75rem;
        border-radius: 0 0.5rem 0.5rem 0;
      }
      
      .html-content table {
        border-collapse: collapse;
        border: 1px solid ${isDarkMode ? '#4b5563' : '#d1d5db'};
        width: 100%;
        margin-bottom: 1rem;
      }
      
      .html-content thead {
        background-color: ${isDarkMode ? '#374151' : '#f3f4f6'};
      }
      
      .html-content tbody {
        background-color: transparent;
      }
      
      .html-content tr {
        border: 1px solid ${isDarkMode ? '#4b5563' : '#d1d5db'};
      }
      
      .html-content tr:hover {
        background-color: ${isDarkMode ? 'rgba(55, 65, 81, 0.5)' : '#f9fafb'};
      }
      
      .html-content th {
        border: 1px solid ${isDarkMode ? '#4b5563' : '#d1d5db'};
        color: ${isDarkMode ? '#ffffff' : '#111827'};
        background-color: ${isDarkMode ? '#374151' : '#f3f4f6'};
        padding: 0.5rem 0.75rem;
        text-align: left;
        font-weight: 600;
        font-size: 0.875rem;
      }
      
      .html-content td {
        border: 1px solid ${isDarkMode ? '#4b5563' : '#d1d5db'};
        color: ${isDarkMode ? '#d1d5db' : '#374151'};
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
      }
    `;
    
    // 기존 스타일 제거
    const existingStyle = document.querySelector('style[data-html-renderer]');
    if (existingStyle) {
      existingStyle.remove();
    }
    
    // 새 스타일 추가
    style.setAttribute('data-html-renderer', 'true');
    document.head.appendChild(style);

    // LaTeX 수식 처리
    const processLatexElements = () => {
      const mathDisplayElements = containerRef.current?.querySelectorAll('.math-display');
      const mathInlineElements = containerRef.current?.querySelectorAll('.math-inline');

      // 블록 수식 처리
      mathDisplayElements?.forEach((element) => {
        const mathContent = element.textContent || '';
        if (mathContent.startsWith('$$') && mathContent.endsWith('$$')) {
          const math = mathContent.slice(2, -2);
          const latexElement = document.createElement('div');
          latexElement.className = 'my-4 flex justify-center';
          
          // React 컴포넌트를 DOM에 렌더링하기 위해 임시 처리
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = `<span class="latex-display" data-math="${encodeURIComponent(math)}" data-display="true"></span>`;
          latexElement.appendChild(tempDiv.firstChild!);
          
          element.replaceWith(latexElement);
        }
      });

      // 인라인 수식 처리
      mathInlineElements?.forEach((element) => {
        const mathContent = element.textContent || '';
        if (mathContent.startsWith('$') && mathContent.endsWith('$')) {
          const math = mathContent.slice(1, -1);
          const latexElement = document.createElement('span');
          latexElement.className = 'latex-inline';
          latexElement.setAttribute('data-math', math);
          latexElement.setAttribute('data-display', 'false');
          
          element.replaceWith(latexElement);
        }
      });

      // LaTeX 요소들을 실제로 렌더링
      const latexElements = containerRef.current?.querySelectorAll('[data-math]');
      latexElements?.forEach((element) => {
        const math = element.getAttribute('data-math');
        const display = element.getAttribute('data-display') === 'true';
        
        if (math) {
          const decodedMath = decodeURIComponent(math);
          const katex = (window as any).katex;
          
          if (katex) {
            try {
              katex.render(decodedMath, element as HTMLElement, {
                displayMode: display,
                throwOnError: false,
                errorColor: '#cc0000'
              });
            } catch (error) {
              console.error('KaTeX 렌더링 오류:', error);
              element.innerHTML = `<span style="color: ${isDarkMode ? '#ff6b6b' : '#cc0000'}; font-family: monospace;">${decodedMath}</span>`;
            }
          } else {
            element.innerHTML = `<span style="color: ${isDarkMode ? '#ff6b6b' : '#cc0000'}; font-family: monospace;">${decodedMath}</span>`;
          }
        }
      });
    };

    // DOM이 업데이트된 후 LaTeX 처리
    setTimeout(processLatexElements, 0);

    // 클린업 함수
    return () => {
      const styleToRemove = document.querySelector('style[data-html-renderer]');
      if (styleToRemove) {
        styleToRemove.remove();
      }
    };
  }, [html, isDarkMode]);

  return (
    <div 
      ref={containerRef}
      className="html-content"
      style={{
        color: isDarkMode ? '#d1d5db' : '#374151',
        lineHeight: '1.7'
      }}
    />
  );
};
