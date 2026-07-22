import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Globe, Zap, Plus, RefreshCw, Trash2, AlertTriangle, MapPin, Check,
} from "lucide-react";
import {
  fetchUgcWorld,
  updateUgcWorld,
  addUgcWorldLocation,
  retryUgcWorldLocation,
  deleteUgcWorldLocation,
} from "../../api/WorldStudioApi";
import { sfx } from "../../utils/sfx";

/**
 * [World Builder v1.1] WorldDetailSheet — 세계관 상세/수정/장소 추가
 *
 * StudioPage '내 세계관' 카드 클릭 → 풀스크린 오버레이(z-[100]).
 *
 * 구성:
 *   - 헤더: 16:9 썸네일 + 이름 + reviewStatus 뱃지 + 닫기
 *   - 설정 섹션: 이름/소개/lore(2000자 카운터)/무드 태그(콤마 입력)
 *       ProfileEditPanel 패턴 — 1회 스냅샷 시딩 + dirty diff, 변경분만 PATCH.
 *       reviewStatus !== NONE이면 저장 confirm에 검수 초기화 경고.
 *       미저장 닫기 confirm.
 *   - 장소 섹션: n/20 카운터 + 16:9 그리드
 *       READY: 배경+이름+설명 / GENERATING: 스피너 "배경을 그리는 중…"
 *       FAILED: rose 보더 + 다시 시도(무료) + 삭제(1E 환불, danger confirm)
 *       GENERATING 존재 시 5초 간격 refetch (전부 정착하면 중단, document.hidden 스킵)
 *   - 장소 추가: "장소 추가 (⚡1)" → 인라인 폼 → confirm(1E 고지) → POST → refetch
 *
 * Props:
 *   worldId         : number|string
 *   onClose         : () => void
 *   onEnergyRefresh : (() => void)|null — 장소 추가/삭제 후 에너지 잔량 갱신
 */

const LOCATION_MAX = 20;
const LORE_MAX = 2000;
const LOCATION_DESC_MAX = 300;
const LOCATION_COST = 1;
// [적대 리뷰 #1] GENERATING이 이 시간 이상 이어지면 멈춤 복구 버튼 노출
// (서버 재시작 등으로 영구 GENERATING에 갇힐 수 있다 — retry API는 GENERATING도 허용)
const STALL_RETRY_MS = 90 * 1000;

const REVIEW_META = {
  APPROVED: { label: "승인됨", cls: "bg-teal-400/15 text-teal-300 border-teal-400/30" },
  REJECTED: { label: "반려됨", cls: "bg-rose-400/15 text-rose-300 border-rose-400/30" },
};

const fieldClass =
  "w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm leading-relaxed placeholder:text-white/25 focus:border-amber-400/60 outline-none";

// ── 설정 폼 필드 정의 (스냅샷/diff 공용) ──
const FORM_KEYS = ["name", "intro", "lore", "moodTagsText"];

/** UgcWorldView → 폼 스냅샷 (moodTags 배열은 콤마 문자열로) */
const snapshotOf = (world) => ({
  name: world?.name || "",
  intro: world?.intro || "",
  lore: world?.lore || "",
  moodTagsText: (world?.moodTags || []).join(", "),
});

/** 콤마 입력 → moodTags 배열 (trim + 빈 항목 제거) */
const parseMoodTags = (text) =>
  text
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

