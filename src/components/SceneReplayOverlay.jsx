import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, History, X } from "lucide-react";

/**
 * [2026-08-07 디오라마 이식] 과거 씬 리플레이 오버레이 — 인디케이터 + 앞/뒤 셰브론 + 라이브 복귀.
 *
 * z-오더: 딤(z-10)은 무대(z-0) 위·대사창(z-20) 아래라 텍스트는 선명하게 유지되고,
 * 컨트롤(z-30)은 대사창 위·상단 HUD(z-40)/히스토리 모달(z-50) 아래.
 * 리플레이 중 씬 일러 무대는 페이지가 언마운트한다(스탠딩 재현이 주인공).
 *
 * @param {object}  props.replay   useSceneReplay 훅 반환값
 * @param {boolean} props.portrait 모바일 세로 — 셰브론을 대사창 위로 올림
 */
export default function SceneReplayOverlay({ replay, portrait = false }) {
  const active = !!replay?.isReplaying;

  // Esc → 라이브 복귀
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") replay.exit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, replay]);

  const chevronPos = portrait ? "bottom-[13.5rem]" : "top-1/2 -translate-y-1/2";

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="scene-replay-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {/* 과거 시점 딤 + 비네트 — 클릭 통과 */}
          <div
            className="absolute inset-0 z-10 pointer-events-none bg-black/25"
            style={{ boxShadow: "inset 0 0 120px rgba(0,0,0,0.55)" }}
          />

          {/* 상단 인디케이터 + 현재로 돌아가기 — 페이지 톱 HUD(인디케이터류) 아래 여백 */}
          <div
            className={`absolute left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 ${
              portrait ? "top-24" : "top-16"
            }`}
          >
            <div className="flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-md border border-amber-400/30 px-3 py-1.5 text-[11px] text-amber-200 shadow-lg whitespace-nowrap">
              <History size={12} />
              지난 장면 · {replay.position.n} / {replay.position.total}
            </div>
            <button
              onClick={replay.exit}
              className="flex items-center gap-1 rounded-full bg-amber-500/90 hover:bg-amber-400/90 px-3 py-1.5 text-[11px] font-medium text-black shadow-lg transition whitespace-nowrap"
            >
              현재로 돌아가기 <X size={12} />
            </button>
          </div>

          {/* 좌/우 씬 이동 — 마지막 씬의 ▶는 라이브 복귀 */}
          {replay.canPrev && (
            <button
              onClick={replay.prev}
              aria-label="이전 씬"
              className={`absolute left-2 z-30 p-2 rounded-full bg-black/50 backdrop-blur-md border border-white/15 text-amber-100/90 hover:bg-black/70 transition ${chevronPos}`}
            >
              <ChevronLeft size={22} />
            </button>
          )}
          <button
            onClick={replay.next}
            aria-label={replay.canNext ? "다음 씬" : "현재로 돌아가기"}
            className={`absolute right-2 z-30 p-2 rounded-full bg-black/50 backdrop-blur-md border border-white/15 text-amber-100/90 hover:bg-black/70 transition ${chevronPos}`}
          >
            <ChevronRight size={22} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
