import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ArrowUpRight, BookOpen, Theater, Users, ArrowRight } from "lucide-react";
import api from "../../api/axios";
import { fetchWorld as fetchTheaterWorld, fetchWorlds as fetchTheaterWorlds } from "../../api/TheaterLobbyApi";
import StoryCreateFlow from "../../components/story-v2/StoryCreateFlow";
import TheaterCreateFlow from "../../components/theater/TheaterCreateFlow";
import { sfx } from "../../utils/sfx";
import "../../styles/aurora-secondary.css";
import {
  LobbyContainer, PageHead, CreditTag, fallbackGrad, SkeletonHero, EmptyState, ErrorState, RATE_LIMIT_MSG,
} from "./lobbyUi";

/**
 * [블록 A R2] 스토리 탭 — 재설계 정본(aichat docs/15_assets/lobby_redesign_mockup.html 화면 2) 구현.
 *
 * <p>공식 월드(GET /lobby/worlds) + UGC 월드(GET /lobby/worlds/ugc)를 한 그리드에 합쳐 렌더.
 * 극장 가능 판정은 GET /theater/lobby/worlds 집합(공식 전용 — UGC 극장은 후속).
 * 카드의 두 행동 버튼이 각각 1줄 설명을 달고 나온다(추상 명사 선제시 금지 — 설계 문서 §4).
 *
 * <p>게스트 게이트: 탐색은 전부 렌더, 행동(이야기 시작·극장) 시점에만 requireLogin.
 * 게스트에게 진행 줄·'이어하기' 라벨은 절대 렌더하지 않음(항상 '이야기 시작하기').
 *
 * <p>상태(정본 매트릭스): 로딩 SkeletonHero×4 · 월드 0 EmptyState · 실패 전면 ErrorState+재시도.
 */
