import { useState, useEffect, useMemo } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Play, Sparkles, ChevronRight, Users } from "lucide-react";
import api from "../../api/axios";
import { fetchMyTheaterSessions } from "../../api/TheaterLobbyApi";
import CharacterProfileView from "../../components/CharacterProfileView";
import { DIFFICULTY_META } from "../../utils/difficultyMeta";
import { sfx } from "../../utils/sfx";
import { formatRelativeTime } from "./lobbyShared";

/**
 * [블록 A] 홈 탭(정거장) — 캐릭터가 곧 메뉴다.
 * 이어하기 배너 → 캐릭터 피드(공식+PUBLIC UGC, 배지) → 세계관 캐러셀 (A′ 확정 구조).
 * 피드 정렬: 공식 큐레이션 우선 + UGC 최신순 (2026-08-13 종원 확정 — 서버가 정렬).
 */

const FILTER_CHIPS = [
  { key: "all",  label: "전체" },
  { key: "official", label: "공식" },
  { key: "ugc",  label: "UGC" },
  { key: "male", label: "남캐" },
];

export default function HomeTab() {
  const navigate = useNavigate();
  const { guest, requireLogin, enterRoom } = useOutletContext();

  const [feed, setFeed] = useState(null);          // null=로딩, []=빈
  const [worlds, setWorlds] = useState([]);
  const [latestRoom, setLatestRoom] = useState(null);
  const [filter, setFilter] = useState("all");
  const [profileCharId, setProfileCharId] = useState(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    api.get("/lobby/feed")
      .then((r) => setFeed(r.data.items || []))
      .catch(() => setFeed([]));
    api.get("/lobby/worlds")
      .then((r) => setWorlds(Array.isArray(r.data) ? r.data : []))
      .catch(() => setWorlds([]));
  }, []);

  // 이어하기 배너 — 멤버의 가장 최근 활동 방 1개 (Dialogue + Theater 통합)
  useEffect(() => {
    if (guest) return;
    (async () => {
      try {
        const [rooms, theater] = await Promise.all([
          api.get("/lobby/rooms").then((r) => r.data).catch(() => []),
          fetchMyTheaterSessions().catch(() => []),
        ]);
        const merged = [
          ...(rooms || []).map((r) => ({ ...r, type: "DIALOGUE" })),
          ...(theater || []).map((s) => ({ ...s, type: "THEATER" })),
        ].sort((a, b) => new Date(b.lastActiveAt || 0) - new Date(a.lastActiveAt || 0));
        setLatestRoom(merged[0] || null);
      } catch { /* 배너만 생략 */ }
    })();
  }, [guest]);

  const filteredFeed = useMemo(() => {
    if (!feed) return null;
    switch (filter) {
      case "official": return feed.filter((c) => !c.ugc);
      case "ugc":      return feed.filter((c) => c.ugc);
      case "male":     return feed.filter((c) => c.gender === "MALE");
      default:         return feed;
    }
  }, [feed, filter]);

  const handleContinueBanner = () => {
    if (!latestRoom) return;
    if (latestRoom.type === "THEATER") return enterRoom(`/theater/${latestRoom.roomId}`);
    localStorage.setItem("roomId", latestRoom.roomId);
    enterRoom(latestRoom.chatMode === "STORY" ? `/v2/chat/${latestRoom.roomId}` : `/chat/${latestRoom.roomId}`);
  };

  // 프로필 CTA — 결정적 순간: 대화 시작 (SANDBOX 직행, 모드 선택 오버레이 소멸)
  const handleStartChat = async (characterId) => {
    const target = (feed || []).find((c) => String(c.characterId) === String(characterId));
    setProfileCharId(null);
    if (guest) {
      requireLogin({
        action: { type: "startChat", characterId, characterName: target?.name },
        title: target ? `${target.name}와의 첫 만남` : "이 인연과 대화하려면",
        message: "이 인연과 대화하려면 로그인이 필요해요. 로그인하면 바로 대화가 시작돼요.",
      });
      return;
    }
    if (starting) return;
    setStarting(true);
    try {
      const res = await api.post("/lobby/rooms", { characterId, chatMode: "SANDBOX" });
      localStorage.setItem("roomId", res.data.roomId);
      sfx.chime?.();
      enterRoom(`/chat/${res.data.roomId}`);
    } catch (e) {
      alert(e.response?.data?.message || "입장에 실패했습니다.");
      setStarting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8">
      {/* ── 이어하기 배너 ── */}
      {!guest && latestRoom && (
        <motion.button
          onClick={handleContinueBanner}
          className="relative w-full mt-2 mb-5 rounded-2xl overflow-hidden border border-violet-400/25 text-left group"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.005 }}
          whileTap={{ scale: 0.995 }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[#2a2347]/90 to-[#1c1c31]/80" />
          <div className="absolute inset-0 bg-[radial-gradient(60%_120%_at_90%_10%,rgba(147,130,255,0.18),transparent_60%)]" />
          <div className="relative flex items-center justify-between px-5 py-4">
            <div className="min-w-0">
              <div className="text-[11px] font-bold tracking-[0.15em] text-violet-300/90">꿈에서 이어서</div>
              <div className="text-[15px] font-bold text-white mt-0.5 truncate">
                {latestRoom.type === "THEATER"
                  ? `${latestRoom.worldDisplayName || "극장"} · Act ${latestRoom.currentAct ?? 1}`
                  : latestRoom.characterName}
                <span className="text-white/35 font-normal text-xs ml-2">{formatRelativeTime(latestRoom.lastActiveAt)}</span>
              </div>
            </div>
            <span className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-r from-violet-300 to-sky-300 text-slate-900 shadow-[0_2px_18px_rgba(147,130,255,0.4)] group-hover:scale-105 transition-transform">
              <Play size={16} className="ml-0.5" fill="currentColor" />
            </span>
          </div>
        </motion.button>
      )}

      {/* ── 캐릭터 피드 ── */}
      <div className="flex items-end justify-between mt-3 mb-3">
        <h2 className="text-sm font-bold tracking-[0.12em] text-violet-200/80 flex items-center gap-2">
          <Sparkles size={14} className="text-violet-300" />
          오늘 정거장에 온 인연들
        </h2>
        <div className="flex gap-1.5">
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.key}
              onClick={() => setFilter(chip.key)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors duration-200 ${
                filter === chip.key
                  ? "bg-violet-400/20 border-violet-300/40 text-violet-100"
                  : "bg-white/[0.03] border-white/10 text-white/40 hover:text-white/70"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {feed === null && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-white/[0.03] border border-white/5 h-56 animate-pulse" />
          ))}
        </div>
      )}

      {feed !== null && filteredFeed.length === 0 && (
        <div className="py-16 text-center text-white/30 text-sm">해당하는 인연이 아직 없어요.</div>
      )}

      {feed !== null && filteredFeed.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredFeed.map((c, i) => (
            <FeedCard key={c.characterId} character={c} index={i} onClick={() => setProfileCharId(c.characterId)} />
          ))}
        </div>
      )}

      {/* ── 세계관 캐러셀 ── */}
      {worlds.length > 0 && (
        <>
          <div className="flex items-end justify-between mt-8 mb-3">
            <h2 className="text-sm font-bold tracking-[0.12em] text-violet-200/80 flex items-center gap-2">
              <Sparkles size={14} className="text-sky-300" />
              세계관에서 시작하기
            </h2>
            <button
              onClick={() => navigate("/worlds")}
              className="flex items-center gap-0.5 text-[12px] text-white/40 hover:text-white/75 transition-colors"
            >
              스토리 · 극장 <ChevronRight size={13} />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-2 -mx-1 px-1">
            {worlds.map((w) => (
              <button
                key={w.worldId}
                onClick={() => navigate("/worlds")}
                className="flex-shrink-0 w-40 rounded-xl overflow-hidden border border-white/10 bg-white/[0.03] hover:border-violet-300/40 transition-colors text-left group"
              >
                <div className="h-20 bg-slate-800/80 overflow-hidden">
                  {w.thumbnailUrl && (
                    <img src={w.thumbnailUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" draggable={false} />
                  )}
                </div>
                <div className="px-3 py-2.5">
                  <div className="text-[12.5px] font-bold text-white truncate">{w.displayName}</div>
                  <div className="flex items-center gap-1 text-[10px] text-white/35 mt-0.5">
                    <Users size={10} /> 인연 {w.heroineCount}명
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── 프로필 오버레이 → 대화 시작 ── */}
      <CharacterProfileView
        characterId={profileCharId}
        variant="card"
        open={Boolean(profileCharId)}
        onClose={() => setProfileCharId(null)}
        onStartChat={handleStartChat}
      />
    </div>
  );
}

// ── 피드 카드 — 배지(난이도·UGC·남캐) 포함 ──
function FeedCard({ character: c, index, onClick }) {
  const diff = DIFFICULTY_META[c.difficulty];
  return (
    <motion.button
      onClick={onClick}
      className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#141422] text-left group hover:border-violet-300/40 transition-colors duration-200"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.035, 0.5), duration: 0.35 }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.985 }}
    >
      <div className="relative h-40 sm:h-44 bg-gradient-to-b from-indigo-900/50 to-slate-900 overflow-hidden">
        {(c.thumbnailUrl || c.defaultImageUrl) && (
          <img
            src={c.thumbnailUrl || c.defaultImageUrl}
            alt={c.name}
            className="w-full h-full object-cover object-top group-hover:scale-[1.04] transition-transform duration-500"
            draggable={false}
            loading="lazy"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#10101e] via-transparent to-transparent" />
      </div>
      <div className="px-3 pt-1.5 pb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[13.5px] font-bold text-white">{c.name}</span>
          {diff && (
            <span className={`text-[9px] font-bold px-1.5 py-[1px] rounded-full border ${diff.badgeCls}`}>{diff.label}</span>
          )}
          {c.ugc && (
            <span className="text-[9px] font-bold px-1.5 py-[1px] rounded-full bg-purple-400/15 text-purple-200 border border-purple-300/40">UGC</span>
          )}
          {c.gender === "MALE" && (
            <span className="text-[9px] font-bold px-1.5 py-[1px] rounded-full bg-sky-400/15 text-sky-200 border border-sky-300/40">남</span>
          )}
        </div>
        <p className="text-[11px] text-white/45 truncate mt-1">{c.tagline || "새로운 만남이 당신을 기다립니다"}</p>
        {c.ugc && c.creatorNickname && (
          <p className="text-[10px] text-white/25 truncate mt-0.5">by {c.creatorNickname}</p>
        )}
      </div>
    </motion.button>
  );
}
