/**
 * [Story V2] 멀티 히로인 컨텍스트의 시각 변별을 위한 캐릭터 컬러 팔레트.
 *
 * <p>대화 기록 패널의 말풍선 색상이 *캐릭터별로 다르게* 표시되어야 한다 — 사용자가
 * 동일 색상의 말풍선들 사이에서 누가 말했는지 일일이 캐릭터명을 보지 않고도 시각적으로
 * 구분할 수 있도록.
 *
 * <p>설계 원칙:
 *  - **deterministic**: 동일 characterId → 항상 동일 색상 (방 재진입 시 일관성)
 *  - **heroines 순서 무관**: characterId 모듈로 매핑 — 새 히로인이 추가되어도 기존 색상 안 바뀜
 *  - **시스템 메시지**: 캐릭터가 아닌 화자 (Director / Narrator) — 균일 회색 톤
 *  - **유저 메시지**: 별도 톤 (V1과 동일 — 보통 darker, right-aligned)
 *
 * <p>팔레트는 *Tailwind 클래스명* 반환 — JSX에서 string concat 또는 template literal로 사용.
 */

/**
 * 5개 히로인까지 cover하는 컬러 팔레트.
 *
 * 각 항목 = { bubble, accent, label }
 *  - bubble: 말풍선 배경 클래스 (Tailwind)
 *  - accent: 캐릭터명/border 강조 색
 *  - label:  팔레트 식별 이름 (디버깅용)
 */
const HEROINE_PALETTE = [
  // 0 — Rose (따뜻한 첫번째)
  {
    bubble: "bg-rose-500/15 border-rose-400/30",
    accent: "text-rose-300",
    label: "rose",
  },
  // 1 — Sky (시원한 두번째)
  {
    bubble: "bg-sky-500/15 border-sky-400/30",
    accent: "text-sky-300",
    label: "sky",
  },
  // 2 — Emerald (안정적 세번째)
  {
    bubble: "bg-emerald-500/15 border-emerald-400/30",
    accent: "text-emerald-300",
    label: "emerald",
  },
  // 3 — Amber (활기찬 네번째)
  {
    bubble: "bg-amber-500/15 border-amber-400/30",
    accent: "text-amber-300",
    label: "amber",
  },
  // 4 — Violet (신비로운 다섯번째)
  {
    bubble: "bg-violet-500/15 border-violet-400/30",
    accent: "text-violet-300",
    label: "violet",
  },
];

/** 시스템(non-character) 화자 — Director / Narrator 등 균일 톤. */
const SYSTEM_PALETTE = {
  bubble: "bg-white/5 border-white/10",
  accent: "text-white/60",
  label: "system",
};

/** 유저 메시지 — V1 톤 유지 (오른쪽 정렬, 다소 어둡고 단단한 톤). */
const USER_PALETTE = {
  bubble: "bg-indigo-600/30 border-indigo-500/30",
  accent: "text-indigo-200",
  label: "user",
};

/**
 * heroines 배열에서 characterId의 인덱스를 찾아 deterministic palette 반환.
 *
 * @param {number|null|undefined} characterId
 * @param {Array<{characterId:number}>} heroines  — 방의 ChatRoomHeroine 배열 (정렬 순서 유지)
 * @returns {{bubble:string, accent:string, label:string}}
 */
export function getHeroinePaletteByCharacterId(characterId, heroines) {
  if (characterId == null || !heroines || heroines.length === 0) {
    return SYSTEM_PALETTE;
  }
  const idx = heroines.findIndex((h) => h.characterId === characterId);
  if (idx < 0) {
    // 메시지에 명시된 characterId가 현재 방 heroines에 없는 경우 — system fallback
    return SYSTEM_PALETTE;
  }
  return HEROINE_PALETTE[idx % HEROINE_PALETTE.length];
}

export const SYSTEM_BUBBLE_PALETTE = SYSTEM_PALETTE;
export const USER_BUBBLE_PALETTE = USER_PALETTE;