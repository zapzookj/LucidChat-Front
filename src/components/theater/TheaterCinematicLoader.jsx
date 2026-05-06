import { useEffect } from "react";
import { motion } from "framer-motion";
import { sfx } from "../../utils/sfx";

/**
 * [Phase 5.5-Theater-Polish] 시네마틱 로딩 오버레이
 *
 * 이슈 #5 해결: "로딩..." 텍스트 대신 영사기 감성의 전체화면 로딩 애니메이션.
 *
 * Props:
 *   visible      : 표시 여부
 *   message      : 하단 안내 문구 (선택)
 *   variant      : "reel" | "ink" | "minimal"   기본 "reel"
 *   fullscreen   : 전체화면 오버레이 vs 부분 오버레이 (기본 true)
 */

const TheaterCinematicLoader = ({
  visible = true,
  message = "다음 장면을 그리는 중…",
  variant = "reel",
  fullscreen = true,
}) => {
  useEffect(() => {
    sfx.wooshDeep();
  }, []);

  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className={`${fullscreen ? "fixed" : "absolute"} inset-0 z-[60] flex flex-col items-center justify-center pointer-events-auto`}
      style={{
        background:
          "radial-gradient(ellipse at center, rgba(15,11,36,0.85) 0%, rgba(0,0,0,0.95) 75%)",
        backdropFilter: "blur(6px)",
      }}
    >
      {variant === "reel" && <FilmReel />}
      {variant === "ink" && <InkBloom />}
      {variant === "minimal" && <MinimalSpinner />}

      <motion.div
        className="mt-8 text-white/80 text-sm tracking-[0.25em] uppercase font-light"
        style={{ fontFamily: "'Noto Serif KR', serif" }}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {message}
      </motion.div>

      <motion.div
        className="mt-3 flex items-end gap-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        {/*
          [Phase III · 작업 1] 점 3개에 사이즈 변화도 함께 — 단순 페이드보다 호흡감.
        */}
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="rounded-full bg-violet-200/65"
            animate={{
              opacity: [0.3, 1, 0.3],
              width: ["3px", "5px", "3px"],
              height: ["3px", "5px", "3px"],
            }}
            transition={{
              duration: 1.2,
              delay: i * 0.2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </motion.div>
    </motion.div>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  영사기 필름 릴
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const FilmReel = () => (
  <div className="relative">
    <motion.svg
      width="88"
      height="88"
      viewBox="0 0 100 100"
      animate={{ rotate: 360 }}
      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
    >
      {/* 외곽 */}
      <circle
        cx="50"
        cy="50"
        r="46"
        fill="none"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth="1"
      />
      <circle
        cx="50"
        cy="50"
        r="40"
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="2"
      />
      {/* 내부 릴 */}
      <circle cx="50" cy="50" r="10" fill="rgba(255,255,255,0.12)" />
      <circle cx="50" cy="50" r="3" fill="rgba(255,255,255,0.5)" />

      {/* 6개 구멍 (릴 홀) */}
      {[0, 60, 120, 180, 240, 300].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const x = 50 + Math.cos(rad) * 26;
        const y = 50 + Math.sin(rad) * 26;
        return (
          <circle
            key={deg}
            cx={x}
            cy={y}
            r="4"
            fill="rgba(0,0,0,0.8)"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="0.5"
          />
        );
      })}
    </motion.svg>

    {/* 필름 스트립 엘립시스 */}
    <motion.div
      className="absolute inset-0 pointer-events-none"
      animate={{ opacity: [0.4, 0.8, 0.4] }}
      transition={{ duration: 2, repeat: Infinity }}
    >
      <div className="absolute inset-[-14px] rounded-full border border-dashed border-white/20" />
    </motion.div>
  </div>
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  잉크 번짐 스타일 (대체 옵션)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const InkBloom = () => (
  <div className="relative w-24 h-24">
    <motion.div
      className="absolute inset-0 rounded-full"
      style={{
        background:
          "radial-gradient(circle, rgba(147,51,234,0.6) 0%, rgba(79,70,229,0.3) 60%, transparent 100%)",
      }}
      animate={{ scale: [0.8, 1.1, 0.8] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div
      className="absolute inset-3 rounded-full"
      style={{
        background:
          "radial-gradient(circle, rgba(236,72,153,0.5) 0%, transparent 70%)",
      }}
      animate={{ scale: [1.1, 0.9, 1.1] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
    />
  </div>
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  미니멀 스피너
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const MinimalSpinner = () => (
  <motion.div
    className="w-10 h-10 border-2 border-white/15 border-t-violet-300 rounded-full shadow-[0_0_18px_rgba(167,139,250,0.25)]"
    animate={{ rotate: 360 }}
    transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
  />
);

export default TheaterCinematicLoader;