import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Sparkles, ArrowRight } from "lucide-react";
import { sfx } from "../../utils/sfx";

// ═══════════════════════════════════════════════════════════════
//  [Chunk C-2] StoryV2EndingCredits — V2 멀티 히로인 시네마틱
//
//  V1 EndingCredits(931줄, 단일 캐릭터 중심)와 *독립*. V2는 멀티 히로인
//  컨텍스트라 각 히로인이 동등한 스포트라이트를 받아야 한다.
//
//  설계:
//    - *백엔드 의존 zero* — V2 room 상태(heroines, endingType, currentDay)만 사용
//    - 5 phase 시네마틱 — fade → title → heroine spotlights → stats → fin
//    - tap-to-skip — 현재 phase 즉시 종료, 다음 phase로
//    - 엔딩 타입별 컬러 팔레트 (HAPPY/BAD/...)
//
//  V1 대비 단순화: 8 phase → 5 phase. 다대다 관계를 균등하게 표현하는 데
//  집중. 후속 작업으로 RAG 추억 회고 (Phase 6) 등 V1 cinematic 깊이 이식 가능.
// ═══════════════════════════════════════════════════════════════

// 엔딩 타입별 시각 톤
const ENDING_PALETTE = {
  HAPPY: {
    titleLabel: "결말",
    titleSubtitle: "행복의 끝에서",
    titleClass: "text-amber-200",
    glow: "shadow-amber-500/30",
    accent: "from-amber-500/20 to-rose-500/10",
    particle: "bg-amber-300",
  },
  BAD: {
    titleLabel: "끝",
    titleSubtitle: "흩어진 인연들",
    titleClass: "text-indigo-200",
    glow: "shadow-indigo-500/20",
    accent: "from-indigo-500/15 to-slate-500/10",
    particle: "bg-indigo-300",
  },
  // 향후 확장 시 추가 — 미지 타입은 NEUTRAL 폴백
  NEUTRAL: {
    titleLabel: "막을 내리며",
    titleSubtitle: "",
    titleClass: "text-stone-200",
    glow: "shadow-stone-500/20",
    accent: "from-stone-500/15 to-stone-700/10",
    particle: "bg-stone-300",
  },
};

function getPalette(endingType) {
  return ENDING_PALETTE[endingType] || ENDING_PALETTE.NEUTRAL;
}

/**
 * @param {object}   props
 * @param {object}   props.room                 — V2 ChatRoom 상태 (heroines, endingType, currentDay, worldDisplayName 등)
 * @param {function} props.onComplete           — 크레딧 종료 시 콜백 (로비 복귀)
 */
