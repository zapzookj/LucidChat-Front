import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";

// ═══════════════════════════════════════════════════════════════
//  [Chunk C-1] V2 씬 카드 — V1 DialogueBox typewriter 패턴 이식
//
//  변화:
//    - narration / dialogue 모두 한 글자씩 타이핑
//    - tap-to-skip: 타이핑 중 탭 시 즉시 풀텍스트 표시
//    - 타이핑 종료 후 dialogue 끝에 깜박이는 커서
//    - faded(이전 씬 히스토리) 카드는 타이핑 건너뜀
//
//  속도: 35ms/char (V1 DialogueBox와 동일)
// ═══════════════════════════════════════════════════════════════

const TYPING_SPEED_MS = 35;

/**
 * 단일 씬 (speaker + narration + dialogue) 렌더 with 타이핑 애니메이션.
 *
 * @param {object}  props
 * @param {object}  props.scene             — { speaker, narration, dialogue }
 * @param {boolean} [props.faded=false]     — true면 opacity 0.4 + 타이핑 건너뜀
 */
export default function StoryV2SceneCard({ scene, faded = false }) {
  // faded 카드는 풀텍스트 즉시 표시 (이미 한 번 본 텍스트)
  const skipTyping = faded;

  // narration 타이핑 상태
  const [narrationText, setNarrationText] = useState(
    skipTyping ? (scene.narration || "") : ""
  );
  // dialogue 타이핑 상태 (narration 완료 후 시작)
  const [dialogueText, setDialogueText] = useState(
    skipTyping ? (scene.dialogue || "") : ""
  );
  // 단계: 0=narration 타이핑 중, 1=dialogue 타이핑 중, 2=완료
  const [phase, setPhase] = useState(skipTyping ? 2 : 0);

  const intervalRef = useRef(null);

  const hasNarration = !!scene.narration;
  const hasDialogue = !!scene.dialogue;

  // narration 타이핑
  useEffect(() => {
    if (skipTyping) return;
    if (phase !== 0) return;
    if (!hasNarration) {
      setPhase(hasDialogue ? 1 : 2);
      return;
    }

    const fullText = scene.narration;
    let charIndex = 0;
    setNarrationText("");

    intervalRef.current = setInterval(() => {
      charIndex++;
      setNarrationText(fullText.slice(0, charIndex));
      if (charIndex >= fullText.length) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        setTimeout(() => setPhase(hasDialogue ? 1 : 2), 300);
      }
    }, TYPING_SPEED_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.narration, phase, skipTyping]);

  // dialogue 타이핑
  useEffect(() => {
    if (skipTyping) return;
    if (phase !== 1) return;
    if (!hasDialogue) {
      setPhase(2);
      return;
    }

    const fullText = scene.dialogue;
    let charIndex = 0;
    setDialogueText("");

    intervalRef.current = setInterval(() => {
      charIndex++;
      setDialogueText(fullText.slice(0, charIndex));
      if (charIndex >= fullText.length) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        setPhase(2);
      }
    }, TYPING_SPEED_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.dialogue, phase, skipTyping]);

  // tap-to-skip: 타이핑 중 탭 시 즉시 풀텍스트
  const handleSkipTyping = useCallback(
    (e) => {
      if (skipTyping) return;
      if (phase === 2) return;
      e.stopPropagation();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setNarrationText(scene.narration || "");
      setDialogueText(scene.dialogue || "");
      setPhase(2);
    },
    [skipTyping, phase, scene.narration, scene.dialogue]
  );

  const isTyping = phase < 2;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: faded ? 0.4 : 1, y: 0 }}
      transition={{ duration: 0.4 }}
      onClick={handleSkipTyping}
      className={`mb-5 ${faded ? "" : "scale-100"} ${
        !faded && isTyping ? "cursor-pointer" : ""
      }`}
    >
      {scene.speaker && (
        <div className="text-amber-300 text-sm font-medium mb-1">{scene.speaker}</div>
      )}

      {hasNarration && (
        <p className="text-stone-300 leading-relaxed whitespace-pre-wrap">
          {narrationText}
          {!faded && phase === 0 && narrationText.length < (scene.narration?.length ?? 0) && (
            <TypingCursor className="text-stone-400" />
          )}
        </p>
      )}

      {hasDialogue && (phase >= 1 || skipTyping) && (
        <p className="text-white leading-relaxed mt-2 italic">
          "{dialogueText}
          {!faded && phase === 1 && dialogueText.length < (scene.dialogue?.length ?? 0) && (
            <TypingCursor className="text-white" />
          )}
          {(skipTyping || phase >= 2) && <span>"</span>}
        </p>
      )}
    </motion.div>
  );
}

function TypingCursor({ className = "" }) {
  return (
    <motion.span
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
      className={`inline-block ml-0.5 w-1.5 ${className}`}
    >
      ▎
    </motion.span>
  );
}