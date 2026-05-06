import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, MessageSquare, Sparkles, ChevronRight } from "lucide-react";
import { sfx } from "../utils/sfx";

/**
 * [Phase 5.5-Director] 디렉터 인터루드 컴포넌트
 *
 * 디렉터가 생성한 나레이션을 유저에게 보여주고,
 * 유저가 상황을 인지한 뒤 행동할 수 있도록 안내한다.
 *
 * 3가지 인터루드 유형:
 * - INTERLUDE: 깜짝 나레이션 → 관찰/개입 선택
 * - BRANCH: 선택지 카드 제시
 * - TRANSITION: 시간/장소 전환 나레이션
 *
 * ⚠️ Rules of Hooks: 모든 훅은 early return 이전에 선언.
 *    directive가 null일 때도 훅 호출 순서가 동일해야 한다.
 */
const DirectorInterlude = ({
  directive,
  onComplete,
  onDismiss,
  characterName = "캐릭터",
  isSecretMode = false,
}) => {
  const [phase, setPhase] = useState("narration");
  const [typedText, setTypedText] = useState("");
  const [typeComplete, setTypeComplete] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);

  // ── directive 파생값 (null-safe) ──
  const isInterlude = directive?.decision === "INTERLUDE";
  const isBranch = directive?.decision === "BRANCH";
  const isTransition = directive?.decision === "TRANSITION";

  const narrationText = useMemo(() => {
    if (!directive) return null;
    if (isInterlude) return directive.interlude?.narration;
    if (isBranch) return directive.branch?.situation;
    if (isTransition) return directive.transition?.narration;
    return null;
  }, [directive, isInterlude, isBranch, isTransition]);

  const isObserverMode = isInterlude && directive?.interlude?.user_agency === "OBSERVER";

  // ── directive 변경 시 상태 리셋 ──
  useEffect(() => {
    if (directive) {
      sfx.wooshLight();
      setPhase("narration");
      setTypedText("");
      setTypeComplete(false);
      setSelectedOption(null);
    }
  }, [directive]);

  // ── 타자기 효과 ──
  useEffect(() => {
    if (!narrationText) {
      setTypeComplete(true);
      return;
    }

    setTypedText("");
    setTypeComplete(false);
    let i = 0;
    const speed = 40;

    const timer = setInterval(() => {
      if (i < narrationText.length) {
        setTypedText(narrationText.substring(0, i + 1));
        if (i % 4 === 0) sfx.typewriter();
        i++;
      } else {
        setTypeComplete(true);
        clearInterval(timer);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [narrationText]);

  // 텍스트 즉시 완성 (탭/클릭으로 스킵)
  const skipTyping = useCallback(() => {
    if (!typeComplete && narrationText) {
      setTypedText(narrationText);
      setTypeComplete(true);
    }
  }, [typeComplete, narrationText]);

  // ── INTERLUDE 완료 ──
  const handleInterludeAction = useCallback(
    (action) => {
      setPhase("done");
      onComplete?.({
        action,
        directiveType: "INTERLUDE",
        isObserverMode,
      });
    },
    [onComplete, isObserverMode]
  );

  // ── BRANCH 선택 ──
  const handleBranchSelect = useCallback(
    (option) => {
      setSelectedOption(option);
      setTimeout(() => {
        setPhase("done");
        onComplete?.({
          action: "branch_select",
          directiveType: "BRANCH",
          selectedOption: option,
        });
      }, 300);
    },
    [onComplete]
  );

  // ── TRANSITION 확인 ──
  const handleTransitionConfirm = useCallback(() => {
    setPhase("done");
    onComplete?.({
      action: "transition_confirm",
      directiveType: "TRANSITION",
    });
  }, [onComplete]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  Early return — 모든 훅이 선언된 후 안전하게 수행
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (!directive || phase === "done") return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[200] flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* 배경 오버레이 */}
        <motion.div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={skipTyping}
        />

        {/* 메인 컨텐츠 */}
        <motion.div
          className="relative z-10 w-[92vw] max-w-lg"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          {/* ── 인터루드 타입 배지 ── */}
          <div className="flex justify-center mb-4">
            <motion.div
              className={`px-4 py-1.5 rounded-full text-xs font-medium tracking-wider
                ${isInterlude ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : ""}
                ${isBranch ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" : ""}
                ${isTransition ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" : ""}
              `}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              {isInterlude && "⚡ SOMETHING HAPPENED"}
              {isBranch && "🎭 CHOOSE YOUR PATH"}
              {isTransition && "⏳ TIME FLOWS"}
            </motion.div>
          </div>

          {/* ── 나레이션 카드 ── */}
          <motion.div
            className="rounded-2xl p-6 border border-white/10"
            style={{
              background:
                "linear-gradient(145deg, rgba(15,10,30,0.95), rgba(25,15,50,0.92))",
              boxShadow: "0 20px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
            onClick={skipTyping}
          >
            {/* 나레이션 텍스트 */}
            <div className="min-h-[80px] mb-6">
              <p
                className="text-white/90 text-[15px] leading-relaxed font-light italic"
                style={{ textShadow: "0 0 20px rgba(255,255,255,0.1)" }}
              >
                {typedText}
                {!typeComplete && (
                  <motion.span
                    className="inline-block w-[2px] h-[18px] bg-white/60 ml-0.5 align-middle"
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                  />
                )}
              </p>
            </div>

            {/* ── 액션 영역 (타자기 완료 후 표시) ── */}
            <AnimatePresence>
              {typeComplete && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  {/* INTERLUDE 액션 버튼 */}
                  {isInterlude && (
                    <div className="space-y-3">
                      {isObserverMode && (
                        <button
                          onClick={() => handleInterludeAction("observe")}
                          className="w-full py-3 rounded-xl flex items-center justify-center gap-2
                            bg-amber-500/15 border border-amber-500/30 text-amber-200
                            hover:bg-amber-500/25 transition-all group"
                        >
                          <Eye size={16} className="group-hover:scale-110 transition-transform" />
                          <span className="text-sm font-medium">숨죽여 지켜보기</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleInterludeAction("intervene")}
                        className="w-full py-3 rounded-xl flex items-center justify-center gap-2
                          bg-white/10 border border-white/20 text-white/80
                          hover:bg-white/15 transition-all group"
                      >
                        <MessageSquare size={16} className="group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-medium">
                          {isObserverMode ? "끼어들기" : "상황에 반응하기"}
                        </span>
                      </button>
                    </div>
                  )}

                  {/* BRANCH 선택지 */}
                  {isBranch && directive.branch?.options && (
                    <div className="space-y-2.5">
                      {directive.branch.options.map((option, idx) => {
                        if (option.is_secret && !isSecretMode) return null;

                        const toneColors = {
                          normal: "border-white/20 bg-white/5 hover:bg-white/10",
                          affection: "border-pink-500/30 bg-pink-500/10 hover:bg-pink-500/15",
                          secret: "border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/15",
                        };

                        return (
                          <motion.button
                            key={idx}
                            onClick={() => handleBranchSelect(option)}
                            className={`w-full p-3.5 rounded-xl border text-left transition-all
                              ${toneColors[option.tone] || toneColors.normal}
                              ${selectedOption === option ? "ring-2 ring-white/40 scale-[0.98]" : ""}
                            `}
                            whileTap={{ scale: 0.97 }}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-white text-sm font-medium">
                                {option.label}
                              </span>
                              <span className="text-white/40 text-xs flex items-center gap-1">
                                <Sparkles size={10} />
                                {option.energy_cost}
                              </span>
                            </div>
                            <p className="text-white/50 text-xs leading-relaxed">
                              {option.detail}
                            </p>
                          </motion.button>
                        );
                      })}
                    </div>
                  )}

                  {/* TRANSITION 확인 */}
                  {isTransition && (
                    <button
                      onClick={handleTransitionConfirm}
                      className="w-full py-3 rounded-xl flex items-center justify-center gap-2
                        bg-blue-500/15 border border-blue-500/30 text-blue-200
                        hover:bg-blue-500/25 transition-all group"
                    >
                      <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                      <span className="text-sm font-medium">계속</span>
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* 스킵 안내 */}
          {!typeComplete && (
            <motion.p
              className="text-center text-white/20 text-xs mt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              탭하여 스킵
            </motion.p>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DirectorInterlude;