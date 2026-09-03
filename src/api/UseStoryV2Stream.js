import { getStoryV2StreamUrl, getStoryV2OpeningStreamUrl } from "./StoryV2Api";
import { API_BASE_URL, refreshAccessToken } from "./refreshLock";

const BASE_URL = API_BASE_URL; // 상수 정의는 refreshLock.js로 일원화 (:75 URL 조립에 사용)

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

async function _ssePostV2(path, body, callbacks, abortController, _retried = false) {
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
        // [E-1.2b] 이 경로는 지금까지 갱신이 100% 실패해 사실상 죽어 있었다 — 고치는 순간
        //   재귀가 처음으로 살아나므로 재시도 1회 제한을 함께 넣는다(E-1.2와 같은 규칙).
        const newToken = _retried ? null : await refreshAccessToken();
        if (newToken) {
          return _ssePostV2(path, body, callbacks, abortController, true);
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

// [E-1.2b] 이 파일에 있던 tryRefreshToken은 `localStorage.getItem("refreshToken")`을 읽고
//   없으면 즉시 false를 반환했다. 그런데 이 앱의 RT는 **httpOnly 쿠키**다(axios withCredentials).
//   localStorage에 그 키는 애초에 존재하지 않으므로 이 경로는 갱신을 **시도조차 못 하고
//   100% 실패**했고, V2 STORY 스트림에서 401이 뜨면 곧장 /login으로 튕겼다.
//   요청 본문에 refreshToken을 싣던 것도 서버 계약과 달랐다(서버는 쿠키를 읽는다).
//   → refreshLock.js의 공용 구현으로 교체. 삭제해야 컴파일/번들 단계에서 잔존 호출이 드러난다.

export default sendV2Message;