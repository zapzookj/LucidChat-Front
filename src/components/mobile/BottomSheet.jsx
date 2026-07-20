import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { sfx } from "../../utils/sfx";

/**
 * [Phase B · 단계0] BottomSheet — 모바일 점진적 노출 프리미티브.
 *
 * 코드베이스 기존 관용구를 그대로 계승:
 *   - 오버레이: `fixed inset-0` + `absolute inset-0 bg-black/50 backdrop-blur-sm` 백드롭
 *   - 모션: y 슬라이드 스프링(싫어요/신고 모달의 items-end 바텀시트 패턴)
 *   - 열릴 때 sfx.wooshLight(), 닫기 sfx.click()
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
  useEffect(() => {
    if (open) sfx.wooshLight();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

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
            onClick={closeOnBackdrop ? onClose : undefined}
          />

          <motion.div
            className={`relative z-10 w-full max-w-lg rounded-t-3xl border border-b-0 border-white/10 flex flex-col ${className}`}
            style={{
              background:
                "linear-gradient(160deg, rgba(15,10,35,0.98) 0%, rgba(30,15,55,0.97) 50%, rgba(20,10,40,0.98) 100%)",
              boxShadow: "0 -20px 60px rgba(0,0,0,0.55)",
              maxHeight,
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120) onClose?.();
            }}
          >
            {showHandle && (
              <div className="flex-shrink-0 flex justify-center pt-3 pb-1">
                <div className="w-10 h-1.5 rounded-full bg-white/20" />
              </div>
            )}

            {title && (
              <div className="flex-shrink-0 flex items-center justify-between px-5 pt-1 pb-3">
                <h3 className="text-white font-bold text-base tracking-wide">{title}</h3>
                <button
                  onClick={() => {
                    sfx.click();
                    onClose?.();
                  }}
                  aria-label="닫기"
                  className="-mr-2 w-11 h-11 flex items-center justify-center rounded-full text-white/40 hover:text-white hover:bg-white/10 transition"
                >
                  <X size={18} />
                </button>
              </div>
            )}

            <div
              className={`flex-1 overflow-y-auto custom-scrollbar px-5 ${
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
