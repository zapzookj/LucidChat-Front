/**
 * [Phase 5.5-Perf] SSE 스트리밍 채팅 클라이언트
 * [Phase 5.5-EV]  이벤트 시스템 강화:
 *   - sendEventSelectStream(): 이벤트 선택 → 디렉터 모드 SSE
 *   - sendDirectorWatchStream(): 👀 계속 지켜보기 SSE
 *   - sendTimeSkipStream(): 시간 넘기기 SSE
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1'; // 백엔드 주소

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  1. 일반 채팅 메시지 (기존)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
//  5. [Phase 5.5-Director] 디렉터 Directive 확인 (Peek)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 
/**
 * 대기 중인 Directive를 확인한다 (소비하지 않음).
 * 유저가 메시지를 보내려 할 때, 먼저 이 함수를 호출하여
 * 디렉터 인터루드가 대기 중인지 확인.
 *
 * @returns {DirectorDirective|null} Directive가 있으면 JSON, 없으면 null
 */
export async function peekDirectorDirective(roomId) {
  // const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';
  const token = localStorage.getItem('accessToken');
 
  try {
    const res = await fetch(`${BASE_URL}/story/rooms/${roomId}/director/peek`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
 
    if (res.status === 204) return null; // No directive
    if (!res.ok) return null;
 
    return await res.json();
  } catch (err) {
    console.warn('[Director] Peek failed:', err);
    return null;
  }
}
 
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  6. [Phase 5.5-Director] 디렉터 Directive 소비 + 적용
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 
/**
 * Directive를 소비하고 ChatRoom에 적용한다.
 * 프론트에서 인터루드 나레이션을 유저에게 보여준 뒤 호출.
 *
 * @returns {DirectorDirective|null} 소비된 Directive 또는 null (이미 소비/만료)
 */
export async function consumeDirectorDirective(roomId) {
  // const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';
  const token = localStorage.getItem('accessToken');
 
  try {
    const res = await fetch(`${BASE_URL}/story/rooms/${roomId}/director/consume`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
 
    if (res.status === 404) return null;
    if (!res.ok) return null;
 
    return await res.json();
  } catch (err) {
    console.warn('[Director] Consume failed:', err);
    return null;
  }
}
 
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  7. [Phase 5.5-Director] 유저 수동 디렉터 호출
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 
/**
 * 유저가 직접 디렉터에게 개입을 요청한다.
 * 기존 "이벤트 트리거" 버튼의 대체.
 *
 * @returns {DirectorDirective} PASS일 수 있음 → 프론트에서 분기 처리 필요
 */
export async function requestDirectorIntervention(roomId) {
  // const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';
  const token = localStorage.getItem('accessToken');
 
  try {
    const res = await fetch(`${BASE_URL}/story/rooms/${roomId}/director/request`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
 
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
 
    return await res.json();
  } catch (err) {
    console.error('[Director] Request failed:', err);
    throw err;
  }
}
 
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  8. [Phase 5.5-Director] BRANCH 선택 → SSE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 
export async function sendDirectorBranchStream(roomId, detail, energyCost, callbacks, abortController) {
  // const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';
  const url = `${BASE_URL}/story/rooms/${roomId}/director/apply-branch`;
  return _ssePost(url, { detail, energyCost }, callbacks, abortController);
}
 
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  9. [Phase 5.5-Director] TRANSITION 적용 → SSE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 
export async function sendDirectorTransitionStream(roomId, callbacks, abortController) {
  // const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';
  const url = `${BASE_URL}/story/rooms/${roomId}/director/apply-transition`;
  return _ssePost(url, {}, callbacks, abortController);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  10. [v3] 투명 디렉터 자동 응답 → SSE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function sendAutoDirectorResponse(roomId, directiveType, eventContext, callbacks, abortController) {
  const url = `${BASE_URL}/story/rooms/${roomId}/director/auto-respond`;
  return _ssePost(url, { directiveType, eventContext: eventContext || null }, callbacks, abortController);
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
    // [Phase6/Tier4 / H-25] reader try-finally cleanup. 컴포넌트 unmount/abort/예외 등으로
    //   while 루프를 빠져나갈 때 reader.cancel()로 underlying 스트림을 명시 해제 →
    //   브라우저의 HTTP 커넥션 + ReadableStream 자원 누수 차단.
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
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
            case 'event_meta':
              try {
                  const meta = JSON.parse(parsed.data);
                  callbacks.onEventMeta?.(meta);
              } catch (e) {
                  console.warn('[SSE] event_meta parse error:', e);
              }
              break;
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
    } finally {
      try { await reader.cancel(); } catch { /* ignore — already closed */ }
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

// [Phase6/Tier3 / H-24] SSE 흐름의 refresh도 single-flight.
//   여러 SSE 호출이 동시에 401을 받아도 한 번의 /auth/refresh 호출로 합쳐진다.
//   axios.js의 refreshOnce와는 별도 트랙(fetch 기반)이지만 동일 패턴.
let _sseRefreshPromise = null;

async function tryRefreshToken() {
  if (!_sseRefreshPromise) {
    _sseRefreshPromise = (async () => {
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
    })().finally(() => { _sseRefreshPromise = null; });
  }
  return _sseRefreshPromise;
}

export default sendMessageStream;