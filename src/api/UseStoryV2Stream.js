import { getStoryV2StreamUrl, getStoryV2OpeningStreamUrl } from "./StoryV2Api";

// const BASE_URL = import.meta.env.VITE_API_BASE_URL;
const BASE_URL = 'http://localhost:8080/api/v1';

/**
 * [Story V2] V2 메시지/액션 SSE 스트림 클라이언트.
 *
 * 4종 액션 UI 통합 처리:
 *   - 일반 채팅:        sendV2Message(roomId, message, null, callbacks)
 *   - 장소 이동:        sendV2Action(roomId, "MOVE", {toLocationKey: "GARDEN"}, callbacks)
 *   - 시간 넘기기:      sendV2Action(roomId, "TIME_ADVANCE", null, callbacks)
 *   - 다음 씬:          sendV2Action(roomId, "NEXT_SCENE", null, callbacks)
 *
 * <p>SSE 이벤트 (V1과 동일):
 *   - first_scene  → 첫 씬 즉시 노출 (4~5 씬 중 1번째)
 *   - final_result → 전체 응답 (모든 씬 + system_updates + 알림 등)
 *   - error        → 백엔드 에러
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  공개 API — 일반 채팅 / 액션
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 일반 자연어 메시지 전송.
 *
 * @param {number} roomId
 * @param {string} message
 * @param {object} callbacks  {onFirstScene, onFinalResult, onError}
 * @param {AbortController} abortController
 */
export async function sendV2Message(roomId, message, callbacks, abortController) {
  return _ssePostV2(getStoryV2StreamUrl(roomId), {
    message,
    actionType: null,
    actionPayload: null,
  }, callbacks, abortController);
}

/**
 * 액션 전송 — 4종 액션 UI.
 *
 * @param {number} roomId
 * @param {"MOVE"|"TIME_ADVANCE"|"NEXT_SCENE"} actionType
 * @param {object|null} actionPayload  MOVE만 사용 — {toLocationKey: "..."}
 * @param {object} callbacks
 * @param {AbortController} abortController
 */
export async function sendV2Action(roomId, actionType, actionPayload, callbacks, abortController) {
  return _ssePostV2(getStoryV2StreamUrl(roomId), {
    message: null,
    actionType,
    actionPayload,
  }, callbacks, abortController);
}

/**
 * [E-3 C-1] 오프닝 스트림 — 방 첫 진입 시 자동 1회 호출.
 * 유저 입력 없이 디렉터가 도입 장면을 생성해 first_scene/final_result로 스트리밍한다.
 * body는 비어 있다(엔드포인트가 무시). 백엔드가 멱등(이미 로그 존재 시 빈 완료)이라 중복 발사에 안전.
 *
 * @param {number} roomId
 * @param {object} callbacks  {onFirstScene, onFinalResult, onError}
 * @param {AbortController} abortController
 */
export async function sendV2Opening(roomId, callbacks, abortController) {
  return _ssePostV2(getStoryV2OpeningStreamUrl(roomId), {}, callbacks, abortController);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  내부 — SSE POST 핸들러 (V1 _ssePost 패턴 차용)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function _ssePostV2(path, body, callbacks, abortController) {
  const token = localStorage.getItem("accessToken");
  const url = `${BASE_URL}${path}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        Accept: "text/event-stream",
      },
      body: JSON.stringify(body),
      credentials: "include",
      signal: abortController?.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      if (response.status === 401) {
        const refreshed = await tryRefreshToken();
        if (refreshed) {
          return _ssePostV2(path, body, callbacks, abortController);
        }
        window.location.href = "/login";
        return;
      }

      callbacks.onError?.({
        errorCode: errorData.errorCode || `HTTP_${response.status}`,
        message: errorData.message || `서버 오류 (${response.status})`,
        status: response.status,
      });
      return;
    }

    // ── SSE 스트림 파싱 (V1과 동일 패턴) ──
    // reader try-finally cleanup: 컴포넌트 unmount/abort/예외 시 reader.cancel()로
    // underlying 스트림을 명시 해제 — HTTP 커넥션 + ReadableStream 자원 누수 차단.
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop();

        for (const eventBlock of events) {
          if (!eventBlock.trim()) continue;
          const parsed = parseSseEvent(eventBlock);
          if (!parsed) continue;

          switch (parsed.event) {
            case "first_scene":
              try {
                callbacks.onFirstScene?.(JSON.parse(parsed.data));
              } catch (e) {
                console.warn("[V2-SSE] first_scene parse error:", e);
              }
              break;
            case "final_result":
              try {
                callbacks.onFinalResult?.(JSON.parse(parsed.data));
              } catch (e) {
                console.warn("[V2-SSE] final_result parse error:", e);
              }
              break;
            case "error":
              try {
                callbacks.onError?.(JSON.parse(parsed.data));
              } catch (e) {
                callbacks.onError?.({ errorCode: "PARSE_ERROR", message: parsed.data });
              }
              break;
            default:
              // V2는 event_meta 사용 안 함 (event_status 필드 폐기)
              break;
          }
        }
      }
    } finally {
      try {
        await reader.cancel();
      } catch {
        /* ignore — already closed */
      }
    }

    // 마지막 버퍼 처리
    if (buffer.trim()) {
      const parsed = parseSseEvent(buffer);
      if (parsed?.event === "final_result") {
        try {
          callbacks.onFinalResult?.(JSON.parse(parsed.data));
        } catch (e) {
          /* ignore */
        }
      }
    }
  } catch (err) {
    if (err.name === "AbortError") {
      console.log("[V2-SSE] Request aborted");
      return;
    }
    console.error("[V2-SSE] Stream error:", err);
    callbacks.onError?.({
      errorCode: "NETWORK_ERROR",
      message: "네트워크 오류가 발생했습니다.",
    });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  유틸
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function parseSseEvent(block) {
  const lines = block.split("\n");
  let event = "message";
  let data = "";
  for (const line of lines) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim() + "\n";
  }
  data = data.trim();
  return data ? { event, data } : null;
}

/**
 * 401 응답 시 토큰 갱신 시도.
 * axios.js의 refreshOnce와 별도 트랙 (fetch 기반) — 동일 패턴.
 */
async function tryRefreshToken() {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      credentials: "include",
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.accessToken) {
      localStorage.setItem("accessToken", data.accessToken);
      if (data.refreshToken) localStorage.setItem("refreshToken", data.refreshToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export default sendV2Message;