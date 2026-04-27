import { useMemo, useRef } from "react";
import { motion } from "framer-motion";

/**
 * [Phase 5.5-Theater-Polish · Phase I] TheaterDoorway
 *
 * Hub의 3-way 메뉴 아래에 배치되는 시네마틱 "극장 입구".
 * 옵션 C — 배너가 아니라 로비 배경의 일부에 붙어있는 프롭처럼 보이게 한다.
 *
 * 구성:
 *   - 외곽: 아치형 극장 입구 (SVG 그라디언트, 미세 발광)
 *   - 중앙: 간판 "LUCID THEATER" + 부제 "오늘 밤의 상연작"
 *   - 양쪽: 벨벳 커튼 (호버 시 약 14% 좌우로 열리며 안쪽 빛이 새어 나옴)
 *   - 하단: 무대 발판 그림자 + 라인 (먼지 한 줄)
 *
 * 의도적으로 "로고/이미지 에셋" 의존성 없이 SVG로 구현 — 디자이너 없이도 즉시 동작.
 * 추후 디자이너가 정식 일러스트로 교체할 수 있는 슬롯(`backdropSrc` prop) 제공.
 *
 * Props:
 *   onEnter   : () => void  — 클릭 시
 *   sessionCount : number  — "상연 중인 극 N편" 미니 인디케이터
 *   disabled  : bool         — 비활성 (예: 인증 필요 등)
 *   backdropSrc : string?  — 정식 일러스트 슬롯 (옵션)
 */
