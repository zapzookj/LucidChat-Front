import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Zap, Heart, Sparkles, Crown, ChevronRight } from "lucide-react";

/**
 * [Phase 5.5-Theater] 분기 선택 모달
 *
 * 4종 분기 레벨 대응:
 *   - LOCATION: 장소 카드 (히로인 호감도 표시)
 *   - MINOR:    2지선다 인라인 (가벼운 스타일)
 *   - MAJOR:    3지선다 풀스크린
 *   - CLIMAX:   3지선다 시네마틱 (스파클 이펙트)
 *
 * Props:
 *   branchOptions: BranchOptions (서버 응답)
 *   branchToken:   서버에서 받은 토큰
 *   onConfirm(chosenIndex)
 *   onCancel
 */

const LEVEL_THEMES = {
  LOCATION: {
    title: "오늘, 어디로 향할까?",
    accent: "indigo",
    bg: "from-indigo-950 to-slate-950",
  },
  MINOR: {
    title: "작은 선택",
    accent: "slate",
    bg: "from-slate-900 to-slate-950",
  },
  MAJOR: {
    title: "큰 선택",
    accent: "purple",
    bg: "from-purple-950 to-slate-950",
  },
  CLIMAX: {
    title: "결정적 순간",
    accent: "rose",
    bg: "from-rose-950 via-purple-950 to-slate-950",
  },
};

export default function TheaterBranchModal({ branchOptions, onConfirm, onCancel }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [confirming, setConfirming] = useState(false);

  if (!branchOptions) return null;

  const theme = LEVEL_THEMES[branchOptions.branchLevel] || LEVEL_THEMES.MINOR;
  const isLocation = branchOptions.branchLevel === "LOCATION";
  const isClimax = branchOptions.branchLevel === "CLIMAX";

  const handleSelect = async (option) => {
    if (!option.unlocked || confirming) return;
    setConfirming(true);
    try {
      await onConfirm(option.index);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 z-[110] bg-gradient-to-b ${theme.bg} backdrop-blur-xl flex flex-col items-center justify-center p-6 overflow-hidden`}
    >
      {/* Climax 배경 이펙트 */}
      {isClimax && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(25)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-rose-300/60 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0.5, 2, 0.5],
              }}
              transition={{
                duration: 2 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 3,
              }}
            />
          ))}
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 max-w-3xl w-full"
      >
        {/* 타이틀 */}
        <div className="text-center mb-8">
          <div className="text-xs uppercase tracking-[0.4em] text-white/40 mb-2">
            {branchOptions.branchLevel}
          </div>
          <h2
            className="text-3xl font-bold text-white"
            style={{ fontFamily: "'Noto Serif KR', serif" }}
          >
            {theme.title}
          </h2>
        </div>

        {/* 상황 나레이션 */}
        {branchOptions.contextNarration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mb-8 text-center text-white/80 italic text-lg leading-relaxed max-w-2xl mx-auto"
            style={{ fontFamily: "'Noto Serif KR', serif" }}
          >
            {branchOptions.contextNarration}
          </motion.div>
        )}

        {/* 선택지들 */}
        <div className={`grid gap-4 ${isLocation ? "md:grid-cols-2" : "grid-cols-1"}`}>
          {branchOptions.options?.map((option, i) => (
            <BranchCard
              key={option.index}
              option={option}
              index={i}
              isLocation={isLocation}
              hovered={hoveredIdx === option.index}
              onHover={() => setHoveredIdx(option.index)}
              onLeave={() => setHoveredIdx(null)}
              onSelect={() => handleSelect(option)}
              disabled={confirming}
            />
          ))}
        </div>

        {/* 취소 */}
        {branchOptions.branchLevel === "MINOR" && onCancel && (
          <div className="mt-6 text-center">
            <button
              onClick={onCancel}
              disabled={confirming}
              className="text-xs text-white/40 hover:text-white/70"
            >
              나중에 결정
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  분기 카드
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function BranchCard({ option, index, isLocation, hovered, onHover, onLeave, onSelect, disabled }) {
  const locked = !option.unlocked;

  const toneColor = {
    normal: "text-white",
    affection: "text-rose-200",
    bold: "text-orange-200",
    witty: "text-cyan-200",
    introspective: "text-purple-200",
  }[option.tone] || "text-white";

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 + index * 0.12 }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={onSelect}
      disabled={disabled || locked}
      whileTap={!disabled && !locked ? { scale: 0.98 } : {}}
      whileHover={!disabled && !locked ? { scale: 1.02, y: -2 } : {}}
      className={`relative text-left rounded-2xl p-5 border transition-all overflow-hidden ${
        locked
          ? "bg-white/[0.02] border-white/10 cursor-not-allowed opacity-60"
          : "bg-white/[0.04] border-white/10 hover:border-white/30 cursor-pointer"
      }`}
    >
      {/* 잠금 오버레이 */}
      {locked && (
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 rounded-full px-2 py-0.5 text-[10px] font-bold text-white/70">
          <Lock size={10} />
          <span>{option.statGate?.requiredStat} {option.statGate?.requiredValue}+</span>
        </div>
      )}

      {/* 에너지 배지 */}
      {option.energyCost > 0 && (
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-amber-500/20 border border-amber-400/30 rounded-full px-2 py-0.5 text-[10px] font-bold text-amber-200">
          <Zap size={10} /> {option.energyCost}
        </div>
      )}

      {/* LOCATION 전용 — 히로인 정보 */}
      {isLocation && option.heroineName && (
        <div className="flex items-center gap-2 mb-2">
          <Heart size={11} className="text-rose-400" fill="currentColor" />
          <span className="text-xs text-rose-300 font-bold">{option.heroineName}</span>
        </div>
      )}
      {isLocation && !option.heroineName && (
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={11} className="text-indigo-300" />
          <span className="text-xs text-indigo-300 font-bold">예측 불가</span>
        </div>
      )}

      {/* 라벨 */}
      <div className={`text-lg font-bold mb-1 ${toneColor}`}>
        {option.label}
      </div>

      {/* 디테일 */}
      {option.detail && (
        <div className="text-sm text-white/50 leading-relaxed">
          {option.detail}
        </div>
      )}

      {/* 호버 이펙트 */}
      <AnimatePresence>
        {hovered && !locked && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-3 right-4 text-white/60 flex items-center gap-1 text-xs"
          >
            선택 <ChevronRight size={12} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}