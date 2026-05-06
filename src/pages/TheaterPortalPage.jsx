import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, Drama, Sparkles, ChevronRight, Clock, Heart, Crown,
  Users, BookOpen, Zap, User, Settings, Gem, Archive
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import {
  fetchWorlds,
  fetchMyTheaterSessions,
} from "../api/TheaterLobbyApi";
import TheaterCreateFlow from "../components/theater/TheaterCreateFlow";
import LucidStore from "../components/LucidStore";
import { assetUrl } from "../utils/assetUrl";
import { sfx } from "../utils/sfx";

/**
 * [Phase 5.5-Theater-Polish · Phase I] TheaterPortalPage
 *
 * 기존 TheaterLobbyTab(탭 안에 박혀있던 Theater 로비)을
 * 독립된 풀페이지 라우트(/theater)로 진화시킨 것.
 *
 * 설계 의도:
 *  - 로비(Lucid Station)의 Doorway를 클릭해 들어오는 "다른 세계"
 *    이지만, 같은 앱이라는 일관성을 위해 Topbar 구조와 디자인 토큰 공유
 *  - 헤더 타이포그래피는 로비의 "새로운 만남" 시스템과 동일 폼팩터로 통일
 *  - 세계관 카드는 Theater의 시그니처(Netflix식 16:9 히어로)를 그대로 유지
 *  - "← 로비로" 버튼으로 항상 Lucid Station에 즉시 복귀 가능
 *
 * 라우트: /theater
 */

