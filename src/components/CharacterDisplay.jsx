import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { useEffect, useRef, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════
//  [Phase 4] Enhanced Character Display — "The Soul"
//
//  5-Layer Animation System:
//    L1. Glow/Aura    — 감정별 컬러 오라 (배경)
//    L2. Breathing     — 호흡 루프 (공통 베이스)
//    L3. Idle + Punch  — 감정별 진입 모션 + 지속 미세 움직임
//    L4. Image Swap    — AnimatePresence 기반 표정 교체
//    L5. Particles     — 감정별 이모션 파티클
// ═══════════════════════════════════════════════════════════════

const EMOTION_MAP = {
  NEUTRAL: "neutral.png",
  JOY: "joy.png",
  SAD: "sad.png",
  ANGRY: "angry.png",
  SHY: "shy.png",
  SURPRISE: "surprise.png",
  PANIC: "panic.png",
  RELAX: "relax.png",
  DISGUST: "disgust.png",
  FRIGHTENED: "frightened.png",
  FLIRTATIOUS: "flirtatious.png",
  HEATED: "heated.png",
};

// ─────────────────────────────────────────────────
//  감정별 애니메이션 프로파일
// ─────────────────────────────────────────────────
//  punch   : 감정 전환 시 1회 재생되는 임팩트 모션
//  idle    : 해당 감정이 유지되는 동안 반복되는 미세 움직임
//  idleTx  : idle 루프 transition 설정
//  glow    : 오라 컬러 (rgba)
//  glowIntensity : 오라 크기 배율 (1 = 기본)
//  imgBrightness : 캐릭터 이미지 밝기 보정
// ─────────────────────────────────────────────────

const EMOTION_ANIM = {
  NEUTRAL: {
    punch: null,
    idle: {
      rotate: [0, 0.4, 0, -0.4, 0],
      x: [0, 0.5, 0, -0.5, 0],
    },
    idleTx: { duration: 8, repeat: Infinity, ease: "easeInOut" },
    glow: "rgba(180, 180, 255, 0.08)",
    glowIntensity: 1,
    imgBrightness: 1.05,
  },

  JOY: {
    // 통통 바운스 — 기쁨의 점프
    punch: {
      y: [-18, 4, 0],
      scale: [1, 1.04, 1],
      transition: { duration: 0.5, ease: "easeOut" },
    },
    idle: {
      y: [0, -5, 0],
      rotate: [0, 1.2, 0, -1.2, 0],
    },
    idleTx: { duration: 3, repeat: Infinity, ease: "easeInOut" },
    glow: "rgba(255, 105, 180, 0.28)",
    glowIntensity: 1.4,
    imgBrightness: 1.1,
  },

  SAD: {
    // 살짝 처지는 느낌
    punch: {
      y: [0, 5, 3],
      scale: [1, 0.98, 0.99],
      transition: { duration: 0.7, ease: "easeOut" },
    },
    idle: {
      y: [0, 2, 0],
      rotate: [0, -0.3, 0],
    },
    idleTx: { duration: 7, repeat: Infinity, ease: "easeInOut" },
    glow: "rgba(100, 140, 220, 0.22)",
    glowIntensity: 0.8,
    imgBrightness: 0.92,
  },

  ANGRY: {
    // 빠른 좌우 진동 — 분노 떨림
    punch: {
      x: [-5, 5, -4, 4, -2, 2, 0],
      transition: { duration: 0.4, ease: "easeOut" },
    },
    idle: {
      x: [0, 1.5, 0, -1.5, 0],
      rotate: [0, 0.3, 0, -0.3, 0],
    },
    idleTx: { duration: 1.8, repeat: Infinity, ease: "easeInOut" },
    glow: "rgba(255, 50, 50, 0.32)",
    glowIntensity: 1.3,
    imgBrightness: 1.05,
  },

  SHY: {
    // 움츠러들며 살짝 기울어짐
    punch: {
      rotate: [-2.5, 0.5, 0],
      scale: [0.97, 1.01, 1],
      transition: { duration: 0.5, ease: "easeOut" },
    },
    idle: {
      rotate: [0, -0.8, 0, 0.8, 0],
      x: [0, -1, 0],
    },
    idleTx: { duration: 4.5, repeat: Infinity, ease: "easeInOut" },
    glow: "rgba(255, 150, 200, 0.26)",
    glowIntensity: 1.1,
    imgBrightness: 1.05,
  },

  SURPRISE: {
    // 위로 튀어오르는 깜짝 점프
    punch: {
      y: [-22, 6, 0],
      scale: [1, 1.06, 1],
      transition: { duration: 0.45, type: "spring", stiffness: 300, damping: 12 },
    },
    idle: {
      y: [0, -3, 0],
      scale: [1, 1.008, 1],
    },
    idleTx: { duration: 2.5, repeat: Infinity, ease: "easeInOut" },
    glow: "rgba(255, 220, 50, 0.28)",
    glowIntensity: 1.4,
    imgBrightness: 1.08,
  },

  PANIC: {
    // 격렬한 진동 — 패닉 떨림
    punch: {
      x: [-6, 6, -5, 5, -3, 3, -1, 1, 0],
      y: [0, -4, 0],
      transition: { duration: 0.4 },
    },
    idle: {
      y: [0, -3, 0],
      scale: [1, 1.008, 1],
    },
    idleTx: { duration: 2.5, repeat: Infinity, ease: "easeInOut" },
    glow: "rgba(255, 80, 30, 0.28)",
    glowIntensity: 1.2,
    imgBrightness: 1.03,
  },

  RELAX: {
    // 부드럽게 커지는 편안한 이완
    punch: {
      scale: [1, 1.02, 1],
      transition: { duration: 1, ease: "easeOut" },
    },
    idle: {
      rotate: [0, 0.2, 0, -0.2, 0],
      y: [0, 1, 0],
    },
    idleTx: { duration: 10, repeat: Infinity, ease: "easeInOut" },
    glow: "rgba(255, 200, 120, 0.18)",
    glowIntensity: 1.0,
    imgBrightness: 1.05,
  },

  DISGUST: {
    // 뒤로 살짝 젖히는 거부감
    punch: {
      rotate: [-1.8, 0.3, 0],
      x: [-4, 0],
      transition: { duration: 0.35, ease: "easeOut" },
    },
    idle: {
      rotate: [0, -0.4, 0],
      x: [0, -0.5, 0],
    },
    idleTx: { duration: 5, repeat: Infinity, ease: "easeInOut" },
    glow: "rgba(160, 80, 200, 0.18)",
    glowIntensity: 0.8,
    imgBrightness: 0.97,
  },

  FRIGHTENED: {
    // 뒤로 움츠러들며 부들부들 떨림
    punch: {
      x: [-3, 3, -3, 2, -1, 0],
      y: [0, 6, 4],
      scale: [1, 0.96, 0.97],
      transition: { duration: 0.45, ease: "easeOut" },
    },
    idle: {
      x: [0, 1.8, 0, -1.8, 0],
      y: [0, 1, 0, 1, 0],
      scale: [0.97, 0.975, 0.97],
    },
    idleTx: { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
    glow: "rgba(80, 80, 180, 0.22)",
    glowIntensity: 0.7,
    imgBrightness: 0.88,
  },

  FLIRTATIOUS: {
    // 느릿하게 몸을 기울이며 다가오는 유혹
    punch: {
      rotate: [0, 2, -1, 0.5, 0],
      scale: [1, 1.03, 1.01],
      y: [0, -5, -2],
      transition: { duration: 0.8, ease: "easeOut" },
    },
    idle: {
      rotate: [0, 1.5, 0, -1.5, 0],
      y: [0, -3, 0, -2, 0],
      scale: [1.01, 1.015, 1.01],
    },
    idleTx: { duration: 5, repeat: Infinity, ease: "easeInOut" },
    glow: "rgba(220, 40, 120, 0.35)",
    glowIntensity: 1.5,
    imgBrightness: 1.08,
  },

  HEATED: {
    // 전신이 달아오르며 크게 숨쉬는 황홀감
    punch: {
      scale: [1, 1.05, 1.02],
      y: [0, -10, -4],
      transition: { duration: 0.6, type: "spring", stiffness: 200, damping: 14 },
    },
    idle: {
      y: [0, -5, 0, -3, 0],
      scale: [1.02, 1.035, 1.02],
      rotate: [0, 0.6, 0, -0.6, 0],
    },
    idleTx: { duration: 3.5, repeat: Infinity, ease: "easeInOut" },
    glow: "rgba(255, 40, 80, 0.42)",
    glowIntensity: 1.7,
    imgBrightness: 1.12,
  },
};

// ─────────────────────────────────────────────────
//  파티클 프리셋
// ─────────────────────────────────────────────────

const PARTICLE_PRESETS = {
  JOY: {
    count: 6,
    emojis: ["♥", "♡", "♥", "❤"],
    colors: ["#ff69b4", "#ff1493", "#ffb6c1", "#ff85a2"],
    yRange: [-120, -220],
    xDrift: 35,
    duration: [3, 5],
    size: [12, 22],
    baseOpacity: 0.75,
  },
  SHY: {
    count: 5,
    emojis: ["✦", "✧", "·", "✦"],
    colors: ["#ffb6c1", "#ffc0cb", "#ffe4e1", "#ffa6c9"],
    yRange: [-80, -160],
    xDrift: 22,
    duration: [2.5, 4.5],
    size: [8, 15],
    baseOpacity: 0.6,
  },
  ANGRY: {
    count: 4,
    emojis: ["💢", "✕", "💢", "✕"],
    colors: ["#ff4444", "#ff6666", "#cc0000", "#ee3333"],
    yRange: [-40, -90],
    xDrift: 18,
    duration: [1.5, 2.5],
    size: [14, 24],
    baseOpacity: 0.85,
  },
  SURPRISE: {
    count: 5,
    emojis: ["✦", "!", "⚡", "✦", "!!"],
    colors: ["#ffd700", "#ffed4a", "#fff59d", "#ffe082"],
    yRange: [-100, -180],
    xDrift: 30,
    duration: [2, 3.5],
    size: [10, 20],
    baseOpacity: 0.7,
  },
  PANIC: {
    count: 5,
    emojis: ["!", "!!", "⚡", "!", "!"],
    colors: ["#ff6633", "#ff4444", "#ff8855", "#ff5533"],
    yRange: [-60, -130],
    xDrift: 40,
    duration: [1.2, 2.2],
    size: [12, 20],
    baseOpacity: 0.8,
  },
  RELAX: {
    count: 4,
    emojis: ["✧", "∘", "·", "✧"],
    colors: ["#ffd700", "#ffe4b5", "#fff8dc", "#ffefd5"],
    yRange: [-50, -110],
    xDrift: 15,
    duration: [4, 6.5],
    size: [6, 12],
    baseOpacity: 0.4,
  },
  SAD: {
    count: 3,
    emojis: ["·", "·", "·"],
    colors: ["#7eb8da", "#a0c4e8", "#6ca6d0"],
    yRange: [30, 80],      // 아래로 떨어지는 효과
    xDrift: 10,
    duration: [3, 5],
    size: [6, 10],
    baseOpacity: 0.45,
  },
  FRIGHTENED: {
    count: 5,
    emojis: ["…", "·", "!", "…", "·"],
    colors: ["#8888cc", "#6666aa", "#9999dd", "#7777bb"],
    yRange: [-30, -70],
    xDrift: 25,
    duration: [1.5, 2.8],
    size: [8, 16],
    baseOpacity: 0.55,
  },
  FLIRTATIOUS: {
    count: 7,
    emojis: ["♥", "✦", "♡", "~", "♥", "✧", "♡"],
    colors: ["#ff1493", "#ff69b4", "#ff85a2", "#dc143c", "#ff4488", "#ff6eb4", "#e91e8c"],
    yRange: [-100, -200],
    xDrift: 40,
    duration: [3.5, 6],
    size: [10, 22],
    baseOpacity: 0.8,
  },
  HEATED: {
    count: 8,
    emojis: ["♥", "✦", "♥", "~", "♡", "✦", "♥", "~"],
    colors: ["#ff2255", "#ff4477", "#ff0044", "#ff6688", "#ee1144", "#ff3366", "#cc0033", "#ff5577"],
    yRange: [-120, -250],
    xDrift: 45,
    duration: [3, 5.5],
    size: [12, 26],
    baseOpacity: 0.9,
  },
};


// ═══════════════════════════════════════════════════════════════
//  파티클 생성 유틸
// ═══════════════════════════════════════════════════════════════

function generateParticles(emotion) {
  const preset = PARTICLE_PRESETS[emotion];
  if (!preset) return [];

  return Array.from({ length: preset.count }, (_, i) => {
    const xStart = 25 + Math.random() * 50; // 25% ~ 75% (캐릭터 중심부)
    const xDriftVal = (Math.random() - 0.5) * preset.xDrift * 2;
    const yEnd =
      preset.yRange[0] + Math.random() * (preset.yRange[1] - preset.yRange[0]);
    const dur =
      preset.duration[0] + Math.random() * (preset.duration[1] - preset.duration[0]);
    const sz =
      preset.size[0] + Math.random() * (preset.size[1] - preset.size[0]);

    return {
      id: i,
      content: preset.emojis[i % preset.emojis.length],
      color: preset.colors[i % preset.colors.length],
      xStart,
      xDrift: xDriftVal,
      yEnd,
      duration: dur,
      delay: Math.random() * 2.5,
      size: Math.round(sz),
      opacity: preset.baseOpacity * (0.7 + Math.random() * 0.3),
    };
  });
}


// ═══════════════════════════════════════════════════════════════
//  EmotionParticles — 감정 파티클 렌더러
// ═══════════════════════════════════════════════════════════════

const EmotionParticles = ({ emotion }) => {
  // emotion 변경 시마다 새 파티클 세트 생성
  const particles = useMemo(() => generateParticles(emotion), [emotion]);

  if (particles.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
      {particles.map((p) => (
        <motion.span
          key={`${emotion}_p${p.id}`}
          className="absolute select-none"
          style={{
            left: `${p.xStart}%`,
            bottom: "35%",
            fontSize: `${p.size}px`,
            color: p.color,
            textShadow: `0 0 ${p.size * 0.6}px ${p.color}`,
          }}
          initial={{ opacity: 0, y: 0, x: 0, scale: 0.3 }}
          animate={{
            opacity: [0, p.opacity, p.opacity * 0.8, 0],
            y: [0, p.yEnd * 0.3, p.yEnd * 0.7, p.yEnd],
            x: [0, p.xDrift * 0.4, p.xDrift * 0.8, p.xDrift],
            scale: [0.3, 1, 1, 0.5],
            rotate: [0, (Math.random() - 0.5) * 30],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            repeatDelay: Math.random() * 1.5,
            ease: "easeOut",
          }}
        >
          {p.content}
        </motion.span>
      ))}
    </div>
  );
};


// ═══════════════════════════════════════════════════════════════
//  GlowLayer — 감정별 오라/글로우
// ═══════════════════════════════════════════════════════════════

const GlowLayer = ({ config }) => (
  <>
    {/* 메인 오라 (넓은 원형) */}
    <motion.div
      className="absolute left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
      style={{
        bottom: "12%",
        width: 320,
        height: 160,
        filter: "blur(60px)",
      }}
      animate={{
        backgroundColor: config.glow,
        scale: [
          config.glowIntensity,
          config.glowIntensity * 1.12,
          config.glowIntensity,
        ],
        opacity: [0.5, 0.8, 0.5],
      }}
      transition={{
        backgroundColor: { duration: 0.8, ease: "easeOut" },
        scale: { duration: 4, repeat: Infinity, ease: "easeInOut" },
        opacity: { duration: 4, repeat: Infinity, ease: "easeInOut" },
      }}
    />

    {/* 보조 오라 (좁고 강한 하이라이트) */}
    <motion.div
      className="absolute left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
      style={{
        bottom: "18%",
        width: 120,
        height: 80,
        filter: "blur(40px)",
      }}
      animate={{
        backgroundColor: config.glow,
        opacity: [0.3, 0.6, 0.3],
      }}
      transition={{
        opacity: { duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1 },
      }}
    />
  </>
);


// ═══════════════════════════════════════════════════════════════
//  CharacterDisplay — 메인 컴포넌트
// ═══════════════════════════════════════════════════════════════

const CharacterDisplay = ({ emotion = "NEUTRAL" }) => {
  const fileName = EMOTION_MAP[emotion] || EMOTION_MAP.NEUTRAL;
  const config = EMOTION_ANIM[emotion] || EMOTION_ANIM.NEUTRAL;
  const idleControls = useAnimation();
  const prevEmotionRef = useRef(emotion);

  // ── 감정 변경 핸들러: Punch → Reset → Idle Loop ──
  useEffect(() => {
    let cancelled = false;

    const runSequence = async () => {
      const isEmotionChange = prevEmotionRef.current !== emotion;
      prevEmotionRef.current = emotion;

      // 1. 감정 전환 시 펀치 모션 재생
      if (isEmotionChange && config.punch) {
        await idleControls.start(config.punch);
        if (cancelled) return;

        // 펀치 후 원점 복귀 (부드럽게)
        await idleControls.start({
          x: 0,
          y: 0,
          rotate: 0,
          scale: 1,
          transition: { duration: 0.15, ease: "easeOut" },
        });
        if (cancelled) return;
      }

      // 2. 아이들 루프 시작
      idleControls.start({
        ...config.idle,
        transition: config.idleTx,
      });
    };

    runSequence();

    return () => {
      cancelled = true;
    };
  }, [emotion, config, idleControls]);


  return (
    <div className="absolute inset-0 z-0 flex items-end justify-center pointer-events-none overflow-hidden">

      {/* ═══ L1: 오라/글로우 ═══ */}
      <GlowLayer config={config} />

      {/* ═══ L2: 호흡 레이어 (공통 베이스) ═══ */}
      <motion.div
        animate={{
          y: [0, -8, 0],
          scaleY: [1, 1.004, 1],
          scaleX: [1, 1.001, 1],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="relative w-full h-full max-w-4xl flex items-end justify-center pb-20 md:pb-28"
      >
        {/* ═══ L3: 감정 Idle + Punch 레이어 ═══ */}
        <motion.div
          animate={idleControls}
          className="relative h-full w-full flex items-end justify-center"
        >
          {/* ═══ L4: 캐릭터 이미지 (AnimatePresence 교체) ═══ */}
          <AnimatePresence mode="popLayout">
            <motion.img
              key={emotion}
              src={`/characters/${fileName}`}
              alt={emotion}
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1.05 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className="h-[85%] md:h-[90%] object-contain"
              style={{
                filter: `
                  drop-shadow(0 0 25px ${config.glow})
                  drop-shadow(0 5px 15px rgba(0,0,0,0.4))
                  brightness(${config.imgBrightness})
                `,
              }}
              onError={(e) => {
                e.target.style.display = "none";
                console.error(`이미지 로드 실패: ${fileName}`);
              }}
            />
          </AnimatePresence>
        </motion.div>
      </motion.div>

      {/* ═══ L5: 감정 파티클 ═══ */}
      <EmotionParticles emotion={emotion} />
    </div>
  );
};

export default CharacterDisplay;