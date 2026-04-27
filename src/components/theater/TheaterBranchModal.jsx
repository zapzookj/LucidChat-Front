import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Zap, Heart, Sparkles, ChevronRight } from "lucide-react";

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
 *   onConfirm(chosenIndex)
 *   onCancel
 *   [Phase III · A-3 신규]
 *   currentStats: { CHARM, WIT, BOLDNESS, INTELLECT, EMPATHY }  — 현재 아바타 5축 스탯
 *                  Stat-gated 옵션의 진척도 바 시각화에 사용
 *   heroines:     [{ characterId, name, slug, thumbnailUrl, affection }]
 *                  LOCATION 옵션의 히로인 썸네일/호감도 매칭에 사용 (옵션, 없으면 텍스트만)
 */

const STAT_LABEL_KO = {
  CHARM: "매력", WIT: "입담", BOLDNESS: "담력", INTELLECT: "지성", EMPATHY: "감수성",
};

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

export default function TheaterBranchModal({
  branchOptions,
  onConfirm,
  onCancel,
  currentStats = null,
  heroines = [],
}) {
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
              currentStats={currentStats}
              heroines={heroines}
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
//
//  [Phase III · A-3] 폴리싱:
//   ─ LOCATION 카드: 히로인 원형 썸네일 + 호감도 미니 + 장소명 강조
//   ─ Stat-gated 옵션: 단순 잠금 → 필요 스탯 진척도 바
//      "✦ 매력  ▓▓▓░░░░  22 / 35 필요" 형태로 부족분 한눈에
//   ─ 잠금 옵션도 호버 가능 (커서 not-allowed지만 툴팁성 정보 제공)
//
function BranchCard({
  option, index, isLocation, hovered, onHover, onLeave, onSelect, disabled,
  currentStats, heroines,
}) {
  const locked = !option.unlocked;
  const gate = option.statGate;
  const requiredStat = gate?.requiredStat;
  const requiredValue = gate?.requiredValue ?? 0;
  const currentStatValue =
    requiredStat && currentStats && typeof currentStats[requiredStat] === "number"
      ? currentStats[requiredStat]
      : null;

  // LOCATION 카드용 — heroineId로 thumbnail/affection 매칭
  const matchedHeroine = isLocation && option.heroineId && Array.isArray(heroines)
    ? heroines.find((h) => h.characterId === option.heroineId)
    : null;
  const heroineThumbUrl =
    matchedHeroine?.thumbnailUrl ||
    (matchedHeroine?.slug ? `/characters/${matchedHeroine.slug}/thumb.jpg` : null);
  const heroineAffection =
    matchedHeroine && typeof matchedHeroine.affection === "number"
      ? matchedHeroine.affection
      : null;

  const toneColor = {
    normal: "text-white",
    affection: "text-rose-200",
    bold: "text-orange-200",
    witty: "text-cyan-200",
    introspective: "text-violet-200",
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
      className={`relative text-left rounded-2xl p-5 border transition-colors duration-200 overflow-hidden ${
        locked
          ? "bg-white/[0.02] border-white/10 cursor-not-allowed"
          : "bg-white/[0.04] border-white/10 hover:border-white/30 cursor-pointer"
      }`}
    >
      {/* 우상단 배지 슬롯 — 잠금/에너지/시크릿 (mutually exclusive) */}
      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
        {locked && requiredStat && (
          <div className="flex items-center gap-1 bg-black/65 backdrop-blur-sm rounded-full px-2 py-0.5 text-[10px] font-bold text-white/75 border border-white/15">
            <Lock size={10} />
            <span>{STAT_LABEL_KO[requiredStat] || requiredStat}</span>
          </div>
        )}
        {!locked && option.energyCost > 0 && (
          <div className="flex items-center gap-1 bg-amber-500/22 border border-amber-300/30 rounded-full px-2 py-0.5 text-[10px] font-bold text-amber-200">
            <Zap size={10} /> {option.energyCost}
          </div>
        )}
        {option.isSecret && (
          <div className="flex items-center gap-1 bg-rose-500/22 border border-rose-300/30 rounded-full px-2 py-0.5 text-[10px] font-bold text-rose-100">
            <Sparkles size={10} />
          </div>
        )}
      </div>

      {/* LOCATION 카드 헤더 — 히로인 썸네일 + 호감도 (또는 미지의 만남) */}
      {isLocation && (
        <div className="flex items-center gap-2.5 mb-3">
          {matchedHeroine ? (
            <>
              {heroineThumbUrl ? (
                <div
                  className="w-9 h-9 rounded-full bg-cover bg-center border-2 border-rose-400/45 shadow-md"
                  style={{
                    backgroundImage: `url(${heroineThumbUrl})`,
                    backgroundColor: "#4c1d95",
                  }}
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-rose-500/15 border-2 border-rose-400/45 flex items-center justify-center">
                  <Heart size={14} className="text-rose-300" fill="currentColor" />
                </div>
              )}
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <Heart size={10} className="text-rose-400" fill="currentColor" />
                  <span className="text-xs text-rose-300 font-bold tracking-wide">
                    {option.heroineName || matchedHeroine.name}
                  </span>
                  {heroineAffection !== null && (
                    <span className="text-[10px] text-rose-200/85 tabular-nums">
                      ♥ {heroineAffection}
                    </span>
                  )}
                </div>
                {option.locationName && (
                  <span className="text-[11px] text-white/45 mt-0.5 italic">
                    {option.locationName}
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="w-9 h-9 rounded-full bg-indigo-500/15 border-2 border-indigo-400/35 flex items-center justify-center">
                <Sparkles size={14} className="text-indigo-200" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-indigo-200 font-bold tracking-wide">
                  예측 불가
                </span>
                <span className="text-[11px] text-white/45 italic mt-0.5">
                  누구를 만날지 모른다
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* 라벨 */}
      <div className={`text-lg font-bold mb-1 ${locked ? "text-white/65" : toneColor}`}>
        {option.label}
      </div>

      {/* 디테일 */}
      {option.detail && (
        <div className={`text-sm leading-relaxed ${locked ? "text-white/30" : "text-white/55"}`}>
          {option.detail}
        </div>
      )}

      {/* [A-3] Stat-gate 진척도 바 — 잠긴 옵션에서만 */}
      {locked && requiredStat && (
        <div className="mt-4 pt-3 border-t border-white/8">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-white/50 font-semibold tracking-wider uppercase">
              {STAT_LABEL_KO[requiredStat] || requiredStat} 필요
            </span>
            <span className="text-[10px] font-mono tabular-nums text-white/65">
              {currentStatValue !== null ? (
                <>
                  <span className={currentStatValue >= requiredValue ? "text-emerald-300" : "text-amber-300"}>
                    {currentStatValue}
                  </span>
                  <span className="text-white/30"> / {requiredValue}</span>
                </>
              ) : (
                <span className="text-white/55">{requiredValue}+</span>
              )}
            </span>
          </div>
          {/* 진척 바 — 현재값 / 필요값 비율 */}
          <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
            {currentStatValue !== null && (
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-amber-500/60 to-amber-300/85"
                initial={{ width: 0 }}
                animate={{
                  width: `${Math.min(100, (currentStatValue / Math.max(1, requiredValue)) * 100)}%`,
                }}
                transition={{ duration: 0.7, ease: "easeOut", delay: 0.3 + index * 0.1 }}
              />
            )}
          </div>
          {currentStatValue !== null && currentStatValue < requiredValue && (
            <p className="mt-1.5 text-[10px] text-amber-200/65">
              {requiredValue - currentStatValue} 부족 — 인터미션이나 다른 분기에서 키울 수 있습니다
            </p>
          )}
        </div>
      )}

      {/* 호버 이펙트 */}
      <AnimatePresence>
        {hovered && !locked && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-3 right-4 text-white/65 flex items-center gap-1 text-xs font-bold"
          >
            선택 <ChevronRight size={12} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}