/**
 * [블록 A R2] 한국어 조사 유틸 — 동적 캐릭터명 뒤 와/과.
 * 규칙(디자인 정본 docs/15_assets 구현 계약): 한글 종성 판별
 * (code-0xAC00)%28 > 0 → '과', 아니면 '와'. 비한글 종결(영문·숫자 닉네임)은
 * 판별 불가이므로 이름 생략형 폴백을 쓴다.
 */
export const josaWaGwa = (name) => {
  if (!name) return null;
  const c = name.charCodeAt(name.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return null; // 비한글 종결 → 폴백 신호
  return (c - 0xac00) % 28 > 0 ? "과" : "와";
};

/** "{이름}와/과 {suffix}" — 비한글 종결이면 "이 캐릭터와 {suffix}" 폴백 */
export const withWaGwa = (name, suffix) => {
  const j = josaWaGwa(name);
  return j ? `${name}${j} ${suffix}` : `이 캐릭터와 ${suffix}`;
};
