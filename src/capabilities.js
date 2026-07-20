// ═══════════════════════════════════════════════════════════════
//  [Phase B · 단계0] capabilities seam (스텁)
//
//  향후 모바일 앱 빌드에서 특정 기능을 숨길 수 있도록 하는 "자리"만 마련한다.
//  현재 값은 전부 노출(web = full). 실제 기능 게이팅(시크릿 UI 숨김 등)은
//  이번 작업 스코프가 아니며, 소비처도 아직 없다 — seam 만 두고 동작은 현행 유지.
//
//  향후 사용 예:
//    import { useCapabilities } from "../capabilities";
//    const caps = useCapabilities();
//    if (caps.showSecretMode) { ... }
// ═══════════════════════════════════════════════════════════════

const WEB_CAPABILITIES = Object.freeze({
  tier: "web",
  // 전 기능 노출 — 현행 웹 경험 100% 유지
  showStore: true,
  showSecretMode: true,
  showAdultContent: true,
  showPayments: true,
  showGallery: true,
  showSupport: true,
});

/**
 * 현재 빌드의 기능 capabilities 를 반환한다.
 * @returns {typeof WEB_CAPABILITIES}
 */
export function getCapabilities() {
  return WEB_CAPABILITIES;
}

/**
 * React 훅 형태의 capabilities 접근자.
 * (현재는 정적 상수를 반환하지만, 향후 플랫폼/원격 설정 연동 지점.)
 */
export function useCapabilities() {
  return WEB_CAPABILITIES;
}

export default getCapabilities;
