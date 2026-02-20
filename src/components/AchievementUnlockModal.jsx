import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import { Award } from "lucide-react";

// ═══════════════════════════════════════════════════════════════
//  [Phase 4.4] AchievementUnlockModal — 업적 획득 연출
//
//  이스터에그/엔딩 달성 시 풀스크린 모달로 시네마틱 표시.
//  도장 찍히는 애니메이션 + 빛나는 효과.
//
//  Props:
//    achievement  — { code, title, titleKo, description, icon, isNew }
//    onClose      — 닫기 콜백
// ═══════════════════════════════════════════════════════════════

const AchievementUnlockModal = ({ achievement, onClose }) => {
  // 5초 후 자동 닫기
  useEffect(() => {
    if (!achievement) return;
    const t = setTimeout(() => onClose?.(), 6000);
    return () => clearTimeout(t);
  }, [achievement, onClose]);

  if (!achievement) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[500] flex items-center justify-center cursor-pointer select-none"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* 배경 딤 */}
        <motion.div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        />

        {/* 메인 카드 */}
        <motion.div
          className="relative flex flex-col items-center gap-4 px-10 py-10 max-w-sm w-full"
          initial={{ scale: 0.3, opacity: 0, y: 40 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
        >
          {/* 빛나는 배경 원 */}
          <motion.div
            className="absolute w-64 h-64 rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(255,215,0,0.15), transparent 70%)",
              filter: "blur(30px)",
            }}
            animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 3, repeat: Infinity }}
          />

          {/* 라벨 */}
          <motion.div
            className="flex items-center gap-2 text-amber-400/80 text-xs tracking-[0.3em] uppercase font-bold"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            <Award size={14} />
            {achievement.isNew ? "Achievement Unlocked" : "Achievement"}
          </motion.div>

          {/* 도장 / 훈장 아이콘 */}
          <motion.div
            className="relative"
            initial={{ scale: 3, opacity: 0, rotate: -30 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 15,
              delay: 0.6,
            }}
          >
            {/* 외부 링 */}
            <motion.div
              className="w-28 h-28 rounded-full border-2 border-amber-400/40 flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, rgba(40,30,20,0.9), rgba(60,50,30,0.9))",
                boxShadow: "0 0 40px rgba(255,215,0,0.15), inset 0 0 20px rgba(255,215,0,0.05)",
              }}
              animate={{
                boxShadow: [
                  "0 0 40px rgba(255,215,0,0.15), inset 0 0 20px rgba(255,215,0,0.05)",
                  "0 0 60px rgba(255,215,0,0.3), inset 0 0 30px rgba(255,215,0,0.1)",
                  "0 0 40px rgba(255,215,0,0.15), inset 0 0 20px rgba(255,215,0,0.05)",
                ],
              }}
              transition={{ duration: 2.5, repeat: Infinity }}
            >
              <span className="text-5xl select-none" style={{ textShadow: "0 0 20px rgba(255,215,0,0.4)" }}>
                {achievement.icon}
              </span>
            </motion.div>

            {/* 스탬프 충격파 */}
            <motion.div
              className="absolute inset-0 rounded-full border border-amber-400/50"
              initial={{ scale: 1, opacity: 0.8 }}
              animate={{ scale: 2.5, opacity: 0 }}
              transition={{ delay: 0.7, duration: 0.8, ease: "easeOut" }}
            />
            <motion.div
              className="absolute inset-0 rounded-full border border-amber-300/30"
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: 3, opacity: 0 }}
              transition={{ delay: 0.85, duration: 0.8, ease: "easeOut" }}
            />
          </motion.div>

          {/* 타이틀 */}
          <motion.h2
            className="text-xl sm:text-2xl font-bold text-amber-100 text-center mt-2"
            style={{ fontFamily: "'Noto Serif KR', serif", letterSpacing: "0.05em" }}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.8 }}
          >
            {achievement.titleKo}
          </motion.h2>

          {/* 영문 서브타이틀 */}
          <motion.p
            className="text-xs text-amber-400/60 tracking-[0.15em]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.6 }}
          >
            {achievement.title}
          </motion.p>

          {/* 설명 */}
          <motion.p
            className="text-sm text-white/50 text-center leading-relaxed mt-1 max-w-xs"
            style={{ fontFamily: "'Noto Sans KR', sans-serif" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 0.8 }}
          >
            {achievement.description}
          </motion.p>

          {/* 닫기 힌트 */}
          <motion.p
            className="text-white/15 text-xs mt-6 tracking-widest"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.5, duration: 1 }}
          >
            TAP TO CLOSE
          </motion.p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AchievementUnlockModal;