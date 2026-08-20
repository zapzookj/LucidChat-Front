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

/**
 * [블록 D · §G-9] 은/는 — 서술형 상태창이 캐릭터 이름을 문장 주어로 쓰면서 추가.
 * 계약은 josaWaGwa와 동일: 한글 종성 판별, 비한글 종결은 판별 불가이므로 null(폴백 신호).
 */
export const josaEunNeun = (name) => {
  if (!name) return null;
  const c = name.charCodeAt(name.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return null;
  return (c - 0xac00) % 28 > 0 ? "은" : "는";
};

/** 이/가 — 동일 계약. */
export const josaIGa = (name) => {
  if (!name) return null;
  const c = name.charCodeAt(name.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return null;
  return (c - 0xac00) % 28 > 0 ? "이" : "가";
};

/**
 * "{이름}은/는" 주어구 — 비한글 종결(영문·숫자 닉네임)이면 "이 캐릭터는" 폴백.
 * 상태창 서술 40문장이 전부 이 주어로 시작한다.
 */
export const subjectEunNeun = (name) => {
  const j = josaEunNeun(name);
  return j ? `${name}${j}` : "이 캐릭터는";
};
