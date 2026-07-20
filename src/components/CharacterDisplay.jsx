import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { useEffect, useRef, useMemo } from "react";
import { assetUrl } from "../utils/assetUrl";

// ═══════════════════════════════════════════════════════════════
//  [Phase 5.5-NPC] CharacterDisplay — NPC UI Fix
//
//  Fix-UI-3 변경점:
//  1. NPC 위치: right-[8%] → right-[15%] (너무 구석 → 적절한 위치)
//  2. NPC 크기: height 55% → 68%, SVG 140x280 → 180x360 (더 크게)
//  3. NPC 지속 표시: isNpcActive가 false여도 hasNpc이면 표시 (딤 처리)
//  4. 메인 캐릭터 위치: left 10% → 15% (NPC와 더 균형있는 배치)
//
//  [Phase 5.5-Fix] 감정 태그 3종 추가:
//  - DUMBFOUNDED: 황당/어이없음 — 가벼운 뒤로 젖힘 + 흔들림
//  - SULKING: 삐짐/뾰루퉁 — 고개 돌림 + 살짝 움츠림
//  - PLEADING: 애원/간절 — 미세 떨림 + 앞으로 기울어짐
// ═══════════════════════════════════════════════════════════════

const EMOTION_LIST = [
  "NEUTRAL", "JOY", "SAD", "ANGRY", "SHY", "SURPRISE",
  "PANIC", "RELAX", "DISGUST", "FRIGHTENED", "FLIRTATIOUS", "HEATED",
  "DUMBFOUNDED", "SULKING", "PLEADING"
];

// [Fix-UGC-CDN] assetDir(절대 URL 디렉터리)이 주어지면 그 디렉터리 기준으로 조립.
// UGC 캐릭터의 스탠딩은 공식 CDN(VITE_ASSET_BASE_URL)이 아닌 백엔드 S3 CDN에 있으므로,
// 백엔드가 준 절대 URL(defaultImageUrl)에서 유도한 디렉터리를 써야 403이 나지 않는다.
// assetDir이 없으면 기존 assetUrl 경로 그대로 (공식 캐릭터 무회귀).
function resolveCharacterImage(characterSlug, outfit, emotion, assetDir = null) {
  const o = (outfit || "MAID").toLowerCase();
  const e = (emotion || "NEUTRAL").toLowerCase();
  if (assetDir) return `${assetDir}/${o}_${e}.png`;
  const slug = characterSlug || "airi";
  return assetUrl(`/characters/${slug}/${o}_${e}.png`); // ⬅️
}

