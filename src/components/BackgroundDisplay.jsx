import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════════
//  [Phase 4] BackgroundDisplay — 동적 배경 전환 엔진
//  [Phase 4 Fix] 캐릭터별 독립 세계관:
//    • 모든 배경이 캐릭터 전용: /backgrounds/{slug}/bg_{location}_{time}.png
//    • 공유 배경 없음 (각 캐릭터가 자신만의 배경 에셋 보유)
//    • 자유(샌드박스) 모드 기본 배경: /backgrounds/{slug}/bg_default.png
// ═══════════════════════════════════════════════════════════════

/**
 * [Phase 4 Fix] characterSlug + location + time → 캐릭터 전용 배경 파일 경로
 * 규칙: /backgrounds/{slug}/bg_{location}_{time}.png
 */
function resolveBackground(location, time, characterSlug) {
  const slug = characterSlug || "airi";

  if (!location) return null;

  const t = (time || "NIGHT").toLowerCase();
  const loc = location.toLowerCase();

  return `/backgrounds/${slug}/bg_${loc}_${t}.png`;
}

/**
 * characterSlug에 따른 기본 배경 이미지 경로
 */
function getDefaultBg(characterSlug) {
  const slug = characterSlug || "airi";
  return `/backgrounds/${slug}/bg_default.png`;
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

/**
 * [Phase 5.5-Illust] dynamicBackgroundUrl 지원
 *   - AI 생성 배경(S3 URL)이 제공되면 enum 기반 해상도를 무시하고 직접 표시
 *   - null이면 기존 enum 기반 정적 배경으로 폴백
 */
const BackgroundDisplay = ({ location, time, characterSlug, dynamicBackgroundUrl }) => {
  const defaultBg = getDefaultBg(characterSlug);
  const [currentBg, setCurrentBg] = useState(defaultBg);
  const [bgKey, setBgKey] = useState(0);
  const prevBgRef = useRef(defaultBg);

  // [Phase 5] characterSlug 변경 시 기본 배경 갱신
  useEffect(() => {
    const newDefault = getDefaultBg(characterSlug);
    if (!location && !dynamicBackgroundUrl && newDefault !== prevBgRef.current) {
      prevBgRef.current = newDefault;
      setCurrentBg(newDefault);
      setBgKey(prev => prev + 1);
    }
  }, [characterSlug]);

  useEffect(() => {
    // [Phase 5.5-Illust] AI 생성 배경이 있으면 최우선 적용
    if (dynamicBackgroundUrl) {
      if (dynamicBackgroundUrl !== prevBgRef.current) {
        prevBgRef.current = dynamicBackgroundUrl;
        setCurrentBg(dynamicBackgroundUrl);
        setBgKey(prev => prev + 1);
      }
      return;
    }

    // enum 기반 정적 배경 해상도
    const newBg = resolveBackground(location, time, characterSlug);
    if (newBg && newBg !== prevBgRef.current) {
      prevBgRef.current = newBg;
      setCurrentBg(newBg);
      setBgKey(prev => prev + 1);
    }
  }, [dynamicBackgroundUrl, location, time, characterSlug]);

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
            // 캐릭터별 기본 배경으로 폴백
            const fallback = getDefaultBg(characterSlug);
            if (e.target.src !== window.location.origin + fallback) {
              e.target.src = fallback;
            }
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