// [Phase 6] 정적 에셋 경로를 CloudFront(S3) URL로 변환.
//
// - VITE_ASSET_BASE_URL 환경변수가 비어 있으면 원본 경로 반환 (로컬 개발)
// - 절대 URL(http://, https://, data:, blob:)은 그대로 반환
//   → S3 동적 일러스트(IllustrationService), 외부 이미지 등은 통과
// - 그 외 상대 경로는 base + path

const RAW_BASE = import.meta.env.VITE_ASSET_BASE_URL || "";
const ASSET_BASE = RAW_BASE.replace(/\/+$/, ""); // 끝 슬래시 정리

const ABSOLUTE_RE = /^(https?:|data:|blob:)/i;

export function assetUrl(path) {
  if (!path) return "";
  if (typeof path !== "string") return path;
  if (ABSOLUTE_RE.test(path)) return path;       // 이미 절대 URL이면 통과
  if (!ASSET_BASE) return path;                  // base 미설정 시 원본
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${ASSET_BASE}${normalized}`;
}

export default assetUrl;