export default function StoryTab() {
  const navigate = useNavigate();
  const { guest, requireLogin, enterRoom, openStore } = useOutletContext();

  const [worlds, setWorlds] = useState(null);          // null=로딩, []=빈
  const [worldsError, setWorldsError] = useState(false); // false | true | "rate"(429)
  const [ugcWorlds, setUgcWorlds] = useState([]);
  const [theaterWorldIds, setTheaterWorldIds] = useState(new Set());
  const [storyCreate, setStoryCreate] = useState(null);     // { worldId } | null
  const [theaterCreate, setTheaterCreate] = useState(null); // { world } | null

  // 초기 상태(null/false)가 곧 로딩 상태 — 이펙트 본문에선 fetch만, 동기 setState 없음
  const fetchAll = useCallback(() => {
    api.get("/lobby/worlds")
      .then((r) => setWorlds(Array.isArray(r.data) ? r.data : []))
      .catch((e) => { setWorlds([]); setWorldsError(e?.response?.status === 429 ? "rate" : true); });
    // UGC·극장 목록 실패는 무해 강등 — 공식 목록만으로 화면 성립(게이트 off도 빈 배열)
    api.get("/lobby/worlds/ugc")
      .then((r) => setUgcWorlds(Array.isArray(r.data) ? r.data : []))
      .catch(() => setUgcWorlds([]));
    fetchTheaterWorlds()
      .then((list) => setTheaterWorldIds(new Set((list || []).map((w) => w.id))))
      .catch(() => setTheaterWorldIds(new Set()));
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const retry = () => {
    setWorlds(null);
    setWorldsError(false);
    fetchAll();
  };

  // 공식 + UGC 합쳐 한 매대에 — 서버가 각 목록을 이미 정렬
  const cards = useMemo(() => [...(worlds ?? []), ...ugcWorlds], [worlds, ugcWorlds]);
  const loading = worlds === null;

  const guardGuest = (title) => {
    requireLogin({
      action: { type: "route", path: "/story" },
      title,
      message: "로그인하면 나눈 이야기가 이어져요.",
    });
  };

  const handleStartStory = (world) => {
    if (guest) return guardGuest("이야기를 시작하려면 로그인이 필요해요");
    sfx.chime?.();
    setStoryCreate({ worldId: world.worldId });
  };

  const handleContinueStory = (roomId) => {
    localStorage.setItem("roomId", roomId);
    enterRoom(`/v2/chat/${roomId}`);
  };

  const handleStartTheater = async (world) => {
    if (guest) return guardGuest("극장을 관람하려면 로그인이 필요해요");
    try {
      const detail = await fetchTheaterWorld(world.worldId);
      sfx.chime?.();
      setTheaterCreate({ world: detail });
    } catch (e) {
      console.error("[StoryTab] theater world fetch failed", e);
      alert("극장 정보를 불러오지 못했습니다.");
    }
  };

  return (
    <LobbyContainer>
      <PageHead
        title="스토리"
        desc={(
          <>
            내가 주인공이 되는 이야기부터, 캐릭터들의 삶을 지켜보는 극장까지.
            <br className="hidden sm:block" /> 머물고 싶은 세계를 골라 보세요.
          </>
        )}
      />

      {/* ── 로딩 — 월드형 스켈레톤 ×4 (정본 매트릭스) ── */}
      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonHero key={i} />)}
        </div>
      )}

      {/* ── 실패 — 전면 에러 패턴 + 재시도 ── */}
      {!loading && worldsError && (
        <ErrorState message={worldsError === "rate" ? RATE_LIMIT_MSG : undefined} onRetry={retry} />
      )}

      {/* ── 월드 0 — 빈 상태 (정본 카피) ── */}
      {!loading && !worldsError && cards.length === 0 && (
        <EmptyState
          title="준비 중인 세계가 곧 열려요"
          desc="먼저 홈에서 캐릭터와 자유 대화를"
          ctaLabel="홈으로"
          onCta={() => navigate("/")}
        />
      )}

      {/* ── 월드 카드 그리드 — lg 2열 · 미만 1열 ── */}
      {!loading && !worldsError && cards.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          {cards.map((w) => (
            <WorldCard
              key={w.worldId}
              world={w}
              guest={guest}
              theaterAvailable={theaterWorldIds.has(w.worldId)}
              onStartStory={() => handleStartStory(w)}
              onContinueStory={() => handleContinueStory(w.existingRoomId)}
              onStartTheater={() => handleStartTheater(w)}
            />
          ))}
        </div>
      )}

      {/* ── 생성 플로우 오버레이 (기존 배선 계승) ── */}
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
            onOpenStore={() => openStore("pass")   /* [C-2.i 후속] LucidStore 탭 키는 energy|secret|pass — "subscription"은 빈 상점이 떴다 */}
          />
        )}
      </AnimatePresence>
    </LobbyContainer>
  );
}

