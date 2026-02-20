import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Award, Lock, Sparkles, X, ChevronLeft } from "lucide-react";
import api from "../api/axios";

// ═══════════════════════════════════════════════════════════════
//  [Phase 4.4] AchievementGallery — 업적 수집 갤러리
//
//  설정 패널 내 별도 뷰로 열리며, 해금/미해금 업적을
//  우표 컬렉션 스타일로 표시.
//
//  Props:
//    onClose — 갤러리 닫기 콜백
// ═══════════════════════════════════════════════════════════════

// 업적 카테고리 컬러
const CATEGORY_STYLES = {
  ENDING: {
    bg: "from-pink-950/40 to-rose-950/40",
    border: "border-pink-500/30",
    accent: "text-pink-400",
    glow: "rgba(236,72,153,0.15)",
    label: "Endings",
  },
  SPECIAL: {
    bg: "from-amber-950/40 to-yellow-950/40",
    border: "border-amber-500/30",
    accent: "text-amber-400",
    glow: "rgba(245,158,11,0.15)",
    label: "Special",
  },
};

const AchievementGallery = ({ onClose }) => {
  const [gallery, setGallery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedAchievement, setSelectedAchievement] = useState(null);

  useEffect(() => {
    const fetchGallery = async () => {
      try {
        const roomId = localStorage.getItem("roomId");
        const res = await api.get(`/achievements/rooms/${roomId}/gallery`);
        setGallery(res.data);
      } catch (err) {
        console.error("Failed to fetch achievements", err);
      } finally {
        setLoading(false);
      }
    };
    fetchGallery();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-white/30 animate-pulse">Loading achievements...</div>
      </div>
    );
  }

  if (!gallery) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-white/30">업적을 불러올 수 없습니다.</div>
      </div>
    );
  }

  // 카테고리별 분류
  const endingUnlocked = gallery.unlocked.filter(a => a.type === "ENDING");
  const endingLocked = gallery.locked.filter(a => a.type === "ENDING");
  const specialUnlocked = gallery.unlocked.filter(a => a.type === "SPECIAL");
  const specialLocked = gallery.locked.filter(a => a.type === "SPECIAL");

  const renderBadge = (achievement, isLocked = false) => {
    const style = CATEGORY_STYLES[achievement.type] || CATEGORY_STYLES.SPECIAL;
    
    return (
      <motion.button
        key={achievement.code}
        onClick={() => !isLocked && setSelectedAchievement(achievement)}
        className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${
          isLocked
            ? "bg-white/[0.02] border-white/5 cursor-default opacity-40 grayscale"
            : `bg-gradient-to-br ${style.bg} ${style.border} hover:scale-105 cursor-pointer`
        }`}
        style={!isLocked ? { boxShadow: `0 0 20px ${style.glow}` } : {}}
        whileHover={!isLocked ? { y: -2 } : {}}
        whileTap={!isLocked ? { scale: 0.95 } : {}}
        layout
      >
        {/* 아이콘 */}
        <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl ${
          isLocked ? "bg-white/5" : "bg-black/30"
        }`}>
          {isLocked ? (
            <Lock size={20} className="text-white/20" />
          ) : (
            <span style={{ textShadow: `0 0 12px ${style.glow}` }}>{achievement.icon}</span>
          )}
        </div>

        {/* 이름 */}
        <div className="text-center">
          <p className={`text-xs font-bold ${isLocked ? "text-white/20" : style.accent}`}>
            {isLocked ? "???" : achievement.titleKo}
          </p>
          <p className={`text-[10px] mt-0.5 ${isLocked ? "text-white/10" : "text-white/30"}`}>
            {isLocked ? "미발견" : achievement.title}
          </p>
        </div>

        {/* NEW 배지 */}
        {!isLocked && achievement.unlockedAt && isRecent(achievement.unlockedAt) && (
          <motion.div
            className="absolute -top-1 -right-1 bg-amber-500 text-black text-[8px] font-black px-1.5 py-0.5 rounded-full"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
          >
            NEW
          </motion.div>
        )}
      </motion.button>
    );
  };

  const renderCategory = (label, icon, unlocked, locked, style) => (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className={`text-sm font-bold tracking-wider ${style.accent}`}>{label}</h3>
        <span className="text-xs text-white/20 ml-auto">
          {unlocked.length}/{unlocked.length + locked.length}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {unlocked.map(a => renderBadge(a, false))}
        {locked.map(a => renderBadge(a, true))}
      </div>
    </section>
  );

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 transition">
            <ChevronLeft size={20} className="text-white/70" />
          </button>
          <h2 className="text-lg font-bold text-amber-300 flex items-center gap-2">
            <Award size={20} />
            Achievements
          </h2>
        </div>
        <div className="text-xs text-white/30">
          {gallery.unlockedCount}/{gallery.totalCount} collected
        </div>
      </div>

      {/* 프로그레스 바 */}
      <div className="px-6 pt-4 pb-2">
        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${(gallery.unlockedCount / gallery.totalCount) * 100}%` }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
          />
        </div>
        <p className="text-[10px] text-white/20 mt-1.5 text-right">
          완성도 {Math.round((gallery.unlockedCount / gallery.totalCount) * 100)}%
        </p>
      </div>

      {/* 컨텐츠 */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-24 custom-scrollbar">
        {renderCategory(
          "Endings",
          <Sparkles size={14} className="text-pink-400" />,
          endingUnlocked, endingLocked,
          CATEGORY_STYLES.ENDING
        )}

        <div className="h-px bg-white/5" />

        {renderCategory(
          "Special",
          <Sparkles size={14} className="text-amber-400" />,
          specialUnlocked, specialLocked,
          CATEGORY_STYLES.SPECIAL
        )}

        {/* 힌트 섹션 */}
        {gallery.unlockedCount < gallery.totalCount && (
          <div className="mt-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center">
            <p className="text-xs text-white/20 leading-relaxed">
              미발견 업적이 {gallery.totalCount - gallery.unlockedCount}개 남아있습니다.
              <br />다양한 대화를 시도해보세요.
            </p>
          </div>
        )}
      </div>

      {/* 업적 상세 모달 */}
      <AnimatePresence>
        {selectedAchievement && (
          <motion.div
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedAchievement(null)}
          >
            <motion.div
              className="bg-gray-900/95 border border-white/10 rounded-2xl p-8 max-w-xs w-full mx-6 text-center space-y-4"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-5xl block">{selectedAchievement.icon}</span>
              <h3 className="text-lg font-bold text-amber-200">{selectedAchievement.titleKo}</h3>
              <p className="text-xs text-white/30 tracking-wider">{selectedAchievement.title}</p>
              <p className="text-sm text-white/50 leading-relaxed">{selectedAchievement.description}</p>
              {selectedAchievement.unlockedAt && (
                <p className="text-[10px] text-white/20 mt-2">
                  획득: {new Date(selectedAchievement.unlockedAt).toLocaleDateString("ko-KR")}
                </p>
              )}
              <button
                onClick={() => setSelectedAchievement(null)}
                className="mt-4 px-6 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/50 hover:bg-white/10 transition"
              >
                닫기
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// 24시간 이내 획득이면 NEW 표시
function isRecent(dateStr) {
  if (!dateStr) return false;
  const diff = Date.now() - new Date(dateStr).getTime();
  return diff < 24 * 60 * 60 * 1000;
}

export default AchievementGallery;