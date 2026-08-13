import api from "../api/axios";

/**
 * [블록 A 게스트] 로그인 후 복원할 액션(딥링크) 저장소.
 *
 * OAuth는 외부 리다이렉트를 거치므로 React Router state가 살아남지 못한다 —
 * sessionStorage가 유일하게 안전한 전달 수단이다(탭 단위 격리, 브라우저 종료 시 소멸).
 *
 * 액션 형태:
 *   { type: "startChat", characterId, characterName }  — 게스트가 고른 인연과 즉시 방 생성
 *   { type: "route", path }                            — 원래 가려던 화면으로 복귀
 */
const KEY = "lucid:pendingAction";
// [리뷰 P2] 만료 규칙 — 로그인 페이지에서 이탈했다가 한참 뒤 다른 진입점으로 로그인하면
//   묵은 액션이 소비돼 엉뚱한 곳(방 생성 포함)으로 착지했다. 짧은 TTL로 누수 차단.
const TTL_MS = 10 * 60 * 1000;

export function savePendingAction(action) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ action, ts: Date.now() }));
  } catch {
    /* sessionStorage 불가 환경 — 복원 없이 로그인만 진행 */
  }
}

export function peekPendingAction() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // 구/신 포맷 호환: {action, ts} 래핑이 정상, 과거 평면 객체는 액션 자체로 간주
    if (parsed && typeof parsed === "object" && "action" in parsed && "ts" in parsed) {
      if (Date.now() - parsed.ts > TTL_MS) {
        clearPendingAction();
        return null;
      }
      return parsed.action;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingAction() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}

/**
 * 로그인 성공 직후 호출 — 저장된 액션을 소비해 목적지를 결정한다.
 *
 * 반환: navigate에 넘길 경로(string). 복원할 것이 없으면
 *  - 방 0개 신규(빈손)면 '/first-meet' (첫 만남 온보딩 — docs/14 §B)
 *  - 그 외 '/'
 *
 * startChat 복원은 여기서 방 생성까지 수행한다(게스트가 이미 인연을 골랐으므로
 * 온보딩을 스킵하고 그 인연과의 방으로 직행 — 딥링크 복원이 온보딩을 대체).
 */
export async function resolvePostLoginPath() {
  const action = peekPendingAction();
  clearPendingAction();

  if (action?.type === "startChat" && action.characterId) {
    try {
      const res = await api.post("/lobby/rooms", {
        characterId: action.characterId,
        chatMode: "SANDBOX",
      });
      localStorage.setItem("roomId", res.data.roomId);
      return `/chat/${res.data.roomId}`;
    } catch (e) {
      console.warn("[postLogin] startChat 복원 실패 — 로비로 폴백:", e?.message);
      return "/";
    }
  }

  if (action?.type === "route" && typeof action.path === "string" && action.path.startsWith("/")) {
    return action.path;
  }

  // 복원할 액션 없음 — 빈손 신규만 '첫 만남' 온보딩으로
  try {
    const [rooms, theater] = await Promise.all([
      api.get("/lobby/rooms").then((r) => r.data),
      api.get("/theater/lobby/sessions").then((r) => r.data).catch(() => []),
    ]);
    const isEmptyHanded = (rooms?.length ?? 0) === 0 && (theater?.length ?? 0) === 0;
    if (isEmptyHanded) return "/first-meet";
  } catch {
    /* 판정 실패는 온보딩 스킵 — 로비가 안전 기본값 */
  }
  return "/";
}
