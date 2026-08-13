import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, ChevronRight, Trophy, Images, UserRound, Archive } from "lucide-react";
import api from "../../api/axios";
import { fetchMyTheaterSessions } from "../../api/TheaterLobbyApi";
import AchievementGallery from "../../components/AchievementGallery";
import IllustrationGalleryPage from "../../pages/IllustrationGalleryPage";
import PersonaManager from "../../components/persona/PersonaManager";
import { DialogueRoomCard, TheaterSessionCard } from "./lobbyShared";

/**
 * [블록 A] 보관함 탭 — 기억의 끈 + 페르소나 + 수집품 통합 (docs/14 §B 확정).
 * 흩어져 있던 세 입구(비활성 메뉴·깨진 수집품·챗 속 갤러리)가 한 곳에 모인다.
 *
 * - 기억의 끈: Dialogue+Theater 세션 통합 리스트 + 극장 아카이브 최초 연결
 * - 페르소나: 카드 갤러리/빌더(PersonaManager) — 내용물은 블록 B(렌즈 5축)가 교체 예정
 * - 수집품: 업적(유저 스코프 신설 API — 구 방 스코프 의존 결함 해소) + 일러스트 갤러리
 */
export default function ArchiveTab() {
  const navigate = useNavigate();
  const { enterRoom } = useOutletContext();

  const [rooms, setRooms] = useState([]);
  const [theaterSessions, setTheaterSessions] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showIllustrations, setShowIllustrations] = useState(false);
  const [showPersona, setShowPersona] = useState(false);
  const [storeCharacters, setStoreCharacters] = useState([]);

  const load = useCallback(async () => {
    const [r, t] = await Promise.all([
      api.get("/lobby/rooms").then((res) => res.data).catch(() => []),
      fetchMyTheaterSessions().catch(() => []),
    ]);
    setRooms(r || []);
    setTheaterSessions(t || []);
    setLoaded(true);
  }, []);
  useEffect(() => { load(); }, [load]);

  const mergedRooms = useMemo(() => {
    const all = [
      ...(rooms || []).map((r) => ({ ...r, type: "DIALOGUE" })),
      ...(theaterSessions || []).map((s) => ({ ...s, type: "THEATER" })),
    ];
    all.sort((a, b) => new Date(b.lastActiveAt || 0) - new Date(a.lastActiveAt || 0));
    return all;
  }, [rooms, theaterSessions]);

  const handleContinue = (roomId, type, chatMode) => {
    if (type === "THEATER") return enterRoom(`/theater/${roomId}`);
    localStorage.setItem("roomId", roomId);
    enterRoom(chatMode === "STORY" ? `/v2/chat/${roomId}` : `/chat/${roomId}`);
  };

  // 일러 갤러리의 캐릭터 필터용 목록 (lazy)
  const openIllustrations = async () => {
    setShowIllustrations(true);
    if (storeCharacters.length === 0) {
      try { setStoreCharacters((await api.get("/lobby/characters")).data); } catch { /* 필터만 영향 */ }
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8">
      <div className="mt-2 mb-4">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <Archive size={18} className="text-violet-300" />
          보관함
          <span className="text-xs font-medium text-white/30 tracking-[0.2em] uppercase ml-1">Archive</span>
        </h1>
        <p className="text-xs text-white/35 mt-1">당신의 이야기와 기억이 쌓이는 곳이에요.</p>
      </div>

      {/* ── 페르소나 · 수집품 카드 행 ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-7">
        <SectionCard
          Icon={UserRound}
          tint="violet"
          title="페르소나"
          sub="이야기 속의 '나'를 매만져요"
          onClick={() => setShowPersona(true)}
        />
        <SectionCard
          Icon={Trophy}
          tint="amber"
          title="업적"
          sub="해금한 순간들의 우표 컬렉션"
          onClick={() => setShowAchievements(true)}
        />
        <SectionCard
          Icon={Images}
          tint="sky"
          title="일러스트"
          sub="함께한 장면들의 갤러리"
          onClick={openIllustrations}
        />
      </div>

      {/* ── 기억의 끈 ── */}
      <div className="flex items-end justify-between mb-3">
        <h2 className="text-sm font-bold tracking-[0.12em] text-violet-200/80 flex items-center gap-2">
          <Sparkles size={14} className="text-violet-300" />
          기억의 끈
          <span className="text-[10px] text-white/25 tracking-[0.2em] uppercase">Continue</span>
        </h2>
        <button
          onClick={() => navigate("/theater/archive")}
          className="flex items-center gap-0.5 text-[12px] text-white/40 hover:text-white/75 transition-colors"
        >
          극장 아카이브 <ChevronRight size={13} />
        </button>
      </div>

      {!loaded && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-white/[0.03] border border-white/5 h-20 animate-pulse" />
          ))}
        </div>
      )}

      {loaded && mergedRooms.length === 0 && (
        <div className="flex flex-col items-center justify-center py-14 text-white/30">
          <Sparkles size={32} className="mb-3 opacity-40" />
          <p className="text-sm">아직 시작한 이야기가 없어요</p>
          <button
            onClick={() => navigate("/")}
            className="mt-3 px-4 py-2 rounded-full text-xs font-bold text-slate-900 bg-gradient-to-r from-violet-300 to-sky-300 hover:from-violet-200 hover:to-sky-200 transition-colors"
          >
            정거장에서 인연 만나기
          </button>
        </div>
      )}

      {loaded && mergedRooms.length > 0 && (
        <div className="space-y-3 max-w-2xl">
          {mergedRooms.map((entry) =>
            entry.type === "THEATER" ? (
              <TheaterSessionCard
                key={`T-${entry.roomId}`}
                session={entry}
                onSelect={(id) => handleContinue(id, "THEATER")}
              />
            ) : (
              <DialogueRoomCard
                key={`D-${entry.roomId}`}
                room={entry}
                onSelect={(id, chatMode) => handleContinue(id, "DIALOGUE", chatMode)}
              />
            )
          )}
        </div>
      )}

      {/* ── 오버레이 ── */}
      <AnimatePresence>
        {showAchievements && (
          <motion.div
            className="fixed inset-y-0 right-0 w-full md:w-[440px] z-[70] bg-slate-950/97 backdrop-blur-xl border-l border-white/10 flex flex-col"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 280, damping: 30 }}
          >
            <AchievementGallery userScope onClose={() => setShowAchievements(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <IllustrationGalleryPage
        isOpen={showIllustrations}
        onClose={() => setShowIllustrations(false)}
        characters={storeCharacters}
      />

      <PersonaManager open={showPersona} onClose={() => setShowPersona(false)} />
    </div>
  );
}

const TINTS = {
  violet: "border-violet-300/25 hover:border-violet-300/50 text-violet-300 from-violet-400/10",
  amber:  "border-amber-300/25 hover:border-amber-300/50 text-amber-300 from-amber-400/10",
  sky:    "border-sky-300/25 hover:border-sky-300/50 text-sky-300 from-sky-400/10",
};

function SectionCard({ Icon, tint, title, sub, onClick }) {
  const cls = TINTS[tint] || TINTS.violet;
  return (
    <motion.button
      onClick={onClick}
      className={`relative rounded-2xl border bg-white/[0.03] px-4 py-4 text-left overflow-hidden transition-colors duration-200 ${cls}`}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.985 }}
    >
      <div className={`absolute inset-0 bg-gradient-to-br to-transparent opacity-60 ${cls.split(" ").pop()}`} />
      <div className="relative flex items-center gap-3">
        <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-black/25 border border-white/10">
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <div className="text-[14px] font-bold text-white">{title}</div>
          <div className="text-[11px] text-white/40 truncate">{sub}</div>
        </div>
        <ChevronRight size={15} className="ml-auto text-white/25" />
      </div>
    </motion.button>
  );
}
