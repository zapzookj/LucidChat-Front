/**
 * [Phase 5.5-Perf] SSE 스트리밍 채팅 클라이언트
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  fetch + ReadableStream 기반 SSE 파싱
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * [EventSource를 안 쓰는 이유]
 *   - EventSource는 GET만 지원 (우리는 POST + JSON body 필요)
 *   - 커스텀 헤더(Authorization) 불가
 *
 * [SSE 이벤트 포맷]
 *   event: first_scene
 *   data: { "narration": "...", "dialogue": "...", "emotion": "JOY" }
 *
 *   event: final_result
 *   data: { "roomId": 1, "scenes": [...], "stats": {...}, ... }
 *
 *   event: error
 *   data: { "errorCode": "CONTENT_BLOCKED", "message": "..." }
 */

const BASE_URL = 'http://localhost:8080/api/v1';

/**
 * SSE 스트리밍으로 채팅 메시지 전송
 *
 * @param {number} roomId - 채팅방 ID
 * @param {string} message - 유저 메시지
 * @param {Object} callbacks - 이벤트 콜백
 * @param {Function} callbacks.onFirstScene  - 첫 번째 씬 도착 시 (SceneResponse)
 * @param {Function} callbacks.onFinalResult - 전체 결과 도착 시 (SendChatResponse)
 * @param {Function} callbacks.onError       - 에러 발생 시 ({ errorCode, message })
 * @param {AbortController} [abortController] - 요청 취소용
 * @returns {Promise<void>}
 */
export async function sendMessageStream(roomId, message, callbacks, abortController) {
  const token = localStorage.getItem('accessToken');
  const url = `${BASE_URL}/chat/rooms/${roomId}/messages/stream`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({ roomId, message }),
      credentials: 'include',
      signal: abortController?.signal,
    });

    // HTTP 에러 처리
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      // 401: 토큰 갱신 시도
      if (response.status === 401) {
        const refreshed = await tryRefreshToken();
        if (refreshed) {
          // 재시도
          return sendMessageStream(roomId, message, callbacks, abortController);
        }
        // 갱신 실패 → 로그아웃
        window.location.href = '/login';
        return;
      }

      callbacks.onError?.({
        errorCode: errorData.errorCode || `HTTP_${response.status}`,
        message: errorData.message || `서버 오류 (${response.status})`,
        status: response.status,
      });
      return;
    }

    // ── SSE 스트림 파싱 ──
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE 이벤트는 \n\n 으로 구분
      const events = buffer.split('\n\n');
      buffer = events.pop(); // 마지막 미완성 조각은 버퍼에 유지

      for (const eventBlock of events) {
        if (!eventBlock.trim()) continue;

        const parsed = parseSseEvent(eventBlock);
        if (!parsed) continue;

        switch (parsed.event) {
          case 'first_scene':
            try {
              const scene = JSON.parse(parsed.data);
              callbacks.onFirstScene?.(scene);
            } catch (e) {
              console.warn('[SSE] first_scene parse error:', e);
            }
            break;

          case 'final_result':
            try {
              const result = JSON.parse(parsed.data);
              callbacks.onFinalResult?.(result);
            } catch (e) {
              console.warn('[SSE] final_result parse error:', e);
            }
            break;

          case 'error':
            try {
              const error = JSON.parse(parsed.data);
              callbacks.onError?.(error);
            } catch (e) {
              callbacks.onError?.({ errorCode: 'PARSE_ERROR', message: parsed.data });
            }
            break;

          default:
            // 기본 data-only 이벤트 (이벤트 이름 없음)
            break;
        }
      }
    }

    // 마지막 버퍼 처리
    if (buffer.trim()) {
      const parsed = parseSseEvent(buffer);
      if (parsed) {
        if (parsed.event === 'final_result') {
          try {
            callbacks.onFinalResult?.(JSON.parse(parsed.data));
          } catch (e) { /* ignore */ }
        }
      }
    }

  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('[SSE] Request aborted');
      return;
    }
    console.error('[SSE] Stream error:', err);
    callbacks.onError?.({
      errorCode: 'NETWORK_ERROR',
      message: '네트워크 오류가 발생했습니다.',
    });
  }
}

/**
 * SSE 이벤트 블록 파싱
 *
 * 입력:
 *   "event: first_scene\ndata: {...json...}"
 *
 * 출력:
 *   { event: "first_scene", data: "{...json...}" }
 */
function parseSseEvent(block) {
  const lines = block.split('\n');
  let event = 'message'; // 기본 이벤트 이름
  let dataLines = [];

  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.substring(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.substring(5).trim());
    }
    // id:, retry: 등은 무시
  }

  if (dataLines.length === 0) return null;

  return {
    event,
    data: dataLines.join('\n'),
  };
}

/**
 * 토큰 갱신 시도 (axios 인터셉터와 동일 로직)
 */
async function tryRefreshToken() {
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) return false;

    const data = await res.json();
    if (data.accessToken) {
      localStorage.setItem('accessToken', data.accessToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export default sendMessageStream;