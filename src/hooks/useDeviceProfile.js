import { useState, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════
//  [Phase B · 단계0] useDeviceProfile
//
//  뷰포트 폭 + 포인터 성능(pointer: coarse) + 방향(orientation)을 종합해
//  플레이어/셸 레이아웃 분기용 폼팩터 프로필을 반환한다.
//
//  단순 Tailwind `md:` 브레이크포인트만으로는 VN 세로 레이아웃 분기가
//  불충분하므로(스프라이트 crop · 다이얼로그 비중 · 터치 타깃) 훅으로 명시 분기.
//
//  판정 규칙(데스크톱 무회귀 = G1 보호):
//   - 폭 <= 767px(Tailwind md 미만)           → 모바일 (폰 세로/소형 창)
//   - coarse 포인터 & 세로 & 폭 <= 1024px       → 모바일 (태블릿 세로 포함)
//   - 그 외(넓은 데스크톱/태블릿 가로)           → 데스크톱 (오늘과 동일 경로)
//
//  즉 폭 >= 768 의 일반 데스크톱 뷰포트는 항상 'desktop' → 렌더 경로 불변.
//  SSR/비브라우저 환경은 fail-safe 로 'desktop'.
// ═══════════════════════════════════════════════════════════════

const MOBILE_MAX_WIDTH = 767; // Tailwind md(768) 미만
const TABLET_PORTRAIT_MAX = 1024;

const DESKTOP_FALLBACK = Object.freeze({
  profile: "desktop",
  isDesktop: true,
  isMobile: false,
  isMobilePortrait: false,
  isMobileLandscape: false,
  isTouch: false,
  orientation: "landscape",
  width: 1280,
  height: 800,
});

function computeProfile() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return DESKTOP_FALLBACK;
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const isTouch = window.matchMedia("(pointer: coarse)").matches;
  const orientation = height >= width ? "portrait" : "landscape";

  const isNarrow = width <= MOBILE_MAX_WIDTH;
  const isTabletPortrait =
    isTouch && orientation === "portrait" && width <= TABLET_PORTRAIT_MAX;

  const isMobile = isNarrow || isTabletPortrait;
  const isMobilePortrait = isMobile && orientation === "portrait";
  const isMobileLandscape = isMobile && orientation === "landscape";

  return {
    profile: isMobilePortrait
      ? "mobile-portrait"
      : isMobileLandscape
      ? "mobile-landscape"
      : "desktop",
    isDesktop: !isMobile,
    isMobile,
    isMobilePortrait,
    isMobileLandscape,
    isTouch,
    orientation,
    width,
    height,
  };
}

/**
 * 폼팩터 프로필 훅.
 * resize / orientationchange 에 반응하되, 레이아웃-관련 신호(profile · orientation)가
 * 바뀔 때만 리렌더해 플레이어 성능을 보호한다.
 *
 * @returns {{profile:string,isDesktop:boolean,isMobile:boolean,isMobilePortrait:boolean,isMobileLandscape:boolean,isTouch:boolean,orientation:string,width:number,height:number}}
 */
export default function useDeviceProfile() {
  const [state, setState] = useState(computeProfile);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    let raf = 0;
    const onChange = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setState((prev) => {
          const next = computeProfile();
          // 레이아웃 분기에 영향 없는 순수 픽셀 변화는 리렌더 생략
          if (prev.profile === next.profile && prev.orientation === next.orientation) {
            return prev;
          }
          return next;
        });
      });
    };

    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
    };
  }, []);

  return state;
}
