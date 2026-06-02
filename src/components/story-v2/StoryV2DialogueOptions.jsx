import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { sfx } from "../../utils/sfx";

/**
 * [Story V2] 디렉터의 선택지 — LLM이 자율적으로 제공한 dialogue_options를
 * DialogueBox의 텍스트 입력창 *위*에 chip 형태로 노출.
 *
 * <p>옵션 클릭 시 입력창에 자동 채움 (사용자가 수정 후 전송 가능). 직접 전송이 아닌
 * *추천* 방식 — 사용자의 자율성 보존.
 *
 * <p>위계: dialogue 본문 → [이 컴포넌트] → 텍스트 입력창 → 액션 바.
 *
 * @param {object}   props
 * @param {string[]} props.options        — LLM dialogue_options 배열 (없거나 빈 배열이면 숨김)
 * @param {boolean}  props.isStreaming    — SSE 응답 중이면 모두 disabled
 * @param {function} props.onSelect       — (option: string) => void; 입력창에 옵션 텍스트 채움
 */
export default function StoryV2DialogueOptions({ options, isStreaming, onSelect }) {
  const opts = options || [];

  return (
    <AnimatePresence>
      {opts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: 8, height: 0 }}
          transition={{ duration: 0.25 }}
          className="overflow-hidden"
        >
          <div className="px-4 sm:px-6 pt-2 pb-1">
            <div className="max-w-3xl mx-auto">
              {/* 라벨 */}
              <div className="flex items-center gap-1.5 mb-2 ml-1">
                <MessageCircle size={11} className="text-amber-300" />
                <span className="text-[10px] uppercase tracking-wider text-amber-300/70 font-medium">
                  디렉터의 제안
                </span>
              </div>

              {/* 옵션 chip */}
              <div className="flex flex-col gap-1.5">
                {opts.map((opt, i) => (
                  <motion.button
                    key={`${opt}-${i}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.25 }}
                    onClick={() => { sfx.click(); onSelect?.(opt); }}
                    disabled={isStreaming}
                    className="group relative w-full text-left px-4 py-2 bg-gradient-to-r from-amber-500/10 to-amber-500/5 hover:from-amber-500/20 hover:to-amber-500/10 border border-amber-400/30 hover:border-amber-400/50 rounded-lg disabled:opacity-40 transition-all duration-200"
                  >
                    {/* 인덱스 — 호버 시 노출 (향후 1~9 키바인딩 hint) */}
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-amber-300/40 font-mono opacity-0 group-hover:opacity-100 transition">
                      {i + 1}
                    </span>
                    <span className="ml-3 text-sm text-amber-100 leading-snug">{opt}</span>
                    {/* 호버 시 우측 화살표 */}
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-300/60 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200">
                      →
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}