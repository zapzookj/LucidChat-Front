// eslint-disable-next-line no-unused-vars -- motion은 <motion.div> JSX 멤버로 사용(jsx-uses-vars 미설정 오탐)
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Award, Lock, Sparkles, ChevronLeft } from "lucide-react";
import api from "../api/axios";
import { sfx } from "../utils/sfx";
import { EmptyState, ErrorState } from "../pages/lobby/lobbyUi";

// ═══════════════════════════════════════════════════════════════
//  [Phase 4.4] AchievementGallery — 업적 수집 갤러리
//
//  설정 패널 내 별도 뷰로 열리며, 해금/미해금 업적을
//  우표 컬렉션 스타일로 표시.
//
//  Props:
//    onClose    — 갤러리 닫기 콜백 (모달/드로어 모드 전용)
//    userScope  — [블록 A 보관함] true면 방 무관 유저 스코프 API(/achievements/gallery) 사용.
//                 기존 방 URL 경로는 챗 내 열람 호환으로 유지(roomId는 localStorage).
//    embedded   — [블록 A R2] true면 보관함 '업적' 세그먼트 인탭 그리드
//                 (디자인 정본: aichat docs/15_assets/lobby_redesign_mockup.html '보관함' 화면).
//                 드로어 크롬(헤더·프로그레스 바) 없이 타일만 — 잠김은 opacity-45+grayscale.
//                 기존 챗 드로어 사용처(ChatPage/ChatPageV2)는 그대로 하위호환.
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

const AchievementGallery = ({ onClose, userScope = false, embedded = false }) => {
  const navigate = useNavigate();
  const [gallery, setGallery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState(null);

  useEffect(() => {
    // 로비 인탭은 무음 (사운드 정책 — 호버/클릭/전환 SFX 금지)
    if (!embedded) sfx.wooshLight();
  }, [embedded]);

  const fetchGallery = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      // [블록 A] 보관함(유저 스코프)은 방 컨텍스트가 없다 — 전역 갤러리 API 사용.
      //   구 로비의 '수집품'은 localStorage.roomId 의존이라 방 미진입 신규에게 항상 실패했다.
      const roomId = localStorage.getItem("roomId");
      const path = userScope || !roomId
        ? "/achievements/gallery"
        : `/achievements/rooms/${roomId}/gallery`;
      const res = await api.get(path);
      setGallery(res.data);
    } catch (err) {
      console.error("Failed to fetch achievements", err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [userScope]);

  useEffect(() => { fetchGallery(); }, [fetchGallery]);

  // ── 업적 상세 모달 (모달/인탭 공용 — 인탭에서는 fixed 오버레이) ──
  const detailModal = (
    <AnimatePresence>
      {selectedAchievement && (
        <motion.div
          className={`${embedded ? "fixed z-[80]" : "absolute z-50"} inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm`}
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
  );

  // ═══════════ 인탭 모드 (보관함 '업적' 세그먼트) ═══════════
  if (embedded) {
    if (loading) {
      return (
        <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-white/[0.09] px-3.5 py-4">
              <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-white/[0.07] animate-pulse" />
              <div className="h-3 rounded bg-white/[0.07] animate-pulse" />
              <div className="h-2.5 w-3/5 mx-auto mt-1.5 rounded bg-white/[0.05] animate-pulse" />
            </div>
          ))}
        </div>
      );
    }
    if (loadError || !gallery) return <ErrorState onRetry={fetchGallery} />;
    if ((gallery.unlocked?.length ?? 0) === 0) {
      return (
        <EmptyState
          title="첫 업적이 기다리고 있어요"
          desc="대화를 시작하면 하나씩 열려요"
          ctaLabel="캐릭터 만나러 가기"
          onCta={() => navigate("/")}
        />
      );
    }
    return (
      <div>
        <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
          {gallery.unlocked.map((a) => (
            <button
              key={a.code}
              onClick={() => setSelectedAchievement(a)}
              className="rounded-xl border border-white/[0.09] bg-white/[0.035] px-3.5 py-4 text-center hover:border-violet-400/45 transition-colors"
            >
              <span className="w-10 h-10 mx-auto mb-2 rounded-full flex items-center justify-center text-[17px] bg-gradient-to-br from-violet-300/[0.14] to-sky-300/[0.10] border border-violet-400/25">
                {a.icon}
              </span>
              <span className="block text-lb-meta font-bold text-white truncate">{a.titleKo}</span>
              <span className="block text-lb-badge text-lobby-tx2 mt-0.5 truncate">{a.description}</span>
            </button>
          ))}
          {(gallery.locked || []).map((a) => (
            <div
              key={a.code}
              className="rounded-xl border border-white/[0.09] bg-white/[0.035] px-3.5 py-4 text-center opacity-45"
            >
              <span className="w-10 h-10 mx-auto mb-2 rounded-full flex items-center justify-center text-[17px] bg-white/[0.035] border border-white/[0.09] grayscale">
                🔒
              </span>
              <span className="block text-lb-meta font-bold text-white">???</span>
              <span className="block text-lb-badge text-lobby-tx2 mt-0.5">아직 잠겨 있어요</span>
            </div>
          ))}
        </div>
        {detailModal}
      </div>
    );
  }

  // ═══════════ 드로어 모드 (기존 사용처 하위호환 — ChatPage/ChatPageV2) ═══════════
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
        onClick={() => { if (!isLocked) { sfx.click(); setSelectedAchievement(achievement); } }}
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
          <button onClick={() => { sfx.click(); onClose?.(); }} className="p-1 rounded-full hover:bg-white/10 transition">
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

      {detailModal}
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
