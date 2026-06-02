import { motion } from "framer-motion";

/**
 * Story V2 초기화 모달 — 페르소나 처리 선택 (스토리만 vs 스토리+페르소나).
 *
 * @param {object}   props
 * @param {function} props.onCancel
 * @param {function} props.onConfirm  — (includePersona: boolean) => Promise<void>
 */
export default function StoryV2ResetModal({ onCancel, onConfirm }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-stone-900 rounded-lg max-w-md w-full p-5"
      >
        <h3 className="font-bold text-amber-200 mb-3">스토리 초기화</h3>
        <p className="text-sm text-stone-400 mb-1">
          현재 진행 중인 스토리를 초기화합니다. 모든 누적 기억, 호감도, 시간 진행이 사라집니다.
        </p>
        <p className="text-sm text-stone-500 mb-5">페르소나 처리를 선택하세요:</p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onConfirm(false)}
            className="p-3 bg-stone-800 hover:bg-stone-700 rounded text-left transition"
          >
            <div className="font-medium text-white">스토리만 초기화</div>
            <div className="text-xs text-stone-400 mt-0.5">페르소나는 유지됩니다.</div>
          </button>
          <button
            onClick={() => onConfirm(true)}
            className="p-3 bg-stone-800 hover:bg-stone-700 rounded text-left transition"
          >
            <div className="font-medium text-white">스토리 + 페르소나 초기화</div>
            <div className="text-xs text-stone-400 mt-0.5">완전히 새로 시작합니다.</div>
          </button>
          <button
            onClick={onCancel}
            className="p-3 mt-2 text-stone-400 hover:bg-stone-800 rounded transition"
          >
            취소
          </button>
        </div>
      </div>
    </motion.div>
  );
}