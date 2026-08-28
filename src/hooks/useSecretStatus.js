import { useEffect, useSyncExternalStore } from "react";
import api from "../api/axios";

/**
 * useSecretStatus — GET /users/secret-status 의 **단일 공용 소스**
 *
 * [왜 훅으로 올렸나 · 적대적 리뷰 P1 · 안건 7(b) 확정(docs/19_assets/decisions_confirmed.md §A #7)]
 *   서버 노브 `bm.secret-products-enabled`(기본 false)가 응답의 `secretProductsEnabled`로 내려온다.
 *   PG 심사 중에는 시크릿을 **완전 게이팅**하기로 확정됐는데, 이 필드를 읽는 FE가 LucidStore
 *   하나뿐이었다. 그래서 토글이 off인데도
 *     - SecretModeFlow의 need_purchase 스텝이 상품명·혜택("24시간 패스 · 영구 해금")을 광고하고
 *     - BiometricStatusPanel의 봉인 카드가 "해금하고 보기 →"를 조건 없이 노출
 *   → 심사자가 이 화면을 그대로 본다. '완전 게이팅' 주장과 화면이 어긋난다.
 *   컴포넌트마다 각자 fetch하면 판정이 또 갈라지므로 **모듈 단일 스토어**로 합쳤다.
 *
 * [설계 원칙]
 *   1. **실패는 닫힘(fail-closed).** 조회 실패·비로그인·파싱 실패 전부 secretProductsEnabled=false.
 *      열림으로 폴백하면 심사 중 노출 사고가 난다. 초기 스냅샷도 닫힘이다.
 *   2. **비로그인/게스트는 요청 자체를 보내지 않는다.** api/axios의 401 인터셉터는 refresh를
 *      시도하고 실패하면 localStorage를 비우고 `window.location.href='/login'`으로 튕긴다 —
 *      게스트가 이 훅 때문에 로그인 화면으로 강제 이동하면 안 된다. accessToken이 없으면
 *      조용히 닫힌 스냅샷을 돌려준다(콘솔 에러도 없다).
 *   3. **Provider가 아니라 모듈 스토어 + useSyncExternalStore.** BiometricStatusPanel의
 *      호출부(ChatPage/ChatPageV2/App)는 이 트랙의 소유가 아니라 Provider를 끼울 수 없고,
 *      useSyncExternalStore는 effect 안 동기 setState를 만들지 않는다
 *      (BiometricStatusPanel이 react-hooks/set-state-in-effect에 걸린 이력이 있다).
 *   4. **동시 요청 dedupe + TTL.** 상태창을 여닫을 때마다 때리지 않도록 기본 60초 TTL을 두되,
 *      결제·인증·프로필 수정 직후처럼 판정이 바뀌는 지점은 `{ force: true }`로 우회한다.
 *
 * ⚠ 이건 **UX 게이트일 뿐 보안 게이트가 아니다.** 서버가 /payments/ready에서 독립적으로 400을
 *   던진다(aichat CLAUDE.md §2-4: 게이트는 반드시 서버측).
 */

/** 닫힘 스냅샷 — 모든 실패 경로의 종착점. */
const CLOSED = Object.freeze({
  loaded: false,
  secretProductsEnabled: false,
  canAccess: false,
  accessReason: null,
  isAdult: false,
  personaAdult: false,
  hasMidnightPass: false,
  hasPermanentUnlock: false,
  has24hPass: false,
});

const DEFAULT_MAX_AGE_MS = 60_000;

let snapshot = CLOSED;
let loadedAt = 0;
let inflight = null;
const listeners = new Set();

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getSnapshot = () => snapshot;

function publish(next) {
  snapshot = next;
  for (const listener of listeners) listener();
}

function hasSession() {
  try {
    return !!localStorage.getItem("accessToken");
  } catch {
    // Safari 프라이빗 모드 등 localStorage 접근 예외 — 세션 없음으로 간주(닫힘).
    return false;
  }
}

/** 서버 응답을 방어적으로 정규화한다. 필드가 빠져도 false로 떨어진다(닫힘 폴백). */
function normalize(data) {
  const d = data || {};
  return {
    loaded: true,
    secretProductsEnabled: d.secretProductsEnabled === true,
    canAccess: d.canAccess === true,
    accessReason: d.accessReason ?? null,
    isAdult: d.isAdult === true,
    personaAdult: d.personaAdult === true,
    hasMidnightPass: d.hasMidnightPass === true,
    hasPermanentUnlock: d.hasPermanentUnlock === true,
    has24hPass: d.has24hPass === true,
  };
}

/**
 * 공용 판정을 갱신한다. **절대 reject하지 않는다** — 실패도 '닫힘' 스냅샷으로 resolve된다.
 * @param {{force?: boolean, maxAgeMs?: number}} [opts]
 * @returns {Promise<typeof CLOSED>} 최신(또는 캐시된) 스냅샷
 */
export function refreshSecretStatus(opts = {}) {
  const { force = false, maxAgeMs = DEFAULT_MAX_AGE_MS } = opts;

  // 비로그인/게스트 — 요청을 보내지 않는다(401 → /login 강제 이동 방지).
  if (!hasSession()) {
    loadedAt = 0;
    if (snapshot !== CLOSED) publish(CLOSED);
    return Promise.resolve(CLOSED);
  }

  if (inflight) return inflight;
  if (!force && snapshot.loaded && Date.now() - loadedAt < maxAgeMs) {
    return Promise.resolve(snapshot);
  }

  const chain = api
    .get("/users/secret-status")
    .then((res) => normalize(res?.data))
    // 실패는 조용히 닫는다 — 콘솔 에러 스팸 없이, 노출은 하지 않는 쪽으로.
    .catch(() => ({ ...CLOSED, loaded: true }))
    .then((next) => {
      loadedAt = Date.now();
      publish(next);
      return next;
    });

  inflight = chain;
  chain.finally(() => {
    if (inflight === chain) inflight = null;
  });
  return chain;
}

/**
 * 컴포넌트에서 공용 시크릿 판정을 구독한다.
 * @param {{active?: boolean, maxAgeMs?: number}} [opts] active가 true로 바뀔 때 갱신을 시도한다.
 */
export default function useSecretStatus(opts = {}) {
  const { active = true, maxAgeMs = DEFAULT_MAX_AGE_MS } = opts;
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (!active) return;
    // 비동기 갱신 — effect 안에서 동기 setState를 하지 않는다.
    refreshSecretStatus({ maxAgeMs });
  }, [active, maxAgeMs]);

  return state;
}
