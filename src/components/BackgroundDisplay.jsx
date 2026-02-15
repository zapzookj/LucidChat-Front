import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════════
//  [Phase 4] BackgroundDisplay — 동적 배경 전환 엔진
//
//  • location + time 조합 → 배경 이미지 매핑
//  • 듀얼 레이어 크로스페이드 (뚝 끊김 방지)
//  • 배경 전환 시 부드러운 1.2s 디졸브
// ═══════════════════════════════════════════════════════════════

// ─── 배경 이미지 매핑 테이블 ───
// key: "{LOCATION}_{TIME}" → value: 파일명
const BG_MAP = {
  // 저택 내부 (밤/낮)
  LIVINGROOM_DAY:   "bg_livingroom_day.png",
  LIVINGROOM_NIGHT: "bg_livingroom_night.png",
  BALCONY_DAY:      "bg_balcony_day.png",
  BALCONY_NIGHT:    "bg_balcony_night.png",
  STUDY_DAY:        "bg_study.png",
  STUDY_NIGHT:      "bg_study.png",         // 서재는 1장
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

  // 저택 외부
  BEACH_DAY:        "bg_beach_day.png",
  BEACH_NIGHT:      "bg_beach_night.png",
  BEACH_SUNSET:     "bg_beach_sunset.png",
  DOWNTOWN_DAY:     "bg_downtown_day.png",
  DOWNTOWN_NIGHT:   "bg_downtown_night.png",
  BAR_NIGHT:        "bg_bar_night.png",
  BAR_DAY:          "bg_bar_night.png",     // 바는 1장 (항상 밤 분위기)
};

// 기본 배경 (초기 상태 — 현관 밤)
const DEFAULT_BG = "bg_entrance_night.png";

/**
 * location + time → 배경 파일명 resolve
 */
function resolveBackground(location, time) {
  if (!location) return null; // null이면 변경 없음

  const t = time || "NIGHT"; // time 미지정 시 NIGHT 기본값
  const key = `${location}_${t}`;

  return BG_MAP[key] || BG_MAP[`${location}_NIGHT`] || BG_MAP[`${location}_DAY`] || DEFAULT_BG;
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

const BackgroundDisplay = ({ location, time }) => {
  const [currentBg, setCurrentBg] = useState(DEFAULT_BG);
  const [bgKey, setBgKey] = useState(0); // AnimatePresence key
  const prevBgRef = useRef(DEFAULT_BG);

  useEffect(() => {
    const newBg = resolveBackground(location, time);
    if (newBg && newBg !== prevBgRef.current) {
      prevBgRef.current = newBg;
      setCurrentBg(newBg);
      setBgKey(prev => prev + 1);
    }
  }, [location, time]);

  const overlayClass = getTimeOverlay(time);

  return (
    <>
      {/* ═══ 배경 이미지 (크로스페이드) ═══ */}
      <AnimatePresence mode="sync">
        <motion.img
          key={bgKey}
          src={`/backgrounds/${currentBg}`}
          alt="Background"
          className="absolute inset-0 w-full h-full object-cover z-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.85 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
          onError={(e) => {
            console.error(`배경 이미지 로드 실패: ${currentBg}`);
            e.target.src = `/backgrounds/${DEFAULT_BG}`;
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

export { resolveBackground };
export default BackgroundDisplay;