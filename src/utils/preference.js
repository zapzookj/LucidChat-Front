/**
 * [블록 A R2] 선호 캐릭터 취향 — 개인화 정렬 v1의 키.
 * 유저 성별을 묻지 않고 선호 캐릭터 성별을 직접 묻는다(가정 0 원칙, 디자인 정본 §2).
 * v1은 로컬 저장 + 프론트 정렬(백엔드 무변경). 블록 B에서 유저 프로필 필드로 승격 예정.
 *  - 'FEMALE' | 'MALE'  : 해당 성별 우선 정렬
 *  - 'ALL'              : 응답했지만 중립
 *  - null(미저장)        : 미응답 — 중립 정렬 + 카피 분기
 */
const KEY = "lucid:prefGender";

export const getPrefGender = () => {
  const v = localStorage.getItem(KEY);
  return v === "FEMALE" || v === "MALE" ? v : null;
};

export const hasAnsweredPref = () => localStorage.getItem(KEY) != null;

export const setPrefGender = (v) => {
  localStorage.setItem(KEY, v === "FEMALE" || v === "MALE" ? v : "ALL");
};

/** 선호 우선 안정 정렬 — 서버 큐레이션 순서를 보존한 채 선호 성별만 앞으로 */
export const sortByPreference = (items, pref) => {
  if (!pref) return items;
  const hit = items.filter((i) => (i.gender || "FEMALE") === pref);
  const rest = items.filter((i) => (i.gender || "FEMALE") !== pref);
  return [...hit, ...rest];
};
