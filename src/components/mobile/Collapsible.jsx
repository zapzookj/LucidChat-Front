import { motion, AnimatePresence } from "framer-motion";

/**
 * [Phase B · 단계0] Collapsible — height 0→auto 접이식 컨테이너.
 *
 * SupportPanel QnaTab 아코디언 패턴을 그대로 계승
 * (initial/animate/exit height + opacity, overflow-hidden).
 * 접이식 StatusPanel · 시트 내부 섹션 등에 재사용.
 *
 * Props:
 *   open       : 펼침 여부
 *   duration?  : 트랜지션 시간(기본 0.2s)
 *   className? : 확장 클래스
 */
export default function Collapsible({ open, children, duration = 0.2, className = "" }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration }}
          className={`overflow-hidden ${className}`}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
