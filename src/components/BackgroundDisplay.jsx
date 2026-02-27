import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════════
//  [Phase 4] BackgroundDisplay — 동적 배경 전환 엔진
//  [Phase 5] 멀티캐릭터 지원:
//    • characterSlug prop → 캐릭터 전용 기본 배경
//    • 스토리 모드 장소 배경은 공유 에셋 (변경 없음)
//    • 자유(샌드박스) 모드 기본 배경: /backgrounds/characters/{slug}/bg_default.png
// ═══════════════════════════════════════════════════════════════

// ─── 공유 배경 이미지 매핑 테이블 (스토리 모드 장소) ───
const BG_MAP = {
  LIVINGROOM_DAY:   "bg_livingroom_day.png",
  LIVINGROOM_NIGHT: "bg_livingroom_night.png",
  BALCONY_DAY:      "bg_balcony_day.png",
  BALCONY_NIGHT:    "bg_balcony_night.png",
  STUDY_DAY:        "bg_study.png",
  STUDY_NIGHT:      "bg_study.png",
  BATHROOM_DAY:     "bg_bathroom_day.png",
  BATHROOM_NIGHT:   "bg_bathroom_night.png",
  GARDEN_DAY:       "bg_garden_day.png",
  GARDEN_NIGHT:     "bg_garden_night.png",
  KITCHEN_DAY:      "bg_kitchen_day.png",
  KITCHEN_NIGHT:    "bg_kitchen_night.png",
  BEDROOM_DAY:      "bg_bedroom_day.png",
  BEDROOM_NIGHT:    "bg_bedroom_night.png",
  ENTRANCE_DAY:     "bg_entrance_day.png",
  ENTRANCE_NIGHT:   "bg_entrance_night.png",
  FOREST_DAY:       "bg_forest_day.png",
  FOREST_NIGHT:     "bg_forest_night.png",
  BEACH_DAY:        "bg_beach_day.png",
  BEACH_NIGHT:      "bg_beach_night.png",
  BEACH_SUNSET:     "bg_beach_sunset.png",
  DOWNTOWN_DAY:     "bg_downtown_day.png",
  DOWNTOWN_NIGHT:   "bg_downtown_night.png",
  BAR_NIGHT:        "bg_bar_night.png",
  BAR_DAY:          "bg_bar_night.png",
};

/**
 * [Phase 5] characterSlug에 따른 기본 배경 이미지 경로
 * 캐릭터 전용 기본 배경이 있으면 사용, 없으면 공유 배경 폴백
 */
function getDefaultBg(characterSlug) {
  if (characterSlug) {
    return `/backgrounds/characters/${characterSlug}/bg_default.png`;
  }
  return "/backgrounds/bg_entrance_night.png";
}

/**
 * location + time → 배경 파일명 resolve
 * [Phase 5] location이 없을 때는 캐릭터별 기본 배경 사용
 */
function resolveBackground(location, time, characterSlug) {
  if (!location) return null;

  const t = time || "NIGHT";
  const key = `${location}_${t}`;

  const matched = BG_MAP[key] || BG_MAP[`${location}_NIGHT`] || BG_MAP[`${location}_DAY`];
  if (matched) {
    return `/backgrounds/${matched}`;
  }

  // 매핑에 없는 location → 캐릭터별 기본 배경 폴백
  return getDefaultBg(characterSlug);
}

/**
 * 시간대별 그라데이션 오버레이
 */
function getTimeOverlay(time) {
  switch (time) {
    case "DAY":
      return "bg-gradient-to-t from-black/70 via-black/10 to-black/20";
    case "SUNSET":
      return "bg-gradient-to-t from-black/70 via-orange-950/15 to-amber-900/20";
    case "NIGHT":
    default:
      return "bg-gradient-to-t from-black/90 via-black/20 to-black/40";
  }
}

const BackgroundDisplay = ({ location, time, characterSlug }) => {
  const defaultBg = getDefaultBg(characterSlug);
  const [currentBg, setCurrentBg] = useState(defaultBg);
  const [bgKey, setBgKey] = useState(0);
  const prevBgRef = useRef(defaultBg);

  // [Phase 5] characterSlug 변경 시 기본 배경 갱신
  useEffect(() => {
    const newDefault = getDefaultBg(characterSlug);
    if (!location && newDefault !== prevBgRef.current) {
      prevBgRef.current = newDefault;
      setCurrentBg(newDefault);
      setBgKey(prev => prev + 1);
    }
  }, [characterSlug]);

  useEffect(() => {
    const newBg = resolveBackground(location, time, characterSlug);
    if (newBg && newBg !== prevBgRef.current) {
      prevBgRef.current = newBg;
      setCurrentBg(newBg);
      setBgKey(prev => prev + 1);
    }
  }, [location, time, characterSlug]);

  const overlayClass = getTimeOverlay(time);

  return (
    <>
      {/* ═══ 배경 이미지 (크로스페이드) ═══ */}
      <AnimatePresence mode="sync">
        <motion.img
          key={bgKey}
          src={currentBg}
          alt="Background"
          className="absolute inset-0 w-full h-full object-cover z-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.85 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
          onError={(e) => {
            console.error(`배경 이미지 로드 실패: ${currentBg}`);
            // 캐릭터별 기본 배경 실패 시 공유 폴백
            e.target.src = "/backgrounds/bg_entrance_night.png";
          }}
        />
      </AnimatePresence>

      {/* ═══ 시간대 그라데이션 오버레이 ═══ */}
      <motion.div
        className={`absolute inset-0 z-0 ${overlayClass}`}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.0 }}
      />
    </>
  );
};

export { resolveBackground, getDefaultBg };
export default BackgroundDisplay;