// [Fix-UGC-CDN] defaultImageUrl(절대 URL일 때만)에서 디렉터리 베이스를 유도.
// 예: https://d3gb5c…/characters/ugc-5/default_neutral.png → https://d3gb5c…/characters/ugc-5
function deriveAssetDir(defaultImageUrl) {
  if (typeof defaultImageUrl !== "string" || !/^https?:\/\//i.test(defaultImageUrl)) return null;
  const idx = defaultImageUrl.lastIndexOf("/");
  // 프로토콜의 "//" 직후 슬래시는 경로 구분자가 아님 — 실제 경로가 있을 때만 유효
  if (idx <= defaultImageUrl.indexOf("//") + 1) return null;
  return defaultImageUrl.substring(0, idx);
}

const EMOTION_ANIM = {
  NEUTRAL: { punch: null, idle: { rotate: [0, 0.4, 0, -0.4, 0], x: [0, 0.5, 0, -0.5, 0] }, idleTx: { duration: 8, repeat: Infinity, ease: "easeInOut" }, glow: "rgba(180, 180, 255, 0.08)", glowIntensity: 1, imgBrightness: 1.05 },
  JOY: { punch: { y: [-18, 4, 0], scale: [1, 1.04, 1], transition: { duration: 0.5 } }, idle: { y: [0, -5, 0], rotate: [0, 1.2, 0, -1.2, 0] }, idleTx: { duration: 3, repeat: Infinity, ease: "easeInOut" }, glow: "rgba(255, 105, 180, 0.28)", glowIntensity: 1.4, imgBrightness: 1.1 },
  SAD: { punch: { y: [0, 5, 3], scale: [1, 0.98, 0.99], transition: { duration: 0.7 } }, idle: { y: [0, 2, 0], rotate: [0, -0.3, 0] }, idleTx: { duration: 5, repeat: Infinity, ease: "easeInOut" }, glow: "rgba(100, 100, 200, 0.15)", glowIntensity: 0.8, imgBrightness: 0.95 },
  ANGRY: { punch: { x: [-6, 6, -4, 4, 0], transition: { duration: 0.4 } }, idle: { x: [0, 1.5, -1.5, 0], scale: [1, 1.01, 1] }, idleTx: { duration: 2, repeat: Infinity, ease: "easeInOut" }, glow: "rgba(255, 50, 50, 0.25)", glowIntensity: 1.5, imgBrightness: 1.05 },
  SHY: { punch: { x: [0, -8, -5], rotate: [0, -2, -1], transition: { duration: 0.5 } }, idle: { x: [0, -1, 0], rotate: [0, -0.5, 0] }, idleTx: { duration: 4, repeat: Infinity, ease: "easeInOut" }, glow: "rgba(255, 150, 200, 0.22)", glowIntensity: 1.2, imgBrightness: 1.08 },
  SURPRISE: { punch: { y: [-20, 5, 0], scale: [1, 1.06, 1], transition: { duration: 0.4 } }, idle: { y: [0, -3, 0] }, idleTx: { duration: 3, repeat: Infinity, ease: "easeInOut" }, glow: "rgba(255, 200, 50, 0.2)", glowIntensity: 1.3, imgBrightness: 1.1 },
  PANIC: { punch: { x: [-4, 4, -3, 3, 0], y: [-5, 0], transition: { duration: 0.3 } }, idle: { x: [0, 2, -2, 0], y: [0, -2, 0] }, idleTx: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }, glow: "rgba(255, 100, 50, 0.2)", glowIntensity: 1.3, imgBrightness: 1.0 },
  RELAX: { punch: null, idle: { y: [0, -3, 0], rotate: [0, 0.3, 0, -0.3, 0] }, idleTx: { duration: 7, repeat: Infinity, ease: "easeInOut" }, glow: "rgba(100, 200, 150, 0.12)", glowIntensity: 0.9, imgBrightness: 1.05 },
  DISGUST: { punch: { x: [0, -5, -3], rotate: [0, -1.5, -0.5], transition: { duration: 0.4 } }, idle: { x: [0, -1, 0] }, idleTx: { duration: 4, repeat: Infinity, ease: "easeInOut" }, glow: "rgba(80, 180, 80, 0.15)", glowIntensity: 1.0, imgBrightness: 0.95 },
  FRIGHTENED: { punch: { x: [-3, 3, -2, 2, 0], y: [-4, 0], scale: [1, 0.97, 1], transition: { duration: 0.5 } }, idle: { x: [0, 1.5, -1.5, 0], y: [0, -1, 0] }, idleTx: { duration: 2, repeat: Infinity, ease: "easeInOut" }, glow: "rgba(100, 100, 180, 0.18)", glowIntensity: 1.1, imgBrightness: 0.9 },
  FLIRTATIOUS: { punch: { rotate: [0, 3, 1], scale: [1, 1.03, 1], transition: { duration: 0.6 } }, idle: { rotate: [0, 1, 0, -1, 0], y: [0, -2, 0] }, idleTx: { duration: 4, repeat: Infinity, ease: "easeInOut" }, glow: "rgba(255, 100, 200, 0.3)", glowIntensity: 1.5, imgBrightness: 1.12 },
  HEATED: { punch: { scale: [1, 1.05, 1.02], y: [0, -8, -3], transition: { duration: 0.5 } }, idle: { scale: [1, 1.02, 1], y: [0, -3, 0] }, idleTx: { duration: 3, repeat: Infinity, ease: "easeInOut" }, glow: "rgba(255, 50, 100, 0.35)", glowIntensity: 1.6, imgBrightness: 1.15 },

  // ── [Phase 5.5-Fix] 새 감정 3종 ──

  /** DUMBFOUNDED (황당/어이없음): 살짝 뒤로 젖혀지며 좌우 미세 흔들림 */
  DUMBFOUNDED: {
    punch: { y: [0, 8, 3], rotate: [0, -2, 1, 0], scale: [1, 0.97, 1], transition: { duration: 0.5 } },
    idle: { rotate: [0, -0.8, 0, 0.8, 0], y: [0, 1, 0] },
    idleTx: { duration: 3.5, repeat: Infinity, ease: "easeInOut" },
    glow: "rgba(251, 191, 36, 0.18)",
    glowIntensity: 1.1,
    imgBrightness: 1.02,
  },

  /** SULKING (삐짐/뾰루퉁): 고개를 살짝 돌리며 움츠린 듯한 느낌 */
  SULKING: {
    punch: { x: [0, -6, -4], rotate: [0, -2.5, -1.5], scale: [1, 0.98, 0.99], transition: { duration: 0.6 } },
    idle: { x: [0, -2, -1, -2, 0], rotate: [0, -1, -0.5, -1, 0], y: [0, 1.5, 0] },
    idleTx: { duration: 5, repeat: Infinity, ease: "easeInOut" },
    glow: "rgba(253, 164, 175, 0.2)",
    glowIntensity: 1.0,
    imgBrightness: 0.98,
  },

  /** PLEADING (애원/간절): 미세 떨림 + 앞으로 살짝 기울어짐 */
  PLEADING: {
    punch: { y: [0, -6, -2], scale: [1, 1.02, 1.01], transition: { duration: 0.5 } },
    idle: { x: [0, 0.8, -0.8, 0.5, -0.5, 0], y: [0, -2, 0], rotate: [0, 0.3, -0.3, 0] },
    idleTx: { duration: 2.5, repeat: Infinity, ease: "easeInOut" },
    glow: "rgba(196, 181, 253, 0.25)",
    glowIntensity: 1.3,
    imgBrightness: 1.06,
  },
};

