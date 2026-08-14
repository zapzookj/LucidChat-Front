import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  ArrowLeft, Wand2, Sparkles, Zap, User, Plus, MoreHorizontal,
  MessageCircle, Globe, Moon, Pencil, Compass, ChevronRight, AlertTriangle,
  Link2Off,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import {
  fetchMyUgcCharacters, fetchExploreCharacters,
  requestPublish, requestSecret, updateUgcTexts, updateUgcCharacterWorld,
} from "../api/StudioApi";
// [World Builder v1] 내 세계관 섹션 + 세계관 연결 셀렉터
import { fetchMyUgcWorlds, OFFICIAL_WORLDS } from "../api/WorldStudioApi";
import useUgcCreationJob from "../hooks/useUgcCreationJob";
import StudioCreateFlow from "../components/studio/StudioCreateFlow";
import UgcStatusBadge from "../components/studio/UgcStatusBadge";
// [World Builder v1.1] 세계관 상세/수정/장소 추가 시트
import WorldDetailSheet from "../components/studio/WorldDetailSheet";
// [Profile v2] 캐릭터 프로필 뷰 (탐색=card / 내 캐릭터=dossier)
import CharacterProfileView from "../components/CharacterProfileView";
import BottomSheet from "../components/mobile/BottomSheet";
import { sfx } from "../utils/sfx";
// [2026-08-05 난이도 배지 승격] 난이도 4색 단일 소스
import { DIFFICULTY_META, DIFFICULTY_ORDER, difficultyFilledStars } from "../utils/difficultyMeta";
// [블록 A R2] 셸 임베드 크롬 정합 — 로비 공용 페이지 헤드 재사용
import { PageHead } from "./lobby/lobbyUi";

/**
 * [Studio v1] StudioPage — UGC 캐릭터 생성 스튜디오
 *
 * TheaterPortalPage의 골격(전용 라우트 + 탑바 + 파티클 + 섹션 스크롤)을 따르되
 * 앰버/스톤 톤으로 분위기를 분리한다.
 *
 * 섹션:
 *   ① 진행 중인 소환 잡 카드 (activeJob 있으면 최상단)
 *   ② 내 캐릭터 그리드 (UgcStatusBadge + ⋯ 메뉴 BottomSheet)
 *   ③ "+ 새 캐릭터" 대형 카드 (에너지 20)
 *   ④ 탐색 피드 (커서 무한 스크롤 → SANDBOX 대화 시작)
 *
 * 라우트: /studio
 */

const CREATE_COST = 20;

// ── 앰버 틴트 반짝임 파티클 (LobbyPage TwinkleStar 패턴) ──
const AmberTwinkle = ({ style }) => (
  <motion.div
    className="absolute w-[2px] h-[2px] bg-amber-200/30 rounded-full pointer-events-none"
    style={style}
    animate={{ opacity: [0.15, 0.7, 0.15], scale: [0.8, 1.2, 0.8] }}
    transition={{ duration: Math.random() * 3 + 2, repeat: Infinity, delay: Math.random() * 5 }}
  />
);

// ── 진행 중 잡 카드 메타 ──
const JOB_STAGE_META = {
  CONCEPT_PROCESSING: { label: "컨셉 분석 중", pct: 8 },
  GACHA_WAIT: { label: "원화 선택 대기", pct: 30, wait: true },
  BASE_PROCESSING: { label: "스탠딩 후보 파생 중", pct: 45 },
  BASE_WAIT: { label: "스탠딩 선택 대기", pct: 55, wait: true },
  EMOTIONS_PROCESSING: { label: "감정 표정 생성 중", pct: 72 },
  REVIEW_WAIT: { label: "검수 대기", pct: 85, wait: true },
  POSTPROCESSING: { label: "마무리 작업 중", pct: 92 },
  BINDING: { label: "캐릭터 등록 중", pct: 96 },
  READY: { label: "완성! 확인해 주세요", pct: 100, wait: true },
  FAILED: { label: "생성 실패", pct: 100, failed: true },
  EXPIRED: { label: "작업 만료", pct: 100, failed: true },
};

