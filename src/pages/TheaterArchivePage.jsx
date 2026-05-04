import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Drama, Clock, Crown, Heart, Play, BookOpen,
  Loader2, Archive, Trophy,
} from "lucide-react";
import {
  fetchArchivedTheaterSessions,
  resumeArchivedSession,
} from "../api/TheaterLobbyApi";

/**
 * [Phase 5.5 UX Polish · R4] TheaterArchivePage
 *
 * 모델 C-2의 아카이브 진입점.
 * 표시 대상:
 *  - ARCHIVED: 새 극 시작으로 중단된 극 (resume 가능)
 *  - ENDED:    엔딩 도달한 완결 극 (감상만 가능)
 *
 * UX:
 *  - 두 섹션을 명확히 분리: "이어서 진행할 수 있는 극" vs "감상한 작품"
 *  - ARCHIVED 카드: "이어서" CTA → POST /resume → /theater/:roomId 이동
 *  - ENDED 카드:    "엔딩 다시 보기" CTA → /theater/:roomId/ending 이동
 *  - 자동으로 활성극이 있다면 resume 시 자동 archive (모델 C-2 보장은 백엔드)
 *  - 시각: violet+amber 시네마틱 톤, BookOpen 아이콘
 */

const formatRel = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const dy = Math.floor(h / 24);
  if (dy < 30) return `${dy}일 전`;
  const mo = Math.floor(dy / 30);
  return `${mo}개월 전`;
};

