import { useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion, useDragControls } from "framer-motion";
import { X } from "lucide-react";
import "../../styles/aurora-chat.css";
import useOverlayFocus from "./useOverlayFocus";

/**
 * [Phase B · 단계0] BottomSheet — 모바일 점진적 노출 프리미티브.
 *
 * 코드베이스 기존 관용구를 그대로 계승:
 *   - 오버레이: `fixed inset-0` + `absolute inset-0 bg-black/50 backdrop-blur-sm` 백드롭
 *   - 모션: y 슬라이드 스프링(싫어요/신고 모달의 items-end 바텀시트 패턴)
 *   - 열림/닫힘은 무음으로 유지한다.
 *   - 스크롤 영역 .custom-scrollbar
 * 추가: safe-area-inset-bottom, 드래그-다운 dismiss, ≥44px 닫기 타깃.
 *
 * 순수 프리젠테이션 — 상태/로직 없음. 모바일 레이아웃에서만 소비된다.
 *
 * Props:
 *   open, onClose      : 표시 제어
 *   title?             : 헤더 타이틀(있으면 헤더+닫기 버튼 렌더)
 *   zIndex?            : 스택 위치(기본 50 — 초고 z 오버레이 아래)
 *   maxHeight?         : 시트 최대 높이(기본 "85vh")
 *   showHandle?        : 상단 드래그 핸들(기본 true)
 *   closeOnBackdrop?   : 백드롭 탭 닫기(기본 true)
 *   className,contentClassName : 확장 클래스
 */
export default function BottomSheet({
  open,
  onClose,
  title,
  children,
  zIndex = 50,
  maxHeight = "85vh",
  showHandle = true,
  closeOnBackdrop = true,
  className = "",
  contentClassName = "",
}) {
  const reduceMotion = useReducedMotion();
  const dragControls = useDragControls();
  const panelRef = useRef(null);
  useOverlayFocus(open, panelRef, onClose);
  // [폴리싱 #8] 열림 직후 같은 클릭이 백드롭에 떨어져 곧바로 닫히는 사고 방지 — 열림 시각 기록
  const openedAtRef = useRef(0);
  useEffect(() => {
    if (open) {
      openedAtRef.current = Date.now();
    }
  }, [open]);

  const handleBackdropClick = () => {
    if (Date.now() - openedAtRef.current < 250) return; // 열림 후 250ms 이내 클릭 무시
    onClose?.();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 flex items-end justify-center"
          style={{ zIndex }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeOnBackdrop ? handleBackdropClick : undefined}
          />

          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title || "상세 보기"}
            className={`aurora-sheet relative z-10 w-full max-w-lg border border-b-0 flex flex-col ${className}`}
            style={{
              maxHeight,
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
            initial={{ y: reduceMotion ? 0 : "100%" }}
            animate={{ y: 0 }}
            exit={{ y: reduceMotion ? 0 : "100%" }}
            transition={reduceMotion ? { duration: .12 } : { type: "spring", stiffness: 320, damping: 34 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120) onClose?.();
            }}
          >
            {showHandle && (
              <div
                aria-hidden="true"
                onPointerDown={(event) => dragControls.start(event)}
                className="flex-shrink-0 flex justify-center pt-3 pb-3 touch-none cursor-grab active:cursor-grabbing"
              >
                <div className="w-10 h-1.5 rounded-full bg-white/20" />
              </div>
            )}

            {title && (
              <div className="aurora-sheet-header flex-shrink-0 flex items-center justify-between px-5 pt-1 pb-3">
                <h3 className="text-white font-bold text-base tracking-wide">{title}</h3>
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

            <div
              className={`aurora-sheet-content min-h-0 flex-1 overflow-y-auto custom-scrollbar px-5 ${
                title ? "pb-5" : "py-5"
              } ${contentClassName}`}
            >
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
