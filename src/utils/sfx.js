// [Phase 6] 라이브러리 SFX 시스템.
//
// 기능:
//   - 라이브러리 ID(L1~L14) 기반 매핑 호출 — playLibrarySfx("L4")
//   - sfx 객체 단축 호출 — sfx.chime(), sfx.thud()
//   - 임의 경로 호출(레거시) — playSfx("/sounds/sfx_button_click.wav")
//   - 마스터 볼륨 / 뮤트 — setSfxMasterVolume, setSfxMuted
//
// 통합 메모:
//   - L6(warning) → L5(thud)로 통합
//   - L7(호감도 chime) → L4(chime)로 통합
//
// 모든 경로는 내부에서 assetUrl()로 변환 — CDN 자동 적용.

import { assetUrl } from "./assetUrl";

const LIBRARY = {
  L1:  { src: "/sounds/sfx_button_click.wav",  defaultVolume: 0.30 }, // 클릭 (보유)
  L2:  { src: "/sounds/sfx_button_hover.ogg",  defaultVolume: 0.15 }, // 호버 (보유)
  L3:  { src: "/sounds/sfx_locked.wav",        defaultVolume: 0.30 }, // disabled/locked
  L4:  { src: "/sounds/sfx_chime.wav",         defaultVolume: 0.40 }, // 긍정 + 호감도 +
  L5:  { src: "/sounds/sfx_thud.wav",          defaultVolume: 0.40 }, // 부정 + warning
  L8:  { src: "/sounds/sfx_woosh_light.wav",   defaultVolume: 0.30 }, // 가벼운 woosh
  L9:  { src: "/sounds/sfx_page_turn.wav",     defaultVolume: 0.25 }, // 페이지 턴
  L10: { src: "/sounds/sfx_woosh_deep.ogg",    defaultVolume: 0.40 }, // 깊은 woosh + drone
  L11: { src: "/sounds/sfx_boom.wav",          defaultVolume: 0.50 }, // 시네마틱 boom
  L12: { src: "/sounds/sfx_sparkle.wav",       defaultVolume: 0.40 }, // sparkle
  L13: { src: "/sounds/sfx_typewriter.wav",    defaultVolume: 0.08 }, // 타자기
  L14: { src: "/sounds/sfx_card_fanout.wav",   defaultVolume: 0.35 }, // 카드 fan-out
};

// ── 인스턴스 캐시 + 마스터 상태 ──
const audioCache = {};
let masterSfxVolume = 1.0;
let muted = false;

export function setSfxMasterVolume(v) {
  const num = Number(v);
  masterSfxVolume = Number.isFinite(num) ? Math.max(0, Math.min(1, num)) : 1;
}
export function setSfxMuted(m) { muted = !!m; }
export function isSfxMuted() { return muted; }
export function getSfxMasterVolume() { return masterSfxVolume; }

function getOrCreate(key, src) {
  if (!audioCache[key]) {
    const a = new Audio(src);
    a.preload = "auto";
    audioCache[key] = a;
  }
  return audioCache[key];
}

/**
 * 라이브러리 SFX 재생.
 * @param {keyof typeof LIBRARY} id   ex) "L4"
 * @param {number} [volumeOverride]   0~1 (생략 시 라이브러리 default)
 */
export function playLibrarySfx(id, volumeOverride) {
  if (muted) return;
  const entry = LIBRARY[id];
  if (!entry) {
    console.warn(`[SFX] Unknown library id: ${id}`);
    return;
  }
  try {
    const url = assetUrl(entry.src);
    const audio = getOrCreate(`__lib_${id}`, url);
    const baseVol = volumeOverride != null ? volumeOverride : entry.defaultVolume;
    audio.volume = Math.max(0, Math.min(1, baseVol * masterSfxVolume));
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch { /* noop */ }
}

/**
 * 레거시 경로 기반 호출 (LobbyPage 기존 호출 호환).
 * 내부적으로 assetUrl로 변환하므로 CDN 자동 적용된다.
 */
export function playSfx(src, volume = 0.35) {
  if (muted) return;
  try {
    const url = assetUrl(src);
    const audio = getOrCreate(url, url);
    audio.volume = Math.max(0, Math.min(1, volume * masterSfxVolume));
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch { /* noop */ }
}

// ── 단축 호출 ──
export const sfx = {
  click:      (v) => playLibrarySfx("L1", v),
  hover:      (v) => playLibrarySfx("L2", v),
  locked:     (v) => playLibrarySfx("L3", v),
  chime:      (v) => playLibrarySfx("L4", v),
  affection:  (v) => playLibrarySfx("L4", v),  // 호감도 = chime (L7 통합)
  thud:       (v) => playLibrarySfx("L5", v),
  warning:    (v) => playLibrarySfx("L5", v),  // 경고 = thud (L6 통합)
  wooshLight: (v) => playLibrarySfx("L8", v),
  pageTurn:   (v) => playLibrarySfx("L9", v),
  wooshDeep:  (v) => playLibrarySfx("L10", v),
  boom:       (v) => playLibrarySfx("L11", v),
  sparkle:    (v) => playLibrarySfx("L12", v),
  typewriter: (v) => playLibrarySfx("L13", v),
  cardFanout: (v) => playLibrarySfx("L14", v),
};

export default playLibrarySfx;