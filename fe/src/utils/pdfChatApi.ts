// PDF 채팅 API 유틸리티 함수

export interface ChatRequest {
  pdfId: string;
  question: string;
  selectedText?: string;
}

export class PdfChatApi {
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  /**
   * PDF 기반 채팅 (스트림 방식)
   * @param request 채팅 요청 데이터
   * @param onChunk 스트림 데이터를 받을 콜백 함수
   * @param onComplete 완료 시 콜백 함수
   * @param onError 에러 시 콜백 함수
   */
  async chatWithPdf(
    request: ChatRequest,
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: string) => void
  ): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/pdfs/${request.pdfId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: request.question,
          selectedText: request.selectedText
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        onError(errorData.error || '채팅 요청에 실패했습니다.');
        return;
      }

      // 스트림 데이터 읽기
      const reader = response.body?.getReader();
      if (!reader) {
        onError('스트림을 읽을 수 없습니다.');
        return;
      }

      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            onComplete();
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          onChunk(chunk);
        }
      } finally {
        reader.releaseLock();
      }

    } catch (error) {
      console.error('PDF 채팅 에러:', error);
      onError('네트워크 오류가 발생했습니다.');
    }
  }
}

// 사용 예시:
/*
const chatApi = new PdfChatApi();

// PDF에서 텍스트를 드래그하고 질문 버튼을 눌렀을 때
const handleQuestion = async (pdfId: string, selectedText: string, question: string) => {
  const chatContainer = document.getElementById('chat-response');
  if (chatContainer) {
    chatContainer.innerHTML = ''; // 기존 내용 초기화
  }

  await chatApi.chatWithPdf(
    { pdfId, question, selectedText },
    (chunk) => {
      // 실시간으로 텍스트 추가
      if (chatContainer) {
        chatContainer.textContent += chunk;
      }
    },
    () => {
    },
    (error) => {
      console.error('에러:', error);
      if (chatContainer) {
        chatContainer.textContent = `에러: ${error}`;
      }
    }
  );
};
*/
