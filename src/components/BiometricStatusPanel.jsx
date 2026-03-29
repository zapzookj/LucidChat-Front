import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, EyeOff, Brain, X, Info } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
//  [Phase 5.5-Fix] Biometric Status Panel — 화려한 리뉴얼
//
//  개선점:
//  1. 섹션 타이틀에 그라데이션 색상 적용 (화려한 시각적 아이덴티티)
//  2. 각 스탯(5종)에 상세 설명 툴팁 추가
//  3. BPM 툴팁에 현재 구간 하이라이트
//  4. 전체적으로 더 비비드한 색감과 글로우 이펙트
// ═══════════════════════════════════════════════════════════════════

// ── 스탯 메타데이터 (툴팁 설명 포함) ──
const NORMAL_STATS = [
  {
    key: "intimacy", label: "친밀도", icon: "💬", color: "#60a5fa",
    desc: "일상적 대화와 공감",
    tooltip: "정서적 친밀감과 유대감의 척도입니다. 높을수록 캐릭터가 개인적인 이야기를 나누고, 깊은 공감과 편안함을 보여줍니다. 낮아지면 거리감을 두고 형식적으로 대합니다.",
  },
  {
    key: "affection", label: "호감도", icon: "💕", color: "#f472b6",
    desc: "설렘과 로맨스",
    tooltip: "로맨틱한 감정과 이성적 매력의 척도입니다. 높을수록 수줍어하고, 설레는 반응과 스킨십에 적극적입니다. 낮아지면 이성적 관심이 줄어들고 친구 이상의 감정을 보이지 않습니다.",
  },
  {
    key: "dependency", label: "의존도", icon: "🫂", color: "#a78bfa",
    desc: "의지와 리드",
    tooltip: "캐릭터가 당신에게 정서적으로 의지하는 정도입니다. 높을수록 당신의 의견을 구하고, 곁에 있고 싶어하며 순종적이 됩니다. 낮아지면 독립적이고 자기 주장이 강해집니다.",
  },
  {
    key: "playfulness", label: "장난기", icon: "😜", color: "#34d399",
    desc: "유머와 티키타카",
    tooltip: "유머와 장난의 빈도입니다. 높을수록 밈, 드립, 티키타카가 활발하고 분위기가 가벼워집니다. 낮아지면 진지하고 차분한 대화를 선호합니다.",
  },
  {
    key: "trust", label: "신뢰도", icon: "🤝", color: "#fbbf24",
    desc: "믿음과 신뢰",
    tooltip: "당신에 대한 믿음과 안정감입니다. 높을수록 비밀을 공유하고, 감정적으로 무방비 상태가 됩니다. 낮아지면 경계하고 속마음을 숨기며, 의심하는 모습을 보입니다.",
  },
];

const SECRET_STATS = [
  { key: "lust", label: "음란도", icon: "🔥", color: "#ef4444", desc: "성적 텐션" },
  { key: "corruption", label: "타락도", icon: "🌑", color: "#8b5cf6", desc: "정체성 이탈" },
  { key: "obsession", label: "집착도", icon: "⛓️", color: "#ec4899", desc: "독점욕" },
];

// ── BPM 구간 정의 ──
const BPM_RANGES = [
  { min: 60, max: 85, label: "평온", desc: "편안하고 안정적인 상태", color: "#f9a8d4", bgColor: "rgba(249,168,212,0.1)" },
  { min: 86, max: 120, label: "두근거림", desc: "긴장하거나 설레는 상태", color: "#f472b6", bgColor: "rgba(244,114,182,0.1)" },
  { min: 121, max: 180, label: "쿵쾅거림", desc: "심장이 터질 듯 격렬한 상태", color: "#ef4444", bgColor: "rgba(239,68,68,0.1)" },
];