const PARTICLE_PRESETS = {
  JOY: { emojis: ["✨", "🌸", "💫"], count: 6, color: "#ffb6d9", baseOpacity: 0.7 },
  SHY: { emojis: ["💗", "💕", "🌸"], count: 5, color: "#ff9ec4", baseOpacity: 0.6 },
  FLIRTATIOUS: { emojis: ["💋", "✨", "💜"], count: 6, color: "#e879f9", baseOpacity: 0.7 },
  HEATED: { emojis: ["🔥", "💥", "✨"], count: 7, color: "#ff4d6d", baseOpacity: 0.8 },
  SAD: { emojis: ["💧", "🌧️"], count: 3, color: "#93c5fd", baseOpacity: 0.5 },
  ANGRY: { emojis: ["💢", "⚡"], count: 4, color: "#f87171", baseOpacity: 0.6 },
  SURPRISE: { emojis: ["❗", "⭐", "💫"], count: 5, color: "#fcd34d", baseOpacity: 0.6 },
  // [Phase 5.5-Fix] 새 감정 3종 파티클
  DUMBFOUNDED: { emojis: ["❓", "⁉️", "😦"], count: 4, color: "#fbbf24", baseOpacity: 0.55 },
  SULKING: { emojis: ["💢", "💨", "😤"], count: 3, color: "#fda4af", baseOpacity: 0.5 },
  PLEADING: { emojis: ["🥺", "💦", "✨"], count: 5, color: "#c4b5fd", baseOpacity: 0.6 },
};

function generateParticles(emotion) {
  const p = PARTICLE_PRESETS[emotion]; if (!p) return [];
  return Array.from({ length: p.count }, (_, i) => ({ id: i, content: p.emojis[i % p.emojis.length], color: p.color,
    xStart: 25 + Math.random() * 50, xDrift: (Math.random() - 0.5) * 60, yEnd: -(80 + Math.random() * 120),
    duration: 2.5 + Math.random() * 2, delay: Math.random() * 2.5, size: Math.round(14 + Math.random() * 10),
    opacity: p.baseOpacity * (0.7 + Math.random() * 0.3) }));
}

