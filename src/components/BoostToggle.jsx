import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Rocket, Zap, Crown, Lock } from "lucide-react";
import api from "../api/axios";

/**
 * BoostToggle — 에너지 부스트 모드 토글
 *
 * [비구독자] 토글 가능하되, "5배 에너지 소모" 경고 표시
 * [구독자]   토글 자유, "Pro 모델 무제한" 표시
 *
 * Props:
 * - boostMode: boolean
 * - isSubscriber: boolean
 * - onToggle: (newValue) => void
 * - onOpenStore: () => void  (구독 유도)
 */
const BoostToggle = ({ boostMode, isSubscriber, onToggle, onOpenStore, compact = false }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleToggle = async () => {
    const newValue = !boostMode;

    // 비구독자가 ON으로 전환 시 → 확인 모달
    if (newValue && !isSubscriber && !showConfirm) {
      setShowConfirm(true);
      return;
    }

    setShowConfirm(false);
    setIsAnimating(true);

    try {
      await api.patch("/users/boost", { enabled: newValue });
      onToggle?.(newValue);
    } catch {
      // 실패 시 롤백은 부모에서 처리
    } finally {
      setTimeout(() => setIsAnimating(false), 600);
    }
  };

  const confirmBoost = () => {
    setShowConfirm(false);
    setIsAnimating(true);

    api.patch("/users/boost", { enabled: true })
      .then(() => onToggle?.(true))
      .catch(() => {})
      .finally(() => setTimeout(() => setIsAnimating(false), 600));
  };

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={handleToggle}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
            boostMode
              ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.15)]"
              : "border-white/10 bg-white/[0.03] text-white/40 hover:text-white/60 hover:bg-white/[0.06]"
          }`}
        >
          <Rocket size={13} className={boostMode ? "text-cyan-400" : ""} />
          <span>Boost</span>
          {boostMode && (
            <motion.div
              className="w-1.5 h-1.5 rounded-full bg-cyan-400"
              animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          )}
        </button>

        {/* Compact confirm tooltip — positioned BELOW */}
        <AnimatePresence>
          {showConfirm && (
            <motion.div
              initial={{ opacity: 0, y: -5, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -5, scale: 0.95 }}
              className="absolute top-full right-0 mt-2 w-56 bg-black/95 border border-cyan-500/20 rounded-xl p-3 shadow-2xl backdrop-blur-xl z-50"
            >
              <p className="text-white text-xs font-medium mb-1.5">부스트 모드를 켤까요?</p>
              <p className="text-white/40 text-[10px] leading-relaxed mb-3">
                Pro 모델로 대화하지만<br/>
                에너지 소모가 <span className="text-cyan-300 font-bold">5배</span>로 증가합니다
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-1.5 rounded-lg bg-white/5 text-white/50 text-[11px] hover:bg-white/10 transition"
                >
                  취소
                </button>
                <button
                  onClick={confirmBoost}
                  className="flex-1 py-1.5 rounded-lg bg-cyan-600 text-white text-[11px] font-bold hover:bg-cyan-500 transition"
                >
                  켜기
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── Full-size toggle (Settings panel) ──
  return (
    <div className="relative">
      <div className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-500 ${
        boostMode
          ? "bg-gradient-to-r from-cyan-900/20 to-blue-900/20 border-cyan-500/30"
          : "bg-white/5 border-white/10"
      }`}>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <motion.div
              animate={boostMode ? { rotate: [0, 10, -10, 0] } : { rotate: 0 }}
              transition={{ duration: 1.5, repeat: boostMode ? Infinity : 0 }}
            >
              <Rocket size={18} className={boostMode ? "text-cyan-400" : "text-gray-500"} />
            </motion.div>
            <span className={`text-sm font-bold ${boostMode ? "text-cyan-300" : "text-gray-300"}`}>
              에너지 부스트
            </span>
            {boostMode && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-[10px] bg-cyan-500/15 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-500/20 font-bold"
              >
                ON
              </motion.span>
            )}
          </div>
          <span className="text-xs text-gray-500 mt-1">
            {isSubscriber
              ? "Pro 모델로 대화합니다 (추가 비용 없음)"
              : boostMode
                ? "Pro 모델 대화 중 · 에너지 5배 소모"
                : "Pro 모델로 업그레이드된 대화 (비구독: x5 소모)"
            }
          </span>
        </div>

        <button
          onClick={handleToggle}
          className={`w-12 h-7 rounded-full transition-colors duration-300 relative ${
            boostMode ? "bg-cyan-600" : "bg-gray-700"
          }`}
        >
          <motion.div
            className="w-5 h-5 bg-white rounded-full shadow-md absolute top-1 left-1"
            animate={{ x: boostMode ? 20 : 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          />

          {/* Rocket launch effect on toggle */}
          <AnimatePresence>
            {isAnimating && boostMode && (
              <motion.div
                className="absolute -top-3 right-0"
                initial={{ opacity: 0, y: 8, scale: 0.5 }}
                animate={{ opacity: 1, y: -12, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.3 }}
                transition={{ duration: 0.6 }}
              >
                <Rocket size={16} className="text-cyan-400" />
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* 비구독자 구독 유도 배너 */}
      <AnimatePresence>
        {!isSubscriber && boostMode && (
          <motion.button
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onClick={onOpenStore}
            className="w-full mt-2 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-900/30 to-purple-900/30 border border-indigo-500/15 hover:border-indigo-500/30 transition text-left group"
          >
            <Crown size={14} className="text-amber-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-white/70">
                <span className="text-indigo-300 font-bold">루시드 패스</span> 구독 시 부스트 비용이 무료!
              </p>
            </div>
            <span className="text-[10px] text-indigo-400 font-bold group-hover:text-indigo-300 transition whitespace-nowrap">
              자세히 →
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* 비구독자 ON 확인 모달 */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute top-full left-0 right-0 mt-2 bg-black/95 border border-cyan-500/20 rounded-xl p-4 shadow-2xl backdrop-blur-xl z-50"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
                <Rocket size={20} className="text-cyan-400" />
              </div>
              <div>
                <p className="text-white text-sm font-bold">부스트 모드 활성화</p>
                <p className="text-white/40 text-xs">Pro 모델로 한 단계 높은 대화를 경험합니다</p>
              </div>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-medium mb-1">
                <Zap size={12} fill="currentColor" />
                에너지 소모 주의
              </div>
              <p className="text-white/50 text-[11px] leading-relaxed">
                비구독자는 에너지 소모가 <span className="text-amber-300 font-bold">5배</span>로 증가합니다.
                자유 모드 5, 스토리 모드 10 에너지가 소모됩니다.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-lg bg-white/5 text-white/60 text-sm hover:bg-white/10 transition"
              >
                취소
              </button>
              <button
                onClick={confirmBoost}
                className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-sm font-bold hover:from-cyan-500 hover:to-blue-500 transition shadow-lg"
              >
                부스트 켜기
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BoostToggle;