import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, ChevronRight, Eye, EyeOff, Brain } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
//  [Phase 5.5] Biometric Status Panel — 입체적 상태창
//
//  2-State UI:
//    1. Minimal HUD: 심장 아이콘(BPM 펄스) + 미니 호감도 바
//    2. Expanded Panel: Glassmorphism 패널
//       - 5각 레이더 차트 (SVG)
//       - 스탯 수치 리스트
//       - 동적 관계 태그
//       - 캐릭터의 생각
//       - 시크릿 모드: 추가 3개 스탯 바
//
//  Props:
//    stats: { intimacy, affection, dependency, playfulness, trust, lust?, corruption?, obsession? }
//    bpm: number (60~180)
//    affectionScore: number (-100~100)  // 기존 호감도 (엔딩용)
//    dynamicRelationTag: string
//    characterThought: string | null
//    characterName: string
//    statusLevel: string (STRANGER|ACQUAINTANCE|FRIEND|LOVER|ENEMY)
//    isSecretMode: boolean
// ═══════════════════════════════════════════════════════════════════

// ── 스탯 메타데이터 ──
const NORMAL_STATS = [
  { key: "intimacy",    label: "친밀도", icon: "💬", color: "#60a5fa", desc: "일상적 대화와 공감" },
  { key: "affection",   label: "호감도", icon: "💕", color: "#f472b6", desc: "설렘과 로맨스" },
  { key: "dependency",  label: "의존도", icon: "🫂", color: "#a78bfa", desc: "의지와 리드" },
  { key: "playfulness", label: "장난기", icon: "😜", color: "#34d399", desc: "유머와 티키타카" },
  { key: "trust",       label: "신뢰도", icon: "🤝", color: "#fbbf24", desc: "믿음과 신뢰" },
];

const SECRET_STATS = [
  { key: "lust",       label: "음란도", icon: "🔥", color: "#ef4444", desc: "성적 텐션" },
  { key: "corruption", label: "타락도", icon: "🌑", color: "#8b5cf6", desc: "정체성 이탈" },
  { key: "obsession",  label: "집착도", icon: "⛓️", color: "#ec4899", desc: "독점욕" },
];

// ── 관계 레벨별 테마 ──
const RELATION_THEME = {
  STRANGER:     { gradient: "from-slate-500 to-gray-600", glow: "rgba(148,163,184,0.15)", accent: "#94a3b8" },
  ACQUAINTANCE: { gradient: "from-emerald-500 to-teal-600", glow: "rgba(52,211,153,0.2)", accent: "#34d399" },
  FRIEND:       { gradient: "from-blue-500 to-indigo-600", glow: "rgba(96,165,250,0.2)", accent: "#60a5fa" },
  LOVER:        { gradient: "from-rose-500 to-pink-600", glow: "rgba(244,114,182,0.25)", accent: "#f472b6" },
  ENEMY:        { gradient: "from-red-700 to-gray-800", glow: "rgba(239,68,68,0.2)", accent: "#ef4444" },
};


// ═══════════════════════════════════════════════════════════════════
//  SVG Radar Chart — 5각 스파이더 차트
// ═══════════════════════════════════════════════════════════════════

const RadarChart = ({ stats, size = 160 }) => {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 16;
  const axes = NORMAL_STATS;
  const levels = [20, 40, 60, 80, 100];

  // 각도 계산 (꼭대기부터 시계 방향)
  const getPoint = (index, value) => {
    const angle = (Math.PI * 2 * index) / axes.length - Math.PI / 2;
    const r = (value / 100) * maxR;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  };

  // 그리드 경로
  const gridPaths = levels.map(level => {
    const points = axes.map((_, i) => getPoint(i, level));
    return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
  });

  // 데이터 경로
  const dataPoints = axes.map((axis, i) => getPoint(i, stats[axis.key] || 0));
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  // 축 라벨 위치
  const labelPoints = axes.map((_, i) => getPoint(i, 118));

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-lg">
      <defs>
        <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f472b6" stopOpacity="0.35" />
          <stop offset="60%" stopColor="#a78bfa" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.05" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* 그리드 */}
      {gridPaths.map((path, i) => (
        <path key={i} d={path} fill="none" stroke="rgba(255,255,255,0.08)"
              strokeWidth={i === levels.length - 1 ? 1 : 0.5} />
      ))}

      {/* 축 선 */}
      {axes.map((_, i) => {
        const p = getPoint(i, 100);
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />;
      })}

      {/* 데이터 영역 (애니메이션은 framer-motion으로) */}
      <motion.path
        d={dataPath}
        fill="url(#radarGlow)"
        stroke="url(#radarStroke)"
        strokeWidth={1.5}
        filter="url(#glow)"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      />

      {/* 데이터 포인트 라인 그라디언트 */}
      <defs>
        <linearGradient id="radarStroke" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="50%" stopColor="#f472b6" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
      </defs>

      {/* 데이터 포인트 꼭짓점 */}
      {dataPoints.map((p, i) => (
        <motion.circle
          key={i}
          cx={p.x} cy={p.y} r={3}
          fill={axes[i].color}
          stroke="rgba(255,255,255,0.5)"
          strokeWidth={1}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1 * i, type: "spring", stiffness: 300 }}
          style={{ filter: `drop-shadow(0 0 4px ${axes[i].color})` }}
        />
      ))}

      {/* 축 라벨 */}
      {axes.map((axis, i) => {
        const lp = labelPoints[i];
        return (
          <text
            key={i} x={lp.x} y={lp.y}
            textAnchor="middle" dominantBaseline="central"
            className="fill-white/50 select-none pointer-events-none"
            style={{ fontSize: "9px", fontWeight: 500 }}
          >
            {axis.label}
          </text>
        );
      })}
    </svg>
  );
};


