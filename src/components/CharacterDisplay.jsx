import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { useEffect, useRef, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════
//  [Phase 5.5-NPC] Enhanced Character Display
//
//  변경점 vs Phase 5:
//  1. npcSpeaker prop: 제3자(NPC) 화자 이름 (null이면 일반 모드)
//  2. 스포트라이트 시스템: 발화자에게 하이라이트, 비발화자 딤 처리
//  3. NPC 실루엣: 검은 인물 음영 (오른쪽에 표시)
//  4. 메인 캐릭터 위치 시프트: NPC 존재 시 좌측으로 이동
//
//  추후 다인큐 채팅에서도 동일 패턴 재활용 가능하도록 설계
// ═══════════════════════════════════════════════════════════════

const EMOTION_LIST = [
  "NEUTRAL", "JOY", "SAD", "ANGRY", "SHY", "SURPRISE",
  "PANIC", "RELAX", "DISGUST", "FRIGHTENED", "FLIRTATIOUS", "HEATED"
];

function resolveCharacterImage(characterSlug, outfit, emotion) {
  const slug = characterSlug || "airi";
  const o = (outfit || "MAID").toLowerCase();
  const e = (emotion || "NEUTRAL").toLowerCase();
  return `/characters/${slug}/${o}_${e}.png`;
}

// ─── 감정별 애니메이션 프로파일 ───

const EMOTION_ANIM = {
  NEUTRAL: {
    punch: null,
    idle: { rotate: [0, 0.4, 0, -0.4, 0], x: [0, 0.5, 0, -0.5, 0] },
    idleTx: { duration: 8, repeat: Infinity, ease: "easeInOut" },
    glow: "rgba(180, 180, 255, 0.08)", glowIntensity: 1, imgBrightness: 1.05,
  },
  JOY: {
    punch: { y: [-18, 4, 0], scale: [1, 1.04, 1], transition: { duration: 0.5, ease: "easeOut" } },
    idle: { y: [0, -5, 0], rotate: [0, 1.2, 0, -1.2, 0] },
    idleTx: { duration: 3, repeat: Infinity, ease: "easeInOut" },
    glow: "rgba(255, 105, 180, 0.28)", glowIntensity: 1.4, imgBrightness: 1.1,
  },
  SAD: {
    punch: { y: [0, 5, 3], scale: [1, 0.98, 0.99], transition: { duration: 0.7, ease: "easeOut" } },
    idle: { y: [0, 2, 0], rotate: [0, -0.3, 0] },
    idleTx: { duration: 5, repeat: Infinity, ease: "easeInOut" },
    glow: "rgba(100, 100, 200, 0.15)", glowIntensity: 0.8, imgBrightness: 0.95,
  },
  ANGRY: {
    punch: { x: [-6, 6, -4, 4, 0], transition: { duration: 0.4, ease: "easeInOut" } },
    idle: { x: [0, 1.5, -1.5, 0], scale: [1, 1.01, 1] },
    idleTx: { duration: 2, repeat: Infinity, ease: "easeInOut" },
    glow: "rgba(255, 50, 50, 0.25)", glowIntensity: 1.5, imgBrightness: 1.05,
  },
  SHY: {
    punch: { x: [0, -8, -5], rotate: [0, -2, -1], transition: { duration: 0.5, ease: "easeOut" } },
    idle: { x: [0, -1, 0], rotate: [0, -0.5, 0] },
    idleTx: { duration: 4, repeat: Infinity, ease: "easeInOut" },
    glow: "rgba(255, 150, 200, 0.22)", glowIntensity: 1.2, imgBrightness: 1.08,
  },
  SURPRISE: {
    punch: { y: [-20, 5, 0], scale: [1, 1.06, 1], transition: { duration: 0.4, ease: "easeOut" } },
    idle: { y: [0, -3, 0] },
    idleTx: { duration: 3, repeat: Infinity, ease: "easeInOut" },
    glow: "rgba(255, 200, 50, 0.2)", glowIntensity: 1.3, imgBrightness: 1.1,
  },
  PANIC: {
    punch: { x: [-4, 4, -3, 3, 0], y: [-5, 0], transition: { duration: 0.3, ease: "easeInOut" } },
    idle: { x: [0, 2, -2, 0], y: [0, -2, 0] },
    idleTx: { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
    glow: "rgba(255, 100, 50, 0.2)", glowIntensity: 1.3, imgBrightness: 1.0,
  },
  RELAX: {
    punch: null,
    idle: { y: [0, -3, 0], rotate: [0, 0.3, 0, -0.3, 0] },
    idleTx: { duration: 7, repeat: Infinity, ease: "easeInOut" },
    glow: "rgba(100, 200, 150, 0.12)", glowIntensity: 0.9, imgBrightness: 1.05,
  },
  DISGUST: {
    punch: { x: [0, -5, -3], rotate: [0, -1.5, -0.5], transition: { duration: 0.4, ease: "easeOut" } },
    idle: { x: [0, -1, 0] },
    idleTx: { duration: 4, repeat: Infinity, ease: "easeInOut" },
    glow: "rgba(80, 180, 80, 0.15)", glowIntensity: 1.0, imgBrightness: 0.95,
  },
  FRIGHTENED: {
    punch: { x: [-3, 3, -2, 2, 0], y: [-4, 0], scale: [1, 0.97, 1], transition: { duration: 0.5 } },
    idle: { x: [0, 1.5, -1.5, 0], y: [0, -1, 0] },
    idleTx: { duration: 2, repeat: Infinity, ease: "easeInOut" },
    glow: "rgba(100, 100, 180, 0.18)", glowIntensity: 1.1, imgBrightness: 0.9,
  },
  FLIRTATIOUS: {
    punch: { rotate: [0, 3, 1], scale: [1, 1.03, 1], transition: { duration: 0.6, ease: "easeOut" } },
    idle: { rotate: [0, 1, 0, -1, 0], y: [0, -2, 0] },
    idleTx: { duration: 4, repeat: Infinity, ease: "easeInOut" },
    glow: "rgba(255, 100, 200, 0.3)", glowIntensity: 1.5, imgBrightness: 1.12,
  },
  HEATED: {
    punch: { scale: [1, 1.05, 1.02], y: [0, -8, -3], transition: { duration: 0.5, ease: "easeOut" } },
    idle: { scale: [1, 1.02, 1], y: [0, -3, 0] },
    idleTx: { duration: 3, repeat: Infinity, ease: "easeInOut" },
    glow: "rgba(255, 50, 100, 0.35)", glowIntensity: 1.6, imgBrightness: 1.15,
  },
};

// ─── 파티클 시스템 ───

const PARTICLE_PRESETS = {
  JOY: { emojis: ["✨", "🌸", "💫"], count: 6, color: "#ffb6d9", baseOpacity: 0.7 },
  SHY: { emojis: ["💗", "💕", "🌸"], count: 5, color: "#ff9ec4", baseOpacity: 0.6 },
  FLIRTATIOUS: { emojis: ["💋", "✨", "💜"], count: 6, color: "#e879f9", baseOpacity: 0.7 },
  HEATED: { emojis: ["🔥", "💥", "✨"], count: 7, color: "#ff4d6d", baseOpacity: 0.8 },
  SAD: { emojis: ["💧", "🌧️"], count: 3, color: "#93c5fd", baseOpacity: 0.5 },
  ANGRY: { emojis: ["💢", "⚡"], count: 4, color: "#f87171", baseOpacity: 0.6 },
  SURPRISE: { emojis: ["❗", "⭐", "💫"], count: 5, color: "#fcd34d", baseOpacity: 0.6 },
};

function generateParticles(emotion) {
  const preset = PARTICLE_PRESETS[emotion];
  if (!preset) return [];
  return Array.from({ length: preset.count }, (_, i) => {
    const xStart = 25 + Math.random() * 50;
    const xDriftVal = (Math.random() - 0.5) * 60;
    const yEnd = -(80 + Math.random() * 120);
    const dur = 2.5 + Math.random() * 2;
    const sz = 14 + Math.random() * 10;
    return {
      id: i, content: preset.emojis[i % preset.emojis.length], color: preset.color,
      xStart, xDrift: xDriftVal, yEnd, duration: dur, delay: Math.random() * 2.5,
      size: Math.round(sz), opacity: preset.baseOpacity * (0.7 + Math.random() * 0.3),
    };
  });
}

const EmotionParticles = ({ emotion }) => {
  const particles = useMemo(() => generateParticles(emotion), [emotion]);
  if (particles.length === 0) return null;
  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
      {particles.map((p) => (
        <motion.span key={`${emotion}_p${p.id}`} className="absolute select-none"
          style={{ left: `${p.xStart}%`, bottom: "35%", fontSize: `${p.size}px`, color: p.color, textShadow: `0 0 ${p.size * 0.6}px ${p.color}` }}
          initial={{ opacity: 0, y: 0, x: 0, scale: 0.3 }}
          animate={{ opacity: [0, p.opacity, p.opacity * 0.8, 0], y: [0, p.yEnd * 0.3, p.yEnd * 0.7, p.yEnd], x: [0, p.xDrift * 0.4, p.xDrift * 0.8, p.xDrift], scale: [0.3, 1, 1, 0.5], rotate: [0, (Math.random() - 0.5) * 30] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, repeatDelay: Math.random() * 1.5, ease: "easeOut" }}
        >{p.content}</motion.span>
      ))}
    </div>
  );
};

const GlowLayer = ({ config }) => (
  <>
    <motion.div className="absolute left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
      style={{ bottom: "12%", width: 320, height: 160, filter: "blur(60px)" }}
      animate={{ backgroundColor: config.glow, scale: [config.glowIntensity, config.glowIntensity * 1.12, config.glowIntensity], opacity: [0.5, 0.8, 0.5] }}
      transition={{ backgroundColor: { duration: 0.8 }, scale: { duration: 4, repeat: Infinity, ease: "easeInOut" }, opacity: { duration: 4, repeat: Infinity, ease: "easeInOut" } }}
    />
    <motion.div className="absolute left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
      style={{ bottom: "18%", width: 120, height: 80, filter: "blur(40px)" }}
      animate={{ backgroundColor: config.glow, opacity: [0.3, 0.6, 0.3] }}
      transition={{ opacity: { duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1 } }}
    />
  </>
);


// ═══════════════════════════════════════════════════════════════
//  [Phase 5.5-NPC] NPC 실루엣 컴포넌트
//
//  - 검은 인물 음영 (SVG)
//  - 발화 시 밝아지고 커짐 (스포트라이트)
//  - NPC 이름 표시
// ═══════════════════════════════════════════════════════════════

const NpcSilhouette = ({ name, isActive }) => (
  <motion.div
    className="relative flex flex-col items-center"
    animate={{
      opacity: isActive ? 1 : 0.4,
      scale: isActive ? 1.05 : 0.92,
      y: isActive ? 0 : 8,
    }}
    transition={{ duration: 0.5, ease: "easeOut" }}
  >
    {/* NPC 이름 */}
    <AnimatePresence>
      {isActive && name && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="absolute -top-8 whitespace-nowrap px-3 py-1 rounded-full text-xs font-bold
                     bg-black/70 text-red-300/90 border border-red-500/30 backdrop-blur-sm
                     shadow-[0_0_12px_rgba(239,68,68,0.2)]"
        >
          {name}
        </motion.div>
      )}
    </AnimatePresence>

    {/* 실루엣 SVG */}
    <svg width="140" height="280" viewBox="0 0 140 280" className="drop-shadow-2xl"
      style={{
        filter: isActive
          ? "drop-shadow(0 0 20px rgba(239,68,68,0.3)) brightness(1.1)"
          : "drop-shadow(0 4px 10px rgba(0,0,0,0.5)) brightness(0.6)",
      }}
    >
      {/* 머리 */}
      <ellipse cx="70" cy="48" rx="24" ry="28"
        fill={isActive ? "rgba(30,15,40,0.95)" : "rgba(15,8,20,0.9)"}
        stroke={isActive ? "rgba(239,68,68,0.25)" : "rgba(100,60,120,0.15)"}
        strokeWidth="1"
      />
      {/* 목 */}
      <rect x="62" y="74" width="16" height="14" rx="3"
        fill={isActive ? "rgba(25,12,35,0.95)" : "rgba(12,6,18,0.9)"}
      />
      {/* 몸통 */}
      <path d="M 30 88 Q 35 82 55 80 L 62 80 L 78 80 L 85 80 Q 105 82 110 88 L 115 160 Q 115 168 108 170 L 32 170 Q 25 168 25 160 Z"
        fill={isActive ? "rgba(20,10,30,0.95)" : "rgba(10,5,15,0.9)"}
        stroke={isActive ? "rgba(239,68,68,0.15)" : "rgba(80,40,100,0.1)"}
        strokeWidth="1"
      />
      {/* 다리 */}
      <rect x="38" y="170" width="26" height="90" rx="4"
        fill={isActive ? "rgba(18,8,28,0.95)" : "rgba(8,4,12,0.9)"}
      />
      <rect x="76" y="170" width="26" height="90" rx="4"
        fill={isActive ? "rgba(18,8,28,0.95)" : "rgba(8,4,12,0.9)"}
      />
      {/* 의문의 빛 (활성 시) */}
      {isActive && (
        <>
          <circle cx="60" cy="44" r="2.5" fill="rgba(255,120,120,0.7)">
            <animate attributeName="opacity" values="0.4;0.9;0.4" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle cx="80" cy="44" r="2.5" fill="rgba(255,120,120,0.7)">
            <animate attributeName="opacity" values="0.4;0.9;0.4" dur="2s" repeatCount="indefinite" />
          </circle>
        </>
      )}
    </svg>

    {/* NPC 바닥 그림자 */}
    <motion.div
      className="absolute -bottom-2 rounded-full"
      style={{ width: 100, height: 12, background: "rgba(0,0,0,0.3)", filter: "blur(6px)" }}
      animate={{ opacity: isActive ? 0.6 : 0.2, scale: isActive ? 1.1 : 0.8 }}
    />
  </motion.div>
);


