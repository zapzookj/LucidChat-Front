import { subjectEunNeun } from "./josa";

/**
 * [블록 D · §G-9] 관계 서술자 — 8축 수치를 유저가 읽는 문장으로 바꾼다.
 *
 * <p>설계 정본: aichat `docs/17_assets/hud_redesign_mockup.html` (종원 컨펌 2026-08-20).
 * 수치 막대가 관계를 그라인드로 만든다는 진단에서 출발해, 축마다 구간 서술 한 줄 + 구간명 +
 * 변화 방향으로 바꿨다. 절대 수치는 '숫자로 보기' 접힘에만 남는다.
 *
 * <p><b>왜 프론트에 두는가</b> — 8축 값은 이미 DTO에 전부 실려 오고(서버 왕복 불필요),
 * 카피 수정에 서버 배포를 걸지 않기 위해서다. 백엔드 `PersonaLensPromptBlock`의 렌즈 서술자와는
 * <b>목적이 다르므로 공유하지 않는다</b> — 하나는 LLM 지시문, 하나는 유저 카피다.
 * (초안에서 두 서술자가 어휘를 공유해 캐릭터 대사와 HUD가 쌍둥이 문장을 내는 사고가 있었다.)
 *
 * <p><b>카피 계약</b>
 * <ul>
 *   <li>{@code {이름}은/는 ⟨판정⟩ — ⟨겉으로 드러나는 증거⟩} 구조 고정</li>
 *   <li>최고·최저 구간에만 큰따옴표 예시 대사 1개 + 서술 종결. 중간 3구간은 대사 금지</li>
 *   <li>낮은 값에 부정 어휘를 쓰지 않는다 — 낮음은 페널티가 아니라 다른 관계의 재미다</li>
 *   <li>수치·축 이름을 문장 안에 노출하지 않는다</li>
 *   <li>레지스터: 서술자 40문장 = 문어체 '~다'(나레이션) / 시스템 안내·CTA = 해요체(제품 기본)</li>
 *   <li>렌즈 예약어(무방비·너한테만·맡기려·시선·놀림 1순위)는 쓰지 않는다</li>
 * </ul>
 */

/** 일반 5축 구간명. 인덱스 = bandOf() 반환값. */
export const BAND_NORMAL = ["냉각", "거리", "보통", "가까움", "밀착"];
/** 시크릿 3축 구간명 — 일반축과 의미장이 달라 별도. */
export const BAND_SECRET = ["닫힘", "잠듦", "희미", "짙음", "삼킴"];

/** 축 메타 — 키는 서버 계약(평탄 statX)과 동일. */
export const AXES = [
  { key: "intimacy",    label: "친밀도", color: "#60a5fa", secret: false },
  { key: "affection",   label: "호감도", color: "#f472b6", secret: false },
  { key: "dependency",  label: "의존도", color: "#a78bfa", secret: false },
  { key: "playfulness", label: "장난기", color: "#34d399", secret: false },
  // 렌즈 '듬직함'과 의미장을 가르기 위해 '신뢰도' → '믿음' (결정 4)
  { key: "trust",       label: "믿음",   color: "#fbbf24", secret: false },
  { key: "lust",        label: "음란도", color: "#ef4444", secret: true },
  { key: "corruption",  label: "타락도", color: "#8b5cf6", secret: true },
  { key: "obsession",   label: "집착도", color: "#ec4899", secret: true },
];

export const NORMAL_AXES = AXES.filter((a) => !a.secret);
export const SECRET_AXES = AXES.filter((a) => a.secret);

