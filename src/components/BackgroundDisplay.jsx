import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef, useMemo } from "react";
import { assetUrl } from "../utils/assetUrl";
import { dayPartToBgTime } from "../utils/dayPart";

// ═══════════════════════════════════════════════════════════════
//  BackgroundDisplay — 배경 전환 엔진
//
//  [정책: 정적 우선] (V2)
//    우선순위: ① 정적 per-location(현재 장소+시간대) → ② 정적 _day 폴백
//              → ③ 동적 생성 URL(정적 없는 새 장소) → (없으면 그라데이션 안전망)
//    경로: /backgrounds/locations/{worldId_소문자}/{location_key_소문자}_{day|sunset|night}.png
//    · 시간 비민감(실내) 장소는 _day.png 한 장만 → _day 폴백이 흡수.
//    · 시드 장소는 location_change로만 이동(백엔드 동적 생성 X) → 정적이 서빙.
//    · 새 동적 장소만 new_dynamic_location → 동적 생성 → ③으로 폴백.
//
//  [V1 Sandbox] 기존 동작 보존 — 동적 우선 → enum 정적 → 캐릭터 bg_default.
//
//  onError 폴백 체인: 한 후보가 404면 다음 후보로 *조용히* 교체(크로스페이드 없음).
//  실제 배경 변경(장소/시간대 전환) 시에만 크로스페이드 + opt-in Ken Burns.
// ═══════════════════════════════════════════════════════════════

/**
 * [V1 Sandbox 전용] location + time + characterSlug → 정적 배경 경로.
 * 규칙: /backgrounds/{slug}/bg_{location}_{time}.png
 */
function resolveBackground(location, time, characterSlug) {
  const slug = characterSlug || "airi";
  if (!location) return null;
  const t = (time || "NIGHT").toLowerCase();
  const loc = location.toLowerCase();
  return assetUrl(`/backgrounds/${slug}/bg_${loc}_${t}.png`);
}

/**
 * 기본 배경 폴백 (V1 Sandbox / 안전망).
 * V2: /backgrounds/worlds/{worldId_lower}/bg_default.png
 * V1: /backgrounds/{slug}/bg_default.png
 */
function getDefaultBg(characterSlug, worldId) {
  if (worldId) {
    return assetUrl(`/backgrounds/worlds/${String(worldId).toLowerCase()}/bg_default.png`);
  }
  const slug = characterSlug || "airi";
  return assetUrl(`/backgrounds/${slug}/bg_default.png`);
}

/**
 * [정책: 정적 우선] V2 정적 per-location 배경 경로.
 * /backgrounds/locations/{worldId_lower}/{locationKey_lower}_{bgTime}.png
 */
function buildStaticLocationPath(worldId, locationKey, bgTime) {
  if (!worldId || !locationKey) return null;
  const w = String(worldId).toLowerCase();
  const loc = String(locationKey).toLowerCase();
  return assetUrl(`/backgrounds/locations/${w}/${loc}_${bgTime}.png`);
}

/**
 * @param {object} props
 * @param {string|null} props.location           — V1 Location enum 키 (V2는 null)
 * @param {string|null} props.time               — V1 time slot (V2는 null)
 * @param {string} [props.characterSlug]         — V1 Sandbox 슬러그
 * @param {string} [props.worldId]               — V2 Story worldId (대문자 enum)
 * @param {string} [props.locationKey]           — V2 현재 장소 키 (정적 경로 해상도)
 * @param {string} [props.dayPart]               — V2 현재 DayPart (→ 정적 시간대)
 * @param {string|null} [props.dynamicBackgroundUrl] — AI 생성/캐시 배경 URL
 * @param {boolean} [props.enableKenBurns=false] — V2 권장 true
 */