// ═══════════════════════════════════════════════════════════════
//  CharacterDisplay — 메인 컴포넌트
//  [Phase 5.5-NPC] npcSpeaker / isNpcActive props 추가
// ═══════════════════════════════════════════════════════════════

const CharacterDisplay = ({
  emotion = "NEUTRAL",
  outfit = "MAID",
  characterSlug = "airi",
  defaultOutfit,
  // ── [Phase 5.5-NPC] NPC 시스템 ──
  npcSpeaker = null,          // NPC 이름 (null이면 NPC 없음)
  isNpcActive = false,        // true면 NPC에 스포트라이트, 메인 캐릭터 딤
}) => {
  const imagePath = resolveCharacterImage(characterSlug, outfit, emotion);
  const config = EMOTION_ANIM[emotion] || EMOTION_ANIM.NEUTRAL;
  const idleControls = useAnimation();
  const prevEmotionRef = useRef(emotion);

  // NPC가 존재하는 상태인지 (이벤트 모드)
  const hasNpc = !!npcSpeaker;
  // 메인 캐릭터가 활성(발화 중)인지
  const isMainActive = !isNpcActive;

  useEffect(() => {
    let cancelled = false;
    const runSequence = async () => {
      const isEmotionChange = prevEmotionRef.current !== emotion;
      prevEmotionRef.current = emotion;
      if (isEmotionChange && config.punch) {
        await idleControls.start(config.punch);
        if (cancelled) return;
        await idleControls.start({ x: 0, y: 0, rotate: 0, scale: 1, transition: { duration: 0.15 } });
        if (cancelled) return;
      }
      idleControls.start({ ...config.idle, transition: config.idleTx });
    };
    runSequence();
    return () => { cancelled = true; };
  }, [emotion, config, idleControls]);

  return (
    <div className="absolute inset-0 z-0 flex items-end justify-center pointer-events-none overflow-hidden">

      {/* L1: 오라/글로우 (메인 캐릭터용) */}
      <motion.div
        animate={{ opacity: hasNpc && isNpcActive ? 0.3 : 1 }}
        transition={{ duration: 0.5 }}
      >
        <GlowLayer config={config} />
      </motion.div>

      {/* ═══ [Phase 5.5-NPC] NPC가 있을 때: 2인 레이아웃 ═══ */}
      {hasNpc ? (
        <div className="relative w-full h-full max-w-5xl flex items-end justify-center pb-20 md:pb-28">

          {/* 메인 캐릭터 — 좌측으로 시프트 */}
          <motion.div
            className="absolute bottom-20 md:bottom-28 flex items-end justify-center"
            animate={{
              left: "10%",
              opacity: isMainActive ? 1 : 0.5,
              scale: isMainActive ? 1.0 : 0.88,
              filter: isMainActive
                ? "brightness(1.05) drop-shadow(0 0 25px rgba(180,180,255,0.2))"
                : "brightness(0.6) drop-shadow(0 0 8px rgba(0,0,0,0.3))",
            }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            style={{ width: "45%", height: "80%" }}
          >
            <motion.div
              animate={{ y: [0, -8, 0], scaleY: [1, 1.004, 1] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="relative w-full h-full flex items-end justify-center"
            >
              <motion.div animate={idleControls} className="relative h-full w-full flex items-end justify-center">
                <AnimatePresence mode="popLayout">
                  <motion.img
                    key={`${characterSlug}_${outfit}_${emotion}`}
                    src={imagePath}
                    alt={`${characterSlug} ${emotion}`}
                    initial={{ opacity: 0, scale: 1.02 }}
                    animate={{ opacity: 1, scale: 1.05 }}
                    exit={{ opacity: 0, scale: 1.02 }}
                    transition={{ duration: 0.5 }}
                    className="h-[85%] md:h-[90%] object-contain select-none pointer-events-none"
                    style={{
                      filter: `drop-shadow(0 0 25px ${config.glow}) drop-shadow(0 5px 15px rgba(0,0,0,0.4)) brightness(${isMainActive ? config.imgBrightness : 0.7})`,
                    }}
                    onError={(e) => {
                      const fallback = resolveCharacterImage(characterSlug, "MAID", emotion);
                      if (!e.target.src.endsWith(fallback)) e.target.src = fallback;
                      else e.target.style.display = "none";
                    }}
                  />
                </AnimatePresence>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* NPC 실루엣 — 우측 */}
          <motion.div
            className="absolute bottom-20 md:bottom-28 right-[8%] flex items-end justify-center"
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 60 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            style={{ height: "55%" }}
          >
            <NpcSilhouette name={npcSpeaker} isActive={isNpcActive} />
          </motion.div>

          {/* NPC 바닥 글로우 (활성 시) */}
          <AnimatePresence>
            {isNpcActive && (
              <motion.div
                className="absolute rounded-full pointer-events-none"
                style={{ bottom: "10%", right: "10%", width: 160, height: 80, filter: "blur(50px)" }}
                initial={{ opacity: 0 }}
                animate={{ backgroundColor: "rgba(239,68,68,0.15)", opacity: [0.3, 0.5, 0.3] }}
                exit={{ opacity: 0 }}
                transition={{ opacity: { duration: 3, repeat: Infinity, ease: "easeInOut" } }}
              />
            )}
          </AnimatePresence>
        </div>
      ) : (
        /* ═══ 일반 모드: 캐릭터 단독 (기존 100% 동일) ═══ */
        <motion.div
          animate={{ y: [0, -8, 0], scaleY: [1, 1.004, 1], scaleX: [1, 1.001, 1] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="relative w-full h-full max-w-4xl flex items-end justify-center pb-20 md:pb-28"
        >
          <motion.div animate={idleControls} className="relative h-full w-full flex items-end justify-center">
            <AnimatePresence mode="popLayout">
              <motion.img
                key={`${characterSlug}_${outfit}_${emotion}`}
                src={imagePath}
                alt={`${characterSlug} ${outfit} ${emotion}`}
                initial={{ opacity: 0, scale: 1.02 }}
                animate={{ opacity: 1, scale: 1.05 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className="h-[85%] md:h-[90%] object-contain outline-none border-none ring-0 select-none pointer-events-none"
                style={{
                  filter: `drop-shadow(0 0 25px ${config.glow}) drop-shadow(0 5px 15px rgba(0,0,0,0.4)) brightness(${config.imgBrightness})`,
                }}
                onError={(e) => {
                  const defaultOutfitFallback = resolveCharacterImage(characterSlug, outfit, "NEUTRAL");
                  const ultimateFallback = resolveCharacterImage(characterSlug, "MAID", emotion);
                  if (e.target.src !== window.location.origin + defaultOutfitFallback &&
                      e.target.src !== window.location.origin + ultimateFallback) {
                    e.target.src = ultimateFallback;
                  } else {
                    e.target.style.display = "none";
                  }
                }}
              />
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}

      {/* L5: 감정 파티클 */}
      <EmotionParticles emotion={emotion} />
    </div>
  );
};

export { resolveCharacterImage, EMOTION_LIST };
export default CharacterDisplay;