export default function TheaterDoorway({
  onEnter,
  sessionCount = 0,
  disabled = false,
  backdropSrc = null,
}) {
  // 커튼 호버 상태 — Framer Motion variant 트리거용
  const hoverRef = useRef(null);

  // 부유 먼지 입자 (시네마틱 분위기) — 마운트 시 1회 생성
  const dustMotes = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        id: i,
        left: `${15 + Math.random() * 70}%`,
        top: `${20 + Math.random() * 60}%`,
        size: 1 + Math.random() * 1.5,
        delay: Math.random() * 4,
        duration: 6 + Math.random() * 4,
      })),
    []
  );

  return (
    <motion.button
      ref={hoverRef}
      type="button"
      onClick={() => !disabled && onEnter?.()}
      disabled={disabled}
      whileHover={!disabled ? "hover" : undefined}
      whileTap={!disabled ? { scale: 0.985 } : undefined}
      initial="rest"
      animate="rest"
      className={`
        group relative block mx-auto
        w-[min(620px,92vw)] aspect-[2.6/1]
        select-none
        ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}
        focus:outline-none
      `}
      aria-label="극장으로 들어가기"
    >
      {/* ═══ 1. 외곽 아치 — 극장 입구의 윤곽선 ═══ */}
      <svg
        viewBox="0 0 520 200"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 w-full h-full pointer-events-none"
      >
        <defs>
          {/* 아치 발광 그라디언트 — 호버 시 진해짐 */}
          <linearGradient id="archGlow" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#1e1b4b" stopOpacity="0" />
            <stop offset="50%" stopColor="#6d28d9" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.35" />
          </linearGradient>
          {/* 무대 안쪽 따뜻한 빛 (커튼 너머) */}
          <radialGradient id="stageGlow" cx="50%" cy="60%" r="50%">
            <stop offset="0%" stopColor="#fde68a" stopOpacity="0.55" />
            <stop offset="40%" stopColor="#f59e0b" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#451a03" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* 아치 (둥근 입구의 외곽선) */}
        <motion.path
          d="M 30 195 L 30 90 Q 30 20 260 20 Q 490 20 490 90 L 490 195 Z"
          fill="url(#archGlow)"
          stroke="rgba(199,210,254,0.18)"
          strokeWidth="1"
          variants={{
            rest:  { opacity: 0.85 },
            hover: { opacity: 1 },
          }}
          transition={{ duration: 0.5 }}
        />

        {/* 아치 내부 발판 그림자 (무대 바닥) */}
        <line
          x1="60" y1="178" x2="460" y2="178"
          stroke="rgba(167,139,250,0.25)" strokeWidth="0.6"
        />
      </svg>

      {/* ═══ 2. 옵션 일러스트 슬롯 (디자이너 교체용) ═══ */}
      {backdropSrc && (
        <div
          className="absolute inset-x-[6%] inset-y-[10%] rounded-t-[180px] overflow-hidden opacity-60 pointer-events-none"
          style={{
            backgroundImage: `url(${backdropSrc})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      )}

      {/* ═══ 3. 무대 안쪽 따뜻한 빛 (커튼이 열리면 더 보임) ═══ */}
      <motion.div
        className="absolute inset-x-[20%] inset-y-[15%] rounded-t-[160px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center 60%, rgba(253,230,138,0.45) 0%, rgba(251,191,36,0.18) 35%, rgba(76,29,149,0) 70%)",
          filter: "blur(8px)",
        }}
        variants={{
          rest:  { opacity: 0.55, scale: 0.9 },
          hover: { opacity: 1.0, scale: 1.05 },
        }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      />

      {/* ═══ 4. 좌측 벨벳 커튼 ═══ */}
      <motion.div
        className="absolute left-[6%] top-[10%] bottom-[2.5%] w-[40%] origin-left pointer-events-none"
        variants={{
          rest:  { x: 0, skewY: 0 },
          hover: { x: "-7%", skewY: -1 },
        }}
        transition={{ type: "spring", stiffness: 130, damping: 22 }}
      >
        <div
          className="absolute inset-0 rounded-tl-[160px] rounded-bl-[6px]"
          style={{
            background: `
              linear-gradient(90deg,
                rgba(20,8,40,0.95) 0%,
                rgba(76,29,149,0.92) 40%,
                rgba(124,58,237,0.85) 70%,
                rgba(167,139,250,0.55) 100%
              )
            `,
          }}
        />
        {/* 커튼 주름 (수직 그림자 라인 5개) */}
        {[18, 32, 50, 68, 84].map((p) => (
          <div
            key={p}
            className="absolute top-0 bottom-0 w-[2px]"
            style={{
              left: `${p}%`,
              background:
                "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.4) 30%, rgba(0,0,0,0.5) 70%, rgba(0,0,0,0) 100%)",
              opacity: 0.55,
            }}
          />
        ))}
        {/* 커튼 우측 가장자리 — 빛 받는 면 */}
        <div
          className="absolute right-0 top-0 bottom-0 w-[3px]"
          style={{
            background:
              "linear-gradient(180deg, rgba(253,230,138,0.0), rgba(253,230,138,0.7), rgba(253,230,138,0.0))",
          }}
        />
      </motion.div>

      {/* ═══ 5. 우측 벨벳 커튼 (좌측의 미러) ═══ */}
      <motion.div
        className="absolute right-[6%] top-[10%] bottom-[2.5%] w-[40%] origin-right pointer-events-none"
        variants={{
          rest:  { x: 0, skewY: 0 },
          hover: { x: "7%", skewY: 1 },
        }}
        transition={{ type: "spring", stiffness: 130, damping: 22 }}
      >
        <div
          className="absolute inset-0 rounded-tr-[160px] rounded-br-[6px]"
          style={{
            background: `
              linear-gradient(270deg,
                rgba(20,8,40,0.95) 0%,
                rgba(76,29,149,0.92) 40%,
                rgba(124,58,237,0.85) 70%,
                rgba(167,139,250,0.55) 100%
              )
            `,
          }}
        />
        {[16, 32, 50, 68, 82].map((p) => (
          <div
            key={p}
            className="absolute top-0 bottom-0 w-[2px]"
            style={{
              right: `${p}%`,
              background:
                "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.4) 30%, rgba(0,0,0,0.5) 70%, rgba(0,0,0,0) 100%)",
              opacity: 0.55,
            }}
          />
        ))}
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px]"
          style={{
            background:
              "linear-gradient(180deg, rgba(253,230,138,0.0), rgba(253,230,138,0.7), rgba(253,230,138,0.0))",
          }}
        />
      </motion.div>

      {/* ═══ 6. 부유 먼지 입자 (커튼 사이 스포트라이트에 비치는 먼지) ═══ */}
      <div className="absolute inset-x-[20%] inset-y-[15%] pointer-events-none overflow-hidden">
        {dustMotes.map((m) => (
          <motion.div
            key={m.id}
            className="absolute rounded-full bg-amber-100/40"
            style={{
              left: m.left,
              top: m.top,
              width: m.size,
              height: m.size,
              filter: "blur(0.5px)",
            }}
            animate={{
              y: [-6, 6, -6],
              x: [-3, 3, -3],
              opacity: [0.2, 0.65, 0.2],
            }}
            transition={{
              duration: m.duration,
              delay: m.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* ═══ 7. 중앙 간판 — LUCID THEATER ═══ */}
      <div className="absolute top-[18%] left-1/2 -translate-x-1/2 z-10 text-center pointer-events-none">
        <motion.div
          className="text-[10px] sm:text-[11px] tracking-[0.45em] uppercase font-medium"
          style={{
            color: "rgba(199,210,254,0.55)",
            fontFamily: "'Pretendard', sans-serif",
          }}
          variants={{
            rest:  { opacity: 0.55, y: 0 },
            hover: { opacity: 0.85, y: -1 },
          }}
          transition={{ duration: 0.4 }}
        >
          Lucid Theater
        </motion.div>
        <motion.h2
          className="text-xl sm:text-2xl font-bold mt-1 animate-marquee-shimmer"
          style={{
            color: "rgba(237,233,254,0.92)",
            fontFamily: "'Pretendard', sans-serif",
            letterSpacing: "0.12em",
          }}
          variants={{
            rest:  { y: 0 },
            hover: { y: -2 },
          }}
          transition={{ duration: 0.5 }}
        >
          극장
        </motion.h2>
      </div>

      {/* ═══ 8. 하단 카피 + 인디케이터 ═══ */}
      <div className="absolute bottom-[8%] left-1/2 -translate-x-1/2 z-10 text-center w-[72%] pointer-events-none">
        <motion.p
          className="text-[11px] sm:text-xs leading-relaxed"
          style={{ color: "rgba(199,210,254,0.65)" }}
          variants={{
            rest:  { opacity: 0.7 },
            hover: { opacity: 1 },
          }}
        >
          당신이 감독이 되어, 이야기가 자동으로 펼쳐집니다
        </motion.p>

        {sessionCount > 0 && (
          <motion.div
            className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-0.5 rounded-full bg-amber-400/10 border border-amber-300/25"
            variants={{
              rest:  { opacity: 0.7, scale: 1 },
              hover: { opacity: 1.0, scale: 1.05 },
            }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
          >
            <span className="w-1 h-1 rounded-full bg-amber-300/80" />
            <span className="text-[10px] tracking-wider text-amber-200/85 font-semibold uppercase">
              상연 중 · {sessionCount}편
            </span>
          </motion.div>
        )}
      </div>

      {/* ═══ 9. 무대 바닥 라인 ═══ */}
      <motion.div
        className="absolute bottom-[3%] left-[12%] right-[12%] h-[1px] pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(167,139,250,0.5), transparent)",
        }}
        variants={{
          rest:  { opacity: 0.4, scaleX: 0.85 },
          hover: { opacity: 0.9, scaleX: 1 },
        }}
        transition={{ duration: 0.6 }}
      />

      {/* ═══ 10. 호버 글로우 (전체 후광) ═══ */}
      <motion.div
        className="absolute -inset-4 rounded-[200px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(167,139,250,0.16) 0%, rgba(167,139,250,0) 60%)",
          filter: "blur(20px)",
        }}
        variants={{
          rest:  { opacity: 0 },
          hover: { opacity: 1 },
        }}
        transition={{ duration: 0.5 }}
      />
    </motion.button>
  );
}