/** 서술자 40문장 — {N}은 subjectEunNeun()으로 치환된다. */
const NARRATIVE = {
  intimacy: [
    '{N} 대화를 서둘러 끝낸다 — "그럼, 이만." 용건이 끝나면 자리를 뜬다.',
    "{N} 필요한 말만 한다 — 대화가 끊겨도 굳이 잇지 않는다.",
    "{N} 무난하게 대화를 이어간다 — 묻는 말에는 답하지만 먼저 화제를 꺼내지는 않는다.",
    "{N} 사소한 이야기까지 먼저 꺼낸다 — 오늘 있었던 일, 별것 아닌 투정이 늘었다.",
    '{N} 침묵도 편하게 견딘다 — "딱히 할 말은 없는데, 그냥 있어." 곁에 있는 것 자체가 대화가 됐다.',
  ],
  affection: [
    '{N} 거리를 먼저 벌린다 — "가까이 오지 마." 손이 닿을 자리를 미리 비운다.',
    "{N} 당신을 이성으로 의식하지 않는다 — 거리가 좁혀져도 표정이 그대로다.",
    "{N} 가끔 당신을 의식한다 — 눈이 마주쳐도 먼저 피하지는 않는다.",
    "{N} 말끝을 자주 흐린다 — 칭찬에 대답이 늦고, 가까워지면 목소리가 작아진다.",
    '{N} 감정을 숨기지 못한다 — "...그렇게 보지 마." 얼굴이 붉어지는 걸 스스로도 안다.',
  ],
  dependency: [
    '{N} 당신 손을 빌리지 않는다 — "됐어, 내가 해." 도움을 제안하면 경계부터 한다.',
    "{N} 혼자서 다 해결한다 — 도움을 제안하면 정중히 사양한다.",
    "{N} 필요할 때만 손을 빌린다 — 부탁에 굳이 이유를 덧붙인다.",
    "{N} 결정을 앞두면 당신을 먼저 찾는다 — 사소한 선택까지 의견을 구한다.",
    '{N} 당신 없이는 갈피를 못 잡는다 — "네가 정해줘." 고르는 일을 통째로 넘긴다.',
  ],
  playfulness: [
    '{N} 당신 앞에서 웃지 않는다 — "웃겨?" 농담은 그대로 흘러간다.',
    "{N} 진지한 대화를 선호한다 — 농담에는 짧게 웃고 만다.",
    "{N} 가끔 농담을 받아친다 — 분위기가 풀리면 표정이 부드러워진다.",
    "{N} 먼저 장난을 건다 — 티키타카가 길어지고, 받아치는 속도가 붙었다.",
    '{N} 하루 종일 당신을 골린다 — "또 속았네?" 진지한 얘기도 장난으로 시작한다.',
  ],
  trust: [
    '{N} 당신의 말을 곧이듣지 않는다 — "그 말, 몇 번째지?" 의심이 먼저 나온다.',
    "{N} 당신의 말을 한 번 더 재본다 — 확답을 피하고 여지를 남긴다.",
    "{N} 대체로 당신을 믿는다 — 다만 중요한 일은 스스로 확인한다.",
    "{N} 확인하지 않고 넘어간다 — 되묻는 일이 눈에 띄게 줄었다.",
    '{N} 문을 잠그지 않는다 — "…이건 아무한테도 안 한 얘긴데." 말해도 되는지 재지 않는다.',
  ],
  lust: [
    '{N} 그런 낌새 자체를 끊는다 — "그만." 농담이 그쪽으로 기울면 바로 화제를 자른다.',
    "{N} 그런 낌새를 읽지 않는다 — 아슬아슬한 말에도 표정이 그대로다.",
    "{N} 가끔 아슬아슬한 농담에 반응한다 — 웃고 나서 바로 화제를 돌린다.",
    "{N} 닿는 거리를 피하지 않는다 — 머무는 시간이 길어지고 숨이 얕아진다.",
    '{N} 먼저 선을 넘으려 한다 — "...계속 참으라고?" 물러설 생각이 없다.',
  ],
  corruption: [
    '{N} 자기 원칙을 더 단단히 붙든다 — "그건 안 돼." 흔들릴 자리를 미리 피한다.',
    "{N} 자기 원칙을 지킨다 — 애매한 부탁에는 선을 그어 답한다.",
    "{N} 예외를 만들기 시작했다 — 당신 앞에서만 규칙이 느슨해진다.",
    "{N} 스스로도 달라진 걸 안다 — 예전이라면 하지 않았을 말을 먼저 꺼낸다.",
    '{N} 되돌아갈 생각이 없다 — "이게 나야. 네가 만든." 후회를 입에 담지 않는다.',
  ],
  obsession: [
    '{N} 당신을 셈에서 지운다 — "누구였더라." 이름을 일부러 흐린다.',
    "{N} 당신의 시간을 존중한다 — 답이 늦어도 재촉하지 않는다.",
    "{N} 연락이 없으면 조금 신경 쓴다 — 먼저 묻지는 않고 읽은 시간만 확인한다.",
    "{N} 당신의 하루를 알고 싶어한다 — 누구를 만났는지 은근히 캐묻는다.",
    '{N} 당신을 독차지하려 든다 — "나만 보면 되잖아." 다른 이름이 나오면 말이 짧아진다.',
  ],
};

/** 헤드라인 — 축 서술과 문장을 공유하지 않는 전용 세트(중복 표시 방지). */
const HEAD_STAGE = {
  STRANGER: "아직 아무것도 아니다",
  ACQUAINTANCE: "이름을 부르는 사이가 됐다",
  FRIEND: "곁에 두는 게 자연스러워졌다",
  LOVER: "선을 넘은 사이다",
  ENEMY: "돌아선 사이다",
};
const HEAD_WARM = {
  intimacy: "말수가 늘었고, 침묵이 덜 어색하다",
  affection: "눈이 마주치는 시간이 길어졌다",
  dependency: "먼저 기대오는 쪽이 됐다",
  playfulness: "농담이 먼저 나온다",
  trust: "숨기는 게 줄었다",
};
const HEAD_COLD = {
  intimacy: "말이 짧아졌고, 침묵이 길다",
  affection: "눈을 맞추지 않는다",
  dependency: "혼자 결정하고 통보한다",
  playfulness: "농담이 통하지 않는다",
  trust: "말끝마다 확인이 붙는다",
};