// ── 대형 월드 카드 — 히어로 16:7 + 두 행동 버튼(각 1줄 설명) ──
export function WorldCard({ world: w, guest, theaterAvailable, onStartStory, onContinueStory, onStartTheater }) {
  // 게스트 스코프 응답엔 필드 자체가 없음(false) + 게스트 렌더 금지 이중 가드
  const continueMode = !guest && Boolean(w.hasExistingRoom);
  const heroImage = w.heroImageUrl || w.thumbnailUrl;
  const isUgc = typeof w.worldId === "string" && w.worldId.startsWith("UGCW_");
  // 이름 목록은 응답에 있을 때만 병기(현행 카드 DTO엔 없음 — 방어적 지원)
  const names = Array.isArray(w.heroineNames) && w.heroineNames.length > 0 ? w.heroineNames.join(" · ") : null;

  return (
    <article className="aurora-story-card rounded-[26px] overflow-hidden border border-white/[0.12] hover:border-lobby-accent/35 transition-colors duration-200 flex flex-col">
      {/* 히어로 16:7 — 이미지 or 폴백 그라데이션 + 하단 스크림 + 월드명 */}
      <div className={`relative aspect-[16/8] sm:aspect-[16/8.5] flex-none overflow-hidden ${fallbackGrad(w.displayName)}`}>
        {heroImage && (
          <img
            src={heroImage} alt="" className="aurora-story-photo absolute inset-0 w-full h-full object-cover transition-transform duration-700" draggable={false} loading="lazy"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        )}
        <div className="aurora-story-image absolute inset-0" />
        <span className="absolute top-4 left-5 px-2.5 py-1 rounded-full bg-[#142034]/60 backdrop-blur-sm border border-white/20 text-[10px] tracking-[0.14em] font-semibold text-white/90">{isUgc ? "CREATOR WORLD" : "LUCID ORIGINAL"}</span>
        <div className="absolute inset-x-0 bottom-0 px-5 sm:px-6 pb-5">
          <span className="block text-[11px] font-medium text-lobby-teal mb-1.5 tracking-wider">당신이 들어갈 세계</span>
          <h2 className="text-[26px] sm:text-[30px] leading-tight tracking-tight font-semibold text-white break-words">{w.displayName}</h2>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-5 pt-4 pb-5 sm:px-6 sm:pt-5 sm:pb-6">
        {/* 설명 2줄 clamp */}
        {w.description && (
          <p className="text-sm leading-[1.8] text-lobby-tx1 line-clamp-3">{w.description}</p>
        )}

        {/* 등장 캐릭터 줄 — 카운트 칩 + (있으면) 이름 나열 + UGC 크레딧 */}
        <div className="flex items-center flex-wrap gap-2 mt-4 min-w-0">
          <span className="flex-none inline-flex items-center gap-1.5 text-xs text-lobby-tx2">
            <Users size={13} /> 캐릭터 {w.heroineCount ?? 0}명
          </span>
          {names && <span className="text-lb-meta text-lobby-tx2 truncate">{names}</span>}
          {isUgc && w.creatorNickname && <CreditTag nickname={w.creatorNickname} className="ml-auto" />}
        </div>

        {/* 진행 줄 — 멤버 & 진행 방 있음일 때만 (게스트 렌더 금지) */}
        {continueMode && (
          <div className="flex items-center gap-2 mt-4 text-xs text-lobby-teal">
            <span className="w-1.5 h-1.5 rounded-full bg-lobby-teal flex-none" />
            진행 중 — 지난 장면에서 바로 이어져요
          </div>
        )}

        {/* 행동 버튼 행 — 하단 고정(mt-auto), 라벨 + 1줄 설명 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-auto pt-5">
          <button
            onClick={continueMode ? onContinueStory : onStartStory}
            className="aurora-secondary-primary rounded-2xl px-4 py-3.5 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-bold">
              <BookOpen size={15} className="shrink-0" />
              {continueMode ? "이야기 이어하기" : "이야기 시작하기"}
              <ArrowUpRight size={15} className="ml-auto shrink-0" />
            </span>
            <span className="block text-xs text-[#34364b] mt-1.5">주인공이 되어 직접 겪는 이야기</span>
          </button>
          {theaterAvailable ? (
            <button
              onClick={onStartTheater}
              className="rounded-2xl px-4 py-3.5 text-left border border-white/[0.12] bg-white/[0.025] hover:border-lobby-accent/30 hover:bg-white/[0.06] transition-colors duration-150"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-lobby-tx0"><Theater size={15} className="text-lobby-accent" />극장 관람<ArrowRight size={14} className="ml-auto text-lobby-tx2" /></span>
              <span className="block text-xs text-lobby-tx1 mt-1.5">캐릭터들의 이야기를 지켜봐요</span>
            </button>
          ) : (
            <div className="rounded-2xl px-4 py-3.5 border border-white/[0.06] bg-white/[0.015]">
              <span className="flex items-center gap-2 text-sm font-medium text-lobby-tx2"><Theater size={15} />극장 준비 중</span>
              <span className="block text-xs text-lobby-tx2 mt-1.5">이 세계는 이야기 모드로 만나요</span>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
