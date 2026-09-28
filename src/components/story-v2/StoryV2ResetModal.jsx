import { motion } from "framer-motion";
import { useRef } from "react";
import useOverlayFocus from "../mobile/useOverlayFocus";
import "../../styles/aurora-chat.css";

/**
 * Story V2 초기화 모달 — 페르소나 처리 선택 (스토리만 vs 스토리+페르소나).
 *
 * @param {object}   props
 * @param {function} props.onCancel
 * @param {function} props.onConfirm  — (includePersona: boolean) => Promise<void>
 */
export default function StoryV2ResetModal({ onCancel, onConfirm }) {
  const panelRef = useRef(null);
  useOverlayFocus(true, panelRef, onCancel);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
      className="fixed inset-0 z-50 bg-lobby-bg/75 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="스토리 초기화"
        onClick={(e) => e.stopPropagation()}
        className="aurora-story-surface max-w-md w-full max-h-[85dvh] overflow-y-auto overscroll-contain p-6"
      >
        <h3 className="font-bold text-amber-200 mb-3">스토리 초기화</h3>
        <p className="text-sm text-lobby-tx1 mb-1">
          현재 진행 중인 스토리를 초기화합니다. 모든 누적 기억, 호감도, 시간 진행이 사라집니다.
        </p>
        <p className="text-sm text-lobby-tx2 mb-5">페르소나 처리를 선택하세요:</p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onConfirm(false)}
            className="aurora-story-option text-left"
          >
            <div className="font-medium text-white">스토리만 초기화</div>
            <div className="text-xs text-lobby-tx1 mt-0.5">시작 시점의 페르소나 스냅샷을 그대로 유지합니다.</div>
          </button>
          <button
            onClick={() => onConfirm(true)}
            className="aurora-story-option text-left"
          >
            <div className="font-medium text-white">현재 프로필로 새로 시작</div>
            <div className="text-xs text-lobby-tx1 mt-0.5">지금의 내 프로필(이름·소개·렌즈)을 다시 적용해 완전히 새로 시작합니다.</div>
          </button>
          <button
            onClick={onCancel}
            className="min-h-[44px] p-3 mt-2 text-lobby-tx1 hover:bg-lobby-accent/10 rounded-xl transition-colors"
          >
            취소
          </button>
        </div>
      </div>
    </motion.div>
  );
}