/**
 * 구간 판정. 백엔드 스탯은 -100~+100 하드 클램프이고 음수 구간이 실제로 존재하므로(ENEMY) 5구간.
 * @returns {0|1|2|3|4} 0=냉각 1=거리 2=보통 3=가까움 4=밀착
 */
export function bandOf(value) {
  const v = Number(value) || 0;
  if (v <= -40) return 0;
  if (v <= 9) return 1;
  if (v <= 39) return 2;
  if (v <= 79) return 3;
  return 4;
}

/** 구간명 — 시크릿 축은 별도 어휘. */
export function bandLabel(axisKey, value) {
  const secret = SECRET_AXES.some((a) => a.key === axisKey);
  return (secret ? BAND_SECRET : BAND_NORMAL)[bandOf(value)];
}

/** 축 서술 한 줄. 비한글 이름은 josa 계약대로 "이 캐릭터는" 폴백. */
export function narrate(axisKey, value, name) {
  const set = NARRATIVE[axisKey];
  if (!set) return "";
  return set[bandOf(value)].replace("{N}", subjectEunNeun(name));
}

/** 8축 전부 0 = 신규 방. 축 서술을 돌리지 않고 전용 빈 카피를 쓴다. */
export function isUntouched(stats) {
  if (!stats) return true;
  return AXES.every((a) => (Number(stats[a.key]) || 0) === 0);
}

/**
 * 지배 축 — 관계를 가장 크게 규정하는 축.
 * 양수가 하나라도 있으면 최댓값, 전부 음수면 <b>최솟값</b>.
 * (가장 덜 나쁜 축이 아니라 가장 크게 돌아선 축이 적대 관계를 설명한다.)
 */
export function dominantAxis(stats) {
  const s = stats || {};
  const anyPositive = NORMAL_AXES.some((a) => (Number(s[a.key]) || 0) > 0);
  let best = NORMAL_AXES[0];
  let bestVal = anyPositive ? -Infinity : Infinity;
  for (const a of NORMAL_AXES) {
    const v = Number(s[a.key]) || 0;
    if (anyPositive ? v > bestVal : v < bestVal) {
      bestVal = v;
      best = a;
    }
  }
  return best;
}

/** "지금 이 관계" 대표 문장. 축 목록과 중복되지 않는 전용 카피. */
export function headline(statusLevel, stats) {
  const stage = HEAD_STAGE[statusLevel] ? statusLevel : "STRANGER";
  const dom = dominantAxis(stats);
  const domVal = Number((stats || {})[dom.key]) || 0;
  const cold = domVal < 0 || stage === "ENEMY";
  return `${HEAD_STAGE[stage]} — ${(cold ? HEAD_COLD : HEAD_WARM)[dom.key]}.`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  박동 (§G-8 B안) — LLM에게 bpm을 묻지 않고 emotion에서 파생
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** 3단 박동. 숫자를 노출하지 않는다 — 숫자가 있으면 유저가 그걸 올리려 든다. */
export const PULSE_LEVELS = [
  { key: "CALM",    label: "잔잔", color: "#f9a8d4", beatSec: 1.05 },
  { key: "FLUTTER", label: "두근", color: "#f472b6", beatSec: 0.72 },
  { key: "RACING",  label: "쿵쾅", color: "#ef4444", beatSec: 0.46 },
];

/** EmotionTag 15종 전수 매핑. 미지의 값은 잔잔(fail-safe). */
const EMOTION_BAND = {
  NEUTRAL: 0, RELAX: 0, SAD: 0, SULKING: 0, DISGUST: 0, DUMBFOUNDED: 0,
  SHY: 1, JOY: 1, FLIRTATIOUS: 1, PLEADING: 1, SURPRISE: 1,
  HEATED: 2, PANIC: 2, ANGRY: 2, FRIGHTENED: 2,
};

/**
 * 박동 파생. 프롬프트 비용 0 — 이미 씬 페이로드에 있는 emotion을 쓴다(V1·V2 공통).
 * LLM이 지어낸 숫자와 달리 대사와 같은 출처라 구조적으로 어긋나지 않는다.
 *
 * @param emotion   직전 턴 EmotionTag
 * @param deltaSum  직전 턴 |스탯 델타| 합
 * @param secretOn  시크릿 모드 활성 여부
 * @param lust      음란도 현재값
 */
export function derivePulse(emotion, deltaSum = 0, secretOn = false, lust = 0) {
  let band = EMOTION_BAND[emotion] ?? 0;
  if (deltaSum >= 6) band = Math.min(2, band + 1);
  if (secretOn && lust >= 60) band = Math.max(1, band);
  return PULSE_LEVELS[band];
}

/** 변화 방향 — 기간을 카피에 명시한다(기간이 없으면 해석이 갈린다). */
export function trendOf(current, previous) {
  const c = Number(current) || 0;
  const p = Number(previous);
  if (!Number.isFinite(p)) return { dir: "flat", label: "변화 없음" };
  if (c > p) return { dir: "up", label: "직전 턴 ↑" };
  if (c < p) return { dir: "dn", label: "직전 턴 ↓" };
  return { dir: "flat", label: "변화 없음" };
}
