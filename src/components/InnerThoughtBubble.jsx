import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Unlock } from "lucide-react";
import { sfx } from "../utils/sfx";

// ═══════════════════════════════════════════════════════════════════
//  [Phase 5.5-IT] InnerThoughtBubble
//
//  캐릭터의 속마음이 존재할 때 일러스트 머리 근처에 표시되는
//  부유하는 생각 말풍선(💭). 클릭 시 잠금 해제 파티클 효과 + API 호출.
//
//  Props:
//    visible      — 말풍선 표시 여부 (hasInnerThought && !unlocked)
//    onUnlock     — 클릭 시 호출할 해금 콜백
//    isUnlocking  — 해금 API 호출 중 로딩 상태
//    unlocked     — 이미 해금된 상태
// ═══════════════════════════════════════════════════════════════════

// ── 잠금 해제 파티클 ──
const UnlockParticles = ({ onComplete }) => {
  const particles = Array.from({ length: 12 }, (_, i) => {
    const angle = (Math.PI * 2 * i) / 12;
    const distance = 40 + Math.random() * 30;
    const size = 4 + Math.random() * 6;
    return {
      id: i,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      size,
      delay: Math.random() * 0.1,
      rotation: Math.random() * 360,
      emoji: ["✨", "💫", "⭐", "🔓", "✦", "·"][i % 6],
    };
  });

  useEffect(() => {
    const timer = setTimeout(onComplete, 800);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute left-1/2 top-1/2 select-none"
          style={{ fontSize: `${p.size + 6}px` }}
          initial={{
            x: 0, y: 0, opacity: 1, scale: 1,
            rotate: 0,
          }}
          animate={{
            x: p.x,
            y: p.y,
            opacity: [1, 1, 0],
            scale: [1, 1.3, 0.3],
            rotate: p.rotation,
          }}
          transition={{
            duration: 0.7,
            delay: p.delay,
            ease: "easeOut",
          }}
        >
          {p.emoji}
        </motion.span>
      ))}
    </div>
  );
};

// ── 잠금 아이콘 (흔들림 + 빛남) ──
const LockIcon = ({ isHovered }) => (
  <motion.div
    className="relative flex items-center justify-center"
    animate={isHovered ? { rotate: [-5, 5, -5, 5, 0] } : { rotate: 0 }}
    transition={{ duration: 0.4 }}
  >
    <Lock
      size={16}
      className="text-purple-200/90 drop-shadow-[0_0_4px_rgba(192,132,252,0.5)]"
    />
    {/* 잠금 글로우 */}
    <motion.div
      className="absolute inset-0 rounded-full"
      animate={{
        boxShadow: isHovered
          ? "0 0 12px 4px rgba(192,132,252,0.4)"
          : "0 0 6px 2px rgba(192,132,252,0.15)",
      }}
      transition={{ duration: 0.3 }}
    />
  </motion.div>
);


const InnerThoughtBubble = ({
  visible = false,
  onUnlock,
  isUnlocking = false,
  unlocked = false,
}) => {
  const [showParticles, setShowParticles] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // visible이 바뀌면 dismissed 리셋
  useEffect(() => {
    setIsDismissed(false);
    setShowParticles(false);
  }, [visible]);

  const handleClick = useCallback(() => {
    if (isUnlocking || unlocked || showParticles) return;

    // 파티클 시작
    setShowParticles(true);

    // 약간의 딜레이 후 콜백 호출
    setTimeout(() => {
      onUnlock?.();
    }, 300);
  }, [isUnlocking, unlocked, showParticles, onUnlock]);

  const handleParticlesComplete = useCallback(() => {
    setShowParticles(false);
    setIsDismissed(true);
  }, []);

  const shouldShow = visible && !unlocked && !isDismissed;

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0, scale: 0.3, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5, y: -20 }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 20,
            delay: 0.8, // 대사 타이핑 후 등장
          }}
          className="absolute z-30 pointer-events-auto cursor-pointer"
          style={{
            // 캐릭터 머리 우측 상단 근처 배치
            // CharacterDisplay의 relative 컨테이너 안에서의 위치
            top: "12%",
            right: "18%",
          }}
          onClick={handleClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* ── 메인 말풍선 ── */}
          <motion.div
            // 둥둥 떠다니는 플로팅 애니메이션
            animate={{ y: [0, -6, 0] }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="relative"
          >
            {/* 말풍선 본체 */}
            <motion.div
              className="relative flex items-center justify-center rounded-2xl px-4 py-3"
              style={{
                background: "linear-gradient(135deg, rgba(88,28,135,0.75), rgba(126,34,206,0.6))",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(192,132,252,0.3)",
                boxShadow: isHovered
                  ? "0 0 24px 6px rgba(168,85,247,0.35), 0 4px 20px rgba(0,0,0,0.3)"
                  : "0 0 16px 3px rgba(168,85,247,0.2), 0 4px 16px rgba(0,0,0,0.2)",
                minWidth: "52px",
                minHeight: "44px",
              }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
            >
              {/* 로딩 중 */}
              {isUnlocking ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 border-2 border-purple-300/30 border-t-purple-300 rounded-full"
                />
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-lg leading-none">💭</span>
                  <LockIcon isHovered={isHovered} />
                </div>
              )}

              {/* 호버 시 비용 텍스트 */}
              <AnimatePresence>
                {isHovered && !isUnlocking && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 2, scale: 0.9 }}
                    transition={{ duration: 0.15 }}
                    className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap"
                  >
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: "rgba(0,0,0,0.8)",
                        color: "rgba(250,204,21,0.9)",
                        border: "1px solid rgba(250,204,21,0.2)",
                      }}
                    >
                      ⚡ -1
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* 말풍선 꼬리 (삼각형) */}
            <div
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0"
              style={{
                borderLeft: "6px solid transparent",
                borderRight: "6px solid transparent",
                borderTop: "8px solid rgba(88,28,135,0.65)",
              }}
            />

            {/* 파티클 효과 */}
            {showParticles && (
              <UnlockParticles onComplete={handleParticlesComplete} />
            )}
          </motion.div>

          {/* ── 미세한 펄스 링 (주의 환기용) ── */}
          <motion.div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{ top: 0 }}
            animate={{
              boxShadow: [
                "0 0 0 0px rgba(168,85,247,0.3)",
                "0 0 0 8px rgba(168,85,247,0)",
              ],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatDelay: 1,
              ease: "easeOut",
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InnerThoughtBubble;