// ═══════════════════════════════════════════════════════════════════
//  미니 스탯 바 (시크릿 모드 전용)
// ═══════════════════════════════════════════════════════════════════

const SecretStatBar = ({ stat, value }) => (
  <div className="flex items-center gap-2">
    <span className="text-xs w-4 text-center">{stat.icon}</span>
    <span className="text-[10px] text-white/40 w-10 shrink-0">{stat.label}</span>
    <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ background: `linear-gradient(90deg, ${stat.color}66, ${stat.color})` }}
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </div>
    <span className="text-[10px] text-white/30 w-6 text-right tabular-nums">{value}</span>
  </div>
);


// ═══════════════════════════════════════════════════════════════════
//  Heart Pulse Component — BPM 동기 심장 애니메이션
// ═══════════════════════════════════════════════════════════════════

const HeartPulse = ({ bpm, size = 22, className = "" }) => {
  const interval = 60 / Math.max(bpm, 60); // 초 단위 (BPM → 1박 간격)

  // BPM에 따른 색상 변화
  const heartColor = useMemo(() => {
    if (bpm >= 140) return "#ff2d55";
    if (bpm >= 110) return "#ff6b9d";
    if (bpm >= 85)  return "#f472b6";
    return "#f9a8d4";
  }, [bpm]);

  return (
    <motion.div
      className={`relative ${className}`}
      animate={{
        scale: [1, 1.25, 1, 1.1, 1],
      }}
      transition={{
        duration: interval,
        repeat: Infinity,
        ease: "easeInOut",
        times: [0, 0.15, 0.35, 0.5, 1],
      }}
    >
      <Heart
        size={size}
        fill={heartColor}
        color={heartColor}
        style={{ filter: `drop-shadow(0 0 ${bpm > 100 ? 8 : 4}px ${heartColor}80)` }}
      />
    </motion.div>
  );
};


// ═══════════════════════════════════════════════════════════════════
//  Main Component
// ═══════════════════════════════════════════════════════════════════

