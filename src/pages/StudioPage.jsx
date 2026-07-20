import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, Wand2, Sparkles, Zap, User, Plus, MoreHorizontal,
  MessageCircle, Globe, Moon, Pencil, Compass, ChevronRight, AlertTriangle,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import {
  fetchMyUgcCharacters, fetchExploreCharacters,
  requestPublish, requestSecret, updateUgcTexts,
} from "../api/StudioApi";
import useUgcCreationJob from "../hooks/useUgcCreationJob";
import StudioCreateFlow from "../components/studio/StudioCreateFlow";
import UgcStatusBadge from "../components/studio/UgcStatusBadge";
import BottomSheet from "../components/mobile/BottomSheet";
import { sfx } from "../utils/sfx";

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

export default function StudioPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [userInfo, setUserInfo] = useState(null);
  const [mine, setMine] = useState({ characters: [], activeJob: null });
  const [mineLoading, setMineLoading] = useState(true);
  const [mineError, setMineError] = useState(null);

  const [explore, setExplore] = useState({ items: [], nextCursor: null, initialized: false });
  const [exploreLoading, setExploreLoading] = useState(false);
  const exploreBusyRef = useRef(false);

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

  useEffect(() => {
    fetchEnergy();
    fetchMine();
    loadExplore(null);
  }, [fetchEnergy, fetchMine, loadExplore]);

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
    <div className="relative w-full h-screen overflow-hidden bg-stone-950">
      {/* ═══ 배경 ═══ */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-950 via-stone-950 to-orange-950" />
        {stars.map((style, i) => (
          <AmberTwinkle key={i} style={style} />
        ))}
        <div className="absolute bottom-0 inset-x-0 h-1/3 bg-gradient-to-t from-stone-950 to-transparent" />
      </div>

      {/* ═══ Topbar — TheaterPortalPage와 동일 폼팩터 ═══ */}
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

      {/* ═══ 본문 — 스크롤 가능 ═══ */}
      <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar h-[calc(100%-80px)]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-6 sm:py-10">
          {/* ─── 페이지 헤더 ─── */}
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
                      onChat={(ch) => setChatTarget({ characterId: ch.characterId, name: ch.name, mine: true })}
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
                        onClick={(it) =>
                          setChatTarget({ characterId: it.characterId, name: it.name, creatorNickname: it.creatorNickname })
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
