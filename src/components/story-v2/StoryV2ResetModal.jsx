import { motion } from "framer-motion";
import { useRef } from "react";
import useOverlayFocus from "../mobile/useOverlayFocus";
import "../../styles/aurora-chat.css";

/**
 * Story V2 '이야기 다시 시작' 모달 — 되돌릴 범위를 고르는 3지선다.
 *
 * <p>앞의 두 선택지는 *같은 방*을 초기화하므로 캐릭터 구성이 그대로 남는다.
 * 세 번째(onRestart)만 생성 플로우로 나가 캐릭터부터 다시 고른다 — 방 안에서 캐릭터를
 * 바꿀 수 있는 유일한 길이라, 두 초기화가 무엇을 안 바꾸는지도 문안에 명시한다.
 *
 * @param {object}   props
 * @param {function} props.onCancel
 * @param {function} props.onConfirm  — (includePersona: boolean) => Promise<void>
 * @param {function} [props.onRestart] — 생성 플로우(캐릭터 재선택)로 이동. 없으면 선택지 숨김.
 */
export default function StoryV2ResetModal({ onCancel, onConfirm, onRestart }) {
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
        aria-label="이야기 다시 시작"
        onClick={(e) => e.stopPropagation()}
        className="aurora-story-surface max-w-md w-full max-h-[85dvh] overflow-y-auto overscroll-contain p-6"
      >
        <h3 className="font-bold text-amber-200 mb-3">이야기 다시 시작</h3>
        <p className="text-sm text-lobby-tx1 mb-1">
          지금까지 쌓인 기억, 호감도, 시간 진행이 사라집니다. 되돌릴 수 없어요.
        </p>
        <p className="text-sm text-lobby-tx2 mb-5">어디까지 되돌릴지 선택하세요:</p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onConfirm(false)}
            className="aurora-story-option text-left"
          >
            <div className="font-medium text-white">스토리만 초기화</div>
            <div className="text-xs text-lobby-tx1 mt-0.5">시작 시점의 페르소나 스냅샷을 그대로 유지합니다. 등장 캐릭터는 지금 그대로예요.</div>
          </button>
          <button
            onClick={() => onConfirm(true)}
            className="aurora-story-option text-left"
          >
            <div className="font-medium text-white">현재 프로필로 새로 시작</div>
            <div className="text-xs text-lobby-tx1 mt-0.5">지금의 내 프로필(이름·소개·렌즈)을 다시 적용합니다. 등장 캐릭터는 지금 그대로예요.</div>
          </button>
          {onRestart && (
            <button
              onClick={onRestart}
              className="aurora-story-option text-left"
            >
              <div className="font-medium text-white">캐릭터부터 다시 고르기</div>
              <div className="text-xs text-lobby-tx1 mt-0.5">이 세계의 등장 캐릭터를 새로 선택해 이야기를 처음부터 엽니다. 선택 화면으로 이동해요.</div>
            </button>
          )}
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
