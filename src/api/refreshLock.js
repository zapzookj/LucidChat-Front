/**
 * [E-1.2 · E-1.2b] 액세스 토큰 갱신의 **단일 소유자**.
 *
 * 이 파일이 생기기 전에는 갱신 경로가 셋이었고, 그중 둘이 결함이었다.
 *
 *  1. `axios.js`      — 쿠키 기반 single-flight. 정상이지만 **자기만의 뮤텍스**를 들고 있었다.
 *  2. `UseChatStream` — 쿠키 기반 single-flight. 역시 **별개 뮤텍스**.
 *     → axios 요청과 SSE 요청이 같은 순간 401을 받으면 `/auth/refresh`가 두 번 나간다.
 *       서버는 RT를 회전(rotation)시키므로 늦게 도착한 쪽은 **이미 폐기된 RT**를 제시하게 되고,
 *       서버는 그것을 토큰 재사용(탈취)으로 판정해 **해당 유저의 전 세션을 끊는다**.
 *       즉 정상 유저가 전 기기에서 강제 로그아웃된다. (E-1.2)
 *  3. `UseStoryV2Stream` — `localStorage.getItem("refreshToken")`을 읽고 없으면 즉시 실패.
 *     이 앱의 RT는 **httpOnly 쿠키**다(axios `withCredentials: true`). localStorage에는 그런 키가
 *     애초에 없으므로 이 경로는 **갱신을 시도조차 못 하고 100% 실패**했다 → V2 STORY 스트림에서
 *     401이 뜨면 곧장 강제 로그아웃. (E-1.2b)
 *
 * 그래서 뮤텍스를 하나로 합치고 쿠키 방식으로 통일한다. 세 소비처 모두 이 함수만 부른다.
 *
 * ⚠ **닫히지 않은 부분** — 이 뮤텍스는 모듈 스코프라 **탭 하나 안에서만** 유효하다.
 *    탭 두 개가 동시에 401을 받으면 여전히 `/auth/refresh`가 두 번 나가고 위 시나리오가 재현된다.
 *    탭 간 조율(BroadcastChannel)이나 서버측 '직전 RT 유예창'이 있어야 완전히 닫힌다
 *    (docs 계획서 §4 결정 7). 이 커밋은 **한 탭 안의 경합만** 닫는다.
 */

/** 세 소비처가 각자 들고 있던 상수를 하나로. (axios baseURL과 같은 값) */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

let inFlight = null;

/**
 * 액세스 토큰을 1회 갱신한다. 동시 호출은 하나의 요청으로 합쳐진다.
 *
 * RT는 httpOnly 쿠키로 자동 전송되므로 본문이 없다 — 본문에 refreshToken을 실으려던 구
 * V2 구현이 정확히 이 지점을 잘못 알고 있었다.
 *
 * axios 인터셉터는 재요청 헤더에 넣을 **토큰 문자열**이 필요하고 SSE 경로는 성공/실패만
 * 알면 되므로, 반환은 `string | null`로 둔다 — 실패가 falsy라 양쪽 계약을 동시에 만족한다.
 * (boolean으로 두면 `const { accessToken } = res.data` 를 쓰던 axios 재요청이 조용히 깨진다.)
 *
 * @returns {Promise<string|null>} 새 accessToken, 실패 시 null
 */
export function refreshAccessToken() {
  if (!inFlight) {
    inFlight = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
        });
        if (!res.ok) return null;
        const data = await res.json().catch(() => null);
        const token = data?.accessToken ?? null;
        if (token) localStorage.setItem('accessToken', token);
        return token;
      } catch {
        return null;
      }
    })().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}
