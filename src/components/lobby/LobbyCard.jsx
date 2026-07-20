import { motion } from "framer-motion";
import { Check, Lock } from "lucide-react";

/**
 * [Phase 7-V2 Pivot] 통합 로비 공통 카드 (poster 타일).
 *
 * 모드 / 세계관 / 캐릭터 선택 — 세 단계 모두 동일한 비주얼 언어로 통일.
 *
 * Props:
 *   imageUrl     — 배경 이미지 (없으면 그라데이션 + fallbackIcon)
 *   title        — 카드 제목
 *   subtitle     — 보조 텍스트 (tagline / 설명)
 *   meta         — 하단 메타 (예: "히로인 3명") (optional)
 *   selected     — 선택 상태 (멀티 선택 단계)
 *   disabled     — 비활성 (잠김)
 *   lockLabel    — 잠김 사유 라벨 (optional)
 *   badge        — 우상단 뱃지 텍스트 (optional, 예: "스토리")
 *   accent       — 강조 색상 토큰: "amber" | "cyan" | "violet" | "neutral"
 *   index        — stagger 애니메이션 순번
 *   onClick      — 클릭 핸들러
 *   onHover      — 호버 핸들러
 *   size         — "md"(기본) | "lg"
 */
const ACCENTS = {
  amber:   { ring: "ring-amber-400/70",  glow: "shadow-[0_0_40px_rgba(251,191,36,0.25)]",  badge: "bg-amber-400/20 text-amber-200 border-amber-400/40",  check: "bg-amber-400 text-black" },
  cyan:    { ring: "ring-cyan-400/70",   glow: "shadow-[0_0_40px_rgba(34,211,238,0.22)]",  badge: "bg-cyan-400/20 text-cyan-200 border-cyan-400/40",    check: "bg-cyan-400 text-black" },
  violet:  { ring: "ring-violet-400/70", glow: "shadow-[0_0_40px_rgba(167,139,250,0.25)]", badge: "bg-violet-400/20 text-violet-100 border-violet-400/40", check: "bg-violet-400 text-black" },
  neutral: { ring: "ring-white/50",      glow: "shadow-[0_0_40px_rgba(255,255,255,0.15)]", badge: "bg-white/15 text-white/80 border-white/25",          check: "bg-white text-black" },
};

export default function LobbyCard({
  imageUrl,
  title,
  subtitle,
  meta,
  selected = false,
  disabled = false,
  lockLabel,
  badge,
  accent = "neutral",
  fallbackIcon: FallbackIcon,
  index = 0,
  onClick,
  onHover,
  size = "md",
}) {
  const a = ACCENTS[accent] || ACCENTS.neutral;
  // [Phase B · 단계4] 모바일(<640px)에서만 폭을 유동화(2열 그리드/캐러셀 대응).
  //  sm: 이상(데스크톱)은 기존 고정 px 그대로 → 데스크톱 렌더 불변(G1).
  const dims =
    size === "lg"
      ? "w-[60vw] max-w-[240px] h-[348px] sm:w-[270px] sm:h-[392px]"
      : "w-[44vw] max-w-[200px] h-[290px] sm:w-[224px] sm:h-[324px]";

  return (
    <motion.button
      type="button"
      layout
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={disabled ? undefined : onHover}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: disabled ? 0.5 : 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.4), type: "spring", stiffness: 260, damping: 24 }}
      whileHover={disabled ? undefined : { y: -6, transition: { type: "spring", stiffness: 320, damping: 20 } }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      className={`group relative flex-shrink-0 rounded-2xl overflow-hidden border text-left transition-all duration-300 ${dims}
        ${selected ? `border-transparent ring-2 ${a.ring} ${a.glow}` : "border-white/10 hover:border-white/25"}
        ${disabled ? "cursor-not-allowed grayscale" : "cursor-pointer"}`}
    >
      {/* 배경 이미지 / 그라데이션 */}
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/50 via-slate-800/70 to-slate-900">
        {imageUrl ? (
          <img src={imageUrl} alt={title} className="w-full h-full object-cover" draggable={false} />
        ) : (
          FallbackIcon && (
            <div className="w-full h-full flex items-center justify-center">
              <FallbackIcon size={40} className="text-white/20" />
            </div>
          )
        )}
      </div>

      {/* 하단 그라데이션 오버레이 */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

      {/* 상단 glow bar (호버) */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 group-hover:opacity-70 transition-opacity duration-300" />

      {/* 우상단 뱃지 */}
      {badge && (
        <span className={`absolute top-2.5 right-2.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border backdrop-blur-sm ${a.badge}`}>
          {badge}
        </span>
      )}

      {/* 선택 체크 */}
      {selected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 22 }}
          className={`absolute top-2.5 left-2.5 w-6 h-6 rounded-full flex items-center justify-center shadow-lg ${a.check}`}
        >
          <Check size={14} strokeWidth={3} />
        </motion.div>
      )}

      {/* 잠김 오버레이 */}
      {disabled && lockLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40">
          <Lock size={20} className="text-white/50" />
          <span className="text-[11px] text-white/60 px-3 text-center leading-tight">{lockLabel}</span>
        </div>
      )}

      {/* 텍스트 */}
      <div className="absolute bottom-0 left-0 right-0 p-3.5">
        <h3 className="text-base sm:text-lg font-semibold text-white tracking-wide leading-tight">{title}</h3>
        {subtitle && (
          <p className="text-xs text-white/55 mt-1 leading-snug line-clamp-2">{subtitle}</p>
        )}
        {meta && (
          <p className="text-[11px] text-white/40 mt-1.5">{meta}</p>
        )}
      </div>
    </motion.button>
  );
}