// ── 관계 레벨별 테마 (더 비비드한 글로우) ──
const RELATION_THEME = {
  STRANGER:     { gradient: "from-slate-500 to-gray-600", glow: "rgba(148,163,184,0.18)", accent: "#94a3b8", accentAlt: "#cbd5e1" },
  ACQUAINTANCE: { gradient: "from-emerald-500 to-teal-600", glow: "rgba(52,211,153,0.25)", accent: "#34d399", accentAlt: "#6ee7b7" },
  FRIEND:       { gradient: "from-blue-500 to-indigo-600", glow: "rgba(96,165,250,0.25)", accent: "#60a5fa", accentAlt: "#93c5fd" },
  LOVER:        { gradient: "from-rose-500 to-pink-600", glow: "rgba(244,114,182,0.3)", accent: "#f472b6", accentAlt: "#fb7185" },
  ENEMY:        { gradient: "from-red-700 to-gray-800", glow: "rgba(239,68,68,0.25)", accent: "#ef4444", accentAlt: "#f87171" },
};

// ── 섹션 타이틀별 그라데이션 ──
const SECTION_STYLES = {
  heartbeat:    { gradient: "from-rose-400 to-pink-500", icon: "💓" },
  relationship: { gradient: "from-violet-400 to-purple-500", icon: "💫" },
  stats:        { gradient: "from-blue-400 to-cyan-500", icon: "📊" },
  secret:       { gradient: "from-red-500 to-rose-600", icon: "🔒" },
  thought:      { gradient: "from-amber-400 to-orange-500", icon: "💭" },
};

const SectionTitle = ({ sectionKey, children }) => {
  const style = SECTION_STYLES[sectionKey];
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm">{style.icon}</span>
      <span className={`text-[10px] uppercase tracking-[0.2em] font-black bg-gradient-to-r ${style.gradient} bg-clip-text text-transparent`}>
        {children}
      </span>
    </div>
  );
};


// ═══════════════════════════════════════════════════════════════════
//  스탯 툴팁 컴포넌트
// ═══════════════════════════════════════════════════════════════════

