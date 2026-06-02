import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { assetUrl } from "../utils/assetUrl";

// ═══════════════════════════════════════════════════════════════
//  [Phase 4] BackgroundDisplay — 동적 배경 전환 엔진
//  [Phase 4 Fix] 캐릭터별 독립 세계관:
//    • 모든 배경이 캐릭터 전용: /backgrounds/{slug}/bg_{location}_{time}.png
//    • 공유 배경 없음 (각 캐릭터가 자신만의 배경 에셋 보유)
//    • 자유(샌드박스) 모드 기본 배경: /backgrounds/{slug}/bg_default.png
//
//  [Phase 5.5-Illust] dynamicBackgroundUrl 지원 (AI 생성 배경 S3 URL)
//
//  [Phase 7-V2 Story] V2 World 지원:
//    • worldId prop 추가 — 우선순위: worldId > characterSlug > "airi"
//    • V2 default 경로: /backgrounds/worlds/{worldId_lower}/bg_default.png
//    • 시간대 명도 오버레이 제거 (CTO 결정) — 동적 일러스트가 시간대 분위기를
//      이미 담고 있어 추가 오버레이는 UX를 해친다 (너무 어두워짐).
//    • Ken Burns 효과 (opt-in via enableKenBurns) — V2 시각적 풍부함 보강.
// ═══════════════════════════════════════════════════════════════

/**
 * [Phase 4 Fix / Phase 7-V2] location + time + characterSlug → 정적 배경 파일 경로.
 * V1 Sandbox 전용 — V2는 dynamicBackgroundUrl로 동적 생성/캐시 자산을 직접 사용한다.
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
 * 기본 배경 폴백.
 * 우선순위: worldId (V2) > characterSlug (V1) > "airi".
 *
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
 * [Phase 5.5-Illust] dynamicBackgroundUrl 지원
 *   - AI 생성 배경(S3 URL)이 제공되면 enum 기반 해상도를 무시하고 직접 표시
 *   - null이면 기존 enum 기반 정적 배경으로 폴백
 *
 * [Phase 7-V2] worldId / enableKenBurns 추가
 *   - worldId: V2 World default 경로 우선 (characterSlug보다 위)
 *   - enableKenBurns: V2 전용 60s scale 1.0 → 1.06 subtle 줌. V1 기본값 false로 영향 zero
 *
 * @param {object} props
 * @param {string|null} props.location           — V1 Location enum 키 (V2는 null)
 * @param {string|null} props.time               — V1 time slot (V2는 null 또는 dayPartToV1Time)
 * @param {string} [props.characterSlug]         — V1 Sandbox 슬러그
 * @param {string} [props.worldId]               — V2 Story worldId (대문자 enum)
 * @param {string|null} [props.dynamicBackgroundUrl] — AI 생성/캐시 배경 URL — 최우선
 * @param {boolean} [props.enableKenBurns=false] — V2 권장 true (시각적 풍부함)
 */
const BackgroundDisplay = ({
  location, time, characterSlug, worldId,
  dynamicBackgroundUrl,
  enableKenBurns = false,
}) => {
  const defaultBg = getDefaultBg(characterSlug, worldId);
  const [currentBg, setCurrentBg] = useState(defaultBg);
  const [bgKey, setBgKey] = useState(0);
  const prevBgRef = useRef(defaultBg);

  // [Phase 5 / Phase 7-V2] characterSlug 또는 worldId 변경 시 기본 배경 갱신
  useEffect(() => {
    const newDefault = getDefaultBg(characterSlug, worldId);
    if (!location && !dynamicBackgroundUrl && newDefault !== prevBgRef.current) {
      prevBgRef.current = newDefault;
      setCurrentBg(newDefault);
      setBgKey(prev => prev + 1);
    }
  }, [characterSlug, worldId]);

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

    // enum 기반 정적 배경 해상도 (V1 전용 — V2는 location=null이라 진입 안 함)
    const newBg = resolveBackground(location, time, characterSlug);
    if (newBg && newBg !== prevBgRef.current) {
      prevBgRef.current = newBg;
      setCurrentBg(newBg);
      setBgKey(prev => prev + 1);
    }
  }, [dynamicBackgroundUrl, location, time, characterSlug]);

  // [Phase 7-V2] 시간대 명도 오버레이 제거 — 동적 일러스트가 시간대 분위기를
  // 충분히 담고 있어, 추가 오버레이는 화면을 과도하게 어둡게 만들어 UX를 해친다.
  // V1 정적 배경에서도 마찬가지로 제거.

  // [Phase 7-V2] Ken Burns 효과 — 매우 느린 (60s) 줌 인. 정적 배경에 시간성 부여.
  // V2 권장 enable, V1 기본 disable (기존 동작 유지).
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
      {/* ═══ 배경 이미지 (크로스페이드 + opt-in Ken Burns) ═══ */}
      <AnimatePresence mode="sync">
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
          onError={(e) => {
            console.error(`배경 이미지 로드 실패: ${currentBg}`);
            const fallback = getDefaultBg(characterSlug, worldId);
            if (e.target.src !== fallback) {
              e.target.src = fallback;
            }
          }}
        />
      </AnimatePresence>
    </>
  );
};

export { resolveBackground, getDefaultBg };
export default BackgroundDisplay;