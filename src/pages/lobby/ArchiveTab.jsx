import { useState, useEffect, useMemo } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import api from "../../api/axios";
import { fetchMyTheaterSessions } from "../../api/TheaterLobbyApi";
import AchievementGallery from "../../components/AchievementGallery";
import IllustrationGalleryPage from "../IllustrationGalleryPage";
import PersonaManager from "../../components/persona/PersonaManager";
import { assetUrl } from "../../utils/assetUrl";
import { formatRelativeTime } from "./lobbyShared";
import {
  LobbyContainer, PageHead, ModeBadge, fallbackGrad,
  SkeletonRow, EmptyState, ErrorState, RATE_LIMIT_MSG,
} from "./lobbyUi";

/**
 * [블록 A R2] 보관함 탭 — 인탭 세그먼트 단일 체계 (디자인 정본: aichat
 * docs/15_assets/lobby_redesign_mockup.html '보관함' 화면 · 설계 문서 §5 확정).
 *
 * 구 R1의 3종 혼재 표현(페르소나 모달·업적 드로어·일러스트 풀스크린)을 전부 걷어내고
 * 대화 기록 / 페르소나 / 업적 / 일러스트 4세그가 같은 자리에서 전환된다.
 *  - /archive?tab=talk|persona|ach|illust 동기화 — 뒤로가기로 세그 복원
 *  - 대화 기록: Dialogue(/lobby/rooms) + Theater(fetchMyTheaterSessions) 병합,
 *    lastActiveAt 내림차순. 극장 아카이브는 팬 하단 조용한 링크로 병합.
 *  - 페르소나/업적/일러스트: 각 컴포넌트 embedded 모드(크롬 제거)로 데이터 배선 계승
 *  - 상태(로딩/빈/오류)는 정본 '상태' 화면 매트릭스 — 오류는 세그 영역만 교체 + 재시도
 *
 * 게스트는 셸에서 탭 클릭 시점에 로그인 시트로 차단된다(화면 진입 없음).
 */

const SEGMENTS = [
  { key: "talk",    label: "대화 기록" },
  { key: "persona", label: "페르소나" },
  { key: "ach",     label: "업적" },
  { key: "illust",  label: "일러스트" },
];
const SEG_KEYS = new Set(SEGMENTS.map((s) => s.key));