const BackgroundDisplay = ({
  location, time, characterSlug, worldId,
  locationKey, dayPart,
  dynamicBackgroundUrl, preferDynamic = false,
  enableKenBurns = false,
}) => {
  // ── 후보 URL 목록 (우선순위 순). onError로 다음 후보 폴백. ──
  const candidates = useMemo(() => {
    const list = [];
    if (worldId) {
      // V2: 시드 장소 → 정적 우선 / 즉석(invented) 장소 → 동적 우선 (preferDynamic)
      const bgTime = dayPartToBgTime(dayPart);
      const staticTime = buildStaticLocationPath(worldId, locationKey, bgTime);
      const staticDay = buildStaticLocationPath(worldId, locationKey, "day");
      const statics = [];
      if (staticTime) statics.push(staticTime);
      if (staticDay && staticDay !== staticTime) statics.push(staticDay);
      if (preferDynamic) {
        // 즉석 생성 장소 — 정적 에셋 없음 → 동적 우선, 정적은 동적 실패 시 폴백
        if (dynamicBackgroundUrl) list.push(dynamicBackgroundUrl);
        statics.forEach((u) => list.push(u));
      } else {
        // 시드 장소 — 정적 우선, 동적은 폴백
        statics.forEach((u) => list.push(u));
        if (dynamicBackgroundUrl) list.push(dynamicBackgroundUrl);
      }
    } else {
      // V1: 동적 우선 → enum 정적 → 캐릭터 기본 (기존 동작 보존)
      if (dynamicBackgroundUrl) list.push(dynamicBackgroundUrl);
      const enumBg = resolveBackground(location, time, characterSlug);
      if (enumBg) list.push(enumBg);
      list.push(getDefaultBg(characterSlug, null));
    }
    // 중복 제거 + falsy 제거
    return list.filter((u, i) => u && list.indexOf(u) === i);
  }, [worldId, locationKey, dayPart, dynamicBackgroundUrl, preferDynamic, location, time, characterSlug]);

  const candidatesKey = candidates.join("|");
  const [idx, setIdx] = useState(0);
  const [bgKey, setBgKey] = useState(0);
  const prevKeyRef = useRef(candidatesKey);

  // 후보 목록이 실제로 바뀌면 첫 후보부터 + 크로스페이드(remount)
  useEffect(() => {
    if (candidatesKey !== prevKeyRef.current) {
      prevKeyRef.current = candidatesKey;
      setIdx(0);
      setBgKey((k) => k + 1);
    }
  }, [candidatesKey]);

  const currentBg = candidates.length > 0
    ? candidates[Math.min(idx, candidates.length - 1)]
    : null;

  // ── Ken Burns (opt-in) ──
  const kenBurnsAnimate = enableKenBurns
    ? { opacity: 0.85, scale: 1.06 }
    : { opacity: 0.85, scale: 1 };
  const kenBurnsTransition = enableKenBurns
    ? {
        opacity: { duration: 1.2, ease: "easeInOut" },
        scale:   { duration: 60,  ease: "easeOut" },
      }
    : { duration: 1.2, ease: "easeInOut" };

  return (
    <>
      {/* 안전망: 모든 후보가 없거나 404일 때 보이는 그라데이션 (bg_default 미사용) */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-gray-800 to-gray-950" />

      {/* 배경 이미지 (크로스페이드 + opt-in Ken Burns) */}
      <AnimatePresence mode="sync">
        {currentBg && (
          <motion.img
            key={bgKey}
            src={currentBg}
            alt="Background"
            className="absolute inset-0 w-full h-full object-cover z-0"
            style={{ transformOrigin: "center" }}
            initial={{ opacity: 0, scale: 1 }}
            animate={kenBurnsAnimate}
            exit={{ opacity: 0 }}
            transition={kenBurnsTransition}
            onError={() => {
              // 현재 후보 404 → 다음 후보로 조용히 교체 (크로스페이드 없이 src만 변경)
              setIdx((i) => (i < candidates.length - 1 ? i + 1 : i));
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export { resolveBackground, getDefaultBg };
export default BackgroundDisplay;