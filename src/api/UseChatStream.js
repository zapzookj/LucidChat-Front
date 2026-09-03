/**
 * [Phase 5.5-Perf] SSE 스트리밍 채팅 클라이언트
 * [Phase 5.5-EV]  이벤트 시스템 강화:
 *   - sendDirectorWatchStream(): 👀 계속 지켜보기 SSE
 *   - sendTimeSkipStream(): 시간 넘기기 SSE
 */

import { API_BASE_URL, refreshAccessToken } from './refreshLock';

const BASE_URL = API_BASE_URL; // 백엔드 주소 (상수 정의는 refreshLock.js로 일원화)

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
 
 
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  9. [Phase 5.5-Director] TRANSITION 적용 → SSE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  10. [v3] 투명 디렉터 자동 응답 → SSE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function sendAutoDirectorResponse(roomId, directiveType, eventContext, callbacks, abortController, chosenIndex = null) {
  const url = `${BASE_URL}/story/rooms/${roomId}/director/auto-respond`;
  // [블록 D · §G-13] chosenIndex — 서버가 캐싱해 둔 가격표로 비용을 재판정한다.
  //   클라이언트가 보내던 energyCost는 더 이상 신뢰되지 않는다(docs/13 P0).
  return _ssePost(url, { directiveType, eventContext: eventContext || null, chosenIndex }, callbacks, abortController);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  공통 SSE POST 호출
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function _ssePost(url, body, callbacks, abortController, _retried = false) {
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
        // [E-1.2] 재시도는 1회로 제한한다 — 갱신은 됐는데 서버가 계속 401이면
        //   (권한 변경·계정 정지 등) 이 재귀가 무한 루프가 된다.
        const newToken = _retried ? null : await refreshAccessToken();
        if (newToken) {
          return _ssePost(url, body, callbacks, abortController, true);
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

// [Phase6/Tier3 / H-24 → E-1.2] SSE 흐름의 refresh single-flight를 이 파일이 따로 들고 있었다.
//   axios.js도 자기 뮤텍스를 들고 있어서, API 요청과 SSE가 같은 순간 401을 받으면
//   /auth/refresh가 두 번 나가고 RT rotation 뒤 늦은 쪽이 폐기된 RT를 제시 →
//   서버가 재사용(탈취)으로 보고 전 세션을 끊었다. 뮤텍스를 refreshLock.js 하나로 합쳤다.

export default sendMessageStream;