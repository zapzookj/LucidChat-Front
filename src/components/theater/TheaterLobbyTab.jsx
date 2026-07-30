import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Drama, Sparkles, ChevronRight, Clock, Heart, Crown,
  Play, Plus, Users, BookOpen
} from "lucide-react";
import { fetchWorlds, fetchUgcTheaterWorlds, fetchMyTheaterSessions } from "../../api/TheaterLobbyApi";
import { assetUrl } from "../../utils/assetUrl";  // ⬅️ 경로 주의 (../../ )
import { sfx } from "../../utils/sfx";

/**
 * [Phase 5.5-Theater] Theater 탭
 *
 * 기존 LobbyPage의 "Dialogue" 탭과 병렬로 배치.
 * 2가지 서브섹션:
 *   1. 세계관 카드 (새로운 극)
 *   2. 진행 중인 Theater 세션 (상연 중인 극)
 *
 * Props:
 *   onCreateFlow: (worldId) => void  — 세계관 카드 클릭 시 아바타 빌더 플로우 시작
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Act 타이틀 매핑
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const ACT_TITLES = {
  1: "Act 1. 만남",
  2: "Act 2. 관계의 형성",
  3: "Act 3. 전환점",
  4: "Act 4. 결말",
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  세계관 카드
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const WorldCard = ({ world, onClick }) => {
  return (
    <motion.div
      layout
      onClick={onClick}
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      className="group relative cursor-pointer overflow-hidden rounded-3xl"
      style={{ aspectRatio: "16/9" }}
    >
      {/* Hero 이미지 */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
        style={{
          backgroundImage: world.heroImageUrl
            ? `url(${world.heroImageUrl})`
            : "linear-gradient(135deg, #1e1b4b, #312e81)",
        }}
      />
      {/* 오버레이 */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

      {/* 컨텐츠 */}
      <div className="relative h-full flex flex-col justify-end p-6">
        <div className="mb-2 flex items-center gap-2">
          {world.moodKeywords?.slice(0, 3).map((kw, i) => (
            <span
              key={i}
              className="text-[10px] uppercase tracking-widest text-white/50 border border-white/20 rounded-full px-2 py-0.5"
            >
              {kw}
            </span>
          ))}
        </div>
        <h3 className="text-3xl font-black text-white mb-2 drop-shadow-lg">
          {world.displayName}
        </h3>
        <p className="text-sm text-white/70 mb-3 line-clamp-1">
          {world.tagline}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-white/50" />
            <span className="text-xs text-white/60">
              {world.heroineCount}명의 히로인
            </span>
          </div>
          <motion.div
            className="flex items-center gap-1 text-sm font-bold text-white/90"
            whileHover={{ x: 4 }}
          >
            입장하기 <ChevronRight size={16} />
          </motion.div>
        </div>

        {/* 히로인 썸네일 */}
        {world.heroines?.length > 0 && (
          <div className="absolute top-5 right-5 flex -space-x-3">
            {world.heroines.slice(0, 3).map((h) => {
              // [Polish-v2] thumbnailUrl이 없으면 characterSlug 기반 폴백
              const imgUrl = h.thumbnailUrl
                || (h.characterSlug ? assetUrl(`/characters/${h.characterSlug}/thumb.jpg`) : null);
              return (
                <div
                  key={h.id}
                  className="w-10 h-10 rounded-full border-2 border-white/80 bg-cover bg-center shadow-lg"
                  style={{
                    backgroundImage: imgUrl ? `url(${imgUrl})` : "none",
                    backgroundColor: "#4c1d95",
                  }}
                  title={h.name}
                />
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  세션 카드 (Continue)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SessionCard = ({ session, onResume }) => {
  const progressPct = Math.min(100, (session.currentAct - 1) * 25 + 10);

  // [Polish-v2] 리드 히로인 이미지 URL 해결
  const leadImgUrl = session.leadHeroineThumbnailUrl
    || (session.leadHeroineSlug ? assetUrl(`/characters/${session.leadHeroineSlug}/thumb.jpg`) : null);

  return (
    <motion.div
      layout
      whileHover={{ scale: 1.02, y: -2 }}
      className="relative rounded-2xl bg-white/[0.04] border border-white/10 hover:border-indigo-400/40 p-5 cursor-pointer backdrop-blur-sm transition-colors"
      onClick={onResume}
    >
      {/* 상단: 세계관 & Act */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase tracking-widest text-indigo-300/70 font-bold">
          {session.worldDisplayName}
        </span>
        {session.endingReached ? (
          <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-amber-300/80 font-bold">
            <Crown size={10} /> 완주
          </span>
        ) : (
          <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">
            {ACT_TITLES[session.currentAct] || `Act ${session.currentAct}`}
          </span>
        )}
      </div>

      {/* 중단: 아바타 / 리드 히로인 */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1">
          <div className="text-xs text-white/40 mb-0.5">주인공</div>
          <div className="text-base font-bold text-white truncate">
            {session.avatarName || "이름 없는 감독"}
          </div>
        </div>
        {session.leadHeroineName && (
          <div className="flex items-center gap-2">
            {/* [Polish-v2] 리드 히로인 원형 썸네일 */}
            {leadImgUrl && (
              <div
                className="w-9 h-9 rounded-full border-2 border-rose-400/40 bg-cover bg-center shadow-md"
                style={{
                  backgroundImage: `url(${leadImgUrl})`,
                  backgroundColor: "#4c1d95",
                }}
              />
            )}
            <div className="text-right">
              <div className="text-xs text-rose-300/70 mb-0.5 flex items-center gap-1 justify-end">
                <Heart size={10} /> 리드
              </div>
              <div className="text-sm font-bold text-rose-200 truncate max-w-[100px]">
                {session.leadHeroineName}
              </div>
              <div className="text-xs text-rose-400/60">
                ♥ {session.leadHeroineAffection}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 진행 바 */}
      <div className="w-full h-1 rounded-full bg-white/5 overflow-hidden mb-2">
        <motion.div
          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px] text-white/40">
        <div className="flex items-center gap-1">
          <BookOpen size={10} />
          <span>Chapter {session.currentChapter}</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock size={10} />
          <span>
            {session.totalSceneCount}개 씬 감상
          </span>
        </div>
      </div>

      {/* 엔딩 도달 배지 */}
      {session.endingReached && (
        <div className="mt-3 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
          <div className="text-xs text-amber-300 font-bold">
            🏆 {session.endingTitle}
          </div>
        </div>
      )}
    </motion.div>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  메인 컴포넌트
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function TheaterLobbyTab({ onCreateFlow }) {
  const [worlds, setWorlds] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        // [에픽 A] 내 UGC 월드 병합 — 게이트 off면 빈 배열(회귀 제로)
        const [w, uw, s] = await Promise.all([
          fetchWorlds(), fetchUgcTheaterWorlds(), fetchMyTheaterSessions()]);
        if (!alive) return;
        setWorlds([...(w || []), ...(uw || [])]);
        setSessions(s || []);
      } catch (e) {
        if (!alive) return;
        console.error("[Theater] Lobby load failed:", e);
        setError("극장 데이터를 불러오지 못했습니다.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const handleResume = (roomId) => {
    navigate(`/theater/${roomId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div
          className="w-10 h-10 border-2 border-purple-400/40 border-t-purple-400 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-red-300 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 text-sm"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* ═══ 진행 중인 세션 ═══ */}
      <AnimatePresence>
        {sessions.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Drama size={18} className="text-indigo-300" />
                  상연 중인 극
                </h2>
                <p className="text-xs text-white/40 mt-0.5">
                  이어서 감상하거나, 새 엔딩을 향해 돌아가세요
                </p>
              </div>
              <span className="text-xs text-white/30">{sessions.length}편</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {sessions.map((s) => (
                <SessionCard key={s.roomId} session={s} onResume={() => handleResume(s.roomId)} />
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ═══ 세계관 카드 ═══ */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles size={18} className="text-purple-300" />
            새로운 극 — 세계관 선택
          </h2>
          <p className="text-xs text-white/40 mt-0.5">
            당신이 감독이 되어 이야기를 만들어갑니다
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {worlds.map((w) => (
            <WorldCard
              key={w.id}
              world={w}
              onClick={() => onCreateFlow && onCreateFlow(w)}
            />
          ))}
        </div>

        {worlds.length === 0 && (
          <div className="text-center py-12 text-white/40 text-sm">
            아직 사용 가능한 세계관이 없습니다.
          </div>
        )}
      </section>
    </div>
  );
}