function resolveJobStage(job) {
  if (!job) return null;
  if (job.status === "CONCEPT_PROCESSING" && job.currentStepHint === "GOLDEN_GENERATING") {
    return { label: "원화 소환 중", pct: 20 };
  }
  return JOB_STAGE_META[job.status] || { label: "진행 중", pct: 50 };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  진행 중 잡 카드
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const ActiveJobCard = ({ job, onClick }) => {
  const stage = resolveJobStage(job);
  if (!stage) return null;
  const isWait = Boolean(stage.wait);
  const isFailed = Boolean(stage.failed);

  return (
    <motion.button
      type="button"
      onClick={() => { sfx.click(); onClick(); }}
      onMouseEnter={() => sfx.hover()}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className={`relative w-full text-left rounded-2xl border p-5 backdrop-blur-sm transition-colors overflow-hidden ${
        isFailed
          ? "bg-rose-500/[0.05] border-rose-400/30 hover:border-rose-400/50"
          : isWait
          ? "bg-amber-500/[0.06] border-amber-400/40 hover:border-amber-300/60"
          : "bg-white/[0.04] border-white/10 hover:border-amber-400/30"
      }`}
    >
      {isWait && !isFailed && (
        <motion.div
          className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-amber-400/[0.06] to-transparent"
          animate={{ x: ["-100%", "100%"] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        />
      )}
      <div className="relative flex items-center gap-4">
        <div
          className={`w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center border ${
            isFailed
              ? "bg-rose-500/10 border-rose-400/30"
              : "bg-amber-500/10 border-amber-400/30"
          }`}
        >
          {isFailed ? (
            <AlertTriangle size={20} className="text-rose-300" />
          ) : (
            <motion.div
              animate={isWait ? { scale: [1, 1.1, 1] } : { rotate: 360 }}
              transition={
                isWait
                  ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
                  : { duration: 6, repeat: Infinity, ease: "linear" }
              }
            >
              <Wand2 size={20} className="text-amber-300" />
            </motion.div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-white">진행 중인 소환</span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isFailed
                  ? "bg-rose-500/15 text-rose-300 border-rose-400/30"
                  : isWait
                  ? "bg-amber-400/15 text-amber-200 border-amber-400/40"
                  : "bg-white/5 text-white/50 border-white/10"
              }`}
            >
              {stage.label}
            </span>
          </div>
          <p className={`text-xs mt-1 ${isWait && !isFailed ? "text-amber-200/90 font-medium" : "text-white/40"}`}>
            {isFailed
              ? "문제가 발생했어요. 눌러서 확인해 주세요."
              : isWait
              ? "선택을 기다리고 있어요 — 눌러서 이어가기"
              : "스튜디오가 캐릭터를 빚는 중이에요. 눌러서 지켜보기"}
          </p>
          {/* 미니 진행률 */}
          <div className="mt-2.5 h-1 rounded-full bg-white/5 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${
                isFailed
                  ? "bg-rose-500/70"
                  : "bg-gradient-to-r from-amber-500 via-orange-400 to-amber-300"
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${stage.pct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>
        <ChevronRight size={16} className="text-white/30 flex-shrink-0" />
      </div>
    </motion.button>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  내 캐릭터 카드
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const MyCharacterCard = ({ character, index, onChat, onMenu }) => {
  const imgSrc = character.thumbnailUrl || character.defaultImageUrl;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + index * 0.05 }}
      className="group relative rounded-2xl overflow-hidden border border-white/10 hover:border-amber-400/40 bg-white/[0.03] transition-colors"
    >
      <button
        type="button"
        onClick={() => { sfx.click(); onChat(character); }}
        onMouseEnter={() => sfx.hover()}
        className="block w-full text-left"
      >
        <div className="relative aspect-[3/4] overflow-hidden bg-gradient-to-b from-stone-800/60 to-stone-950">
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={character.name}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              draggable={false}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/15">
              <User size={36} />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
          <div className="absolute top-2 left-2">
            <UgcStatusBadge
              visibility={character.visibility}
              secretReviewStatus={character.secretReviewStatus}
            />
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <div className="text-sm font-bold text-white truncate">{character.name}</div>
            <div className="text-[11px] text-white/50 truncate mt-0.5">
              {character.tagline || "아직 소개가 없어요"}
            </div>
          </div>
        </div>
      </button>
      {/* ⋯ 메뉴 */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); sfx.click(); onMenu(character); }}
        aria-label="캐릭터 메뉴"
        className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-sm border border-white/10 text-white/60 hover:text-white hover:bg-black/70 transition-colors"
      >
        <MoreHorizontal size={14} />
      </button>
    </motion.div>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  [World Builder] 내 세계관 카드
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// reviewStatus 뱃지 — APPROVED=승인됨 teal / REJECTED=반려됨 rose / NONE=뱃지 없음
const WORLD_REVIEW_META = {
  APPROVED: { label: "승인됨", cls: "bg-teal-400/15 text-teal-300 border-teal-400/30" },
  REJECTED: { label: "반려됨", cls: "bg-rose-400/15 text-rose-300 border-rose-400/30" },
};

const WORLD_JOB_STAGE_LABELS = {
  CONCEPT_PROCESSING: "설정 초안 생성 중",
  EDIT_WAIT: "설정 편집 대기",
  ILLUSTRATING: "일러스트 생성 중",
  REVIEW_WAIT: "일러스트 검수 대기",
  BINDING: "세계 등록 중",
  READY: "완성! 확인해 주세요",
  FAILED: "생성 실패",
  EXPIRED: "작업 만료",
};

// [World Builder v1.1] 카드 클릭 → WorldDetailSheet (상세/수정/장소 추가)
const MyWorldCard = ({ world, index, onClick }) => {
  const review = WORLD_REVIEW_META[world.reviewStatus] || null;
  return (
    <motion.button
      type="button"
      onClick={() => { sfx.click(); onClick?.(world); }}
      onMouseEnter={() => sfx.hover()}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + index * 0.05 }}
      className="group relative w-full text-left rounded-2xl overflow-hidden border border-white/10 hover:border-amber-400/40 bg-white/[0.03] transition-colors"
    >
      <div className="relative aspect-video overflow-hidden bg-gradient-to-b from-stone-800/60 to-stone-950">
        {world.thumbnailUrl ? (
          <img
            src={world.thumbnailUrl}
            alt={world.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            draggable={false}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/15">
            <Globe size={30} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        {review && (
          <span
            className={`absolute top-2 left-2 inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${review.cls}`}
          >
            {review.label}
          </span>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <div className="text-sm font-bold text-white truncate">{world.name}</div>
          <div className="text-[11px] text-white/50 truncate mt-0.5">
            {world.intro || "아직 소개가 없어요"}
          </div>
        </div>
      </div>
    </motion.button>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  탐색 피드 카드
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const ExploreCard = ({ item, index, onClick }) => (
  <motion.button
    type="button"
    onClick={() => { sfx.click(); onClick(item); }}
    onMouseEnter={() => sfx.hover()}
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: Math.min(index % 20, 8) * 0.04 }}
    className="group relative rounded-2xl overflow-hidden border border-white/10 hover:border-amber-400/40 bg-white/[0.03] text-left transition-colors"
  >
    <div className="relative aspect-[3/4] overflow-hidden bg-gradient-to-b from-stone-800/60 to-stone-950">
      {item.thumbnailUrl ? (
        <img
          src={item.thumbnailUrl}
          alt={item.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          draggable={false}
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-white/15">
          <User size={36} />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
      {/* 창작자 닉네임 뱃지 */}
      <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm border border-white/10">
        <User size={8} className="text-amber-200/70" />
        <span className="text-[9px] text-white/70 max-w-[90px] truncate">
          {item.creatorNickname || "익명의 창작자"}
        </span>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <div className="text-sm font-bold text-white truncate">{item.name}</div>
        <div className="text-[11px] text-white/50 truncate mt-0.5">{item.tagline || ""}</div>
      </div>
    </div>
  </motion.button>
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  메인 컴포넌트
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * [블록 A] embedded — 로비 셸 임베드 모드(2안 확정). true면 셸이 탑바·탭바를 제공하므로
 * 자체 탑바(로비로/로고/에너지)를 숨기고 높이를 셸 콘텐츠 영역(h-full)에 맞춘다.
 * URL은 /studio 그대로 — 라우트가 셸 Layout Route 하위로 편입됐을 뿐이다.
 */
export default function StudioPage({ embedded = false }) {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const { user } = useAuth();

  const [userInfo, setUserInfo] = useState(null);
  const [mine, setMine] = useState({ characters: [], activeJob: null });
  const [mineLoading, setMineLoading] = useState(true);
  const [mineError, setMineError] = useState(null);

  const [explore, setExplore] = useState({ items: [], nextCursor: null, initialized: false });
  const [exploreLoading, setExploreLoading] = useState(false);
  const exploreBusyRef = useRef(false);

  // [World Builder] 내 세계관 목록 + 진행 중 월드 잡 (마운트 시 1회 fetch)
  const [worldsData, setWorldsData] = useState({ worlds: [], activeJob: null, loaded: false });
  const [worldLinkChar, setWorldLinkChar] = useState(null); // 세계관 연결 시트 대상
  // [World Builder v1.1] 세계관 상세 시트 대상 worldId
  const [worldDetailId, setWorldDetailId] = useState(null);
  // [Profile v2] 프로필 뷰 대상 — { characterId, variant: "card"|"dossier" } | null
  const [profileView, setProfileView] = useState(null);

  const [createFlow, setCreateFlow] = useState(null); // { jobId: string|null } | null
  const [menuChar, setMenuChar] = useState(null);     // ⋯ BottomSheet 대상
  const [editChar, setEditChar] = useState(null);     // 설정 수정 대상
  const [editForm, setEditForm] = useState(null);
  const [chatTarget, setChatTarget] = useState(null); // 대화 시작 confirm 대상 {characterId, name}
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);           // { message, type }
  const toastTimerRef = useRef(null);

  const showToast = useCallback((message, type = "info") => {
    clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);
  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  // ─── 데이터 로드 ───
  const fetchEnergy = useCallback(async () => {
    try { setUserInfo((await api.get("/users/me")).data); } catch { /* noop */ }
  }, []);

  const fetchMine = useCallback(async () => {
    try {
      setMineError(null);
      const data = await fetchMyUgcCharacters();
      setMine({ characters: data?.characters || [], activeJob: data?.activeJob || null });
    } catch (e) {
      console.error("[Studio] mine fetch failed:", e);
      setMineError("스튜디오 데이터를 불러오지 못했습니다.");
    } finally {
      setMineLoading(false);
    }
  }, []);

  const loadExplore = useCallback(async (cursor) => {
    if (exploreBusyRef.current) return;
    exploreBusyRef.current = true;
    setExploreLoading(true);
    try {
      const data = await fetchExploreCharacters(cursor);
      setExplore((prev) => ({
        items: cursor ? [...prev.items, ...(data?.items || [])] : data?.items || [],
        nextCursor: data?.nextCursor ?? null,
        initialized: true,
      }));
    } catch (e) {
      console.warn("[Studio] explore fetch failed:", e?.message);
      setExplore((prev) => ({ ...prev, initialized: true }));
    } finally {
      exploreBusyRef.current = false;
      setExploreLoading(false);
    }
  }, []);

  // [World Builder] 내 세계관 로드 — 마운트 시 1회
  const fetchWorlds = useCallback(async () => {
    try {
      const data = await fetchMyUgcWorlds();
      setWorldsData({
        worlds: data?.worlds || [],
        activeJob: data?.activeJob || null,
        loaded: true,
      });
    } catch (e) {
      console.warn("[Studio] worlds fetch failed:", e?.message);
      setWorldsData((prev) => ({ ...prev, loaded: true }));
    }
  }, []);

  useEffect(() => {
    fetchEnergy();
    fetchMine();
    fetchWorlds();
    loadExplore(null);
  }, [fetchEnergy, fetchMine, fetchWorlds, loadExplore]);

  // ─── 진행 중 잡 라이브 폴링 (위저드가 닫혀 있을 때만 — 이중 폴링 방지) ───
  const { job: liveJob } = useUgcCreationJob(createFlow ? null : mine.activeJob?.jobId || null);
  const displayJob = liveJob || mine.activeJob;

  // ─── 탐색 무한 스크롤 sentinel ───
  const sentinelRef = useRef(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !explore.nextCursor) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && explore.nextCursor && !exploreLoading) {
          loadExplore(explore.nextCursor);
        }
      },
      { rootMargin: "300px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [explore.nextCursor, exploreLoading, loadExplore]);

  // ─── 액션 ───
  const handleOpenCreate = () => {
    sfx.click();
    if (mine.activeJob) {
      // 백엔드도 400으로 막지만, UX상 기존 잡 재개로 유도
      showToast("이미 진행 중인 소환이 있어요. 진행 중인 작업으로 이동합니다.", "info");
      setCreateFlow({ jobId: mine.activeJob.jobId });
      return;
    }
    setCreateFlow({ jobId: null });
  };

  const handleResumeJob = () => {
    if (!displayJob) return;
    setCreateFlow({ jobId: displayJob.jobId });
  };

  // [World Builder] 월드 완성 스텝의 "캐릭터 만들러 가기" — router state로 위저드 자동 오픈
  const openCreateHandledRef = useRef(false);
  useEffect(() => {
    if (mineLoading || openCreateHandledRef.current) return;
    if (routerLocation.state?.openCreate) {
      openCreateHandledRef.current = true;
      // 새로고침 시 재오픈되지 않도록 router state 제거
      navigate(routerLocation.pathname, { replace: true, state: null });
      handleOpenCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mineLoading, routerLocation.state]);

  // [World Builder] 세계관 연결/변경/해제 — PATCH 후 목록 리프레시 + 토스트
  const handleWorldLink = async (payload, successMessage) => {
    if (!worldLinkChar) return;
    setBusy(true);
    try {
      await updateUgcCharacterWorld(worldLinkChar.characterId, payload);
      sfx.chime();
      showToast(successMessage, "success");
      setWorldLinkChar(null);
      fetchMine();
    } catch (e) {
      sfx.thud();
      // 공개 캐릭터 + 미승인 월드 등 — 서버 메시지 그대로 노출
      showToast(e?.response?.data?.message || "세계관 연결에 실패했습니다.", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleCloseFlow = () => {
    setCreateFlow(null);
    fetchMine();
    fetchEnergy();
  };

  const startSandboxChat = async (characterId) => {
    setBusy(true);
    try {
      const res = await api.post("/lobby/rooms", { characterId, chatMode: "SANDBOX" });
      localStorage.setItem("roomId", res.data.roomId);
      navigate(`/chat/${res.data.roomId}`);
    } catch (e) {
      sfx.thud();
      showToast(e?.response?.data?.message || "대화방 생성에 실패했습니다.", "error");
      setBusy(false);
    }
  };

  const handlePublishToggle = async (character) => {
    const cancel = character.visibility === "PENDING_PUBLIC";
    setBusy(true);
    try {
      await requestPublish(character.characterId, cancel);
      sfx.chime();
      showToast(
        cancel ? "공개 신청을 취소했어요." : "공개 신청 완료! 검토 후 공개돼요.",
        "success"
      );
      setMenuChar(null);
      fetchMine();
    } catch (e) {
      sfx.thud();
      showToast(e?.response?.data?.message || "요청에 실패했습니다.", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleSecretRequest = async (character) => {
    setBusy(true);
    try {
      await requestSecret(character.characterId);
      sfx.chime();
      showToast("Secret 신청 완료! 심사 후 활성화돼요.", "success");
      setMenuChar(null);
      fetchMine();
    } catch (e) {
      sfx.thud();
      showToast(e?.response?.data?.message || "요청에 실패했습니다.", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleOpenEdit = (character) => {
    sfx.click();
    setMenuChar(null);
    setEditChar(character);
    setEditForm({
      name: character.name || "",
      tagline: character.tagline || "",
      personality: character.personality || "",
      tone: character.tone || "",
      firstGreeting: character.firstGreeting || "",
      // [2026-08-04 난이도] 무료 편집 필드 — 미보유 응답은 NORMAL 기본
      difficulty: character.difficulty || "NORMAL",
    });
  };

  const handleSaveEdit = async () => {
    if (!editChar || !editForm) return;
    setBusy(true);
    try {
      await updateUgcTexts(editChar.characterId, editForm);
      sfx.chime();
      showToast("저장했어요.", "success");
      setEditChar(null);
      setEditForm(null);
      fetchMine();
    } catch (e) {
      sfx.thud();
      showToast(e?.response?.data?.message || "저장에 실패했습니다.", "error");
    } finally {
      setBusy(false);
    }
  };

  const stars = useMemo(
    () =>
      Array.from({ length: 40 }, () => ({
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
      })),
    []
  );

  const displayEnergy = userInfo?.energy ?? user?.energy ?? 0;
  const displayNickname = userInfo?.nickname ?? user?.nickname ?? "";

  return (
    // [블록 A R2] embedded = 셸이 배경(bg-lobby-bg + 글로우 + 별)·탑바·스크롤을 제공 —
    // 자체 배경/자체 높이/자체 스크롤러 없이 콘텐츠만 렌더(잔존 자체 크롬 제거, 설계 문서 §5).
    <div className={embedded ? "relative w-full" : "relative w-full overflow-hidden bg-stone-950 h-screen"}>
      {/* ═══ 배경 — 비임베드 전용 (임베드는 셸 배경 사용) ═══ */}
      {!embedded && (
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-950 via-stone-950 to-orange-950" />
        {stars.map((style, i) => (
          <AmberTwinkle key={i} style={style} />
        ))}
        <div className="absolute bottom-0 inset-x-0 h-1/3 bg-gradient-to-t from-stone-950 to-transparent" />
      </div>
      )}

      {/* ═══ Topbar — TheaterPortalPage와 동일 폼팩터 (셸 임베드 시 셸 탑바가 대체) ═══ */}
      {!embedded && (
      <div className="relative z-20 flex items-center justify-between px-5 sm:px-8 py-4">
        <div className="flex items-center gap-3">
          <motion.button
            onClick={() => { sfx.click(); navigate("/"); }}
            whileHover={{ x: -3 }}
            whileTap={{ scale: 0.94 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-md border border-white/10 text-white/60 hover:text-white hover:bg-black/50 transition-colors duration-200"
          >
            <ArrowLeft size={14} />
            <span className="text-xs tracking-wide">로비로</span>
          </motion.button>

          <Link to="/" className="flex items-center gap-2 cursor-pointer" aria-label="Lucid Station으로 돌아가기">
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
              style={{ color: "rgba(253,230,138,0.9)", fontFamily: "'Pretendard', sans-serif" }}
            >
              스튜디오
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-1.5 bg-black/20 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/10">
            <Zap size={14} className="text-amber-300" />
            <span className="text-sm font-semibold text-white tabular-nums">{displayEnergy}</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-white/60 text-sm">
            <User size={14} />
            <span>{displayNickname}</span>
          </div>
        </div>
      </div>
      )}

      {/* ═══ 본문 — 임베드: 셸 main이 스크롤 담당 · 비임베드: 자체 스크롤 ═══ */}
      <div className={embedded ? "relative z-10" : "relative z-10 flex-1 overflow-y-auto custom-scrollbar h-[calc(100%-80px)]"}>
        <div className={embedded ? "max-w-[1200px] mx-auto px-5 sm:px-8" : "max-w-6xl mx-auto px-5 sm:px-8 py-6 sm:py-10"}>
          {/* ─── 페이지 헤더 — 임베드: 로비 공용 PageHead(카피는 목업 원문) ─── */}
          {embedded ? (
            <div className="mb-12">
              <PageHead title="스튜디오" desc="나만의 캐릭터와 세계를 만드는 공간이에요." />
            </div>
          ) : (
          <motion.div
            className="text-center mb-10"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 mb-3">
              <Wand2 size={18} className="text-amber-300/80" />
              <span className="text-[10px] uppercase tracking-[0.4em] text-amber-200/55 font-medium">
                Lucid Studio
              </span>
            </div>
            <h1
              className="text-3xl sm:text-4xl font-bold text-white tracking-wider mb-2"
              style={{ fontFamily: "'Pretendard', sans-serif" }}
            >
              당신의 상상을 소환하세요
            </h1>
            <p className="text-xs sm:text-sm text-white/40 tracking-wider">
              몇 문장이면 충분해요. 스튜디오가 살아 숨쉬는 캐릭터로 빚어냅니다
            </p>
          </motion.div>
          )}

          {/* ─── 로딩 ─── */}
          {mineLoading && (
            <div className="flex items-center justify-center py-24">
              <motion.div
                className="w-10 h-10 border-2 border-amber-400/40 border-t-amber-400 rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
            </div>
          )}

          {/* ─── 에러 ─── */}
          {mineError && !mineLoading && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <p className="text-rose-300 mb-4">{mineError}</p>
              <button
                onClick={() => { setMineLoading(true); fetchMine(); }}
                className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 text-sm"
              >
                다시 시도
              </button>
            </div>
          )}

          {!mineLoading && !mineError && (
            <div className="space-y-12">
              {/* ═══ ① 진행 중인 소환 ═══ */}
              {displayJob && (
                <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                  <ActiveJobCard job={displayJob} onClick={handleResumeJob} />
                </motion.section>
              )}

              {/* ═══ ② 내 캐릭터 ═══ */}
              <section>
                <div className="flex items-end justify-between mb-4">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 tracking-wide">
                      <Sparkles size={18} className="text-amber-300" />
                      내 캐릭터
                    </h2>
                    <p className="text-xs text-white/40 mt-0.5 tracking-wider">
                      당신의 손에서 태어난 존재들
                    </p>
                  </div>
                  {mine.characters.length > 0 && (
                    <span className="text-[11px] text-white/35 tracking-widest uppercase">
                      {mine.characters.length}명
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {mine.characters.map((c, i) => (
                    <MyCharacterCard
                      key={c.characterId}
                      character={c}
                      index={i}
                      // [Profile v1] 카드 본체 클릭 → dossier 프로필 (⋯ 메뉴의 "바로 대화하기"는 기존 confirm 유지)
                      onChat={(ch) => setProfileView({ characterId: ch.characterId, variant: "dossier" })}
                      onMenu={setMenuChar}
                    />
                  ))}

                  {/* ═══ ③ "+ 새 캐릭터" 대형 카드 ═══ */}
                  <motion.button
                    type="button"
                    onClick={handleOpenCreate}
                    onMouseEnter={() => sfx.hover()}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + mine.characters.length * 0.05 }}
                    whileHover={{ scale: 1.02, y: -3 }}
                    whileTap={{ scale: 0.98 }}
                    className="group relative rounded-2xl border border-dashed border-white/20 hover:border-amber-400/50 bg-white/[0.02] hover:bg-amber-500/[0.04] transition-colors aspect-[3/4] flex flex-col items-center justify-center gap-3 hover:shadow-[0_0_40px_rgba(251,191,36,0.12)]"
                  >
                    <div className="w-12 h-12 rounded-full bg-white/5 group-hover:bg-amber-500/15 border border-white/10 group-hover:border-amber-400/40 flex items-center justify-center transition-colors">
                      <Plus size={22} className="text-white/40 group-hover:text-amber-200 transition-colors" />
                    </div>
                    <div className="text-center px-3">
                      <div className="text-sm font-bold text-white/70 group-hover:text-amber-100 transition-colors">
                        새 캐릭터 소환
                      </div>
                      <div className="flex items-center justify-center gap-1 mt-1.5 text-amber-300/70">
                        <Zap size={11} />
                        <span className="text-[11px] font-semibold">에너지 {CREATE_COST}</span>
                      </div>
                    </div>
                  </motion.button>
                </div>

                {/* 빈 상태 */}
                {mine.characters.length === 0 && !displayJob && (
                  <div className="mt-4 rounded-2xl bg-white/[0.02] border border-dashed border-white/10 px-6 py-8 text-center">
                    <div className="text-3xl mb-2 opacity-60">🌙</div>
                    <p className="text-white/40 text-xs leading-relaxed">
                      아직 소환한 캐릭터가 없어요.
                      <br />
                      머릿속에만 있던 그 사람을, 이곳에서 처음으로 만나보세요.
                    </p>
                  </div>
                )}
              </section>

              {/* ═══ [World Builder] 내 세계관 ═══ */}
              <section>
                <div className="flex items-end justify-between mb-4">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 tracking-wide">
                      <Globe size={18} className="text-amber-300" />
                      내 세계관
                    </h2>
                    <p className="text-xs text-white/40 mt-0.5 tracking-wider">
                      캐릭터들이 살아갈 세계를 직접 빚어보세요
                    </p>
                  </div>
                  {worldsData.worlds.length > 0 && (
                    <span className="text-[11px] text-white/35 tracking-widest uppercase">
                      {worldsData.worlds.length}개
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* 진행 중 월드 잡 카드 */}
                  {worldsData.activeJob && (
                    <motion.button
                      type="button"
                      onClick={() => { sfx.click(); navigate("/studio/world"); }}
                      onMouseEnter={() => sfx.hover()}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className="relative rounded-2xl overflow-hidden border border-amber-400/40 hover:border-amber-300/60 bg-amber-500/[0.06] aspect-video flex flex-col items-center justify-center gap-2.5 text-left transition-colors"
                    >
                      <motion.div
                        className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-amber-400/[0.06] to-transparent"
                        animate={{ x: ["-100%", "100%"] }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                      />
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                      >
                        <Globe size={22} className="text-amber-300" />
                      </motion.div>
                      <div className="text-sm font-bold text-white">만들던 세계관 이어가기</div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-400/15 text-amber-200 border-amber-400/40">
                        {WORLD_JOB_STAGE_LABELS[worldsData.activeJob.status] || "진행 중"}
                      </span>
                    </motion.button>
                  )}

                  {/* 완성된 월드 카드 — 클릭 시 상세/수정/장소 추가 시트 */}
                  {worldsData.worlds.map((w, i) => (
                    <MyWorldCard
                      key={w.worldId}
                      world={w}
                      index={i}
                      onClick={(world) => setWorldDetailId(world.worldId)}
                    />
                  ))}

                  {/* "새 세계관 만들기" 훅 카드 */}
                  <motion.button
                    type="button"
                    onClick={() => { sfx.click(); navigate("/studio/world"); }}
                    onMouseEnter={() => sfx.hover()}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + worldsData.worlds.length * 0.05 }}
                    whileHover={{ scale: 1.02, y: -3 }}
                    whileTap={{ scale: 0.98 }}
                    className="group relative rounded-2xl border border-dashed border-white/20 hover:border-amber-400/50 bg-white/[0.02] hover:bg-amber-500/[0.04] transition-colors aspect-video flex flex-col items-center justify-center gap-2.5 hover:shadow-[0_0_40px_rgba(251,191,36,0.12)]"
                  >
                    <div className="w-10 h-10 rounded-full bg-white/5 group-hover:bg-amber-500/15 border border-white/10 group-hover:border-amber-400/40 flex items-center justify-center transition-colors">
                      <Plus size={18} className="text-white/40 group-hover:text-amber-200 transition-colors" />
                    </div>
                    <div className="text-center px-3">
                      <div className="text-sm font-bold text-white/70 group-hover:text-amber-100 transition-colors">
                        새 세계관 만들기
                      </div>
                      <div className="flex items-center justify-center gap-1 mt-1 text-amber-300/70">
                        <Zap size={10} />
                        <span className="text-[10px] font-semibold">에너지 10</span>
                      </div>
                    </div>
                  </motion.button>
                </div>
              </section>

              {/* ═══ ④ 탐색 피드 ═══ */}
              <section>
                <div className="flex items-end justify-between mb-4">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 tracking-wide">
                      <Compass size={18} className="text-orange-300" />
                      탐색
                    </h2>
                    <p className="text-xs text-white/40 mt-0.5 tracking-wider">
                      다른 창작자들이 소환한 캐릭터를 만나보세요
                    </p>
                  </div>
                </div>

                {explore.items.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {explore.items.map((item, i) => (
                      <ExploreCard
                        key={item.characterId}
                        item={item}
                        index={i}
                        // [Profile v2] 탐색 카드 클릭 → 중앙 카드 프로필 (CTA가 SANDBOX 방 생성)
                        onClick={(it) =>
                          setProfileView({ characterId: it.characterId, variant: "card" })
                        }
                      />
                    ))}
                  </div>
                ) : explore.initialized && !exploreLoading ? (
                  <div className="rounded-2xl bg-white/[0.02] border border-dashed border-white/10 px-6 py-10 text-center">
                    <div className="text-3xl mb-2 opacity-60">🔭</div>
                    <p className="text-white/40 text-xs leading-relaxed">
                      아직 공개된 캐릭터가 없어요.
                      <br />
                      당신의 캐릭터가 이 피드의 첫 주인공이 될 수 있어요.
                    </p>
                  </div>
                ) : null}

                {/* 무한 스크롤 sentinel + 로딩 */}
                <div ref={sentinelRef} className="h-1" />
                {exploreLoading && (
                  <div className="flex items-center justify-center py-8">
                    <motion.div
                      className="w-7 h-7 border-2 border-amber-400/40 border-t-amber-400 rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                  </div>
                )}
              </section>

              <div className="h-8" />
            </div>
          )}
        </div>
      </div>

      {/* ═══ 생성 위저드 ═══ */}
      <AnimatePresence>
        {createFlow && (
          <StudioCreateFlow
            initialJobId={createFlow.jobId}
            energy={displayEnergy}
            onClose={handleCloseFlow}
            onEnergyRefresh={fetchEnergy}
          />
        )}
      </AnimatePresence>

      {/* ═══ [Profile v2] 캐릭터 프로필 뷰 (탐색=card / 내 캐릭터=dossier) ═══ */}
      <CharacterProfileView
        characterId={profileView?.characterId}
        variant={profileView?.variant || "immersive"}
        open={Boolean(profileView)}
        onClose={() => setProfileView(null)}
        // 기존 진입 로직 재사용 — createOrGetRoom(POST /lobby/rooms SANDBOX) → /chat 이동
        onStartChat={async (characterId) => {
          setProfileView(null);
          await startSandboxChat(characterId);
        }}
      />

      {/* ═══ [World Builder v1.1] 세계관 상세/수정/장소 추가 시트 ═══ */}
      <AnimatePresence>
        {worldDetailId && (
          <WorldDetailSheet
            worldId={worldDetailId}
            onClose={() => {
              setWorldDetailId(null);
              fetchWorlds(); // 이름/썸네일/검수상태 수정분을 목록 카드에 반영
            }}
            onEnergyRefresh={fetchEnergy}
          />
        )}
      </AnimatePresence>

      {/* ═══ ⋯ 캐릭터 메뉴 BottomSheet ═══ */}
      <BottomSheet
        open={Boolean(menuChar)}
        onClose={() => setMenuChar(null)}
        title={menuChar?.name || ""}
        zIndex={90}
      >
        {menuChar && (
          <div className="space-y-2 pb-2">
            {/* 대화하기 */}
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                sfx.click();
                const target = menuChar;
                setMenuChar(null);
                setChatTarget({ characterId: target.characterId, name: target.name, mine: true });
              }}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/15 transition-colors text-left disabled:opacity-50"
            >
              <MessageCircle size={16} className="text-cyan-300/80" />
              <div>
                <div className="text-sm font-bold text-white">바로 대화하기</div>
                <div className="text-[11px] text-white/40 mt-0.5">자유 모드로 대화방을 만들어요</div>
              </div>
            </button>

            {/* 공개 신청 / 취소 */}
            {menuChar.visibility === "PUBLIC" ? (
              <div className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/5 opacity-60">
                <Globe size={16} className="text-teal-300/80" />
                <div>
                  <div className="text-sm font-bold text-white/70">공개 중</div>
                  <div className="text-[11px] text-white/40 mt-0.5">탐색 피드에 노출되고 있어요</div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => handlePublishToggle(menuChar)}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/15 transition-colors text-left disabled:opacity-50"
              >
                <Globe size={16} className="text-teal-300/80" />
                <div>
                  <div className="text-sm font-bold text-white">
                    {menuChar.visibility === "PENDING_PUBLIC" ? "공개 신청 취소" : "공개 신청"}
                  </div>
                  <div className="text-[11px] text-white/40 mt-0.5">
                    {menuChar.visibility === "PENDING_PUBLIC"
                      ? "심사 대기를 취소하고 비공개로 돌려요"
                      : "검토 후 탐색 피드에 공개돼요"}
                  </div>
                </div>
              </button>
            )}

            {/* Secret 신청 */}
            {menuChar.secretReviewStatus === "PENDING" ? (
              <div className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/5 opacity-60">
                <Moon size={16} className="text-rose-300/80" />
                <div>
                  <div className="text-sm font-bold text-white/70">Secret 심사 중</div>
                  <div className="text-[11px] text-white/40 mt-0.5">심사가 끝나면 알려드릴게요</div>
                </div>
              </div>
            ) : menuChar.secretReviewStatus === "APPROVED" ? (
              <div className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-rose-500/[0.05] border border-rose-400/20 opacity-80">
                <Moon size={16} className="text-rose-300" />
                <div>
                  <div className="text-sm font-bold text-rose-200">Secret 승인됨</div>
                  <div className="text-[11px] text-white/40 mt-0.5">Secret 모드를 사용할 수 있어요</div>
                </div>
              </div>
            ) : menuChar.secretEligible ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => handleSecretRequest(menuChar)}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/15 transition-colors text-left disabled:opacity-50"
              >
                <Moon size={16} className="text-rose-300/80" />
                <div>
                  <div className="text-sm font-bold text-white">
                    {menuChar.secretReviewStatus === "REJECTED" ? "Secret 다시 신청" : "Secret 신청"}
                  </div>
                  <div className="text-[11px] text-white/40 mt-0.5">
                    성인 인증 유저 전용 · 심사 후 활성화돼요
                  </div>
                  {menuChar.secretReviewStatus === "REJECTED" && menuChar.reviewNote && (
                    <div className="text-[11px] text-rose-200/70 mt-1">{menuChar.reviewNote}</div>
                  )}
                </div>
              </button>
            ) : null}

            {/* [World Builder] 세계관 연결 / 변경 */}
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                sfx.click();
                const target = menuChar;
                setMenuChar(null);
                setWorldLinkChar(target);
              }}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/15 transition-colors text-left disabled:opacity-50"
            >
              <Globe size={16} className="text-amber-300/80" />
              <div>
                <div className="text-sm font-bold text-white">
                  {menuChar.worldName ? "세계관 변경" : "세계관 연결"}
                </div>
                <div className="text-[11px] text-white/40 mt-0.5">
                  {menuChar.worldName ? `현재: ${menuChar.worldName}` : "미연결 — 공식·커스텀 세계관을 연결해요"}
                </div>
              </div>
            </button>

            {/* 설정 수정 */}
            <button
              type="button"
              disabled={busy}
              onClick={() => handleOpenEdit(menuChar)}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/15 transition-colors text-left disabled:opacity-50"
            >
              <Pencil size={16} className="text-amber-300/80" />
              <div>
                <div className="text-sm font-bold text-white">설정 수정</div>
                <div className="text-[11px] text-white/40 mt-0.5">이름·태그라인·성격·말투·첫인사</div>
              </div>
            </button>
          </div>
        )}
      </BottomSheet>

      {/* ═══ 설정 수정 BottomSheet ═══ */}
      <BottomSheet
        open={Boolean(editChar)}
        onClose={() => { setEditChar(null); setEditForm(null); }}
        title="설정 수정"
        zIndex={95}
      >
        {editForm && (
          <div className="space-y-3 pb-3">
            {[
              { key: "name", label: "이름", max: 20 },
              { key: "tagline", label: "태그라인", max: 60 },
            ].map((f) => (
              <div key={f.key}>
                <label className="text-[11px] text-white/50 mb-1 block">{f.label}</label>
                <input
                  type="text"
                  value={editForm[f.key]}
                  maxLength={f.max}
                  onChange={(e) => setEditForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/25 focus:border-amber-400/60 outline-none"
                />
              </div>
            ))}
            {/* [2026-08-04 난이도] 공략 난이도 — 스탯 상승 배율+성격 지시 이중 게이트
                [2026-08-05 난이도 배지 승격] 4색 단일 소스(difficultyMeta) 적용 — 선택 상태 = 해당 색 배경 */}
            <div>
              <label className="text-[11px] text-white/50 mb-1 block">공략 난이도</label>
              <div className="grid grid-cols-4 gap-1.5">
                {DIFFICULTY_ORDER.map((value) => {
                  const meta = DIFFICULTY_META[value];
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setEditForm((p) => ({ ...p, difficulty: value }))}
                      className={`py-2 rounded-lg text-[11px] font-medium border transition ${
                        editForm.difficulty === value
                          ? meta.selectedCls
                          : "bg-white/[0.04] border-white/10 text-white/45 hover:bg-white/[0.06]"
                      }`}
                    >
                      {meta.label} {difficultyFilledStars(value)}
                    </button>
                  );
                })}
              </div>
            </div>
            {[
              { key: "personality", label: "성격", rows: 3 },
              { key: "tone", label: "말투", rows: 3 },
              { key: "firstGreeting", label: "첫인사", rows: 3 },
            ].map((f) => (
              <div key={f.key}>
                <label className="text-[11px] text-white/50 mb-1 block">{f.label}</label>
                <textarea
                  value={editForm[f.key]}
                  rows={f.rows}
                  onChange={(e) => setEditForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/25 focus:border-amber-400/60 outline-none resize-none"
                />
              </div>
            ))}
            <button
              type="button"
              disabled={busy}
              onClick={handleSaveEdit}
              className="w-full py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
            >
              {busy ? "저장 중…" : "저장"}
            </button>
          </div>
        )}
      </BottomSheet>

      {/* ═══ [World Builder] 세계관 연결/변경 BottomSheet ═══ */}
      <BottomSheet
        open={Boolean(worldLinkChar)}
        onClose={() => setWorldLinkChar(null)}
        title="세계관 연결"
        zIndex={95}
      >
        {worldLinkChar && (
          <div className="space-y-2 pb-2">
            <p className="text-[11px] text-white/45 leading-relaxed mb-1">
              {worldLinkChar.name} ·{" "}
              {worldLinkChar.worldName ? `현재 연결: ${worldLinkChar.worldName}` : "미연결"}
            </p>

            {/* 공식 4종 */}
            <div className="text-[10px] text-white/40 uppercase tracking-widest pt-1">공식 세계관</div>
            {OFFICIAL_WORLDS.map((w) => {
              const active =
                worldLinkChar.worldType === "OFFICIAL" && worldLinkChar.worldId === w.id;
              return (
                <button
                  key={w.id}
                  type="button"
                  disabled={busy || active}
                  onClick={() => handleWorldLink({ officialWorldId: w.id }, `${w.name} 세계관을 연결했어요.`)}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-colors text-left disabled:opacity-60 ${
                    active
                      ? "bg-amber-500/[0.08] border-amber-400/40"
                      : "bg-white/[0.03] hover:bg-white/[0.08] border-white/5 hover:border-white/15"
                  }`}
                >
                  <Globe size={16} className={active ? "text-amber-300" : "text-white/40"} />
                  <div className="flex-1">
                    <div className="text-sm font-bold text-white">{w.name}</div>
                  </div>
                  {active && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-200 border border-amber-400/40">
                      연결 중
                    </span>
                  )}
                </button>
              );
            })}

            {/* 내 READY 월드 */}
            <div className="text-[10px] text-white/40 uppercase tracking-widest pt-2">내 세계관</div>
            {worldsData.worlds.length > 0 ? (
              worldsData.worlds.map((w) => {
                const active =
                  worldLinkChar.worldType === "UGC" && worldLinkChar.ugcWorldId === w.worldId;
                return (
                  <button
                    key={w.worldId}
                    type="button"
                    disabled={busy || active}
                    onClick={() => handleWorldLink({ ugcWorldId: w.worldId }, `${w.name} 세계관을 연결했어요.`)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left disabled:opacity-60 ${
                      active
                        ? "bg-amber-500/[0.08] border-amber-400/40"
                        : "bg-white/[0.03] hover:bg-white/[0.08] border-white/5 hover:border-white/15"
                    }`}
                  >
                    <div className="w-16 aspect-video rounded-lg overflow-hidden border border-white/10 flex-shrink-0 bg-black/40">
                      {w.thumbnailUrl ? (
                        <img src={w.thumbnailUrl} alt={w.name} className="w-full h-full object-cover" draggable={false} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/15">
                          <Globe size={12} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white truncate">{w.name}</div>
                      <div className="text-[11px] text-white/40 truncate mt-0.5">
                        {w.reviewStatus === "APPROVED"
                          ? "승인됨 — 공개 캐릭터에도 연결할 수 있어요"
                          : w.reviewStatus === "REJECTED"
                          ? "반려됨"
                          : "비공개 캐릭터에 연결할 수 있어요"}
                      </div>
                    </div>
                    {active && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-200 border border-amber-400/40 flex-shrink-0">
                        연결 중
                      </span>
                    )}
                  </button>
                );
              })
            ) : (
              <button
                type="button"
                onClick={() => { sfx.click(); setWorldLinkChar(null); navigate("/studio/world"); }}
                className="w-full py-3.5 rounded-xl border border-dashed border-white/15 hover:border-amber-400/50 bg-white/[0.02] hover:bg-amber-500/[0.04] text-[11px] text-white/45 hover:text-amber-100 transition-colors"
              >
                아직 만든 세계관이 없어요 — 월드 빌더에서 만들기
              </button>
            )}

            {/* 연결 해제 */}
            {(worldLinkChar.worldType === "OFFICIAL" || worldLinkChar.worldType === "UGC") && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  handleWorldLink(
                    { officialWorldId: null, ugcWorldId: null },
                    "세계관 연결을 해제했어요."
                  )
                }
                className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.03] hover:bg-rose-500/[0.08] border border-white/5 hover:border-rose-400/25 transition-colors text-left disabled:opacity-50"
              >
                <Link2Off size={16} className="text-rose-300/80" />
                <div>
                  <div className="text-sm font-bold text-rose-200">연결 해제</div>
                  <div className="text-[11px] text-white/40 mt-0.5">세계관 없이 자유롭게 두어요</div>
                </div>
              </button>
            )}
          </div>
        )}
      </BottomSheet>

      {/* ═══ 대화 시작 confirm ═══ */}
      <AnimatePresence>
        {chatTarget && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={busy ? undefined : () => setChatTarget(null)}
            />
            <motion.div
              className="relative z-10 w-full max-w-sm rounded-2xl p-6 border border-amber-400/25"
              style={{
                background: "linear-gradient(145deg, rgba(28,18,8,0.97), rgba(20,12,6,0.96))",
                boxShadow: "0 30px 60px rgba(0,0,0,0.6)",
              }}
              initial={{ scale: 0.92, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 16 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
            >
              <h3 className="font-bold text-white mb-1.5">
                {chatTarget.name}와(과) 대화를 시작할까요?
              </h3>
              <p className="text-white/55 text-xs leading-relaxed mb-1">
                자유 모드(SANDBOX) 대화방이 만들어져요.
              </p>
              {chatTarget.creatorNickname && (
                <p className="text-white/35 text-[11px] mb-4">
                  창작자 · {chatTarget.creatorNickname}
                </p>
              )}
              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => { sfx.click(); setChatTarget(null); }}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 transition text-sm disabled:opacity-50"
                >
                  다음에
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => { sfx.click(); startSandboxChat(chatTarget.characterId); }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  <MessageCircle size={14} />
                  {busy ? "입장 중…" : "대화 시작"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ 토스트 ═══ */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className={`fixed bottom-8 left-1/2 z-[9999] px-6 py-3.5 rounded-2xl backdrop-blur-xl border shadow-2xl text-sm font-medium
              ${toast.type === "success"
                ? "bg-emerald-900/80 border-emerald-400/30 text-emerald-200 shadow-emerald-500/20"
                : toast.type === "error"
                  ? "bg-rose-900/80 border-rose-400/30 text-rose-200 shadow-rose-500/20"
                  : "bg-amber-900/80 border-amber-400/30 text-amber-100 shadow-amber-500/20"
              }`}
            initial={{ x: "-50%", y: 30, opacity: 0, scale: 0.9 }}
            animate={{ x: "-50%", y: 0, opacity: 1, scale: 1 }}
            exit={{ x: "-50%", y: 30, opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
