import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import api from "../../api/axios";
import { fetchMyTheaterSessions, fetchWorlds as fetchTheaterWorlds } from "../../api/TheaterLobbyApi";
import CharacterProfileView from "../../components/CharacterProfileView";
import LobbyFeature from "../../components/lobby/LobbyFeature";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { sfx } from "../../utils/sfx";
import { josaWaGwa } from "../../utils/josa";
import { getPrefGender, hasAnsweredPref, sortByPreference } from "../../utils/preference";
import { formatRelativeTime } from "./lobbyShared";
import {
  LobbyContainer, SectionHead, CharacterCard, ModeBadge, fallbackGrad,
  SkeletonCard, SkeletonHero, ErrorState, RATE_LIMIT_MSG,
} from "./lobbyUi";

/**
 * [블록 A R2] 홈 탭 — 재설계 정본(aichat docs/15_assets/lobby_redesign_mockup.html '홈' 화면) 구현.
 *
 * 구성(위→아래): 인사말 → 히어로(이어하기/첫 만남 유도/게스트 안내) → 추천 그리드
 * → 새로 나온 창작 레일 → 스토리 세계관 프리뷰. 필터 칩은 전면 제거(설계 문서 §2 —
 * 섹션이 축을 대신한다: '추천'=개인화 정렬 / '새로 나온 창작'=UGC 매대).
 *
 * 개인화 v1: 멤버는 sortByPreference(선호 성별 우선 안정 정렬, 프론트 수행), 게스트·미응답은
 * 서버 큐레이션 순서 그대로 + 카피 분기(시스템이 하지 않는 일을 말하지 않는다).
 *
 * 상태 계약('상태' 화면 매트릭스): 히어로=배너 시머/오류 숨김 · 추천=카드형×10/섹션 단위
 * ErrorState(429 문구 분기)+재시도/빈이면 숨김 · 신작 레일=카드형×5/빈·오류 숨김 ·
 * 세계관 프리뷰=월드형×3/빈·오류 숨김. 부분 실패는 해당 섹션만 — 나머지 유지.
 *
 * 모션: 탭 enter 페이드는 셸 담당 — 내부 추가 페이드 금지. 사운드는 대화 시작 순간의
 * chime 1회만(호버/클릭 SFX 금지).
 */

const BTN_GRAD =
  "aurora-button-primary flex-none";

const RAIL_BTN =
  "aurora-icon-button disabled:opacity-35 disabled:cursor-default";

// 피드 그리드 — 데스크톱 auto-fill 190px(1200에서 5열), <768은 2열 계약(설계 문서 §3)
const FEED_GRID =
  "grid grid-cols-2 gap-x-3 gap-y-5 md:gap-5 md:grid-cols-[repeat(auto-fill,minmax(195px,1fr))]";
const WORLD_GRID = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4";

/** moodKeywords 첫 1개 — 배열/콤마 문자열 양쪽 방어 */
const firstMood = (w) => {
  const mk = w?.moodKeywords;
  if (Array.isArray(mk)) return mk[0] || null;
  if (typeof mk === "string" && mk.trim()) return mk.split(",")[0].trim();
  return null;
};

