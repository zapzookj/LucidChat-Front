/**
 * [V2 Story] DayPart 5단계 시간 시스템의 표시·호환 헬퍼.
 *
 * V2는 5단계: MORNING / NOON / AFTERNOON / EVENING / NIGHT
 * V1 BackgroundDisplay / AudioEngine은 3단계 time slot: DAY / SUNSET / NIGHT
 *
 * V2 → V1 매핑은 V1 정적 자산 경로 호환을 위한 폴백용. V2 본 흐름은
 * dynamicBackgroundUrl이 1순위라 이 매핑은 거의 사용되지 않는다.
 */

// ── 한국어 라벨 ──
export const DAY_PART_KR = {
  MORNING: "아침",
  NOON: "정오",
  AFTERNOON: "오후",
  EVENING: "저녁",
  NIGHT: "밤",
};

// ── 톤 컬러 (헤더 인디케이터 등 부가 UI용) ──
// 각 시간대 분위기 색을 슬쩍 텍스트/아이콘 컬러에 반영하면 풍부함이 살아난다.
export const DAY_PART_ACCENT = {
  MORNING: "text-amber-200",
  NOON:    "text-yellow-100",
  AFTERNOON: "text-orange-200",
  EVENING: "text-rose-300",
  NIGHT:   "text-indigo-200",
};

// ── V2 → V1 time slot 매핑 ──
export const DAY_PART_TO_V1_TIME = {
  MORNING:   "DAY",
  NOON:      "DAY",
  AFTERNOON: "DAY",
  EVENING:   "SUNSET",
  NIGHT:     "NIGHT",
};

export function dayPartLabel(dayPart) {
  return DAY_PART_KR[dayPart] || "?";
}

export function dayPartAccentClass(dayPart) {
  return DAY_PART_ACCENT[dayPart] || "text-stone-300";
}

export function dayPartToV1Time(dayPart) {
  return DAY_PART_TO_V1_TIME[dayPart] || "NIGHT";
}

// ── V2 → 정적 배경 시간대 (day/sunset/night) ──
//  배경 파일명 접미사용. DAY_PART_TO_V1_TIME(DAY/SUNSET/NIGHT)을 소문자로 재사용.
//  시간 비민감(실내) 배경은 _day.png 한 장만 두고, BackgroundDisplay가 _day로 폴백한다.
export function dayPartToBgTime(dayPart) {
  return (DAY_PART_TO_V1_TIME[dayPart] || "DAY").toLowerCase();
}