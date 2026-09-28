import { useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import "../../styles/aurora-chat.css";
import useOverlayFocus from "./useOverlayFocus";

/**
 * [Phase B · 단계0] Drawer — 측면 슬라이드 패널 프리미티브.
 *
 * TheaterDiaryPanel 의 레시피를 그대로 계승:
 *   - `fixed inset-0` + `bg-black/55 backdrop-blur-sm` 백드롭
 *   - 우/좌 슬라이드 `x: "100%"` 스프링(stiffness 280 / damping 30)
 *   - bg-slate-900/95 backdrop-blur-xl 패널, custom-scrollbar 본문
 *   - 무음 전환, ESC 닫기, ≥44px 닫기 타깃
 * 추가: safe-area 상/하 인셋.
 *
 * Props:
 *   open, onClose
 *   side?       : "right" | "left" (기본 "right")
 *   title?      : 헤더 타이틀
 *   widthClass? : 패널 폭(기본 "max-w-md")
 *   zIndex?     : 스택 위치(기본 50)
 */
export default function Drawer({
  open,
  onClose,
  side = "right",
  title,
  children,
  widthClass = "max-w-md",
  zIndex = 50,
  className = "",
  contentClassName = "",
}) {
  const reduceMotion = useReducedMotion();
  const panelRef = useRef(null);
  useOverlayFocus(open, panelRef, onClose);

  const isRight = side !== "left";
  const offscreen = isRight ? "100%" : "-100%";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={`fixed inset-0 flex ${isRight ? "justify-end" : "justify-start"}`}
          style={{ zIndex }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title || "상세 보기"}
            className={`aurora-drawer relative w-full ${widthClass} h-full ${
              isRight ? "border-l" : "border-r"
            } border-white/10 overflow-hidden flex flex-col ${className}`}
            style={{
              paddingTop: "env(safe-area-inset-top)",
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
            initial={{ x: reduceMotion ? 0 : offscreen }}
            animate={{ x: 0 }}
            exit={{ x: reduceMotion ? 0 : offscreen }}
            transition={reduceMotion ? { duration: .12 } : { type: "spring", stiffness: 280, damping: 30 }}
          >
            {title && (
              <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-white/5">
                <h2 className="text-lg font-bold text-white tracking-wide">{title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="닫기"
                  className="aurora-icon-close -mr-2 transition"
                >
                  <X size={18} />
                </button>
              </div>
            )}

            <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain custom-scrollbar ${contentClassName}`}>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