/** confirm 모달 — WorldCreateFlow ConfirmModal과 동일 폼팩터 (z-[130]) */
const ConfirmModal = ({ data, busy, onConfirm, onCancel }) => (
  <AnimatePresence>
    {data && (
      <motion.div
        className="fixed inset-0 z-[130] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={busy ? undefined : onCancel} />
        <motion.div
          className={`relative z-10 w-full max-w-sm rounded-2xl p-6 border ${
            data.danger ? "border-rose-400/25" : "border-amber-400/25"
          }`}
          style={{
            background: "linear-gradient(145deg, rgba(28,18,8,0.97), rgba(20,12,6,0.96))",
            boxShadow: "0 30px 60px rgba(0,0,0,0.6)",
          }}
          initial={{ scale: 0.92, y: 16, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.92, y: 16, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
        >
          <h3 className={`font-bold mb-2 ${data.danger ? "text-rose-200" : "text-amber-100"}`}>
            {data.title}
          </h3>
          <p className="text-white/60 text-sm leading-relaxed mb-5 whitespace-pre-line">{data.desc}</p>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => { sfx.click(); onCancel(); }}
              className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 transition text-sm disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onConfirm}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                data.danger
                  ? "bg-rose-600/80 hover:bg-rose-500/80 text-white"
                  : "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-amber-500/20"
              }`}
            >
              {busy ? "처리 중…" : data.confirmLabel || "확인"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

// ── 장소 카드 (16:9) ──
const LocationCard = ({ location, busy, stalled = false, onRetry, onDeleteRequest }) => {
  const generating = location.status === "GENERATING";
  const failed = location.status === "FAILED";

  return (
    <div
      className={`relative rounded-2xl overflow-hidden border bg-white/[0.03] transition-colors ${
        failed ? "border-rose-400/40" : "border-white/10"
      }`}
    >
      <div className="relative aspect-video">
        {location.backgroundUrl ? (
          <img
            src={location.backgroundUrl}
            alt={location.displayName}
            className="w-full h-full object-cover"
            draggable={false}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-stone-900/40 to-black/60">
            {failed ? (
              <AlertTriangle size={20} className="text-rose-300/80" />
            ) : (
              <MapPin size={20} className="text-white/15" />
            )}
          </div>
        )}
        {/* GENERATING — 스피너 오버레이 */}
        {generating && (
          <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center gap-2">
            <motion.div
              className="w-7 h-7 border-2 border-amber-400/40 border-t-amber-400 rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
            <span className="text-[10px] text-amber-100/70">배경을 그리는 중…</span>
            {/* [적대 리뷰 #1] 90초 이상 GENERATING이면 멈춤 복구 경로 노출 — 은은한 고스트 버튼 */}
            {stalled && (
              <button
                type="button"
                disabled={busy}
                onClick={() => { sfx.click(); onRetry(location); }}
                className="mt-0.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/15 text-white/45 hover:text-amber-100 hover:bg-white/10 text-[10px] transition-colors disabled:opacity-50"
              >
                <RefreshCw size={9} /> 오래 걸리면 다시 시도 (무료)
              </button>
            )}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 p-3 pointer-events-none">
          <div className="text-sm font-bold text-white truncate">{location.displayName}</div>
          <div className="text-[11px] text-white/50 truncate mt-0.5">{location.description}</div>
        </div>
      </div>

      {/* FAILED — 복구/삭제 컨트롤 바 */}
      {failed && (
        <div className="flex items-center gap-2 px-2.5 py-2 bg-black/40 border-t border-rose-400/20">
          <button
            type="button"
            disabled={busy}
            onClick={() => { sfx.click(); onRetry(location); }}
            className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-rose-500/20 border border-rose-400/40 text-rose-200 text-[10px] font-bold hover:bg-rose-500/30 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={10} /> 다시 시도 (무료)
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => { sfx.click(); onDeleteRequest(location); }}
            className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-white/5 border border-white/15 text-white/55 hover:text-rose-200 hover:border-rose-400/30 text-[10px] font-bold transition-colors disabled:opacity-50"
          >
            <Trash2 size={10} /> 삭제 (<Zap size={9} className="text-amber-300" />1 환불)
          </button>
        </div>
      )}
    </div>
  );
};

export default function WorldDetailSheet({ worldId, onClose, onEnergyRefresh = null }) {
  const [world, setWorld] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // ── 설정 폼 (ProfileEditPanel 패턴 — 1회 스냅샷 시딩) ──
  const [form, setForm] = useState(null); // null = 미시딩
  const baselineRef = useRef(null);

  // ── 액션 상태 ──
  const [actionBusy, setActionBusy] = useState(false);
  const [confirmState, setConfirmState] = useState(null); // {title,desc,confirmLabel,danger,action}
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [toast, setToast] = useState(null); // { message, type }
  const toastTimerRef = useRef(null);

  // ── 장소 추가 인라인 폼 ──
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ displayName: "", description: "" });

  // [폴리싱 #8 패턴] state 기반 busy는 리렌더 전 2번째 클릭이 통과 — ref 재진입 락
  const busyRef = useRef(false);
  const confirmFiredRef = useRef(false); // ConfirmModal 확인 버튼 이중 발화 가드

  const showToast = useCallback((message, type = "info") => {
    clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);
  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  // ── 상세 로드 (silent: 폴링용 — 로딩 스피너 없이 교체) ──
  const loadWorld = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
        setLoadError(null);
      }
      try {
        const data = await fetchUgcWorld(worldId);
        setWorld(data);
        return data;
      } catch (e) {
        if (!silent) setLoadError(e?.response?.data?.message || "세계관 정보를 불러오지 못했어요.");
        return null;
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [worldId]
  );

  useEffect(() => {
    sfx.wooshLight();
    loadWorld();
  }, [loadWorld]);

  // ── 폼 시딩 — 데이터가 처음 도착했을 때 1회 (이후 refetch가 입력을 덮지 않도록) ──
  useEffect(() => {
    if (form === null && world) {
      const snap = snapshotOf(world);
      baselineRef.current = snap;
      setForm({ ...snap });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, form === null]);

  const dirtyKeys = form
    ? FORM_KEYS.filter((k) => (form[k] ?? "") !== (baselineRef.current?.[k] ?? ""))
    : [];
  const dirty = dirtyKeys.length > 0;

  // ── 장소 GENERATING 폴링 — 5초 간격, 전부 정착하면 중단, 백그라운드 탭 스킵 ──
  const locations = world?.locations || [];
  const hasGenerating = locations.some((l) => l.status === "GENERATING");
  useEffect(() => {
    if (!hasGenerating) return undefined;
    const timer = setInterval(() => {
      if (document.hidden) return; // 백그라운드 탭 — 서버 부하/불필요 refetch 스킵
      loadWorld(true);
    }, 5000);
    return () => clearInterval(timer);
  }, [hasGenerating, loadWorld]);

  // [적대 리뷰 #1] 멈춘 GENERATING 복구 — locationKey별 최초 관측 시각 기록.
  // 노출 판정 리렌더는 5초 폴링이 만들어 준다 (90초 경과 후 다음 틱에 버튼이 뜬다).
  const generatingSinceRef = useRef({});
  useEffect(() => {
    const seen = generatingSinceRef.current;
    const generatingKeys = new Set(
      locations.filter((l) => l.status === "GENERATING").map((l) => l.locationKey)
    );
    generatingKeys.forEach((key) => {
      if (!seen[key]) seen[key] = Date.now();
    });
    Object.keys(seen).forEach((key) => {
      if (!generatingKeys.has(key)) delete seen[key];
    });
  }, [locations]);

  const isStalled = (loc) =>
    loc.status === "GENERATING" &&
    Boolean(generatingSinceRef.current[loc.locationKey]) &&
    Date.now() - generatingSinceRef.current[loc.locationKey] >= STALL_RETRY_MS;

  // ── 공통 액션 러너 (WorldCreateFlow runAction 패턴) ──
  const runAction = useCallback(
    async (fn, { successMessage = null, refreshEnergy = false, onRefetched = null } = {}) => {
      if (busyRef.current) return false;
      busyRef.current = true;
      setActionBusy(true);
      try {
        await fn();
        sfx.chime();
        if (successMessage) showToast(successMessage, "success");
        const fresh = await loadWorld(true);
        onRefetched?.(fresh); // refetch 실패 시 null — 폴백은 호출부가 결정
        if (refreshEnergy) onEnergyRefresh?.();
        return true;
      } catch (e) {
        sfx.thud();
        // 상한 20 초과/잔액 부족/FAILED 아님 등 — 서버 message 그대로 노출
        showToast(e?.response?.data?.message || "요청에 실패했습니다.", "error");
        return false;
      } finally {
        busyRef.current = false;
        setActionBusy(false);
      }
    },
    [loadWorld, onEnergyRefresh, showToast]
  );

  // ── 닫기 — 미저장 변경이 있으면 confirm ──
  const handleRequestClose = useCallback(() => {
    if (busyRef.current) return;
    sfx.click();
    if (dirty) {
      setCloseConfirm(true);
      return;
    }
    onClose?.();
  }, [dirty, onClose]);

  // ESC 닫기 — confirm/추가 폼이 열려 있으면 그것부터 정리
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== "Escape") return;
      if (confirmState || closeConfirm) return; // 모달 자체 버튼으로 처리
      // [적대 리뷰 #4] 장소 추가 폼이 열려 있으면 ESC는 폼만 닫는다 — 시트는 유지
      if (addOpen) {
        const hasInput =
          addForm.displayName.trim().length > 0 || addForm.description.trim().length > 0;
        if (hasInput && !window.confirm("작성 중인 장소 정보가 사라져요. 그래도 닫을까요?")) return;
        sfx.click();
        setAddForm({ displayName: "", description: "" });
        setAddOpen(false);
        return;
      }
      handleRequestClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleRequestClose, confirmState, closeConfirm, addOpen, addForm]);

  // [적대 리뷰 #3] 빈 이름은 백엔드가 400으로 거절 — 저장 전 클라이언트에서 먼저 막는다
  const nameEmpty = Boolean(form) && form.name.trim().length === 0;

  // ── 설정 저장 — 변경분만 PATCH. 판정 이력 있으면 재검수 경고 confirm ──
  const doSave = () =>
    runAction(
      async () => {
        const payload = {};
        if (dirtyKeys.includes("name")) payload.name = form.name.trim();
        if (dirtyKeys.includes("intro")) payload.intro = form.intro.trim();
        if (dirtyKeys.includes("lore")) payload.lore = form.lore;
        if (dirtyKeys.includes("moodTagsText")) payload.moodTags = parseMoodTags(form.moodTagsText);
        await updateUgcWorld(worldId, payload);
      },
      {
        successMessage: "세계관 설정을 저장했어요.",
        // [적대 리뷰 #3] 저장 성공 후 서버 응답 기준 재동기화 — 서버가 무시/정규화한 값
        // (trim, moodTags 클리어 등)과 폼 상태가 어긋나지 않게. refetch 실패 시에만 낙관적 폴백.
        onRefetched: (fresh) => {
          const snap = fresh ? snapshotOf(fresh) : { ...form };
          baselineRef.current = snap;
          setForm({ ...snap });
        },
      }
    );

  const handleSaveRequest = () => {
    if (!dirty || actionBusy || nameEmpty) {
      if (!dirty || nameEmpty) sfx.locked();
      return;
    }
    sfx.click();
    // [계약] PATCH 저장 시 판정 이력(APPROVED/REJECTED)은 NONE으로 리셋된다
    if (world?.reviewStatus && world.reviewStatus !== "NONE") {
      setConfirmState({
        title: "설정을 저장할까요?",
        desc: "수정하면 검수 상태가 초기화돼요.\n(공개 심사 시 재검수를 받게 됩니다)",
        confirmLabel: "저장하기",
        action: doSave,
      });
      return;
    }
    doSave();
  };

  // ── 장소 추가 — 인라인 폼 → confirm(1E 고지) → POST ──
  const locationCount = locations.length;
  const atCap = locationCount >= LOCATION_MAX;
  const addValid =
    addForm.displayName.trim().length > 0 &&
    addForm.description.trim().length > 0 &&
    addForm.description.trim().length <= LOCATION_DESC_MAX;

  const handleAddRequest = () => {
    if (!addValid || actionBusy) return;
    sfx.click();
    setConfirmState({
      title: "장소를 추가할까요?",
      desc: `에너지 ${LOCATION_COST}을 사용해 "${addForm.displayName.trim()}" 장소를 추가합니다.\n배경 일러스트가 자동으로 그려져요.`,
      confirmLabel: "추가하기",
      action: async () => {
        const ok = await runAction(
          () =>
            addUgcWorldLocation(worldId, {
              displayName: addForm.displayName.trim(),
              description: addForm.description.trim(),
            }),
          { successMessage: "장소를 추가했어요. 배경을 그리기 시작합니다.", refreshEnergy: true }
        );
        if (ok) {
          setAddForm({ displayName: "", description: "" });
          setAddOpen(false);
        }
      },
    });
  };

  // ── 장소 재시도 (무료) / 삭제 (1E 환불, danger confirm) ──
  const handleRetry = async (location) => {
    const ok = await runAction(() => retryUgcWorldLocation(worldId, location.locationKey), {
      successMessage: "배경을 다시 그리기 시작했어요.",
    });
    // [적대 리뷰 #1] 재시도 성공 시 관측 시각 리셋 — 새 생성이 다시 90초를 채우기 전엔 버튼 숨김
    if (ok) delete generatingSinceRef.current[location.locationKey];
  };

  const handleDeleteRequest = (location) => {
    setConfirmState({
      danger: true,
      title: "장소 삭제",
      desc: `"${location.displayName}" 장소를 삭제합니다.\n사용한 에너지 ${LOCATION_COST}은 환불돼요.`,
      confirmLabel: "삭제하기",
      action: () =>
        runAction(() => deleteUgcWorldLocation(worldId, location.locationKey), {
          successMessage: "장소를 삭제하고 에너지를 환불했어요.",
          refreshEnergy: true,
        }),
    });
  };

  const review = world ? REVIEW_META[world.reviewStatus] || null : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col bg-gradient-to-br from-amber-950 via-stone-950 to-orange-950"
    >
      {/* ═══ 상단바 ═══ */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 sm:px-8 pt-4 pb-2">
        <div className="flex items-center gap-2 text-xs text-white/40 uppercase tracking-[0.3em]">
          <Globe size={12} className="text-amber-300/70" />
          World Detail
        </div>
        <button
          type="button"
          onClick={handleRequestClose}
          onMouseEnter={() => sfx.hover()}
          aria-label="닫기"
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/15 text-white/50 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* ═══ 본문 ═══ */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 pb-10">
          {loading ? (
            <div className="flex items-center justify-center py-32">
              <motion.div
                className="w-10 h-10 border-2 border-amber-400/40 border-t-amber-400 rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <p className="text-rose-300 text-sm mb-4">{loadError}</p>
              <button
                type="button"
                onClick={() => { sfx.click(); loadWorld(); }}
                className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 text-sm"
              >
                다시 시도
              </button>
            </div>
          ) : world ? (
            <>
              {/* ─── 헤더: 와이드 썸네일 + 이름 + 뱃지 ─── */}
              <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-white/[0.03]">
                <div className="relative aspect-video">
                  {world.thumbnailUrl ? (
                    <img
                      src={world.thumbnailUrl}
                      alt={world.name}
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/15 bg-gradient-to-b from-stone-800/60 to-stone-950">
                      <Globe size={40} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                  {review && (
                    <span
                      className={`absolute top-3 left-3 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${review.cls}`}
                    >
                      {review.label}
                    </span>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                      {world.name}
                    </h2>
                    {world.intro && (
                      <p className="text-xs text-white/55 mt-1 line-clamp-2">{world.intro}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* ─── 설정 섹션 ─── */}
              {form && (
                <section className="mt-8">
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-base font-bold text-white tracking-wide">세계관 설정</h3>
                    {dirty && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-200 border border-amber-400/40">
                        미저장
                      </span>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-[11px] text-white/50 mb-1 block">이름</label>
                      <input
                        type="text"
                        value={form.name}
                        maxLength={30}
                        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                        className={fieldClass}
                      />
                      {nameEmpty && (
                        <p className="mt-1 text-[11px] text-rose-300/80">이름은 비울 수 없어요</p>
                      )}
                    </div>
                    <div>
                      <label className="text-[11px] text-white/50 mb-1 block">소개</label>
                      <textarea
                        value={form.intro}
                        rows={2}
                        onChange={(e) => setForm((p) => ({ ...p, intro: e.target.value }))}
                        className={`${fieldClass} resize-none`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] text-white/50 block">설정 본문</label>
                        <span
                          className={`text-[10px] tabular-nums ${
                            form.lore.length > LORE_MAX ? "text-rose-300" : "text-white/30"
                          }`}
                        >
                          {form.lore.length} / {LORE_MAX}
                        </span>
                      </div>
                      <textarea
                        value={form.lore}
                        rows={8}
                        maxLength={LORE_MAX}
                        onChange={(e) => setForm((p) => ({ ...p, lore: e.target.value }))}
                        className={`${fieldClass} resize-none`}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-white/50 mb-1 block">
                        무드 태그 <span className="text-white/30">— 콤마(,)로 구분</span>
                      </label>
                      <input
                        type="text"
                        value={form.moodTagsText}
                        placeholder="예) 몽환적, 쓸쓸한, 네온 느와르"
                        onChange={(e) => setForm((p) => ({ ...p, moodTagsText: e.target.value }))}
                        className={fieldClass}
                      />
                    </div>

                    <button
                      type="button"
                      disabled={!dirty || actionBusy || nameEmpty}
                      onClick={handleSaveRequest}
                      className={`w-full py-3 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${
                        dirty && !actionBusy && !nameEmpty
                          ? "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-amber-500/20"
                          : "bg-white/5 text-white/25 cursor-not-allowed"
                      }`}
                    >
                      <Check size={15} />
                      {actionBusy ? "저장 중…" : dirty ? "설정 저장" : "변경 사항이 없어요"}
                    </button>
                  </div>
                </section>
              )}

              {/* ─── 장소 섹션 ─── */}
              <section className="mt-10">
                <div className="flex items-end justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2 tracking-wide">
                      <MapPin size={15} className="text-amber-300" />
                      장소
                      <span className="text-[11px] font-semibold text-white/40 tabular-nums">
                        {locationCount}/{LOCATION_MAX}
                      </span>
                    </h3>
                    <p className="text-xs text-white/40 mt-0.5">
                      이 세계의 무대가 되는 장소들이에요
                    </p>
                  </div>
                  {atCap ? (
                    <span className="text-[11px] text-white/35">최대 {LOCATION_MAX}개까지 만들 수 있어요</span>
                  ) : (
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => { sfx.click(); setAddOpen((v) => !v); }}
                      onMouseEnter={() => sfx.hover()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold bg-amber-500/10 border border-amber-400/40 text-amber-200 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                    >
                      <Plus size={13} />
                      장소 추가 (<Zap size={11} className="text-amber-300" />{LOCATION_COST})
                    </button>
                  )}
                </div>

                {/* 장소 추가 인라인 폼 */}
                <AnimatePresence>
                  {addOpen && !atCap && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="mb-4 rounded-2xl border border-amber-400/25 bg-amber-500/[0.04] p-4 space-y-3">
                        <div>
                          <label className="text-[11px] text-white/50 mb-1 block">장소 이름</label>
                          <input
                            type="text"
                            value={addForm.displayName}
                            maxLength={30}
                            placeholder="예) 달빛 정원"
                            onChange={(e) =>
                              setAddForm((p) => ({ ...p, displayName: e.target.value }))
                            }
                            className={fieldClass}
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] text-white/50 block">설명</label>
                            <span
                              className={`text-[10px] tabular-nums ${
                                addForm.description.length > LOCATION_DESC_MAX
                                  ? "text-rose-300"
                                  : "text-white/30"
                              }`}
                            >
                              {addForm.description.length} / {LOCATION_DESC_MAX}
                            </span>
                          </div>
                          <textarea
                            value={addForm.description}
                            rows={3}
                            maxLength={LOCATION_DESC_MAX}
                            placeholder="이곳이 어떤 장소인지 적어주세요 — 배경 일러스트의 밑그림이 돼요"
                            onChange={(e) =>
                              setAddForm((p) => ({ ...p, description: e.target.value }))
                            }
                            className={`${fieldClass} resize-none`}
                          />
                        </div>
                        <div className="flex gap-2.5">
                          <button
                            type="button"
                            disabled={actionBusy}
                            onClick={() => { sfx.click(); setAddOpen(false); }}
                            className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 transition text-sm disabled:opacity-50"
                          >
                            취소
                          </button>
                          <button
                            type="button"
                            disabled={!addValid || actionBusy}
                            onClick={handleAddRequest}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-1.5 ${
                              addValid && !actionBusy
                                ? "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-amber-500/20"
                                : "bg-white/5 text-white/25 cursor-not-allowed"
                            }`}
                          >
                            <Zap size={13} className="text-amber-100" />
                            {LOCATION_COST} 사용해 추가
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 장소 그리드 */}
                {locations.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {locations.map((loc) => (
                      <LocationCard
                        key={loc.locationKey}
                        location={loc}
                        busy={actionBusy}
                        stalled={isStalled(loc)}
                        onRetry={handleRetry}
                        onDeleteRequest={handleDeleteRequest}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl bg-white/[0.02] border border-dashed border-white/10 px-6 py-10 text-center">
                    <div className="text-3xl mb-2 opacity-60">🗺️</div>
                    <p className="text-white/40 text-xs leading-relaxed">
                      아직 장소가 없어요.
                      <br />
                      이 세계의 첫 무대를 추가해 보세요.
                    </p>
                  </div>
                )}
              </section>
            </>
          ) : null}
        </div>
      </div>

      {/* ═══ 액션 confirm (z-[130]) ═══ */}
      <ConfirmModal
        data={confirmState}
        busy={actionBusy}
        onConfirm={async () => {
          // 이중 발화 가드 — 첫 클릭만 액션 실행
          if (confirmFiredRef.current) return;
          confirmFiredRef.current = true;
          try {
            await confirmState?.action?.();
          } finally {
            confirmFiredRef.current = false;
            setConfirmState(null);
          }
        }}
        onCancel={() => setConfirmState(null)}
      />

      {/* ═══ 미저장 닫기 confirm (z-[130]) ═══ */}
      <AnimatePresence>
        {closeConfirm && (
          <motion.div
            className="fixed inset-0 z-[130] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setCloseConfirm(false)}
            />
            <motion.div
              className="relative z-10 w-full max-w-sm rounded-2xl p-6 border border-amber-400/25"
              style={{
                background: "linear-gradient(145deg, rgba(28,18,8,0.97), rgba(20,12,6,0.96))",
                boxShadow: "0 30px 60px rgba(0,0,0,0.6)",
              }}
              initial={{ scale: 0.92, y: 16, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, y: 16, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
            >
              <h3 className="font-bold text-amber-100 mb-2">저장하지 않고 닫을까요?</h3>
              <p className="text-white/60 text-sm leading-relaxed mb-5">
                저장하지 않은 설정 변경이 있어요. 닫으면 지금까지 고친 내용이 사라집니다.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { sfx.click(); setCloseConfirm(false); }}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 transition text-sm"
                >
                  계속 수정하기
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sfx.click();
                    setCloseConfirm(false);
                    onClose?.();
                  }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-rose-600/80 hover:bg-rose-500/80 text-white transition"
                >
                  저장 안 하고 닫기
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
    </motion.div>
  );
}
