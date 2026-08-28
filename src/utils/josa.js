/**
 * [D-32] 세 josa 함수의 공통 전처리.
 * 이전에는 `if (!name)`만 검사해 **문자열이 아닌 값**(숫자 id, 객체)이 들어오면
 * `name.charCodeAt`에서 TypeError로 화면이 통째로 죽었다. 캐릭터 이름은 서버·유저
 * 양쪽에서 오므로 타입을 신뢰하지 않는다. 공백만 있는 이름도 판별 불가 → 폴백 신호.
 * @returns {number|null} 마지막 글자의 코드포인트, 판별 불가면 null
 */
const lastHangulCode = (name) => {
  if (typeof name !== "string") return null;
  const s = name.trim();
  if (!s) return null;
  const c = s.charCodeAt(s.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return null; // 비한글 종결 → 폴백 신호
  return c;
};

/**
 * [블록 A R2] 한국어 조사 유틸 — 동적 캐릭터명 뒤 와/과.
 * 규칙(디자인 정본 docs/15_assets 구현 계약): 한글 종성 판별
 * (code-0xAC00)%28 > 0 → '과', 아니면 '와'. 비한글 종결(영문·숫자 닉네임)은
 * 판별 불가이므로 이름 생략형 폴백을 쓴다.
 */
export const josaWaGwa = (name) => {
  const c = lastHangulCode(name);
  if (c === null) return null;
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
  const c = lastHangulCode(name);
  if (c === null) return null;
  return (c - 0xac00) % 28 > 0 ? "은" : "는";
};

/** 이/가 — 동일 계약. */
export const josaIGa = (name) => {
  const c = lastHangulCode(name);
  if (c === null) return null;
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