export default function ArchiveTab() {
  const navigate = useNavigate();
  const { enterRoom } = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();

  const rawTab = searchParams.get("tab");
  const tab = SEG_KEYS.has(rawTab) ? rawTab : "talk";

  return (
    <LobbyContainer>
      <PageHead
        title="보관함"
        desc="나눈 대화와 수집한 순간들, 내 페르소나까지 한곳에 모았어요."
      />

      {/* ── 세그먼트 컨트롤 (알약형 — 목업 .seg) ── */}
      <div
        role="tablist"
        aria-label="보관함 분류"
        className="flex gap-1 mt-6 p-1 rounded-full bg-white/[0.035] border border-white/[0.09] w-full sm:w-fit"
      >
        {SEGMENTS.map((s) => {
          const on = tab === s.key;
          return (
            <button
              key={s.key}
              role="tab"
              id={`archive-tab-${s.key}`}
              aria-selected={on}
              aria-controls={`archive-pane-${s.key}`}
              onClick={() => { if (tab !== s.key) setSearchParams({ tab: s.key }); }}
              className={`flex-1 sm:flex-none px-0 sm:px-5 py-2 rounded-full text-lb-meta font-semibold transition-colors duration-150 ${
                on ? "bg-violet-400/[0.16] text-white" : "text-lobby-tx1 hover:text-white"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* ── 세그먼트 팬 — 활성 세그만 마운트 (전환 페이드는 셸 담당, 추가 모션 금지) ── */}
      <div
        role="tabpanel"
        id={`archive-pane-${tab}`}
        aria-labelledby={`archive-tab-${tab}`}
        className="mt-6"
      >
        {tab === "talk" && <TalkPane navigate={navigate} enterRoom={enterRoom} />}
        {tab === "persona" && <PersonaManager embedded />}
        {tab === "ach" && <AchievementGallery embedded userScope />}
        {tab === "illust" && <IllustrationGalleryPage embedded />}
      </div>
    </LobbyContainer>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  대화 기록 팬 — Dialogue + Theater 병합 리스트 (목업 .rrow)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function TalkPane({ navigate, enterRoom }) {
  const [status, setStatus] = useState("loading"); // loading | ready | error | rate(429)
  const [rooms, setRooms] = useState([]);
  const [theaterSessions, setTheaterSessions] = useState([]);
  const [reloadKey, setReloadKey] = useState(0); // 재시도 트리거 (이펙트 내 동기 setState 회피)

  useEffect(() => {
    let alive = true;
    (async () => {
      const [r, t] = await Promise.allSettled([
        api.get("/lobby/rooms").then((res) => res.data),
        fetchMyTheaterSessions(),
      ]);
      if (!alive) return;
      // 부분 실패 허용 — 양쪽 다 실패했을 때만 세그 영역 오류(정본 상태 매트릭스)
      if (r.status === "rejected" && t.status === "rejected") {
        const rate = [r.reason, t.reason].some((e) => e?.response?.status === 429);
        setStatus(rate ? "rate" : "error");
        return;
      }
      setRooms(r.status === "fulfilled" ? r.value || [] : []);
      setTheaterSessions(t.status === "fulfilled" ? t.value || [] : []);
      setStatus("ready");
    })();
    return () => { alive = false; };
  }, [reloadKey]);

  const retry = () => {
    setStatus("loading");
    setReloadKey((k) => k + 1);
  };

  const entries = useMemo(() => {
    const all = [
      ...(rooms || []).map((r) => ({ ...r, type: "DIALOGUE" })),
      ...(theaterSessions || []).map((s) => ({ ...s, type: "THEATER" })),
    ];
    all.sort((a, b) => new Date(b.lastActiveAt || 0) - new Date(a.lastActiveAt || 0));
    return all;
  }, [rooms, theaterSessions]);

  const handleOpen = (entry) => {
    if (entry.type === "THEATER") return enterRoom(`/theater/${entry.roomId}`);
    localStorage.setItem("roomId", entry.roomId);
    enterRoom(entry.chatMode === "STORY" ? `/v2/chat/${entry.roomId}` : `/chat/${entry.roomId}`);
  };

  if (status === "loading") {
    return (
      <div>
        {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
      </div>
    );
  }

  if (status === "error" || status === "rate") {
    return <ErrorState message={status === "rate" ? RATE_LIMIT_MSG : undefined} onRetry={retry} />;
  }

  // 극장 아카이브 — 조용한 링크(대화 기록에 병합된 극장의 지난 관람 입구)
  const theaterArchiveLink = (
    <div className="mt-1 flex justify-end">
      <button
        onClick={() => navigate("/theater/archive")}
        className="py-1 text-lb-meta text-lobby-tx2 hover:text-violet-300 transition-colors"
      >
        극장 아카이브 ›
      </button>
    </div>
  );

  if (entries.length === 0) {
    return (
      <div>
        <EmptyState
          title="아직 나눈 대화가 없어요"
          desc="첫 이야기를 시작하면 여기에 기록돼요"
          ctaLabel="캐릭터 만나러 가기"
          onCta={() => navigate("/")}
        />
        {theaterArchiveLink}
      </div>
    );
  }

  return (
    <div>
      {entries.map((entry) => (
        <TalkRow
          key={`${entry.type}-${entry.roomId}`}
          entry={entry}
          onOpen={() => handleOpen(entry)}
        />
      ))}
      {theaterArchiveLink}
    </div>
  );
}

/** 대화 기록 행 — 44px 원형 썸네일 + 이름·모드 배지 + 보조 줄 + 상대시간 */
function TalkRow({ entry, onOpen }) {
  const theater = entry.type === "THEATER";
  const story = !theater && entry.chatMode === "STORY";

  const name = theater
    ? (entry.worldDisplayName || "극장 세션")
    : (entry.characterName || "캐릭터");

  const thumbUrl = theater
    ? entry.leadHeroineThumbnailUrl ||
      (entry.leadHeroineSlug ? assetUrl(`/characters/${entry.leadHeroineSlug}/thumb.jpg`) : null)
    : entry.characterThumbnailUrl || null;

  const mode = theater ? "THEATER" : story ? "STORY" : "SANDBOX";

  // 배지 서픽스 — 목업: "스토리 · 2장" / "극장 · 관람 중" (응답에 있을 때만)
  const suffix = theater
    ? (entry.endingReached ? undefined : "관람 중")
    : story && entry.currentChapter
      ? `${entry.currentChapter}장`
      : undefined;

  // 보조 줄 — 스토리/극장은 진행 정보, 자유는 관계 태그(있으면)
  let sub = null;
  if (theater) {
    sub = entry.endingReached
      ? (entry.endingTitle || "엔딩에 도달했어요")
      : [
          `${entry.currentAct ?? 1}막 ${entry.currentChapter ?? 1}장 진행 중`,
          entry.leadHeroineName,
        ].filter(Boolean).join(" · ");
  } else if (story) {
    sub = entry.endingReached
      ? (entry.endingTitle || "엔딩에 도달했어요")
      : entry.currentChapter
        ? `${entry.currentChapter}장 진행 중`
        : entry.dynamicRelationTag || null;
  } else {
    sub = entry.dynamicRelationTag || null;
  }

  return (
    <button
      onClick={onOpen}
      className="w-full flex items-center gap-4 px-[18px] py-3.5 mb-3 rounded-2xl text-left bg-white/[0.035] border border-white/[0.09] hover:border-violet-400/45 hover:bg-white/[0.06] transition-colors duration-150"
    >
      {/* 그라데이션을 항상 뒤에 깔아 이미지 404 시 폴백으로 강등 */}
      <span className={`relative w-11 h-11 rounded-full overflow-hidden flex-none flex items-center justify-center ${fallbackGrad(name)}`}>
        <span className="absolute inset-0 flex items-center justify-center text-[15px] font-bold text-white/85">{name?.[0] ?? ""}</span>
        {thumbUrl && (
          <img
            src={thumbUrl} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false}
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        )}
      </span>
      <span className="block flex-1 min-w-0">
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-lb-card font-bold text-white truncate">{name}</span>
          <span className="flex-none"><ModeBadge mode={mode} suffix={suffix} /></span>
        </span>
        {sub && (
          <span className="block text-lb-meta text-lobby-tx1 truncate mt-0.5">{sub}</span>
        )}
      </span>
      <span className="text-lb-meta text-lobby-tx2 flex-none">
        {formatRelativeTime(entry.lastActiveAt)}
      </span>
    </button>
  );
}
