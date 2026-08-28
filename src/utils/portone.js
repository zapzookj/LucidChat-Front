/**
 * [버그픽스 C-2.j · docs/19 §F] PortOne(아임포트) SDK 초기화 — **앱 부트스트랩 단일 지점**.
 *
 * ## 왜 별도 모듈인가
 * 이전에는 `IMP.init('imp_YOUR_CODE')`이 **폐기 예정 `PaymentModal.jsx` 안에만** 있었다.
 * 그 모달을 지우는 순간 코드베이스에서 PortOne 초기화가 통째로 사라져 **결제가 전면 불능**이 된다
 * (레지스터 C-2.j — "C-2.i보다 반드시 먼저"라고 순서를 못박은 이유가 이것이다).
 * 반대로 살아 있는 `LucidStore`는 `IMP.init`을 **한 번도 부르지 않으면서** `window.IMP.request_pay`만
 * 호출하고 있었다. 즉 두 모달 중 어느 쪽도 단독으로는 결제가 성립하지 않는 상태였다.
 *
 * ## 계약
 * - SDK 자체는 `index.html`의 `<script src="https://cdn.iamport.kr/v1/iamport.js">`가 로드한다(무변경).
 * - 가맹점 코드는 **환경변수 `VITE_PORTONE_MERCHANT_CODE`**로 주입한다. 실 코드는 `imp_xxxxxxxx` 형식이며
 *   PortOne 가맹 심사 승인 후에 발급된다(docs/18 §1-D D3). 미발급 상태에서도 앱은 정상 기동해야 하므로
 *   **초기화 실패는 예외로 던지지 않고 false를 반환**하고, 결제 시도 시점에 명확한 문구로 막는다.
 * - 멱등하다 — 여러 번 불러도 실제 `IMP.init`은 1회만 수행한다.
 */

const MERCHANT_CODE = import.meta.env.VITE_PORTONE_MERCHANT_CODE || "";

let initialized = false;

/** 가맹점 코드가 주입돼 있는가(플레이스홀더 제외). */
export function hasPortOneMerchantCode() {
  return !!MERCHANT_CODE && !MERCHANT_CODE.startsWith("imp_YOUR");
}

/**
 * PortOne SDK 초기화. 앱 부트스트랩(App.jsx)에서 1회 호출하고,
 * 결제 직전에도 방어적으로 호출한다(SDK가 늦게 로드되는 경우 대비).
 * @returns {boolean} 결제를 시도해도 되는 상태인지
 */
export function initPortOne() {
  if (initialized) return true;
  if (!window.IMP) return false;            // CDN 스크립트 미로드 — 결제 직전에 재시도된다
  if (!hasPortOneMerchantCode()) {
    // 가맹 계약 전(로컬·심사 대기)에는 정상 상태다. 결제 시도 시점에만 막는다.
    console.warn("[PortOne] VITE_PORTONE_MERCHANT_CODE 미설정 — 결제 비활성");
    return false;
  }
  try {
    window.IMP.init(MERCHANT_CODE);
    initialized = true;
    return true;
  } catch (e) {
    console.error("[PortOne] init 실패", e);
    return false;
  }
}

/** 결제 진입 직전 게이트. 실패 사유를 유저 문구로 돌려준다(null이면 진행 가능). */
export function portOneBlockReason() {
  if (!window.IMP) return "결제 모듈을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.";
  if (!hasPortOneMerchantCode()) return "결제 준비 중입니다. 잠시 후 다시 시도해 주세요.";
  if (!initPortOne()) return "결제 모듈 초기화에 실패했습니다. 새로고침 후 다시 시도해 주세요.";
  return null;
}