export default function StoryV2EndingCredits({ room, onComplete }) {
  // phase 시퀀스
  //   0: black fade (2s)
  //   1: title card (5s)
  //   2: heroine spotlights — 각 히로인 4s씩
  //   3: stats summary (4s)
  //   4: fin (∞, 유저 클릭 대기)
  const [phase, setPhase] = useState(0);
  const [heroineIdx, setHeroineIdx] = useState(0);  // phase 2 내부 인덱스

  const palette = getPalette(room?.endingType);
  const heroines = room?.heroines || [];

  // ── phase 자동 진행 타이머 ──
  useEffect(() => {
    if (phase === 0) {
      const t = setTimeout(() => setPhase(1), 2000);
      return () => clearTimeout(t);
    }
    if (phase === 1) {
      sfx.chime();
      const t = setTimeout(() => setPhase(2), 5000);
      return () => clearTimeout(t);
    }
    if (phase === 2) {
      // 히로인 한 명당 4s — 종료 시 다음 히로인 또는 phase 3
      if (heroines.length === 0) {
        setPhase(3);
        return;
      }
      const t = setTimeout(() => {
        if (heroineIdx + 1 < heroines.length) {
          setHeroineIdx((i) => i + 1);
        } else {
          setPhase(3);
        }
      }, 4000);
      return () => clearTimeout(t);
    }
    if (phase === 3) {
      const t = setTimeout(() => setPhase(4), 4000);
      return () => clearTimeout(t);
    }
    // phase 4: fin — 유저가 클릭해야 종료
  }, [phase, heroineIdx, heroines.length]);

  // ── tap-to-skip: 현재 phase 즉시 종료 ──
  const handleSkip = useCallback(() => {
    sfx.click();
    if (phase === 0) setPhase(1);
    else if (phase === 1) setPhase(2);
    else if (phase === 2) {
      if (heroineIdx + 1 < heroines.length) setHeroineIdx((i) => i + 1);
      else setPhase(3);
    }
    else if (phase === 3) setPhase(4);
    // phase 4는 명시적 버튼 — handleEnd
  }, [phase, heroineIdx, heroines.length]);

  const handleEnd = useCallback(() => {
    sfx.chime();
    onComplete?.();
  }, [onComplete]);

  if (!room) return null;

  return (
    <div
      className="fixed inset-0 z-[300] bg-black overflow-hidden cursor-pointer"
      onClick={handleSkip}
    >
      <AnimatePresence mode="wait">
        {/* ═══ Phase 0: Black Fade ═══ */}
        {phase === 0 && (
          <motion.div
            key="phase-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black"
          />
        )}

        {/* ═══ Phase 1: Title Card ═══ */}
        {phase === 1 && (
          <motion.div
            key="phase-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.0 }}
            className={`absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-black ${palette.accent}`}
          >
            {/* 떠다니는 파티클 효과 */}
            <FloatingParticles palette={palette} count={20} />

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 1.5 }}
              className="text-center z-10"
            >
              <p className={`${palette.titleClass} text-xs tracking-[0.4em] uppercase mb-4 opacity-60`}>
                {room.worldDisplayName}
              </p>
              <h1 className={`text-6xl sm:text-7xl font-bold ${palette.titleClass} mb-3 tracking-wider`}
                  style={{ textShadow: "0 0 40px currentColor" }}>
                {palette.titleLabel}
              </h1>
              {palette.titleSubtitle && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.7 }}
                  transition={{ delay: 1.5, duration: 1.5 }}
                  className={`${palette.titleClass} text-base italic`}
                >
                  {palette.titleSubtitle}
                </motion.p>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* ═══ Phase 2: Heroine Spotlights ═══ */}
        {phase === 2 && heroines[heroineIdx] && (
          <motion.div
            key={`phase-2-${heroineIdx}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className={`absolute inset-0 flex items-center justify-center bg-gradient-to-tr from-black ${palette.accent}`}
          >
            <HeroineSpotlight
              heroine={heroines[heroineIdx]}
              palette={palette}
              index={heroineIdx + 1}
              total={heroines.length}
            />
          </motion.div>
        )}

        {/* ═══ Phase 3: Stats Summary ═══ */}
        {phase === 3 && (
          <motion.div
            key="phase-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className={`absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-black ${palette.accent}`}
          >
            <StatsSummary room={room} palette={palette} />
          </motion.div>
        )}

        {/* ═══ Phase 4: Fin ═══ */}
        {phase === 4 && (
          <motion.div
            key="phase-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
            className="absolute inset-0 bg-black flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}  // 자동 skip 차단 — 명시적 버튼만
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5, duration: 1.5 }}
              className="text-center"
            >
              <h1 className={`text-8xl font-serif italic ${palette.titleClass} mb-12 tracking-widest`}
                  style={{ textShadow: "0 0 60px currentColor" }}>
                Fin.
              </h1>
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.8 }}
                transition={{ delay: 2 }}
                whileHover={{ scale: 1.05, opacity: 1 }}
                onClick={handleEnd}
                className={`group inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-white/70 hover:text-white text-sm transition`}
              >
                로비로 돌아가기
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* skip 힌트 (phase 0~3에서만, 첫 1초 뒤 등장) */}
      {phase < 4 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="absolute bottom-6 right-6 text-[10px] uppercase tracking-wider text-white/40"
        >
          탭하여 건너뛰기
        </motion.div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Sub-components
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** 히로인 스포트라이트 — 프로필 + 이름 + 관계 + 핵심 스탯 */
function HeroineSpotlight({ heroine, palette, index, total }) {
  return (
    <motion.div
      key={heroine.characterId}
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 1.0, ease: "easeOut" }}
      className="text-center z-10 px-6"
    >
      {/* 진행 인디케이터 */}
      <p className={`${palette.titleClass} text-[10px] tracking-[0.3em] uppercase opacity-50 mb-6`}>
        {index} / {total}
      </p>

      {/* 프로필 이미지 with glow */}
      <motion.div
        initial={{ scale: 0.7 }}
        animate={{ scale: 1 }}
        transition={{ duration: 1.5, delay: 0.2 }}
        className={`relative w-40 h-40 sm:w-48 sm:h-48 mx-auto mb-6 rounded-full overflow-hidden shadow-2xl ${palette.glow}`}
        style={{ filter: "drop-shadow(0 0 30px currentColor)" }}
      >
        {heroine.profileImageUrl ? (
          <img
            src={heroine.profileImageUrl}
            alt={heroine.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-white/5 flex items-center justify-center text-white/30 text-4xl">
            ?
          </div>
        )}
        <div className={`absolute inset-0 ring-2 ${palette.titleClass} ring-opacity-30 rounded-full pointer-events-none`} />
      </motion.div>

      {/* 이름 */}
      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.8 }}
        className="text-3xl sm:text-4xl font-bold text-white mb-2"
      >
        {heroine.name}
      </motion.h2>

      {/* 동적 관계 태그 */}
      {heroine.dynamicRelationTag && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.8 }}
          transition={{ delay: 1.2, duration: 0.8 }}
          className={`${palette.titleClass} text-sm italic mb-6`}
        >
          ─ {heroine.dynamicRelationTag} ─
        </motion.p>
      )}

      {/* 스탯 라인 — 시각적 강약 */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.6, duration: 0.8 }}
        className="flex items-center justify-center gap-5 text-xs"
      >
        <StatPill icon={<Heart size={11} />} label="호감도" value={heroine.statAffection} palette={palette} />
        <span className="text-white/20">·</span>
        <StatPill label="친밀도" value={heroine.statIntimacy} palette={palette} />
        <span className="text-white/20">·</span>
        <StatPill label="신뢰" value={heroine.statTrust} palette={palette} />
      </motion.div>

      {/* (있다면) 마지막 속마음 */}
      {heroine.thoughtUnlocked && heroine.characterThought && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
          transition={{ delay: 2.2, duration: 1 }}
          className="mt-6 text-purple-200/80 text-sm italic max-w-md mx-auto leading-relaxed"
        >
          💭 {heroine.characterThought}
        </motion.p>
      )}
    </motion.div>
  );
}

function StatPill({ icon, label, value, palette }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${palette.titleClass} opacity-90`}>
      {icon}
      <span className="text-white/40">{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </span>
  );
}

/** 통계 요약 — 함께한 일수 + 총 히로인 수 + 가장 가까웠던 히로인 */
function StatsSummary({ room, palette }) {
  const heroines = room.heroines || [];

  // 가장 호감도 높은 히로인
  const topHeroine = useMemo(() => {
    if (heroines.length === 0) return null;
    return [...heroines].sort((a, b) => (b.statAffection ?? 0) - (a.statAffection ?? 0))[0];
  }, [heroines]);

  const totalAffection = useMemo(() => {
    return heroines.reduce((sum, h) => sum + (h.statAffection ?? 0), 0);
  }, [heroines]);

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 1.2 }}
      className="text-center z-10 px-6 max-w-md"
    >
      <p className={`${palette.titleClass} text-xs uppercase tracking-[0.4em] opacity-60 mb-8`}>
        함께한 시간
      </p>

      <div className="space-y-6">
        <StatBlock label="여정의 길이" value={`${room.currentDay} 일`} palette={palette} />
        <StatBlock label="만난 사람들" value={`${heroines.length} 명`} palette={palette} />
        {topHeroine && (
          <StatBlock
            label="가장 가까웠던"
            value={topHeroine.name}
            sublabel={`호감도 ${topHeroine.statAffection}`}
            palette={palette}
          />
        )}
        <StatBlock label="누적 호감도" value={totalAffection} palette={palette} />
      </div>
    </motion.div>
  );
}

function StatBlock({ label, value, sublabel, palette }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6 }}
    >
      <p className="text-white/40 text-[10px] uppercase tracking-widest mb-1">{label}</p>
      <p className={`${palette.titleClass} text-2xl font-bold`}>{value}</p>
      {sublabel && (
        <p className="text-white/40 text-xs italic mt-0.5">{sublabel}</p>
      )}
    </motion.div>
  );
}

/** 떠다니는 파티클 효과 — 타이틀 phase의 분위기 보강 */
function FloatingParticles({ palette, count = 20 }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className={`absolute w-1 h-1 rounded-full ${palette.particle} opacity-40`}
          initial={{
            x: `${Math.random() * 100}%`,
            y: "110%",
            scale: 0,
          }}
          animate={{
            y: "-10%",
            scale: [0, 1, 0],
            opacity: [0, 0.5, 0],
          }}
          transition={{
            duration: 6 + Math.random() * 4,
            delay: Math.random() * 3,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
}