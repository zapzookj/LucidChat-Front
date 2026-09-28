import { motion, AnimatePresence } from "framer-motion";
import { Send, MapPin, Clock, Forward, MessageCircle } from "lucide-react";
import "../../styles/aurora-chat.css";

/**
 * Story V2 하단 영역 — 입력 + 3개 액션 버튼 + LLM 자율 dialogue_options.
 *
 * [Chunk C-4] dialogue_options UI 폴리싱:
 *   - "감독 옵션" 라벨 + 시각적 그룹화
 *   - 옵션 카드형 (단순 pill에서 진화)
 *   - 호버 시 가로 슬라이드 인디케이터 (→)
 *   - 등장 시 stagger fade + scale
 *
 * @param {object}   props
 * @param {string}   props.inputMessage
 * @param {function} props.setInputMessage
 * @param {function} props.onSendMessage         — () => Promise<void>
 * @param {function} props.onAction              — (actionType, payload?) => Promise<void>
 *                                                  actionType: "NEXT_SCENE" | "TIME_ADVANCE" | "MOVE"
 * @param {function} props.onMoveClick           — () => void
 * @param {boolean}  props.isStreaming
 * @param {string[]} props.dialogueOptions       — LLM이 자율 제공한 선택지
 * @param {function} props.onOptionClick         — (opt: string) => void
 */
export default function StoryV2BottomBar({
  inputMessage, setInputMessage, onSendMessage,
  onAction, onMoveClick, isStreaming,
  dialogueOptions, onOptionClick,
}) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-30 px-4 sm:px-6 pb-safe-4 pt-3 bg-gradient-to-t from-lobby-bg via-lobby-bg/90 to-transparent">
      <div className="max-w-4xl mx-auto space-y-2.5">
        {/* ═══ dialogue_options (LLM 자율 — 노출 시) ═══ */}
        <AnimatePresence>
          {dialogueOptions.length > 0 && (
            <motion.div
              key="dialogue-options"
              initial={{ opacity: 0, y: 12, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: 12, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 mb-2 ml-1">
                <MessageCircle size={11} className="text-amber-300" />
                <span className="text-xs uppercase tracking-wider text-lobby-accent font-medium">
                  감독의 선택지
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {dialogueOptions.map((opt, i) => (
                  <motion.button
                    key={`${opt}-${i}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08, duration: 0.3 }}
                    onClick={() => onOptionClick(opt)}
                    disabled={isStreaming}
                    className="aurora-story-choice group relative w-full text-left px-4 py-3 rounded-xl disabled:opacity-40 transition-colors duration-200"
                  >
                    {/* 인덱스 번호 — 키보드 단축 힌트 (향후 1~9 키바인딩 가능) */}
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-lobby-tx2 font-mono opacity-0 group-hover:opacity-100 transition">
                      {i + 1}
                    </span>
                    {/* 옵션 텍스트 */}
                    <span className="ml-3 text-sm text-amber-100 leading-snug">{opt}</span>
                    {/* 호버 시 우측 화살표 — 슬라이드 인 */}
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-lobby-accent opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200">
                      →
                    </span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ 3 액션 버튼 ═══ */}
        <div className="flex gap-2 text-xs">
          <ActionButton onClick={() => onAction("NEXT_SCENE")} disabled={isStreaming}>
            <Forward size={14} /> 다음 씬
          </ActionButton>
          <ActionButton onClick={() => onAction("TIME_ADVANCE")} disabled={isStreaming}>
            <Clock size={14} /> 시간 진전
          </ActionButton>
          <ActionButton onClick={onMoveClick} disabled={isStreaming}>
            <MapPin size={14} /> 장소 이동
          </ActionButton>
        </div>

        {/* ═══ 입력 ═══ */}
        <div className="flex gap-2">
          <input
            type="text"
            aria-label="행동 또는 대사 입력"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSendMessage();
              }
            }}
            disabled={isStreaming}
            placeholder={isStreaming ? "응답 중..." : "행동/대사 입력..."}
            className="flex-1 min-w-0 min-h-[52px] bg-lobby-surface/95 backdrop-blur border border-lobby-accent/25 rounded-xl px-4 py-3 text-lobby-tx0 placeholder:text-lobby-tx2 focus:outline-none focus:border-lobby-accent disabled:opacity-50"
          />
          <button
            onClick={onSendMessage}
            disabled={isStreaming || !inputMessage.trim()}
            className="aurora-chat-send px-4 py-3 rounded-xl transition flex items-center"
            aria-label="전송"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ActionButton({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="aurora-chat-action flex-1 px-3 py-2 transition disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
    >
      {children}
    </button>
  );
}