const EmotionParticles = ({ emotion }) => {
  const particles = useMemo(() => generateParticles(emotion), [emotion]);
  if (particles.length === 0) return null;
  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
      {particles.map(p => (
        <motion.span key={`${emotion}_p${p.id}`} className="absolute select-none"
          style={{ left: `${p.xStart}%`, bottom: "35%", fontSize: `${p.size}px`, color: p.color, textShadow: `0 0 ${p.size * 0.6}px ${p.color}` }}
          initial={{ opacity: 0, y: 0, x: 0, scale: 0.3 }}
          animate={{ opacity: [0, p.opacity, p.opacity * 0.8, 0], y: [0, p.yEnd * 0.3, p.yEnd * 0.7, p.yEnd], x: [0, p.xDrift * 0.4, p.xDrift * 0.8, p.xDrift], scale: [0.3, 1, 1, 0.5] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, repeatDelay: Math.random() * 1.5 }}
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
      transition={{ backgroundColor: { duration: 0.8 }, scale: { duration: 4, repeat: Infinity }, opacity: { duration: 4, repeat: Infinity } }} />
    <motion.div className="absolute left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
      style={{ bottom: "18%", width: 120, height: 80, filter: "blur(40px)" }}
      animate={{ backgroundColor: config.glow, opacity: [0.3, 0.6, 0.3] }}
      transition={{ opacity: { duration: 3, repeat: Infinity, delay: 1 } }} />
  </>
);


// ═══════════════════════════════════════════════════════
//  [Fix-UI-3] NPC 실루엣 — 더 크고, 이름표 개선
// ═══════════════════════════════════════════════════════

const NpcSilhouette = ({ name, isActive }) => (
  <motion.div
    className="relative flex flex-col items-center"
    animate={{
      opacity: isActive ? 1 : 0.3,
      scale: isActive ? 1.08 : 0.95,
      y: isActive ? 0 : 6,
    }}
    transition={{ duration: 0.5, ease: "easeOut" }}
  >
    {/* NPC 이름 */}
    <AnimatePresence>
      {name && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: isActive ? 1 : 0.4, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="absolute -top-10 whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold
                     bg-black/80 text-red-300/90 border border-red-500/30 backdrop-blur-sm
                     shadow-[0_0_15px_rgba(239,68,68,0.2)]"
        >
          👤 {name}
        </motion.div>
      )}
    </AnimatePresence>

    {/* [Fix-UI-3] 실루엣 SVG — 180x360으로 확대 */}
    <svg width="180" height="360" viewBox="0 0 180 360" className="drop-shadow-2xl"
      style={{
        filter: isActive
          ? "drop-shadow(0 0 25px rgba(239,68,68,0.35)) brightness(1.15)"
          : "drop-shadow(0 4px 12px rgba(0,0,0,0.5)) brightness(0.5)",
      }}
    >
      <ellipse cx="90" cy="58" rx="30" ry="35"
        fill={isActive ? "rgba(30,15,40,0.95)" : "rgba(15,8,20,0.85)"}
        stroke={isActive ? "rgba(239,68,68,0.3)" : "rgba(100,60,120,0.1)"} strokeWidth="1.5" />
      <rect x="78" y="91" width="24" height="18" rx="4"
        fill={isActive ? "rgba(25,12,35,0.95)" : "rgba(12,6,18,0.85)"} />
      <path d="M 35 109 Q 42 100 70 97 L 80 97 L 100 97 L 110 97 Q 138 100 145 109 L 152 205 Q 152 215 143 218 L 37 218 Q 28 215 28 205 Z"
        fill={isActive ? "rgba(20,10,30,0.95)" : "rgba(10,5,15,0.85)"}
        stroke={isActive ? "rgba(239,68,68,0.2)" : "rgba(80,40,100,0.08)"} strokeWidth="1.5" />
      <rect x="45" y="218" width="34" height="115" rx="5"
        fill={isActive ? "rgba(18,8,28,0.95)" : "rgba(8,4,12,0.85)"} />
      <rect x="101" y="218" width="34" height="115" rx="5"
        fill={isActive ? "rgba(18,8,28,0.95)" : "rgba(8,4,12,0.85)"} />
      <ellipse cx="52" cy="338" rx="22" ry="6"
        fill={isActive ? "rgba(15,5,25,0.9)" : "rgba(5,2,10,0.7)"} />
      <ellipse cx="128" cy="338" rx="22" ry="6"
        fill={isActive ? "rgba(15,5,25,0.9)" : "rgba(5,2,10,0.7)"} />
    </svg>
  </motion.div>
);


// ═══════════════════════════════════════════════════════
//  CharacterDisplay — 메인
// ═══════════════════════════════════════════════════════

const CharacterDisplay = ({
  emotion = "NEUTRAL", outfit = "MAID", characterSlug = "airi", defaultOutfit,
  // [Fix-UGC-CDN] 백엔드가 준 절대 URL (GET /chat/rooms/{id}의 defaultImageUrl).
  // UGC 캐릭터의 CDN 디렉터리 유도용 — 없거나 절대 URL이 아니면 기존 동작 유지.
  defaultImageUrl = null,
  npcSpeaker = null, isNpcActive = false,
  // [Phase B · 단계1] 모바일 세로 bust-up 크롭 (default false → 데스크톱 geometry 불변)
  portrait = false,
}) => {
  const assetDir = useMemo(() => deriveAssetDir(defaultImageUrl), [defaultImageUrl]);
  const imagePath = resolveCharacterImage(characterSlug, outfit, emotion, assetDir);
  const config = EMOTION_ANIM[emotion] || EMOTION_ANIM.NEUTRAL;
  const idleControls = useAnimation();
  const prevEmotionRef = useRef(emotion);

  const hasNpc = !!npcSpeaker;
  const hasCharacter = !!characterSlug;   // [Bug-Sprite] 화자(히로인)가 있을 때만 메인 스프라이트 — 시스템 나레이션엔 미표시
  const isMainActive = !isNpcActive;

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const changed = prevEmotionRef.current !== emotion;
      prevEmotionRef.current = emotion;
      if (changed && config.punch) {
        await idleControls.start(config.punch);
        if (cancelled) return;
        await idleControls.start({ x: 0, y: 0, rotate: 0, scale: 1, transition: { duration: 0.15 } });
        if (cancelled) return;
      }
      idleControls.start({ ...config.idle, transition: config.idleTx });
    };
    run();
    return () => { cancelled = true; };
  }, [emotion, config, idleControls]);

  return (
    <div className="absolute inset-0 z-0 flex items-end justify-center pointer-events-none overflow-hidden">

      {/* [Bug-Sprite] 무대 전체 페이드 — 화자(히로인) 등장/퇴장이 매끄럽게 */}
      <AnimatePresence>
      {(hasCharacter || hasNpc) && (
      <motion.div
        key="char-stage"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="absolute inset-0 flex items-end justify-center"
      >

      {(hasCharacter || hasNpc) && (
      <motion.div animate={{ opacity: hasNpc && isNpcActive ? 0.3 : 1 }} transition={{ duration: 0.5 }}>
        <GlowLayer config={config} />
      </motion.div>
      )}

      {hasNpc ? (
        <div className="relative w-full h-full max-w-5xl flex items-end justify-center pb-20 md:pb-28">

          {/* [Fix-UI-3] 메인 캐릭터 — left 15% (기존 10%) */}
          {hasCharacter && (
          <motion.div
            className="absolute bottom-20 md:bottom-28 flex items-end justify-center"
            animate={{
              left: "15%",
              opacity: isMainActive ? 1 : 0.45,
              scale: isMainActive ? 1.0 : 0.85,
              filter: isMainActive
                ? `brightness(${config.imgBrightness}) drop-shadow(0 0 25px ${config.glow})`
                : "brightness(0.55) drop-shadow(0 0 8px rgba(0,0,0,0.3))",
            }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            style={{ width: "42%", height: "80%" }}
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
                    src={imagePath} alt={`${characterSlug} ${emotion}`}
                    initial={{ opacity: 0, scale: 1.02 }} animate={{ opacity: 1, scale: 1.05 }}
                    exit={{ opacity: 0, scale: 1.02 }} transition={{ duration: 0.5 }}
                    className="h-[85%] md:h-[90%] object-contain select-none pointer-events-none"
                    style={{ filter: `drop-shadow(0 0 25px ${config.glow}) drop-shadow(0 5px 15px rgba(0,0,0,0.4)) brightness(${isMainActive ? config.imgBrightness : 0.65})` }}
                    onError={(e) => {
                      const fb1 = resolveCharacterImage(characterSlug, outfit, "NEUTRAL", assetDir);
                      const fb2 = resolveCharacterImage(characterSlug, defaultOutfit || "MAID", emotion, assetDir);
                      // resolveCharacterImage가 절대 URL을 반환하므로 직접 비교
                      if (e.target.src !== fb1 && e.target.src !== fb2) e.target.src = fb2;
                      else e.target.style.display = "none";
                    }}
                  />
                </AnimatePresence>
              </motion.div>
            </motion.div>
          </motion.div>
          )}

          {/* [Fix-UI-3] NPC 실루엣 */}
          <motion.div
            className="absolute bottom-20 md:bottom-28 flex items-end justify-center"
            style={{ right: "15%", height: "68%" }}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <NpcSilhouette name={npcSpeaker} isActive={isNpcActive} />
          </motion.div>

          {/* NPC 바닥 글로우 */}
          <motion.div
            className="absolute rounded-full pointer-events-none"
            style={{ bottom: "10%", right: "18%", width: 180, height: 90, filter: "blur(50px)" }}
            animate={{
              backgroundColor: isNpcActive ? "rgba(239,68,68,0.18)" : "rgba(100,50,80,0.05)",
              opacity: isNpcActive ? [0.3, 0.5, 0.3] : 0.1,
            }}
            transition={{ opacity: { duration: 3, repeat: Infinity, ease: "easeInOut" } }}
          />
        </div>
      ) : hasCharacter ? (
        /* 일반 모드 (기존) */
        <motion.div
          animate={{ y: [0, -8, 0], scaleY: [1, 1.004, 1], scaleX: [1, 1.001, 1] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className={`relative w-full h-full max-w-4xl flex items-end justify-center ${portrait ? "pb-0" : "pb-20 md:pb-28"}`}
        >
          <motion.div animate={idleControls} className="relative h-full w-full flex items-end justify-center">
            {/* [Phase B · 단계1] portrait 시 상반신 bust-up 크롭 — top-biased 확대(하반신은 루트 overflow-hidden 으로 clip). 기본 off. */}
            <div
              className="relative h-full w-full flex items-end justify-center"
              style={portrait ? { transform: "scale(1.5)", transformOrigin: "center 18%" } : undefined}
            >
            <AnimatePresence mode="popLayout">
              <motion.img
                key={`${characterSlug}_${outfit}_${emotion}`}
                src={imagePath} alt={`${characterSlug} ${outfit} ${emotion}`}
                initial={{ opacity: 0, scale: 1.02 }} animate={{ opacity: 1, scale: 1.05 }}
                exit={{ opacity: 0, scale: 1.02 }} transition={{ duration: 0.5 }}
                className="h-[85%] md:h-[90%] object-contain select-none pointer-events-none"
                style={{ filter: `drop-shadow(0 0 25px ${config.glow}) drop-shadow(0 5px 15px rgba(0,0,0,0.4)) brightness(${config.imgBrightness})` }}
                onError={(e) => {
                  const fb1 = resolveCharacterImage(characterSlug, outfit, "NEUTRAL", assetDir);
                  const fb2 = resolveCharacterImage(characterSlug, defaultOutfit || "MAID", emotion, assetDir);
                  if (e.target.src !== fb1 && e.target.src !== fb2) e.target.src = fb2;
                  else e.target.style.display = "none";
                }}
              />
            </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      ) : null}

      {(hasCharacter || hasNpc) && <EmotionParticles emotion={emotion} />}

      </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
};

export { resolveCharacterImage, EMOTION_LIST };
export default CharacterDisplay;