export default function HomeTab() {
  const navigate = useNavigate();
  const { guest, user, userInfo, requireLogin, enterRoom } = useOutletContext();
  const nickname = userInfo?.nickname ?? user?.nickname ?? "";
  const reduceMotion = useReducedMotion();

  // ── 데이터: 피드(추천+신작 레일 공용) / 월드 프리뷰 / 히어로(멤버 전용) ──
  const [feed, setFeed] = useState(null);           // null=로딩(오류 미발생 시), []=빈
  const [feedError, setFeedError] = useState(null); // null | "rate" | "network"
  const [worlds, setWorlds] = useState(null);       // null=로딩, []=빈·오류(섹션 숨김)
  const [hero, setHero] = useState({ status: "loading", room: null }); // loading|ready|error
  const [profileCharId, setProfileCharId] = useState(null);
  const [starting, setStarting] = useState(false);

  const fetchFeed = useCallback(() => {
    api.get("/lobby/feed")
      .then((r) => setFeed(
        (r.data.items || []).map((c) => ({ ...c, thumbnailUrl: c.thumbnailUrl || c.defaultImageUrl }))
      ))
      .catch((e) => setFeedError(e?.response?.status === 429 ? "rate" : "network"));
  }, []);
  useEffect(() => { fetchFeed(); }, [fetchFeed]);
  const retryFeed = () => {
    setFeed(null);
    setFeedError(null);
    fetchFeed();
  };

  useEffect(() => {
    api.get("/lobby/worlds")
      .then((r) => setWorlds(Array.isArray(r.data) ? r.data : []))
      .catch(() => setWorlds([])); // 매트릭스: 홈 프리뷰 오류=섹션 숨김
  }, []);

  // 극장 가능 월드 id 집합 — StoryTab과 동일 판정. 실패 시 빈 Set(배지 생략 무해)
  const [theaterWorldIds, setTheaterWorldIds] = useState(new Set());
  useEffect(() => {
    fetchTheaterWorlds()
      .then((list) => setTheaterWorldIds(new Set((list || []).map((w) => w.id))))
      .catch(() => setTheaterWorldIds(new Set()));
  }, []);

  // 히어로 — 멤버의 가장 최근 활동 1건 (Dialogue + Theater 병합)
  useEffect(() => {
    if (guest) return undefined;
    let cancelled = false;
    (async () => {
      const [roomsRes, theaterRes] = await Promise.allSettled([
        api.get("/lobby/rooms").then((r) => r.data),
        fetchMyTheaterSessions(),
      ]);
      if (cancelled) return;
      // 양쪽 다 실패 = 오류(섹션 숨김) — '기록 0'과 구분해 거짓 첫 만남 배너를 막는다
      if (roomsRes.status === "rejected" && theaterRes.status === "rejected") {
        setHero({ status: "error", room: null });
        return;
      }
      const rooms = roomsRes.status === "fulfilled" && Array.isArray(roomsRes.value) ? roomsRes.value : [];
      const theater = theaterRes.status === "fulfilled" && Array.isArray(theaterRes.value) ? theaterRes.value : [];
      const merged = [
        ...rooms.map((r) => ({ ...r, type: "DIALOGUE" })),
        ...theater.map((s) => ({ ...s, type: "THEATER" })),
      ].sort((a, b) => new Date(b.lastActiveAt || 0) - new Date(a.lastActiveAt || 0));
      setHero({ status: "ready", room: merged[0] || null });
    })();
    return () => { cancelled = true; };
  }, [guest]);

  // ── 파생: 추천(개인화 정렬) / 신작 레일(서버 최신순 그대로) ──
  const feedLoading = feed === null && !feedError;
  const recommended = useMemo(() => {
    if (!feed) return [];
    return guest ? feed : sortByPreference(feed, getPrefGender());
  }, [feed, guest]);
  const ugcItems = useMemo(() => (feed || []).filter((i) => i.ugc), [feed]);
  const featuredItems = useMemo(() => recommended.slice(0, 4), [recommended]);

  const answered = !guest && hasAnsweredPref();
  const recTitle = guest ? "지금 만나볼 수 있는 캐릭터" : "추천 캐릭터";
  const recSub = guest
    ? "처음이라면 여기서 시작해 보세요"
    : answered ? "취향에 맞춰 순서를 정했어요" : "마음이 가는 캐릭터를 만나보세요";

  // ── 신작 레일: 스크롤 위치 연동 페이드 + 화살표(끝단 비활성, 오버플로 없으면 숨김) ──
  const railRef = useRef(null);
  const [railUi, setRailUi] = useState({ overflow: false, atStart: true, atEnd: true });
  const syncRail = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const next = { overflow: max > 8, atStart: el.scrollLeft <= 8, atEnd: el.scrollLeft >= max - 8 };
    setRailUi((prev) =>
      prev.overflow === next.overflow && prev.atStart === next.atStart && prev.atEnd === next.atEnd
        ? prev : next
    );
  }, []);
  useEffect(() => {
    syncRail();
    window.addEventListener("resize", syncRail);
    return () => window.removeEventListener("resize", syncRail);
  }, [syncRail, ugcItems.length]);
  const scrollRail = (dir) => {
    const el = railRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: reduceMotion ? "auto" : "smooth" });
  };

  // ── 이어하기: THEATER → /theater, STORY → /v2/chat, 그 외 → /chat ──
  const handleContinue = () => {
    const room = hero.room;
    if (!room) return;
    if (room.type === "THEATER") return enterRoom(`/theater/${room.roomId}`);
    localStorage.setItem("roomId", room.roomId);
    enterRoom(room.chatMode === "STORY" ? `/v2/chat/${room.roomId}` : `/chat/${room.roomId}`);
  };

  // ── 프로필 CTA — 결정적 순간: 대화 시작 (SANDBOX 직행) ──
  const handleStartChat = async (characterId) => {
    const target = (feed || []).find((c) => String(c.characterId) === String(characterId));
    setProfileCharId(null);
    if (guest) {
      const j = target?.name ? josaWaGwa(target.name) : null;
      requireLogin({
        action: { type: "startChat", characterId, characterName: target?.name },
        title: j ? `${target.name}${j}의 첫 만남` : "이 캐릭터와의 첫 만남",
        message: "이 캐릭터와 대화하려면 로그인이 필요해요. 로그인하면 바로 대화가 시작돼요.",
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
    <LobbyContainer>
      {!guest && <div className="flex items-center justify-between gap-3 pt-7">
        <p className="min-w-0 truncate text-sm text-lobby-tx1">다시 만나서 반가워요{nickname && <>, <span className="text-lobby-accent">{nickname}</span>님</>}</p>
        <span className="hidden text-[10px] tracking-[.18em] text-lobby-tx2 sm:block">YOUR NEXT CHAPTER</span>
      </div>}
      {!guest && hero.status === "loading" && <SkeletonBanner />}
      {!guest && hero.status === "ready" && hero.room && <ContinueBanner room={hero.room} onContinue={handleContinue} />}
      <LobbyFeature items={featuredItems} onSelect={setProfileCharId} guest={guest} />
      {!guest && hero.status === "ready" && !hero.room && <div className="aurora-continue">
        <Sparkles size={24} className="flex-none text-lobby-accent" aria-hidden="true" />
        <div className="min-w-0 flex-1"><p className="text-base font-medium text-lobby-tx0">첫 대화, 누구와 시작할까요?</p><p className="mt-1 text-lb-meta text-lobby-tx1">취향을 고르면 어울리는 캐릭터를 추천해 드려요.</p></div>
        <button onClick={() => navigate("/first-meet", { state: { intent: true } })} className={BTN_GRAD}>첫 만남 시작하기<ArrowUpRight size={16} /></button>
      </div>}

      {/* ═══ 추천 — 빈 피드(방어)면 섹션 숨김 ═══ */}
      {!(feed !== null && feed.length === 0) && (
        <section className="mt-10 sm:mt-12" aria-busy={feedLoading}>
          <SectionHead title={recTitle} sub={recSub} />
          {feedLoading && (
            <div className={FEED_GRID}>
              {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          )}
          {feedError && (
            <ErrorState
              message={feedError === "rate" ? RATE_LIMIT_MSG : undefined}
              onRetry={retryFeed}
            />
          )}
          {feed !== null && recommended.length > 0 && (
            <div className={FEED_GRID}>
              {recommended.map((c) => (
                <CharacterCard key={c.characterId} item={c} onClick={() => setProfileCharId(c.characterId)} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ═══ 새로 나온 창작 캐릭터 — UGC 0이면 섹션 숨김, 오류도 숨김 ═══ */}
      {(feedLoading || ugcItems.length > 0) && (
        <section className="mt-12">
          <SectionHead
            title="새로 나온 창작 캐릭터"
            sub="유저들이 직접 만든 캐릭터들이에요"
            action={!feedLoading && railUi.overflow ? (
              <div className="flex gap-1.5">
                <button onClick={() => scrollRail(-1)} disabled={railUi.atStart} aria-label="이전" className={RAIL_BTN}>‹</button>
                <button onClick={() => scrollRail(1)} disabled={railUi.atEnd} aria-label="다음" className={RAIL_BTN}>›</button>
              </div>
            ) : null}
          />
          {feedLoading ? (
            <div className="flex gap-4 overflow-hidden pb-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="w-[164px] flex-none"><SkeletonCard /></div>
              ))}
            </div>
          ) : (
            <div className="relative">
              <div
                ref={railRef}
                onScroll={syncRail}
                className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {ugcItems.map((c) => (
                  <div key={c.characterId} className="w-[184px] sm:w-[208px] flex-none snap-start">
                    <CharacterCard item={c} onClick={() => setProfileCharId(c.characterId)} />
                  </div>
                ))}
              </div>
              <div
                className={`pointer-events-none absolute top-0 bottom-2 left-0 w-14 z-[2] bg-gradient-to-r from-lobby-bg to-transparent transition-opacity duration-200 ${
                  railUi.overflow && !railUi.atStart ? "opacity-100" : "opacity-0"
                }`}
              />
              <div
                className={`pointer-events-none absolute top-0 bottom-2 right-0 w-14 z-[2] bg-gradient-to-l from-lobby-bg to-transparent transition-opacity duration-200 ${
                  railUi.overflow && !railUi.atEnd ? "opacity-100" : "opacity-0"
                }`}
              />
            </div>
          )}
        </section>
      )}

      {/* ═══ 스토리 세계관 프리뷰 — 월드 0·오류면 섹션 숨김 ═══ */}
      {(worlds === null || worlds.length > 0) && (
        <section className="mt-12">
          <SectionHead
            title="스토리 세계관"
            sub="이야기에 직접 참여하거나, 극장에서 캐릭터들의 이야기를 지켜보세요"
            action={
              <button
                onClick={() => navigate("/story")}
                className="inline-flex min-h-11 flex-none items-center gap-1 text-xs text-lobby-tx1 hover:text-lobby-accent transition-colors whitespace-nowrap sm:text-sm"
              >
                전체 보기 <ArrowUpRight size={14} aria-hidden="true" />
              </button>
            }
          />
          <div className={WORLD_GRID}>
            {worlds === null
              ? Array.from({ length: 3 }).map((_, i) => <SkeletonHero key={i} />)
              : worlds.slice(0, 3).map((w) => (
                <WorldPreviewCard
                  key={w.worldId}
                  world={w}
                  theaterAvailable={theaterWorldIds.has(w.worldId)}
                  onClick={() => navigate("/story")}
                />
              ))}
          </div>
        </section>
      )}

      <footer className="aurora-lobby-footer"><span className="tracking-[.12em]">LUCID CHAT</span><span>당신만의 이야기가 시작되는 곳</span></footer>
      {/* ═══ 프로필 오버레이 → 대화 시작 ═══ */}
      <CharacterProfileView
        characterId={profileCharId}
        variant="card"
        open={Boolean(profileCharId)}
        onClose={() => setProfileCharId(null)}
        onStartChat={handleStartChat}
      />
    </LobbyContainer>
  );
}

// ── 이어하기 배너 — 정본 .banner (grad-soft · face · eyebrow/이름 · CTA) ──
function ContinueBanner({ room, onContinue }) {
  const isTheater = room.type === "THEATER";
  const name = isTheater ? (room.worldDisplayName || "극장") : room.characterName;
  const mode = isTheater ? "THEATER" : (room.chatMode === "STORY" ? "STORY" : "SANDBOX");
  const thumb = isTheater ? room.leadHeroineThumbnailUrl : room.characterThumbnailUrl;
  return (
    <div
      className="aurora-continue"
    >
      {/* 그라데이션을 항상 뒤에 깔아 이미지 404 시 폴백으로 강등 (AWS 정지 상태에서도 성립) */}
      <span
        className={`relative w-11 h-11 sm:w-14 sm:h-14 rounded-full overflow-hidden flex-none flex items-center justify-center text-lg sm:text-xl font-bold text-white/85 ${fallbackGrad(name)}`}
        aria-hidden
      >
        <span className="absolute inset-0 flex items-center justify-center">{name?.[0] ?? "·"}</span>
        {thumb && (
          <img
            src={thumb} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false}
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        )}
      </span>
      <span className="block flex-1 min-w-0">
        <span className="flex items-center gap-1.5 flex-wrap text-lb-meta text-lobby-tx1 mb-0.5">
          <span>이어서 대화하기</span>
          <span className="opacity-50" aria-hidden>·</span>
          <span>{formatRelativeTime(room.lastActiveAt)}</span>
          <span className="opacity-50" aria-hidden>·</span>
          <ModeBadge mode={mode} />
        </span>
        <span className="block text-lb-sec text-white truncate">{name}</span>
      </span>
      <button onClick={onContinue} className={BTN_GRAD}>이어하기<ArrowUpRight size={16} aria-hidden="true" /></button>
    </div>
  );
}

// ── 히어로 로딩 — 배너 골격 시머(매트릭스: 스피너 금지) ──
function SkeletonBanner() {
  return (
    <div className="mt-8 flex items-center gap-4 sm:gap-5 px-4 sm:px-6 py-3.5 sm:py-5 rounded-[20px] border border-white/[0.09]">
      <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-white/[0.07] animate-pulse flex-none" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-3 w-2/5 max-w-[180px] rounded bg-white/[0.07] animate-pulse" />
        <div className="h-4 w-1/4 max-w-[120px] rounded bg-white/[0.05] animate-pulse" />
      </div>
      <div className="h-9 w-24 rounded-full bg-white/[0.07] animate-pulse flex-none" />
    </div>
  );
}

// ── 월드 프리뷰 카드 — 정본 .wcard-s (16/8.5 히어로 + 스크림 + 태그라인 + 칩) ──
function WorldPreviewCard({ world: w, theaterAvailable, onClick }) {
  const heroImage = w.heroImageUrl || w.thumbnailUrl;
  const mood = firstMood(w);
  return (
    <button
      onClick={onClick}
      className="aurora-world-card"
    >
      <span className={`relative flex items-end p-3.5 aspect-[16/8.5] overflow-hidden ${fallbackGrad(w.displayName)}`}>
        {heroImage && (
          <img
            src={heroImage} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} loading="lazy"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        )}
        <span className="absolute inset-x-0 bottom-0 h-[70%] bg-gradient-to-b from-transparent to-black/55" />
        <span className="relative z-[1] max-w-full text-lb-card font-extrabold text-white truncate">{w.displayName}</span>
      </span>
      <span className="block px-3.5 pt-3 pb-3.5">
        {w.tagline && <span className="block text-lb-meta text-lobby-tx1 truncate">{w.tagline}</span>}
        <span className="flex items-center gap-1.5 mt-2 flex-wrap">
          {mood && (
            <span className="inline-flex items-center text-lb-badge text-lobby-tx2 px-2.5 py-[2.5px] rounded-full border border-white/[0.09]">{mood}</span>
          )}
          <span className="inline-flex items-center text-lb-badge text-lobby-tx2 px-2.5 py-[2.5px] rounded-full border border-white/[0.09]">
            캐릭터 {w.heroineCount}
          </span>
          {theaterAvailable && (
            <span className="inline-flex items-center text-lb-badge font-semibold px-2 py-0.5 rounded-full text-indigo-300 bg-indigo-400/[0.12]">극장 가능</span>
          )}
        </span>
      </span>
    </button>
  );
}