const BiometricStatusPanel = ({
  stats,
  bpm = 65,
  affectionScore = 0,
  dynamicRelationTag,
  characterThought,
  characterName = "캐릭터",
  statusLevel = "STRANGER",
  isSecretMode = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const panelRef = useRef(null);
  const theme = RELATION_THEME[statusLevel] || RELATION_THEME.STRANGER;

  // 패널 외부 클릭 시 닫기
  useEffect(() => {
    if (!isExpanded) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setIsExpanded(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isExpanded]);

  // 안전한 스탯 기본값
  const safeStats = {
    intimacy: stats?.intimacy ?? 0,
    affection: stats?.affection ?? 0,
    dependency: stats?.dependency ?? 0,
    playfulness: stats?.playfulness ?? 0,
    trust: stats?.trust ?? 0,
    lust: stats?.lust ?? 0,
    corruption: stats?.corruption ?? 0,
    obsession: stats?.obsession ?? 0,
  };

  // 최고 스탯 하이라이트
  const dominantKey = useMemo(() => {
    const normalEntries = NORMAL_STATS.map(s => ({ key: s.key, value: safeStats[s.key] }));
    const sorted = [...normalEntries].sort((a, b) => b.value - a.value);
    return sorted[0]?.value > 0 ? sorted[0].key : null;
  }, [safeStats]);

  return (
    <div
      ref={panelRef}
      className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 z-40 select-none"
    >
      {/* ━━━ Minimal HUD (항상 표시) ━━━ */}
      <motion.div
        className="flex flex-col items-center gap-2 cursor-pointer group"
        onClick={() => setIsExpanded(!isExpanded)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {/* 심장 아이콘 + BPM */}
        <div className="relative flex flex-col items-center">
          <HeartPulse bpm={bpm} size={20} />
          <motion.span
            className="text-[10px] tabular-nums font-bold mt-0.5"
            style={{ color: theme.accent }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {bpm}
          </motion.span>
        </div>

        {/* 미니 호감도 바 */}
        <div className="w-1 h-16 rounded-full bg-white/[0.06] overflow-hidden relative">
          <motion.div
            className="absolute bottom-0 w-full rounded-full"
            style={{
              background: `linear-gradient(to top, ${theme.accent}88, ${theme.accent})`,
              boxShadow: `0 0 8px ${theme.accent}40`,
            }}
            animate={{ height: `${Math.max(2, Math.abs(affectionScore))}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>

        {/* 확장 힌트 */}
        <motion.div
          className="opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        >
          <ChevronRight size={12} className="text-white/30 rotate-0" />
        </motion.div>
      </motion.div>

      {/* ━━━ Expanded Glassmorphism Panel ━━━ */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, x: -20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="absolute left-10 top-1/2 -translate-y-1/2 w-[220px] sm:w-[240px]"
          >
            <div
              className="rounded-2xl border border-white/[0.08] overflow-hidden"
              style={{
                background: "linear-gradient(135deg, rgba(10,5,25,0.88), rgba(20,10,40,0.92))",
                backdropFilter: "blur(24px) saturate(1.4)",
                boxShadow: `0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06), 0 0 60px ${theme.glow}`,
              }}
            >
              {/* ── Header: 관계 태그 + 캐릭터 이름 ── */}
              <div className="px-4 pt-3.5 pb-2 border-b border-white/[0.04]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HeartPulse bpm={bpm} size={14} />
                    <span className="text-[10px] tabular-nums font-mono text-white/40">{bpm} BPM</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
                    className="p-1 rounded-lg hover:bg-white/[0.06] transition"
                  >
                    <ChevronRight size={12} className="text-white/20 rotate-180" />
                  </button>
                </div>
                <div className="mt-2">
                  <span
                    className="text-xs font-bold bg-clip-text text-transparent"
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${theme.accent}, white)`,
                    }}
                  >
                    {dynamicRelationTag || "낯선 사람"}
                  </span>
                  <p className="text-[10px] text-white/25 mt-0.5">{characterName}의 마음</p>
                </div>
              </div>

              {/* ── Radar Chart ── */}
              <div className="flex justify-center py-2">
                <RadarChart stats={safeStats} size={160} />
              </div>

              {/* ── 노말 스탯 수치 ── */}
              <div className="px-4 pb-2 space-y-1">
                {NORMAL_STATS.map((stat) => {
                  const val = safeStats[stat.key];
                  const isDominant = stat.key === dominantKey;
                  return (
                    <div key={stat.key} className="flex items-center gap-1.5">
                      <span className="text-[10px] w-3.5 text-center">{stat.icon}</span>
                      <span className={`text-[10px] w-10 shrink-0 ${isDominant ? "text-white/70 font-bold" : "text-white/35"}`}>
                        {stat.label}
                      </span>
                      <div className="flex-1 h-1 rounded-full bg-white/[0.05] overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{
                            background: isDominant
                              ? `linear-gradient(90deg, ${stat.color}88, ${stat.color})`
                              : `${stat.color}55`,
                            boxShadow: isDominant ? `0 0 6px ${stat.color}40` : "none",
                          }}
                          initial={{ width: 0 }}
                          animate={{ width: `${val}%` }}
                          transition={{ duration: 0.6, ease: "easeOut", delay: 0.05 }}
                        />
                      </div>
                      <span className={`text-[10px] w-5 text-right tabular-nums ${isDominant ? "text-white/60" : "text-white/25"}`}>
                        {val}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* ── 시크릿 모드 추가 스탯 ── */}
              <AnimatePresence>
                {isSecretMode && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-2 pt-1 border-t border-red-500/10">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <EyeOff size={10} className="text-red-400/50" />
                        <span className="text-[9px] text-red-400/40 uppercase tracking-widest font-bold">Secret</span>
                      </div>
                      <div className="space-y-1.5">
                        {SECRET_STATS.map((stat) => (
                          <SecretStatBar key={stat.key} stat={stat} value={safeStats[stat.key]} />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── 캐릭터의 생각 ── */}
              {characterThought && (
                <div className="px-4 pb-3.5 pt-1 border-t border-white/[0.04]">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Brain size={10} className="text-purple-400/50" />
                    <span className="text-[9px] text-white/25 uppercase tracking-widest font-bold">Inner Thought</span>
                  </div>
                  <motion.p
                    key={characterThought}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="text-[11px] text-white/50 leading-relaxed italic"
                    style={{ fontFamily: "'Noto Serif KR', serif" }}
                  >
                    "{characterThought}"
                  </motion.p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BiometricStatusPanel;