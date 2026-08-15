// [Phase 6] 정적 에셋 경로를 CloudFront(S3) URL로 변환.
//
// - VITE_ASSET_BASE_URL 환경변수가 비어 있으면 원본 경로 반환 (로컬 개발)
// - 절대 URL(http://, https://, data:, blob:)은 그대로 반환
//   → S3 동적 일러스트(IllustrationService), 외부 이미지 등은 통과
// - 그 외 상대 경로는 base + path
//
// [로컬 에셋 폴백] dev에서 VITE_LOCAL_ASSET_FALLBACK=1이면 절대 CDN URL도 로컬 public/
// 경로로 선제 리라이트(실패 왕복 없이 즉시 로컬) — AWS 정지 중 오프라인 테스트용.
// 여길 안 거치는 소비 지점은 localAssetFallback.js의 전역 error 리스너가 받는다.

import { isCdnAssetUrl, toLocalAssetPath } from "./localAssetFallback";

const RAW_BASE = import.meta.env.VITE_ASSET_BASE_URL || "";
const ASSET_BASE = RAW_BASE.replace(/\/+$/, ""); // 끝 슬래시 정리

const ABSOLUTE_RE = /^(https?:|data:|blob:)/i;

const LOCAL_FALLBACK =
  import.meta.env.DEV && import.meta.env.VITE_LOCAL_ASSET_FALLBACK === "1";

export function assetUrl(path) {
  if (!path) return "";
  if (typeof path !== "string") return path;
  if (ABSOLUTE_RE.test(path)) {
    // 절대 URL 통과 — 단 로컬 폴백 모드에서 CDN이면 로컬 미러로 선제 우회
    if (LOCAL_FALLBACK && isCdnAssetUrl(path)) return toLocalAssetPath(path);
    return path;
  }
  if (!ASSET_BASE) return path;                  // base 미설정 시 원본
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${ASSET_BASE}${normalized}`;
}

export default assetUrl;