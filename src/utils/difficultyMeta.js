/**
 * [2026-08-05 난이도 배지 승격] 공략 난이도 단일 소스 (종원 승인)
 *
 * 배경: 기존 '공략 ★★☆☆' 칩이 무드 태그 클러스터에 묻혀 가시성이 낮았다.
 * → 4단계 라벨·4색·별점을 여기서 단일 관리하고, 소비처는 전부 이 모듈을 참조한다.
 *   - CharacterProfileView (panel/card/immersive 독립 배지 + dossier 레코드 행)
 *   - StudioPage 설정 수정 시트 난이도 셀렉터 (선택 상태 = 해당 색 배경)
 *   - StoryCreateFlow 히로인 카드 미니 배지 (NORMAL 숨김 정책은 소비처 유지)
 *
 * 주의: 클래스 문자열은 Tailwind JIT가 이 파일을 스캔해 추출한다 —
 *       동적 합성(`bg-${color}-400/20` 등) 금지, 반드시 완성 문자열로 유지할 것.
 */

/** 셀렉터 등 순서가 필요한 곳에서 사용 */
export const DIFFICULTY_ORDER = ["EASY", "NORMAL", "HARD", "EXTREME"];

export const DIFFICULTY_META = {
  EASY: {
    label: "쉬움",
    stars: "★☆☆☆",
    // 승격 배지 — 무드 칩(/15 bg·/25 border)보다 강한 채움+테두리
    badgeCls: "bg-emerald-400/20 text-emerald-100 border-emerald-300/60",
    // 스튜디오 셀렉터 선택 상태 — 해당 색 배경
    selectedCls: "bg-emerald-500/25 border-emerald-400/60 text-emerald-100",
  },
  NORMAL: {
    label: "보통",
    stars: "★★☆☆",
    badgeCls: "bg-sky-400/20 text-sky-100 border-sky-300/60",
    selectedCls: "bg-sky-500/25 border-sky-400/60 text-sky-100",
  },
  HARD: {
    label: "어려움",
    stars: "★★★☆",
    badgeCls: "bg-orange-400/20 text-orange-100 border-orange-300/60",
    selectedCls: "bg-orange-500/25 border-orange-400/60 text-orange-100",
  },
  EXTREME: {
    label: "극한",
    stars: "★★★★",
    badgeCls: "bg-rose-400/20 text-rose-100 border-rose-300/60",
    selectedCls: "bg-rose-500/25 border-rose-400/60 text-rose-100",
  },
};

/** 채워진 별만 (★ / ★★ / ★★★ / ★★★★) — 미니 배지·셀렉터 라벨용 */
export const difficultyFilledStars = (difficulty) =>
  DIFFICULTY_META[difficulty]?.stars.replace(/☆/g, "") || "";
