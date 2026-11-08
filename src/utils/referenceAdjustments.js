/**
 * [그림 방식 · aichat docs/56 §10] 레퍼런스 조정값 계약 — 서버 ReferencePrompts.sanitize와 같은 어휘.
 * outfit keep|maid|uniform|suit|casual|custom(outfitText), body keep|slim|curvy, bust keep|small|large, extra(60자).
 * 키는 원화·스탠딩이 허벅지 위 구도라 보이지 않아 받지 않는다.
 */

export const OUTFITS = [
  ["keep", "올린 그림 그대로"], ["maid", "메이드복"], ["uniform", "교복"],
  ["suit", "정장"], ["casual", "사복"], ["custom", "직접 입력"],
];
export const BODY = [["keep", "그대로"], ["slim", "슬림"], ["curvy", "글래머"]];
export const BUST = [["keep", "그대로"], ["small", "작게"], ["large", "크게"]];

export const EMPTY_ADJUSTMENTS = { outfit: "keep", outfitText: "", body: "keep", bust: "keep", extra: "" };
export const MAX_REFERENCE_BYTES = 10 * 1024 * 1024;
const ACCEPT = ["image/png", "image/jpeg", "image/webp"];

/** 서버 응답(null 필드 포함)·로컬 상태 어느 쪽이든 폼 상태로 정규화 */
export const toAdjustState = (a) => ({
  ...EMPTY_ADJUSTMENTS,
  ...Object.fromEntries(Object.entries(a || {}).filter(([, v]) => v != null)),
});

/** 사람이 읽는 요약 — ["메이드복", "글래머 체형", …] */
export function summarizeAdjustments(a) {
  if (!a) return [];
  const p = [];
  if (a.outfit === "custom") {
    if (a.outfitText?.trim()) p.push(a.outfitText.trim()); // 빈 직접 입력은 변경이 아니다(서버 sanitize와 같은 판정)
  } else if (a.outfit && a.outfit !== "keep") {
    p.push(OUTFITS.find((o) => o[0] === a.outfit)?.[1]);
  }
  if (a.body && a.body !== "keep") p.push(`${BODY.find((o) => o[0] === a.body)?.[1]} 체형`);
  if (a.bust && a.bust !== "keep") p.push(`가슴 ${BUST.find((o) => o[0] === a.bust)?.[1]}`);
  if (a.extra?.trim()) p.push("기타 요청");
  return p.filter(Boolean);
}

/** 전송 페이로드 — 빈 문자열 제거. 바꾼 게 없으면 null(서버도 같은 판정) */
export function adjustmentsPayload(a) {
  if (!summarizeAdjustments(a).length) return null;
  return {
    outfit: a.outfit,
    ...(a.outfit === "custom" && a.outfitText?.trim() ? { outfitText: a.outfitText.trim() } : {}),
    body: a.body,
    bust: a.bust,
    ...(a.extra?.trim() ? { extra: a.extra.trim() } : {}),
  };
}

/** 클라이언트 1차 검사 — 서버가 같은 규칙으로 다시 막는다(여기는 왕복 없이 즉시 안내용) */
export function checkReferenceFile(file) {
  if (!file) return null;
  if (!ACCEPT.includes(file.type)) return "PNG·JPG·WebP 파일만 올려주세요.";
  if (file.size > MAX_REFERENCE_BYTES) return "10MB 이하 파일로 올려주세요.";
  return null;
}
