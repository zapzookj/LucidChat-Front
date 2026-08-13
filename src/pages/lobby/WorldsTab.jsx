import { useState, useEffect, useMemo } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Users, Play, BookOpen, Drama } from "lucide-react";
import api from "../../api/axios";
import { fetchWorld as fetchTheaterWorld, fetchWorlds as fetchTheaterWorlds } from "../../api/TheaterLobbyApi";
import StoryCreateFlow from "../../components/story-v2/StoryCreateFlow";
import TheaterCreateFlow from "../../components/theater/TheaterCreateFlow";
import { sfx } from "../../utils/sfx";

/**
 * [블록 A] 세계관 탭 — 스토리·극장 진입 통합 (docs/14 §B: 극장 고아 입구 해소,
 * '새로운 만남 UGC 합류'의 편입처). 공식 월드 + 승인 UGC 월드가 한 매대에 선다.
 *
 * 데이터: GET /lobby/worlds(공식) + GET /lobby/worlds/ugc(내 월드+승인 UGC) +
 * GET /theater/lobby/worlds(극장 가능 월드 판정). 게스트도 전부 조회 가능(게스트 카드),
 * 시작 행동만 로그인 게이트.
 */
export default function WorldsTab() {
  const navigate = useNavigate();
  const { guest, requireLogin, enterRoom, openStore } = useOutletContext();

  const [worlds, setWorlds] = useState(null);
  const [ugcWorlds, setUgcWorlds] = useState([]);
  const [theaterWorldIds, setTheaterWorldIds] = useState(new Set());
  const [storyCreate, setStoryCreate] = useState(null);   // { worldId } | null
  const [theaterCreate, setTheaterCreate] = useState(null); // { world } | null

  useEffect(() => {
    api.get("/lobby/worlds")
      .then((r) => setWorlds(Array.isArray(r.data) ? r.data : []))
      .catch(() => setWorlds([]));
    api.get("/lobby/worlds/ugc")
      .then((r) => setUgcWorlds(Array.isArray(r.data) ? r.data : []))
      .catch(() => setUgcWorlds([]));
    fetchTheaterWorlds()
      .then((list) => setTheaterWorldIds(new Set((list || []).map((w) => w.id))))
      .catch(() => setTheaterWorldIds(new Set()));
  }, []);

  const guardGuest = (world) => {
    requireLogin({
      action: { type: "route", path: "/worlds" },
      title: `${world.displayName || world.name}의 문턱에서`,
      message: "이 세계관의 이야기를 시작하려면 로그인이 필요해요.",
    });
  };

  const handleStartStory = (world) => {
    if (guest) return guardGuest(world);
    sfx.chime?.();
    setStoryCreate({ worldId: world.worldId });
  };

  const handleContinueStory = (roomId) => {
    localStorage.setItem("roomId", roomId);
    enterRoom(`/v2/chat/${roomId}`);
  };

  const handleStartTheater = async (world) => {
    if (guest) return guardGuest(world);
    try {
      const detail = await fetchTheaterWorld(world.worldId);
      sfx.chime?.();
      setTheaterCreate({ world: detail });
    } catch (e) {
      console.error("[WorldsTab] theater world fetch failed", e);
      alert("극장 정보를 불러오지 못했습니다.");
    }
  };

  const officialCards = worlds ?? [];
  // 내 월드(회원 combined 응답의 앞부분)와 타인 승인 월드를 한 섹션에 — 서버가 이미 정렬
  const ugcCards = useMemo(() => ugcWorlds, [ugcWorlds]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8">
      <div className="mt-2 mb-4">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <Sparkles size={18} className="text-amber-300" />
          세계관
          <span className="text-xs font-medium text-white/30 tracking-[0.2em] uppercase ml-1">Worlds</span>
        </h1>
        <p className="text-xs text-white/35 mt-1">스토리와 극장, 모든 이야기의 무대가 여기 있어요.</p>
      </div>

      {worlds === null && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-white/[0.03] border border-white/5 h-64 animate-pulse" />
          ))}
        </div>
      )}

      {/* [리뷰 P2] 공식·UGC 모두 비었을 때(빈 목록 또는 fetch 실패) 죽은 화면 방지 */}
      {worlds !== null && officialCards.length === 0 && ugcCards.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-white/35">
          <Sparkles size={30} className="mb-3 opacity-40" />
          <p className="text-sm">아직 열린 세계관이 없어요</p>
          <button
            onClick={() => navigate("/")}
            className="mt-3 px-4 py-2 rounded-full text-xs font-bold text-slate-900 bg-gradient-to-r from-violet-300 to-sky-300 hover:from-violet-200 hover:to-sky-200 transition-colors"
          >
            정거장에서 인연 만나기
          </button>
        </div>
      )}

      {worlds !== null && officialCards.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {officialCards.map((w) => (
            <WorldCard
              key={w.worldId}
              world={w}
              theaterAvailable={theaterWorldIds.has(w.worldId)}
              onStartStory={() => handleStartStory(w)}
              onContinueStory={handleContinueStory}
              onStartTheater={() => handleStartTheater(w)}
            />
          ))}
        </div>
      )}

      {ugcCards.length > 0 && (
        <>
          <h2 className="text-sm font-bold tracking-[0.12em] text-violet-200/80 flex items-center gap-2 mt-8 mb-3">
            <Sparkles size={14} className="text-sky-300" />
            여행자들의 세계관
            <span className="text-[10px] font-bold px-1.5 py-[1px] rounded-full bg-purple-400/15 text-purple-200 border border-purple-300/40">UGC</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ugcCards.map((w) => (
              <WorldCard
                key={w.worldId}
                world={w}
                theaterAvailable={false}
                onStartStory={() => handleStartStory(w)}
                onContinueStory={handleContinueStory}
              />
            ))}
          </div>
        </>
      )}

      {/* ── 생성 플로우 오버레이 ── */}
      <AnimatePresence>
        {storyCreate && (
          <StoryCreateFlow
            worldId={storyCreate.worldId}
            presetHeroineIds={null}
            onCancel={() => setStoryCreate(null)}
            onComplete={(roomId) => {
              setStoryCreate(null);
              localStorage.setItem("roomId", roomId);
              navigate(`/v2/chat/${roomId}`);
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {theaterCreate && (
          <TheaterCreateFlow
            world={theaterCreate.world}
            initialHeroineIds={[]}
            skipHeroineSelection={false}
            onClose={() => setTheaterCreate(null)}
            onOpenStore={() => openStore("subscription")}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── 월드 카드 — 스토리·극장 진입 통합 ──
function WorldCard({ world: w, theaterAvailable, onStartStory, onContinueStory, onStartTheater }) {
  const hasExisting = Boolean(w.hasExistingRoom); // 게스트 카드엔 필드 자체가 없음 → false
  const heroImage = w.heroImageUrl || w.thumbnailUrl;
  const isUgc = typeof w.worldId === "string" && w.worldId.startsWith("UGCW_");

  return (
    <motion.div
      className="rounded-2xl overflow-hidden border border-white/10 bg-[#12121f]/90 hover:border-violet-300/35 transition-colors duration-200"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
    >
      <div className="relative h-40 bg-gradient-to-br from-slate-800 to-slate-900 overflow-hidden">
        {heroImage ? (
          <img src={heroImage} alt="" className="w-full h-full object-cover" draggable={false} loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Sparkles size={30} className="text-white/15" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#12121f] via-transparent to-transparent" />
        <div className="absolute bottom-2.5 left-4 right-4 flex items-center gap-2">
          <h2 className="text-lg font-bold text-white drop-shadow">{w.displayName}</h2>
          {isUgc && (
            <span className="text-[9px] font-bold px-1.5 py-[1px] rounded-full bg-purple-400/20 text-purple-100 border border-purple-300/40">UGC</span>
          )}
        </div>
      </div>

      <div className="px-4 pt-2.5 pb-4">
        {w.tagline && <p className="text-[12.5px] text-white/50 italic">{w.tagline}</p>}
        <div className="flex items-center gap-3 mt-2.5 text-[11px] text-white/35">
          <span className="flex items-center gap-1"><Users size={12} /> 인연 {w.heroineCount}명</span>
          {w.moodKeywords && <span className="truncate">{w.moodKeywords}</span>}
        </div>

        <div className="mt-4 flex gap-2">
          {hasExisting ? (
            <>
              <button
                onClick={() => onContinueStory(w.existingRoomId)}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-slate-900 bg-gradient-to-r from-amber-300 to-amber-200 hover:from-amber-200 hover:to-amber-100 transition-colors flex items-center justify-center gap-1.5"
              >
                <Play size={14} fill="currentColor" /> 이어하기
              </button>
              <button
                onClick={onStartStory}
                className="px-3.5 py-2.5 rounded-xl text-[12px] font-medium text-white/60 bg-white/[0.05] border border-white/10 hover:bg-white/[0.1] transition-colors"
                title="새로 시작 (기존 진행 사라짐)"
              >
                새로 시작
              </button>
            </>
          ) : (
            <button
              onClick={onStartStory}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-slate-900 bg-gradient-to-r from-amber-300 to-amber-200 hover:from-amber-200 hover:to-amber-100 transition-colors flex items-center justify-center gap-1.5"
            >
              <BookOpen size={14} /> 스토리 시작
            </button>
          )}
          {theaterAvailable && (
            <button
              onClick={onStartTheater}
              className="px-3.5 py-2.5 rounded-xl text-[12px] font-bold text-violet-100 bg-violet-500/20 border border-violet-300/35 hover:bg-violet-500/30 transition-colors flex items-center gap-1.5"
            >
              <Drama size={14} /> 극장
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