const ACT_TITLES = {
  1: "Act 1. 만남",
  2: "Act 2. 관계의 형성",
  3: "Act 3. 전환점",
  4: "Act 4. 결말",
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  세계관 카드
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const WorldCard = ({ world, onClick, index }) => (
  <motion.button
    type="button"
    onClick={onClick}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.05 + index * 0.08, duration: 0.5 }}
    whileHover={{ scale: 1.02, y: -4 }}
    whileTap={{ scale: 0.98 }}
    className="group relative cursor-pointer overflow-hidden rounded-3xl text-left w-full focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
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
    {/* 오버레이 — Theater의 시그니처 톤 */}
    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />
    {/* 호버 시 상단 글로우 라인 (LobbyPage 모드 카드와 같은 DNA) */}
    <motion.div
      className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-violet-300/70 to-transparent"
      initial={{ scaleX: 0 }}
      whileHover={{ scaleX: 1 }}
      transition={{ duration: 0.4 }}
    />

    {/* 컨텐츠 */}
    <div className="relative h-full flex flex-col justify-end p-6">
      <div className="mb-2 flex items-center gap-2 flex-wrap">
        {world.moodKeywords?.slice(0, 3).map((kw, i) => (
          <span
            key={i}
            className="text-[10px] uppercase tracking-widest text-white/55 border border-white/20 rounded-full px-2 py-0.5"
          >
            {kw}
          </span>
        ))}
      </div>
      <h3 className="text-3xl font-black text-white mb-2 drop-shadow-lg">
        {world.displayName}
      </h3>
      <p className="text-sm text-white/70 mb-3 line-clamp-1">{world.tagline}</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-white/55" />
          <span className="text-xs text-white/65">
            {world.heroineCount}명의 히로인
          </span>
        </div>
        <motion.div
          className="flex items-center gap-1 text-sm font-bold text-white/90 group-hover:text-violet-200 transition-colors"
          whileHover={{ x: 4 }}
        >
          입장하기 <ChevronRight size={16} />
        </motion.div>
      </div>

      {/* 히로인 썸네일 (우상단) */}
      {world.heroines?.length > 0 && (
        <div className="absolute top-5 right-5 flex -space-x-3">
          {world.heroines.slice(0, 3).map((h) => {
            const imgUrl =
              h.thumbnailUrl ||
                (h.characterSlug ? assetUrl(`/characters/${h.characterSlug}/thumb.jpg`) : null);
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
  </motion.button>
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  세션 카드 (Continue)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SessionCard = ({ session, onResume, index }) => {
  const progressPct = Math.min(100, (session.currentAct - 1) * 25 + 10);

  const leadImgUrl =
    session.leadHeroineThumbnailUrl ||
    (session.leadHeroineSlug ? assetUrl(`/characters/${session.leadHeroineSlug}/thumb.jpg`) : null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + index * 0.06 }}
      whileHover={{ scale: 1.02, y: -2 }}
      className="relative rounded-2xl bg-white/[0.04] border border-white/10 hover:border-violet-400/40 p-5 cursor-pointer backdrop-blur-sm transition-colors"
      onClick={onResume}
    >
      {/* 상단 메타 */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase tracking-widest text-violet-300/75 font-bold">
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

      {/* 아바타 / 리드 히로인 */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-white/45 mb-0.5">감독</div>
          <div className="text-base font-bold text-white truncate">
            {session.avatarName || "이름 없는 감독"}
          </div>
        </div>
        {session.leadHeroineName && (
          <div className="flex items-center gap-2">
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
              <div className="text-[10px] text-rose-300/70 mb-0.5 flex items-center gap-1 justify-end">
                <Heart size={10} /> 리드
              </div>
              <div className="text-sm font-bold text-rose-200 truncate max-w-[100px]">
                {session.leadHeroineName}
              </div>
              <div className="text-[10px] text-rose-400/65">
                ♥ {session.leadHeroineAffection}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 진행 바 */}
      <div className="w-full h-1 rounded-full bg-white/5 overflow-hidden mb-2">
        <motion.div
          className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500"
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px] text-white/45">
        <div className="flex items-center gap-1">
          <BookOpen size={10} />
          <span>Chapter {session.currentChapter}</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock size={10} />
          <span>{session.totalSceneCount}개 씬 감상</span>
        </div>
      </div>

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

export default function TheaterPortalPage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();

  const [worlds, setWorlds] = useState([]);
  const [sessions, setSessions] = useState([]);
  // [Phase 5.5 UX Polish · R4] 아카이브 카운트 — 진입 버튼에 표시
  const [archiveCount, setArchiveCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [createFlowWorld, setCreateFlowWorld] = useState(null);
  const [showStore, setShowStore] = useState(false);
  // [Phase III · B-4] 업셀 진입(=구독 탭) vs Topbar Gem 진입(=에너지 탭) 구분
  const [storeInitialTab, setStoreInitialTab] = useState("energy");
  const [userInfo, setUserInfo] = useState(null);

  // ─── 데이터 로드 ───
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        // [R4] 모든 세션 fetch (활성/아카이브 분리는 sessionStatus로)
        const [w, s] = await Promise.all([fetchWorlds(), fetchMyTheaterSessions()]);
        if (!alive) return;
        setWorlds(w || []);
        setSessions(s || []);
        // 아카이브 카운트 계산 (별도 API 호출 안 함 — 로컬 필터)
        const archCount = (s || []).filter(
          (x) => x.sessionStatus === "ARCHIVED" || x.sessionStatus === "ENDED"
        ).length;
        setArchiveCount(archCount);
      } catch (e) {
        if (!alive) return;
        console.error("[Theater] Portal load failed:", e);
        setError("극장 데이터를 불러오지 못했습니다.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // 유저 에너지 정보
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get("/users/me");
        if (alive) setUserInfo(res.data);
      } catch {}
    })();
    return () => { alive = false; };
  }, []);

  const handleResume = useCallback((roomId) => {
    navigate(`/theater/${roomId}`);
  }, [navigate]);

  const handleBack = useCallback(() => {
    navigate("/");
  }, [navigate]);

  const stars = useMemo(
    () =>
      Array.from({ length: 50 }, () => ({
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: 1 + Math.random() * 1.5,
        duration: 2 + Math.random() * 4,
        delay: Math.random() * 4,
      })),
    []
  );

  const displayEnergy = userInfo?.energy ?? user?.energy ?? 0;
  const displayNickname = userInfo?.nickname ?? user?.nickname ?? "";

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-950">
      {/* ═══ 배경 ═══ */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-slate-950 to-purple-950" />
        {/* 별빛 */}
        {stars.map((s, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white/40"
            style={{
              left: s.left, top: s.top,
              width: s.size, height: s.size,
            }}
            animate={{ opacity: [0.1, 0.55, 0.1] }}
            transition={{ duration: s.duration, delay: s.delay, repeat: Infinity }}
          />
        ))}
        {/* 하단 객석 그림자 */}
        <div className="absolute bottom-0 inset-x-0 h-1/3 bg-gradient-to-t from-slate-950 to-transparent" />
      </div>

      {/* ═══ Topbar — Lucid Station과 동일한 폼팩터, "← 로비로" 좌측 ═══ */}
      <div className="relative z-20 flex items-center justify-between px-5 sm:px-8 py-4">
        {/* 좌: 뒤로 + 로고 */}
        <div className="flex items-center gap-3">
          <motion.button
            onClick={handleBack}
            whileHover={{ x: -3 }}
            whileTap={{ scale: 0.94 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-md border border-white/10 text-white/60 hover:text-white hover:bg-black/50 transition-colors duration-200"
          >
            <ArrowLeft size={14} />
            <span className="text-xs tracking-wide">로비로</span>
          </motion.button>

          <Link
            to="/"
            className="flex items-center gap-2 cursor-pointer"
            aria-label="Lucid Station으로 돌아가기"
          >
            <img
              src="/logo_icon.png"
              alt=""
              className="h-7 sm:h-8 drop-shadow-lg"
              onError={(e) => { e.target.style.display = "none"; }}
            />
            <span
              className="hidden sm:inline text-base sm:text-lg font-bold text-white/85 tracking-[0.12em] drop-shadow-lg"
              style={{ fontFamily: "'Pretendard', sans-serif" }}
            >
              LUCID CHAT
            </span>
            <span className="text-white/30 mx-1.5">·</span>
            <span
              className="text-sm sm:text-base font-bold tracking-[0.18em]"
              style={{
                color: "rgba(199,210,254,0.9)",
                fontFamily: "'Pretendard', sans-serif",
              }}
            >
              극장
            </span>
          </Link>
        </div>

        {/* 우: 에너지 / 닉 / 스토어 / 설정 (Lucid Station과 동일) */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-1.5 bg-black/20 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/10">
            <Zap size={14} className="text-amber-300" />
            <span className="text-sm font-semibold text-white">{displayEnergy}</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-white/60 text-sm">
            <User size={14} />
            <span>{displayNickname}</span>
          </div>
          <button
            onClick={() => { setStoreInitialTab("energy"); setShowStore(true); }}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-black/20 backdrop-blur-md border border-white/10 text-amber-400/70 hover:text-amber-300 hover:bg-black/40 transition-colors duration-200"
            aria-label="Lucid Store"
          >
            <Gem size={14} />
          </button>
          <button
            onClick={() => navigate("/")}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-black/20 backdrop-blur-md border border-white/10 text-white/50 hover:text-white hover:bg-black/40 transition-colors duration-200"
            aria-label="설정"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* ═══ 본문 — 스크롤 가능 ═══ */}
      <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar h-[calc(100%-80px)]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-6 sm:py-10">
          {/* ─── 페이지 헤더 — Lucid Station과 같은 타이포 시스템 ─── */}
          <motion.div
            className="text-center mb-10"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 mb-3">
              <Drama size={18} className="text-violet-300/80" />
              <span className="text-[10px] uppercase tracking-[0.4em] text-violet-200/55 font-medium">
                Lucid Theater
              </span>
            </div>
            <h1
              className="text-3xl sm:text-4xl font-bold text-white tracking-wider mb-2"
              style={{ fontFamily: "'Pretendard', sans-serif" }}
            >
              당신의 무대는 어디입니까
            </h1>
            <p className="text-xs sm:text-sm text-white/40 tracking-wider">
              감독이 되어, 이야기가 펼쳐지는 것을 감상하세요
            </p>
          </motion.div>

          {/* ─── 로딩 ─── */}
          {loading && (
            <div className="flex items-center justify-center py-24">
              <motion.div
                className="w-10 h-10 border-2 border-violet-400/40 border-t-violet-400 rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
            </div>
          )}

          {/* ─── 에러 ─── */}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <p className="text-rose-300 mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 text-sm"
              >
                다시 시도
              </button>
            </div>
          )}

          {/* ─── 컨텐츠 ─── */}
          {!loading && !error && (
            <div className="space-y-12">
              {/* [Phase 5.5 UX Polish · R4] 활성 세션 (메인 카드) + 아카이브 진입 */}
              {(() => {
                // 활성/아카이브 분리 (legacy null은 활성으로 간주)
                const activeSessions = sessions.filter(
                  (s) => !s.sessionStatus || s.sessionStatus === "ACTIVE"
                );
                if (activeSessions.length === 0 && archiveCount === 0) return null;
                return (
                  <motion.section
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="flex items-end justify-between mb-4 gap-3 flex-wrap">
                      <div>
                        <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 tracking-wide">
                          <Drama size={18} className="text-indigo-300" />
                          상연 중인 극
                        </h2>
                        <p className="text-xs text-white/40 mt-0.5 tracking-wider">
                          {activeSessions.length > 0
                            ? "이어서 감상하거나, 새 엔딩을 향해 돌아가세요"
                            : "진행 중인 극이 없습니다. 새로운 극을 시작해 보세요."}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {archiveCount > 0 && (
                          <button
                            onClick={() => navigate("/theater/archive")}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-300/25 hover:border-amber-300/50 text-amber-100 text-[11px] font-bold tracking-wide transition-colors"
                          >
                            <Archive size={11} />
                            아카이브
                            <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-100 text-[9px] font-mono tabular-nums">
                              {archiveCount}
                            </span>
                          </button>
                        )}
                        {activeSessions.length > 0 && (
                          <span className="text-[11px] text-white/35 tracking-widest uppercase">
                            {activeSessions.length}편
                          </span>
                        )}
                      </div>
                    </div>

                    {activeSessions.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {activeSessions.map((s, i) => (
                          <SessionCard
                            key={s.roomId}
                            session={s}
                            onResume={() => handleResume(s.roomId)}
                            index={i}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl bg-white/[0.02] border border-dashed border-white/10 px-6 py-8 text-center">
                        <p className="text-white/35 text-xs leading-relaxed">
                          새 극을 시작하면 진행 중인 극이 이곳에 표시됩니다.
                        </p>
                      </div>
                    )}
                  </motion.section>
                );
              })()}

              {/* 세계관 */}
              <section>
                <div className="flex items-end justify-between mb-4">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 tracking-wide">
                      <Sparkles size={18} className="text-purple-300" />
                      새로운 극 — 세계관 선택
                    </h2>
                    <p className="text-xs text-white/40 mt-0.5 tracking-wider">
                      당신이 감독이 되어 이야기를 만들어갑니다
                    </p>
                  </div>
                  <span className="text-[11px] text-white/35 tracking-widest uppercase">
                    {worlds.length}개 세계관
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {worlds.map((w, i) => (
                    <WorldCard
                      key={w.id}
                      world={w}
                      index={i}
                      onClick={() => setCreateFlowWorld(w)}
                    />
                  ))}
                </div>
                {worlds.length === 0 && (
                  <div className="text-center py-12 text-white/40 text-sm">
                    아직 사용 가능한 세계관이 없습니다.
                  </div>
                )}
              </section>

              {/* 하단 여백 */}
              <div className="h-8" />
            </div>
          )}
        </div>
      </div>

      {/* ═══ 생성 플로우 ═══ */}
      <AnimatePresence>
        {createFlowWorld && (
          <TheaterCreateFlow
            world={createFlowWorld}
            onClose={() => setCreateFlowWorld(null)}
            // [Phase III · B-4] 무료 유저 Step 4 업셀
            onOpenStore={() => {
              setStoreInitialTab("subscription");
              setShowStore(true);
            }}
          />
        )}
      </AnimatePresence>

      {/* ═══ Lucid Store ═══ */}
      <LucidStore
        isOpen={showStore}
        onClose={() => setShowStore(false)}
        initialTab={storeInitialTab}
        userInfo={userInfo}
        characters={[]}
        onPaymentComplete={() => {
          setShowStore(false);
          // [Polish · P0] 로컬 userInfo + AuthContext 동시 갱신.
          api.get("/users/me").then((r) => setUserInfo(r.data)).catch(() => {});
          if (refreshUser) {
            try { refreshUser(); } catch { /* noop */ }
          }
        }}
      />
    </div>
  );
}