export default function TheaterArchivePage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resumingId, setResumingId] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await fetchArchivedTheaterSessions();
        if (!alive) return;
        setSessions(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!alive) return;
        console.error("[Archive] fetch failed:", e);
        setError("아카이브를 불러오지 못했습니다.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // ARCHIVED / ENDED 분리
  const { archived, ended } = useMemo(() => {
    const a = [], e = [];
    for (const s of sessions) {
      if (s.sessionStatus === "ENDED") e.push(s);
      else a.push(s);
    }
    return { archived: a, ended: e };
  }, [sessions]);

  const handleResume = async (roomId) => {
    if (resumingId) return;
    setResumingId(roomId);
    try {
      const room = await resumeArchivedSession(roomId);
      navigate(`/theater/${room.roomId}`);
    } catch (e) {
      console.error("[Archive] resume failed:", e);
      alert(e?.response?.data?.message || "이어서 진행할 수 없습니다.");
      setResumingId(null);
    }
  };

  const handleViewEnding = (roomId) => {
    navigate(`/theater/${roomId}/ending`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* 시네마틱 글로우 배경 */}
      <div
        className="fixed inset-0 pointer-events-none opacity-40"
        style={{
          background:
            "radial-gradient(circle at 30% 20%, rgba(167,139,250,0.10), transparent 50%), radial-gradient(circle at 70% 80%, rgba(251,191,36,0.06), transparent 50%)",
        }}
      />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* ═══ 헤더 ═══ */}
        <header className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate("/theater")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white/70 hover:text-white text-xs transition-colors"
          >
            <ArrowLeft size={13} />
            로비로
          </button>
          <div className="flex items-center gap-2">
            <Archive size={16} className="text-violet-300/85" />
            <h1 className="text-base sm:text-lg font-bold text-white tracking-wide">
              아카이브
            </h1>
          </div>
          <div className="w-[88px]" />
        </header>

        {/* ═══ 본문 ═══ */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-violet-300/55" />
            <p className="text-white/40 text-sm mt-3">아카이브 불러오는 중...</p>
          </div>
        )}

        {error && !loading && (
          <div className="text-center py-16">
            <p className="text-rose-300/80">{error}</p>
          </div>
        )}

        {!loading && !error && sessions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <BookOpen size={36} className="text-white/15 mb-4" />
            <p className="text-white/45 text-base font-bold mb-2">
              아직 아카이브된 극이 없습니다
            </p>
            <p className="text-white/30 text-xs leading-relaxed max-w-[320px]">
              새 극을 시작하면 진행 중이던 극이 이곳에 보관됩니다.
              <br />
              엔딩에 도달한 극도 영구적으로 이곳에 모입니다.
            </p>
            <button
              onClick={() => navigate("/theater")}
              className="mt-6 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-violet-500/20 border border-violet-300/35 text-violet-100 text-xs font-bold hover:bg-violet-500/30 transition-colors"
            >
              <Drama size={12} />
              새 극 시작하기
            </button>
          </div>
        )}

        {!loading && !error && sessions.length > 0 && (
          <>
            {/* ═══ ARCHIVED 섹션 ═══ */}
            {archived.length > 0 && (
              <section className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                  <Clock size={14} className="text-amber-300/85" />
                  <h2 className="text-sm font-bold text-white tracking-wide">
                    이어서 진행할 수 있는 극
                  </h2>
                  <span className="text-[11px] text-white/30 font-mono">
                    {archived.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {archived.map((s) => (
                    <ArchiveCard
                      key={s.roomId}
                      session={s}
                      kind="ARCHIVED"
                      busy={resumingId === s.roomId}
                      onAction={() => handleResume(s.roomId)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* ═══ ENDED 섹션 ═══ */}
            {ended.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Trophy size={14} className="text-emerald-300/85" />
                  <h2 className="text-sm font-bold text-white tracking-wide">
                    감상한 작품
                  </h2>
                  <span className="text-[11px] text-white/30 font-mono">
                    {ended.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {ended.map((s) => (
                    <ArchiveCard
                      key={s.roomId}
                      session={s}
                      kind="ENDED"
                      busy={false}
                      onAction={() => handleViewEnding(s.roomId)}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  카드
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ArchiveCard({ session, kind, busy, onAction }) {
  const isEnded = kind === "ENDED";
  const accent = isEnded
    ? "from-emerald-500/15 via-cyan-500/8 to-transparent"
    : "from-amber-500/12 via-violet-500/8 to-transparent";
  const borderColor = isEnded
    ? "border-emerald-300/25 hover:border-emerald-300/45"
    : "border-amber-300/25 hover:border-amber-300/45";
  const ctaClass = isEnded
    ? "bg-emerald-500/85 hover:bg-emerald-400 shadow-emerald-500/20"
    : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-amber-500/25";

  const heroineThumb = session.leadHeroineThumbnailUrl;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      className={`relative rounded-2xl bg-slate-900/80 backdrop-blur-md border ${borderColor} transition-colors overflow-hidden`}
    >
      {/* 카드 배경 그라디언트 */}
      <div className={`absolute inset-0 bg-gradient-to-br ${accent} pointer-events-none`} />

      <div className="relative p-4">
        {/* 상단: 히로인 썸네일 + 상태 배지 */}
        <div className="flex items-start gap-3 mb-3">
          {heroineThumb ? (
            <div
              className="w-14 h-14 rounded-xl bg-cover bg-center bg-slate-800 border border-white/10 flex-shrink-0"
              style={{ backgroundImage: `url(${heroineThumb})` }}
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
              <Drama size={22} className="text-white/30" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-bold ${
                  isEnded
                    ? "bg-emerald-500/15 border-emerald-300/30 text-emerald-200"
                    : "bg-amber-500/15 border-amber-300/30 text-amber-200"
                }`}
              >
                {isEnded ? (<><Trophy size={9} /> 완결</>) : (<><Clock size={9} /> 보관됨</>)}
              </span>
            </div>
            <h3 className="text-sm font-bold text-white leading-snug truncate">
              {session.leadHeroineName || "—"}
            </h3>
            <p className="text-[11px] text-white/45 truncate">
              {session.worldDisplayName}
            </p>
          </div>
        </div>

        {/* 진행도 / 엔딩 정보 */}
        <div className="space-y-1.5 mb-3">
          {isEnded && session.endingTitle ? (
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-100/85">
              <Trophy size={11} />
              <span className="font-bold truncate">{session.endingTitle}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] text-white/55">
              <span>Act {session.currentAct} · Ch {session.currentChapter}</span>
              <span className="text-white/25">·</span>
              <span>{session.totalSceneCount}씬</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-[11px] text-rose-200/75">
            <Heart size={11} fill="currentColor" />
            <span className="font-mono tabular-nums">{session.leadHeroineAffection}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-white/30">
            <Clock size={10} />
            <span>
              {isEnded ? "완결" : "보관"} · {formatRel(session.sessionStatusChangedAt || session.lastActiveAt)}
            </span>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={onAction}
          disabled={busy}
          className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-bold shadow-lg transition-colors disabled:opacity-50 ${ctaClass}`}
        >
          {busy ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              이어가는 중...
            </>
          ) : isEnded ? (
            <>
              <BookOpen size={12} />
              엔딩 다시 보기
            </>
          ) : (
            <>
              <Play size={12} />
              이어서 진행
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}