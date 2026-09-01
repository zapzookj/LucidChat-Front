// [로컬 에셋 폴백] AWS(CloudFront/S3) 접근 불가 상태에서의 로컬 테스트 지원 — dev 전용.
//
// 에셋 URL은 두 계열이다:
//   1) 상대 경로(public/ 정적) — assetUrl()이 VITE_ASSET_BASE_URL 미설정 시 이미 로컬 서빙
//      (.env.development가 dev에서 base를 비워 이 계열은 자동 로컬).
//   2) API가 내려주는 절대 URL(시드 썸네일·생성 에셋 publicUrl 등, DB에 절대 URL로 저장) —
//      소비 지점이 수십 곳이라 개별 수정 대신 여기의 전역 폴백이 받는다.
//
// 동작(캡처 단계 전역 error 리스너, <img> 한정):
//   CDN(*.cloudfront.net) 로드 실패 → 같은 경로의 로컬 public/ 미러로 1회 스왑
//   → 미러에도 없으면 내장 플레이스홀더(데이터 URI, 재실패 불가).
// 프로드 번들에서는 설치 자체를 하지 않는다(무영향).

// [탈AWS 2026-09-01] CDN이 CloudFront → R2 커스텀 도메인(assets.lucid-chat.com)으로
// 절환됨. 구 도메인 패턴은 과도기(로컬 DB에 남은 옛 절대 URL) 안전망으로 유지.
const CDN_HOST_RE = /^https?:\/\/([^/]*\.cloudfront\.net|assets\.lucid-chat\.com)\//i;

/** 어떤 CDN 도메인이든 경로만 벗겨 로컬 public/ 경로로. */
export function toLocalAssetPath(url) {
  return url.replace(CDN_HOST_RE, "/");
}

export function isCdnAssetUrl(url) {
  return typeof url === "string" && CDN_HOST_RE.test(url);
}

/** 실루엣 플레이스홀더 — 로컬 미러에도 없는 에셋 자리 표시(다크 톤, 로드 실패 불가). */
export const ASSET_PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 160">` +
    `<rect width="120" height="160" rx="10" fill="#1c1917"/>` +
    `<circle cx="60" cy="62" r="22" fill="#292524"/>` +
    `<path d="M22 138c6-26 22-38 38-38s32 12 38 38" fill="#292524"/>` +
    `<text x="60" y="152" text-anchor="middle" font-size="9" fill="#57534e" font-family="sans-serif">local asset</text>` +
    `</svg>`
  );

export function installLocalAssetFallback() {
  if (!import.meta.env.DEV) return;

  // 로컬 미러 스왑 — Vite dev 서버는 미존재 경로에 404가 아니라 SPA 폴백(200 text/html)을
  // 주고 <img>는 그걸 조용히 스톨하므로, HEAD로 실존(이미지 타입) 검증해 미스면 플레이스홀더.
  const swapToLocal = (img, localPath) => {
    img.dataset.lafTriedLocal = "1";
    img.src = localPath; // 진행 중이던 CDN 요청은 src 교체로 취소됨
    fetch(localPath, { method: "HEAD" })
      .then((r) => {
        const ct = r.headers.get("content-type") || "";
        if (!r.ok || !ct.startsWith("image/")) placeholder(img);
      })
      .catch(() => placeholder(img));
  };

  const placeholder = (img) => {
    if (img.dataset.lafDone) return;
    img.dataset.lafDone = "1";
    img.src = ASSET_PLACEHOLDER;
  };

  window.addEventListener(
    "error",
    (e) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement)) return;
      if (img.dataset.lafDone) return;

      if (isCdnAssetUrl(img.src)) {
        // 1차: CDN 실패 → 로컬 미러 시도
        swapToLocal(img, toLocalAssetPath(img.src));
      } else if (img.dataset.lafTriedLocal || img.src.startsWith(window.location.origin)) {
        // 2차: 로컬 미러도 없음(또는 원래 로컬 에셋 결손) → 플레이스홀더
        placeholder(img);
      }
    },
    true // 이미지 error는 버블링하지 않음 — 캡처 단계 필수
  );

  // 폴백 모드(VITE_LOCAL_ASSET_FALLBACK=1): CDN <img>를 삽입 시점에 선제 리라이트.
  // AWS 정지는 빠른 403이 아니라 블랙홀 행(hang)이라 error 이벤트가 분 단위로 늦다 —
  // 반응형 리스너만으로는 그동안 이미지가 빈 채 걸려 있으므로, API 절대 URL을 <img>에
  // 직결하는 소비 지점 전부를 DOM 레벨에서 받는다(assetUrl 미경유 지점 포함).
  if (import.meta.env.VITE_LOCAL_ASSET_FALLBACK !== "1") return;

  const rewrite = (img) => {
    if (!(img instanceof HTMLImageElement)) return;
    if (img.dataset.lafDone || img.dataset.lafTriedLocal) return;
    if (!isCdnAssetUrl(img.getAttribute("src") || "")) return;
    swapToLocal(img, toLocalAssetPath(img.src));
  };

  const sweep = (root) => {
    if (root instanceof HTMLImageElement) rewrite(root);
    else if (root instanceof Element) root.querySelectorAll("img").forEach(rewrite);
  };

  new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "attributes") rewrite(m.target);
      else m.addedNodes.forEach(sweep);
    }
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src"],
  });
  sweep(document.documentElement); // 설치 이전에 이미 삽입된 이미지도 1회 스윕
}