const StatTooltip = ({ stat, value, isVisible, position }) => (
  <AnimatePresence>
    {isVisible && (
      <motion.div
        initial={{ opacity: 0, y: 4, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 4, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="absolute z-[100] w-56 p-3 rounded-xl border shadow-2xl pointer-events-none"
        style={{
          bottom: "calc(100% + 8px)",
          left: "0",
          background: "rgba(8,4,20,0.95)",
          borderColor: `${stat.color}30`,
          backdropFilter: "blur(20px)",
          boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 20px ${stat.color}15`,
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">{stat.icon}</span>
          <span className="text-sm font-bold" style={{ color: stat.color }}>{stat.label}</span>
          <span className="text-xs text-white/30 ml-auto tabular-nums">{value}</span>
        </div>
        <p className="text-[11px] text-white/50 leading-relaxed">{stat.tooltip}</p>
        {/* 시각적 수치 바 — 0~100 범위 */}
        <div className="mt-2 h-1 rounded-full bg-white/[0.06] overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${Math.max(0, value)}%`, background: stat.color }} />
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);


// ═══════════════════════════════════════════════════════════════════
//  SVG Radar Chart (패딩 확대, 텍스트 잘림 완전 해소)
// ═══════════════════════════════════════════════════════════════════

const RadarChart = ({ stats, size = 230 }) => {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 38;
  const axes = NORMAL_STATS;
  const levels = [20, 40, 60, 80, 100];

  const getPoint = (index, value) => {
    const angle = (Math.PI * 2 * index) / axes.length - Math.PI / 2;
    const v = Math.max(0, Math.min(100, value));
    const r = (v / 100) * maxR;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  };

  const gridPaths = levels.map(level => {
    const pts = axes.map((_, i) => getPoint(i, level));
    return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
  });

  const dataPoints = axes.map((axis, i) => getPoint(i, stats[axis.key] || 0));
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  const labelPoints = axes.map((_, i) => {
    const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
    const r = maxR * 1.35;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-lg">
      <defs>
        <radialGradient id="rGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f472b6" stopOpacity="0.3" />
          <stop offset="60%" stopColor="#a78bfa" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.02" />
        </radialGradient>
        <linearGradient id="rStroke" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="50%" stopColor="#f472b6" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="2.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>

      {gridPaths.map((path, i) => (
        <path key={i} d={path} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={i === 4 ? 1 : 0.5} />
      ))}
      {axes.map((_, i) => {
        const p = getPoint(i, 100);
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />;
      })}

      <motion.path d={dataPath} fill="url(#rGlow)" stroke="url(#rStroke)" strokeWidth={1.5} filter="url(#glow)"
        initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }} style={{ transformOrigin: `${cx}px ${cy}px` }} />

      {dataPoints.map((p, i) => (
        <motion.circle key={i} cx={p.x} cy={p.y} r={3.5} fill={axes[i].color} stroke="rgba(255,255,255,0.5)" strokeWidth={1}
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.08 * i, type: "spring", stiffness: 300 }}
          style={{ filter: `drop-shadow(0 0 5px ${axes[i].color})` }} />
      ))}

      {axes.map((axis, i) => (
        <text key={i} x={labelPoints[i].x} y={labelPoints[i].y} textAnchor="middle" dominantBaseline="central"
          className="fill-white/50 select-none pointer-events-none" style={{ fontSize: "11px", fontWeight: 600 }}>
          {axis.label}
        </text>
      ))}
    </svg>
  );
};


// ═══════════════════════════════════════════════════════════════════
//  심장 펄스 (BPM 동기, 자립형)
// ═══════════════════════════════════════════════════════════════════

const HeartPulse = ({ bpm, size = 18 }) => {
  const interval = 60 / Math.max(bpm, 60);
  const c = bpm >= 140 ? "#ff2d55" : bpm >= 110 ? "#ff6b9d" : bpm >= 85 ? "#f472b6" : "#f9a8d4";
  return (
    <motion.div animate={{ scale: [1, 1.25, 1, 1.1, 1] }}
      transition={{ duration: interval, repeat: Infinity, ease: "easeInOut", times: [0, 0.15, 0.35, 0.5, 1] }}>
      <Heart size={size} fill={c} color={c} style={{ filter: `drop-shadow(0 0 ${bpm > 100 ? 8 : 4}px ${c}80)` }} />
    </motion.div>
  );
};


// ═══════════════════════════════════════════════════════════════════
//  메인 패널
// ═══════════════════════════════════════════════════════════════════

const BiometricStatusPanel = ({
  isOpen,
  onClose,
  stats,
  bpm = 65,
  dynamicRelationTag,
  characterThought,
  characterName = "캐릭터",
  statusLevel = "STRANGER",
  isSecretMode = false,
}) => {
  const panelRef = useRef(null);
  const [hoveredStat, setHoveredStat] = useState(null);
  const theme = RELATION_THEME[statusLevel] || RELATION_THEME.STRANGER;

  const safeStats = {
    intimacy: stats?.intimacy ?? 0, affection: stats?.affection ?? 0,
    dependency: stats?.dependency ?? 0, playfulness: stats?.playfulness ?? 0, trust: stats?.trust ?? 0,
    lust: stats?.lust ?? 0, corruption: stats?.corruption ?? 0, obsession: stats?.obsession ?? 0,
  };

  const dominantKey = useMemo(() => {
    const sorted = NORMAL_STATS.map(s => ({ key: s.key, value: safeStats[s.key] })).sort((a, b) => b.value - a.value);
    return sorted[0]?.value > 0 ? sorted[0].key : null;
  }, [safeStats]);

  const bpmPercent = Math.min(100, Math.max(0, ((bpm - 60) / 120) * 100));

  // 현재 BPM이 속하는 구간 인덱스
  const currentBpmRangeIdx = BPM_RANGES.findIndex(r => bpm >= r.min && bpm <= r.max);

  // 패널 외부 클릭 시 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ type: "spring", stiffness: 280, damping: 26 }}
          className="fixed left-3 sm:left-5 z-[65] flex flex-col"
          style={{
            top: "72px",
            bottom: "210px",
            width: "min(310px, 40vw)",
            willChange: "transform, opacity",
            transform: "translateZ(0)",
          }}
        >
          <div
            className="h-full rounded-2xl border border-white/[0.08] flex flex-col"
            style={{
              background: "linear-gradient(160deg, rgba(8,4,20,0.82), rgba(15,8,30,0.88))",
              backdropFilter: "blur(28px) saturate(1.3)",
              boxShadow: `0 12px 60px rgba(0,0,0,0.5), 0 0 80px ${theme.glow}, inset 0 1px 0 rgba(255,255,255,0.04)`,
              overflow: "hidden",
            }}
          >
            {/* 상단 장식 라인 */}
            <div className="h-[2px] w-full" style={{ background: `linear-gradient(90deg, transparent, ${theme.accent}60, ${theme.accentAlt}40, transparent)` }} />

            {/* 내부 스크롤 컨테이너 (스크롤바 숨김) */}
            <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
              <style>{`.status-scroll::-webkit-scrollbar { display: none; }`}</style>
              <div className="status-scroll h-full overflow-y-auto" style={{ scrollbarWidth: "none" }}>

                {/* ══════════ Section 1: BPM ══════════ */}
                <div className="px-5 pt-4 pb-3 border-b border-white/[0.04]">
                  <div className="flex items-center justify-between mb-3">
                    <SectionTitle sectionKey="heartbeat">Heartbeat</SectionTitle>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/[0.06] transition text-white/25 hover:text-white/50">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="flex items-center gap-4">
                    <HeartPulse bpm={bpm} size={28} />
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2 mb-1.5">
                        <span className="text-2xl font-black text-white tabular-nums">{bpm}</span>
                        <span className="text-xs font-bold bg-gradient-to-r from-rose-400 to-pink-500 bg-clip-text text-transparent">BPM</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: bpm >= 120 ? "linear-gradient(90deg, #f472b6, #ef4444)" : "linear-gradient(90deg, #f9a8d4, #f472b6)" }}
                          animate={{ width: `${bpmPercent}%` }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* [Fix #4] BPM 구간 표시 — 현재 구간 하이라이트 */}
                  <div className="mt-3 space-y-1">
                    {BPM_RANGES.map((range, idx) => {
                      const isCurrent = idx === currentBpmRangeIdx;
                      return (
                        <motion.div
                          key={range.label}
                          className="flex items-center justify-between px-2.5 py-1 rounded-lg transition-all"
                          animate={{
                            backgroundColor: isCurrent ? range.bgColor : "transparent",
                            scale: isCurrent ? 1 : 0.98,
                          }}
                          transition={{ duration: 0.3 }}
                        >
                          <div className="flex items-center gap-2">
                            {isCurrent && (
                              <motion.div
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: range.color }}
                                animate={{ scale: [1, 1.4, 1], opacity: [0.8, 1, 0.8] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                              />
                            )}
                            <span className={`text-[11px] font-bold ${isCurrent ? "text-white/80" : "text-white/20"}`}>
                              {range.label}
                            </span>
                          </div>
                          <span className={`text-[10px] tabular-nums ${isCurrent ? "text-white/50" : "text-white/15"}`}>
                            {range.min}~{range.max}
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* ══════════ Section 2: 캐릭터의 마음 (동적 관계) ══════════ */}
                <div className="px-5 py-3 border-b border-white/[0.04]">
                  <SectionTitle sectionKey="relationship">Relationship</SectionTitle>
                  <div className="mt-2">
                    <motion.span
                      key={dynamicRelationTag}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-base font-bold bg-clip-text text-transparent leading-tight"
                      style={{ backgroundImage: `linear-gradient(135deg, ${theme.accent}, ${theme.accentAlt}, white)` }}
                    >
                      {dynamicRelationTag || "낯선 사람"}
                    </motion.span>
                    <p className="text-[10px] text-white/20 mt-0.5">{characterName}의 당신을 향한 마음</p>
                  </div>
                </div>

                {/* ══════════ Section 3: 레이더 차트 + 스탯 ══════════ */}
                <div className="px-3 pt-2 pb-1 border-b border-white/[0.04]">
                  <div className="px-2 mb-1 flex items-center justify-between">
                    <SectionTitle sectionKey="stats">Stats</SectionTitle>
                    <span className="text-[9px] text-white/15 italic">hover for info</span>
                  </div>

                  {/* 레이더 차트 */}
                  <div className="flex justify-center">
                    <RadarChart stats={safeStats} size={230} />
                  </div>

                  {/* [Fix #3] 스탯 바 + 호버 툴팁 */}
                  <div className="px-2 pb-2 space-y-1.5">
                    {NORMAL_STATS.map((stat) => {
                      const val = safeStats[stat.key];
                      const isDom = stat.key === dominantKey;
                      const absVal = Math.abs(val);
                      const isNeg = val < 0;
                      const isHovered = hoveredStat === stat.key;
                      return (
                        <div
                          key={stat.key}
                          className="relative flex items-center gap-2 cursor-help group"
                          onMouseEnter={() => setHoveredStat(stat.key)}
                          onMouseLeave={() => setHoveredStat(null)}
                        >
                          {/* 툴팁 */}
                          <StatTooltip stat={stat} value={val} isVisible={isHovered} />

                          <span className="text-sm w-5 text-center">{stat.icon}</span>
                          <span className={`text-xs w-12 shrink-0 transition-colors ${
                            isHovered ? "text-white/90 font-bold" : isDom ? "text-white/70 font-bold" : "text-white/30"
                          }`}>{stat.label}</span>
                          <div className={`flex-1 h-1.5 rounded-full bg-white/[0.04] overflow-hidden relative transition-all ${
                            isHovered ? "h-2 bg-white/[0.06]" : ""
                          }`}>
                            <motion.div
                              className="absolute top-0 h-full rounded-full transition-all"
                              style={{
                                left: isNeg ? `${50 - absVal / 2}%` : "50%",
                                background: isHovered
                                  ? `linear-gradient(90deg, ${stat.color}aa, ${stat.color})`
                                  : isDom ? `linear-gradient(90deg, ${stat.color}88, ${stat.color})` : `${stat.color}44`,
                                boxShadow: isHovered ? `0 0 12px ${stat.color}40` : isDom ? `0 0 8px ${stat.color}30` : "none",
                              }}
                              initial={{ width: 0 }}
                              animate={{ width: `${absVal / 2}%` }}
                              transition={{ duration: 0.6, ease: "easeOut" }}
                            />
                            <div className="absolute left-1/2 top-0 w-px h-full bg-white/[0.08]" />
                          </div>
                          <span className={`text-[11px] w-7 text-right tabular-nums transition-colors ${
                            isHovered ? "text-white/80 font-bold" : isDom ? "text-white/60 font-bold" : "text-white/20"
                          }`}>{val}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* 시크릿 스탯 */}
                  <AnimatePresence>
                    {isSecretMode && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="px-2 pb-2 pt-1 border-t border-red-500/10">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <SectionTitle sectionKey="secret">Secret</SectionTitle>
                          </div>
                          <div className="space-y-1.5">
                            {SECRET_STATS.map((stat) => (
                              <div key={stat.key} className="flex items-center gap-2">
                                <span className="text-sm w-5 text-center">{stat.icon}</span>
                                <span className="text-xs text-white/30 w-12 shrink-0">{stat.label}</span>
                                <div className="flex-1 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                                  <motion.div className="h-full rounded-full"
                                    style={{ background: `linear-gradient(90deg, ${stat.color}44, ${stat.color})` }}
                                    initial={{ width: 0 }} animate={{ width: `${Math.max(0, safeStats[stat.key])}%` }}
                                    transition={{ duration: 0.8, ease: "easeOut" }} />
                                </div>
                                <span className="text-[11px] text-white/20 w-7 text-right tabular-nums">{safeStats[stat.key]}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* ══════════ Section 4: 캐릭터의 생각 ══════════ */}
                <div className="px-5 py-3">
                  <SectionTitle sectionKey="thought">Inner Thought</SectionTitle>
                  {characterThought ? (
                    <motion.p
                      key={characterThought}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5 }}
                      className="text-sm text-white/40 leading-relaxed italic mt-2"
                      style={{ fontFamily: "'Noto Serif KR', serif" }}
                    >
                      "{characterThought}"
                    </motion.p>
                  ) : (
                    <p className="text-[11px] text-white/15 mt-2 italic">아직 뚜렷한 생각이 없는 것 같다...</p>
                  )}
                </div>

              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BiometricStatusPanel;