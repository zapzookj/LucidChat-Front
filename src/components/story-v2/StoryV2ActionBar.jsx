import { motion, AnimatePresence } from "framer-motion";
import { Forward, Clock, MapPin } from "lucide-react";
import { sfx } from "../../utils/sfx";

/**
 * [Story V2] 액션 바 — DialogueBox 텍스트 입력창 *아래*에 위치.
 *
 * <p>3개 액션:
 *   - 다음 씬 (NEXT_SCENE): 동일 시간/장소, 다른 분위기 또는 다른 화자로 진행
 *   - 시간 진전 (TIME_ADVANCE): DayPart 한 칸 진전
 *   - 장소 이동 (MOVE): 모달 열기 → 장소 선택
 *
 * <p>`topicConcluded=true`일 때만 노출. false면 빈 div (height collapse) — V1 입력창 위치 영향 없음.
 *
 * <p>V1과 시각 일관성: 동일 backdrop-blur / border / shadow 톤.
 *
 * @param {object}   props
 * @param {boolean}  props.topicConcluded  — 액션 허용 신호 (false면 자동 숨김)
 * @param {boolean}  props.isStreaming     — SSE 응답 중이면 모두 disabled
 * @param {function} props.onNextScene
 * @param {function} props.onTimeAdvance
 * @param {function} props.onMoveClick     — 장소 이동 모달 트리거
 */
export default function StoryV2ActionBar({
  topicConcluded, isStreaming,
  onNextScene, onTimeAdvance, onMoveClick,
}) {
  return (
    <AnimatePresence>
      {topicConcluded && (
        <motion.div
          initial={{ opacity: 0, y: -8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -8, height: 0 }}
          transition={{ duration: 0.25 }}
          className="overflow-hidden"
        >
          <div className="px-4 sm:px-6 pb-3">
            <div className="max-w-3xl mx-auto flex items-center gap-2">
              {/* 가이드 라벨 */}
              <span className="text-[10px] uppercase tracking-wider text-amber-300/60 font-medium mr-1 hidden sm:inline">
                흐름 진행
              </span>

              <ActionButton
                onClick={() => { sfx.click(); onNextScene?.(); }}
                disabled={isStreaming}
                icon={<Forward size={13} />}
                label="다음 씬"
              />
              <ActionButton
                onClick={() => { sfx.click(); onTimeAdvance?.(); }}
                disabled={isStreaming}
                icon={<Clock size={13} />}
                label="시간 진전"
              />
              <ActionButton
                onClick={() => { sfx.click(); onMoveClick?.(); }}
                disabled={isStreaming}
                icon={<MapPin size={13} />}
                label="장소 이동"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ActionButton({ onClick, disabled, icon, label }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex-1 px-3 py-2 rounded-lg bg-black/40 backdrop-blur-md border border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center justify-center gap-1.5 text-xs font-medium"
    >
      {icon}
      {label}
    </button>
  );
}