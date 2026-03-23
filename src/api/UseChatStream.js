/**
 * [Phase 5.5-Perf] SSE 스트리밍 채팅 클라이언트
 * [Phase 5.5-EV]  이벤트 시스템 강화:
 *   - sendEventSelectStream(): 이벤트 선택 → 디렉터 모드 SSE
 *   - sendDirectorWatchStream(): 👀 계속 지켜보기 SSE
 *   - sendTimeSkipStream(): 시간 넘기기 SSE
 */

const BASE_URL = 'http://localhost:8080/api/v1';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  1. 일반 채팅 메시지 (기존)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function sendMessageStream(roomId, message, callbacks, abortController) {
  const url = `${BASE_URL}/chat/rooms/${roomId}/messages/stream`;
  return _ssePost(url, { roomId, message }, callbacks, abortController);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  2. [Phase 5.5-EV] 이벤트 선택 → 디렉터 모드 SSE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function sendEventSelectStream(roomId, detail, energyCost, callbacks, abortController) {
  const url = `${BASE_URL}/story/rooms/${roomId}/events/select`;
  return _ssePost(url, { detail, energyCost }, callbacks, abortController);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  3. [Phase 5.5-EV] 👀 계속 지켜보기 SSE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function sendDirectorWatchStream(roomId, callbacks, abortController) {
  const url = `${BASE_URL}/story/rooms/${roomId}/events/watch`;
  return _ssePost(url, {}, callbacks, abortController);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  4. [Phase 5.5-EV] 시간 넘기기 SSE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function sendTimeSkipStream(roomId, callbacks, abortController) {
  const url = `${BASE_URL}/story/rooms/${roomId}/time-skip`;
  return _ssePost(url, {}, callbacks, abortController);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  공통 SSE POST 호출
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function _ssePost(url, body, callbacks, abortController) {
  const token = localStorage.getItem('accessToken');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(body),
      credentials: 'include',
      signal: abortController?.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      if (response.status === 401) {
        const refreshed = await tryRefreshToken();
        if (refreshed) {
          return _ssePost(url, body, callbacks, abortController);
        }
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
      const events = buffer.split('\n\n');
      buffer = events.pop();

      for (const eventBlock of events) {
        if (!eventBlock.trim()) continue;
        const parsed = parseSseEvent(eventBlock);
        if (!parsed) continue;

        switch (parsed.event) {
          case 'first_scene':
            try { callbacks.onFirstScene?.(JSON.parse(parsed.data)); }
            catch (e) { console.warn('[SSE] first_scene parse error:', e); }
            break;
          case 'final_result':
            try { callbacks.onFinalResult?.(JSON.parse(parsed.data)); }
            catch (e) { console.warn('[SSE] final_result parse error:', e); }
            break;
          case 'error':
            try { callbacks.onError?.(JSON.parse(parsed.data)); }
            catch (e) { callbacks.onError?.({ errorCode: 'PARSE_ERROR', message: parsed.data }); }
            break;
          default:
            break;
        }
      }
    }

    // 마지막 버퍼 처리
    if (buffer.trim()) {
      const parsed = parseSseEvent(buffer);
      if (parsed?.event === 'final_result') {
        try { callbacks.onFinalResult?.(JSON.parse(parsed.data)); }
        catch (e) { /* ignore */ }
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  유틸
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function parseSseEvent(block) {
  const lines = block.split('\n');
  let event = 'message';
  let dataLines = [];

  for (const line of lines) {
    if (line.startsWith('event:')) event = line.substring(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.substring(5).trim());
  }

  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join('\n') };
}

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