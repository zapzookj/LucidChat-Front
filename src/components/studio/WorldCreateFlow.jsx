import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  X, Check, Sparkles, Wand2, RefreshCw, Zap, ArrowLeft, Globe, MapPin,
  Plus, Trash2, AlertTriangle, Image as ImageIcon,
} from "lucide-react";
import {
  createUgcWorld, updateWorldDraft, startWorldIllustration,
  rerollWorldThumbnail, selectWorldThumbnail,
  rerollWorldLocation, selectWorldLocation,
  confirmWorldCreation, abandonWorldCreationJob,
  LAST_WORLD_JOB_KEY,
} from "../../api/WorldStudioApi";
import useUgcWorldJob from "../../hooks/useUgcWorldJob";
import { sfx } from "../../utils/sfx";

/**
 * [World Builder v1] WorldCreateFlow — UGC 세계관 생성 전체화면 위저드
 *
 * StudioCreateFlow의 골격(fixed inset-0 z-[100] 오버레이 + STEP_LABELS 스테퍼 +
 * AnimatePresence mode="wait" x슬라이드 + ConfirmModal/runAction)을 4스텝으로 축소.
 * 스텝 전환은 서버 잡 status에 의해 구동된다.
 *
 * status → 스텝 매핑:
 *   CONCEPT_PROCESSING            → 1 (컨셉 분석 로딩)
 *   EDIT_WAIT                     → 2 (설정 편집 — 스냅샷 1회 시딩 폼)
 *   ILLUSTRATING · REVIEW_WAIT    → 3 (일러 검수 그리드 — GENERATING 스피너 오버레이)
 *   BINDING                       → 3 (봉인 로딩)
 *   READY                         → 4 (완성)
 *   FAILED · EXPIRED              → 에러 뷰 ("처음부터 다시" — FAILED는 전액 환불)
 *
 * Props:
 *   initialJobId    : string|null — 있으면 진행 중 잡 재개, 없으면 컨셉 스텝부터
 *   energy          : number      — 현재 에너지 (표시용)
 *   onClose         : () => void  — 위저드 이탈 (잡은 서버에서 계속 진행)
 *   onEnergyRefresh : () => void  — 에너지 차감 액션 후 상위 갱신 트리거
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  상수
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const STEP_LABELS = [
  { n: 1, label: "컨셉" },
  { n: 2, label: "편집" },
  { n: 3, label: "일러스트" },
  { n: 4, label: "완성" },
];

const CONCEPT_MIN = 30;
const CONCEPT_MAX = 1000;
const LORE_MAX = 2000;
const CREATE_COST = 10;

// 컨셉 분석(CONCEPT_PROCESSING) 중 순환 서사 카피
const WORLD_CONCEPT_COPY = [
  "세계의 뼈대를 세우는 중…",
  "지도의 여백을 채우는 중…",
  "장소들의 이름을 짓는 중…",
  "세계의 공기를 고르는 중…",
];

// "나가서 기다리기"가 허용되는 상태 — 잡이 서버에서 계속 돌아가는 구간
const LEAVE_ALLOWED_STATUSES = new Set([
  "EDIT_WAIT", "ILLUSTRATING", "REVIEW_WAIT", "BINDING",
]);

// 중도 포기 버튼을 노출하는 상태
const ABANDON_ALLOWED_STATUSES = new Set([
  "EDIT_WAIT", "ILLUSTRATING", "REVIEW_WAIT",
]);

// [적대 리뷰 #5] 종결 뷰를 보여준 뒤(또는 잡 정리 후) 재진입 복원 키 제거
const clearLastWorldJobKey = () => localStorage.removeItem(LAST_WORLD_JOB_KEY);

function resolveStep(job) {
  const s = job?.status;
  if (s === "CONCEPT_PROCESSING") return 1;
  if (s === "EDIT_WAIT") return 2;
  if (s === "ILLUSTRATING" || s === "REVIEW_WAIT" || s === "BINDING") return 3;
  if (s === "READY") return 4;
  return 0; // FAILED / EXPIRED
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  공용 소품 (StudioCreateFlow와 동일 폼팩터)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SpinnerRing = ({ size = 40, className = "" }) => (
  <motion.div
    className={`border-2 border-amber-400/30 border-t-amber-400 rounded-full ${className}`}
    style={{ width: size, height: size }}
    animate={{ rotate: 360 }}
    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
  />
);

/** 순환 서사 카피 — 페이드로 교차 */
const CyclingCopy = ({ lines, interval = 3500, className = "" }) => {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setIdx((i) => (i + 1) % lines.length), interval);
    return () => clearInterval(timer);
  }, [lines, interval]);
  return (
    <div className={`relative h-6 ${className}`}>
      <AnimatePresence mode="wait">
        <motion.p
          key={idx}
          className="absolute inset-0 text-center text-sm text-amber-100/80"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.5 }}
        >
          {lines[idx]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
};

/** confirm 모달 — 비용/포기 등 확인 (z-[130], 위저드 위) */
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

const fieldClass =
  "w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm leading-relaxed placeholder:text-white/25 focus:border-amber-400/60 outline-none";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  STEP 1 — 컨셉 입력
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const WORLD_CONCEPT_PLACEHOLDER = `예시처럼 자유롭게 적어주세요.

· 마력이 전기 대신 흐르는 1920년대풍 항구 도시. 밀수업자와 마도공학자들이 뒤섞여 산다.
· 백 년째 밤이 끝나지 않는 왕국. 사람들은 달빛 정원에서 꿈을 수확하며 살아간다.
· 폐교 직전의 산골 학교. 오래된 괴담이 하나씩 현실이 되기 시작한다.`;

const WorldConceptStep = ({ busy, error, energy, onSubmitRequest }) => {
  const [name, setName] = useState("");
  const [moodHint, setMoodHint] = useState("");
  const [concept, setConcept] = useState("");
  const len = concept.trim().length;
  const valid = len >= CONCEPT_MIN && len <= CONCEPT_MAX;
  const lackEnergy = energy < CREATE_COST;

  return (
    <div className="max-w-xl mx-auto w-full">
      <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
        <Globe size={16} className="text-amber-300" />
        어떤 세계를 빚을까요?
      </h3>
      <p className="text-xs text-white/50 mb-5">
        떠오르는 세계의 인상을 자유롭게 적어주세요. 설정과 장소는 스튜디오가 채워드려요.
      </p>

      {/* 이름 (선택) */}
      <div className="mb-4">
        <label className="text-xs text-white/60 mb-1.5 block">세계관 이름 (선택)</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="비우면 AI가 지어줘요"
          maxLength={30}
          className={fieldClass}
        />
      </div>

      {/* 무드 힌트 (선택) */}
      <div className="mb-4">
        <label className="text-xs text-white/60 mb-1.5 block">무드 힌트 (선택)</label>
        <input
          type="text"
          value={moodHint}
          onChange={(e) => setMoodHint(e.target.value)}
          placeholder="예) 몽환적이고 쓸쓸한, 네온 느와르"
          maxLength={60}
          className={fieldClass}
        />
      </div>

      {/* 컨셉 */}
      <div className="mb-5">
        <label className="text-xs text-white/60 mb-1.5 block">컨셉 *</label>
        <textarea
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          placeholder={WORLD_CONCEPT_PLACEHOLDER}
          rows={8}
          maxLength={CONCEPT_MAX}
          className={`${fieldClass} resize-none`}
        />
        <div className={`mt-1 text-right text-[11px] tabular-nums ${valid ? "text-white/40" : "text-amber-300/70"}`}>
          {len} / {CONCEPT_MIN}~{CONCEPT_MAX}자
        </div>
      </div>

      {/* 에너지 고지 */}
      <div className="flex items-center gap-1.5 mb-5 text-amber-300/85">
        <Zap size={14} />
        <span className="text-xs font-semibold">생성 시작 시 에너지 {CREATE_COST} 소모</span>
        {lackEnergy && <span className="text-xs text-rose-300/80 ml-1">· 에너지가 부족해요</span>}
      </div>

      {/* 에러 (400/402 — 서버 메시지 그대로) */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-400/25 text-rose-200 text-xs leading-relaxed">
          {error}
        </div>
      )}

      <motion.button
        type="button"
        disabled={!valid || busy || lackEnergy}
        onClick={() => {
          if (!valid || busy || lackEnergy) { sfx.locked(); return; }
          sfx.click();
          onSubmitRequest({ name, moodHint, concept: concept.trim() });
        }}
        onMouseEnter={() => sfx.hover()}
        whileTap={{ scale: valid && !busy ? 0.98 : 1 }}
        className={`w-full py-3.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${
          valid && !busy && !lackEnergy
            ? "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-amber-500/25"
            : "bg-white/5 text-white/25 cursor-not-allowed"
        }`}
      >
        <Sparkles size={16} />
        {busy ? "준비 중…" : "세계 만들기"}
      </motion.button>
    </div>
  );
};

/** CONCEPT_PROCESSING 로딩 연출 */
const ConceptProcessingView = () => (
  <div className="flex flex-col items-center justify-center py-16">
    <div className="relative mb-8">
      <SpinnerRing size={72} />
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <Globe size={26} className="text-amber-300" />
      </motion.div>
    </div>
    <CyclingCopy lines={WORLD_CONCEPT_COPY} className="w-full mb-2" />
    <p className="text-xs text-white/35">보통 10~30초 정도 걸려요. 잠시만 기다려 주세요.</p>
  </div>
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  STEP 2 — 설정 편집 (EDIT_WAIT)
//  draft 스냅샷 1회 시딩 — 폴링 갱신이 입력을 덮지 않도록 (ProfileEditPanel 패턴)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** draft → 폼 스냅샷 */
const snapshotOfDraft = (draft) => ({
  name: draft?.name || "",
  intro: draft?.intro || "",
  lore: draft?.lore || "",
  moodTags: (draft?.moodTags || []).join(", "),
  locations: (draft?.locations || []).map((l) => ({
    locationKey: l.locationKey ?? null,
    displayName: l.displayName || "",
    description: l.description || "",
  })),
});

/** 폼 → PATCH draft 페이로드 (기존 장소는 locationKey 유지 — 프롬프트 승계) */
const buildDraftPayload = (form) => ({
  name: form.name.trim() || null,
  intro: form.intro.trim() || null,
  lore: form.lore.trim() || null,
  moodTags: form.moodTags.split(",").map((s) => s.trim()).filter(Boolean),
  locations: form.locations.map((l) => ({
    ...(l.locationKey ? { locationKey: l.locationKey } : {}),
    displayName: l.displayName.trim(),
    description: l.description.trim(),
  })),
});

const WorldEditStep = ({ job, busy, error, onSave, onIllustrateRequest }) => {
  const draft = job?.draft || null;
  const maxLocations = job?.maxLocations ?? 10;

  const [form, setForm] = useState(null); // null = 미시딩
  const baselineRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [savedToast, setSavedToast] = useState(false);
  const toastTimerRef = useRef(null);

  // 1회 시딩 — 이후 폴링으로 job이 갱신돼도 입력을 덮지 않는다
  useEffect(() => {
    if (form === null && draft) {
      const snap = snapshotOfDraft(draft);
      baselineRef.current = snap;
      setForm(JSON.parse(JSON.stringify(snap)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, form === null]);

  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  if (!form) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <SpinnerRing size={48} className="mb-4" />
        <p className="text-sm text-white/45">설정 초안을 불러오는 중…</p>
      </div>
    );
  }

  const dirty = JSON.stringify(form) !== JSON.stringify(baselineRef.current);
  const locs = form.locations;
  const locsValid =
    locs.length >= 1 &&
    locs.length <= maxLocations &&
    locs.every((l) => l.displayName.trim() && l.description.trim());
  const valid = locsValid && form.lore.length <= LORE_MAX;

  const setLoc = (idx, key, value) =>
    setForm((p) => ({
      ...p,
      locations: p.locations.map((l, i) => (i === idx ? { ...l, [key]: value } : l)),
    }));
  const addLoc = () => {
    if (locs.length >= maxLocations) { sfx.locked(); return; }
    sfx.click();
    setForm((p) => ({
      ...p,
      locations: [...p.locations, { locationKey: null, displayName: "", description: "" }],
    }));
  };
  const removeLoc = (idx) => {
    if (locs.length <= 1) { sfx.locked(); return; }
    sfx.click();
    setForm((p) => ({ ...p, locations: p.locations.filter((_, i) => i !== idx) }));
  };

  const handleSave = async () => {
    if (!dirty || !valid || saving || busy) {
      if (!dirty || !valid) sfx.locked();
      return;
    }
    sfx.click();
    setSaving(true);
    setSaveError(null);
    const result = await onSave(buildDraftPayload(form));
    setSaving(false);
    if (result?.ok) {
      baselineRef.current = JSON.parse(JSON.stringify(form));
      clearTimeout(toastTimerRef.current);
      setSavedToast(true);
      toastTimerRef.current = setTimeout(() => setSavedToast(false), 2500);
    } else {
      setSaveError(result?.message || "저장에 실패했습니다.");
    }
  };

  return (
    <div className="max-w-2xl mx-auto w-full">
      <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
        <Wand2 size={16} className="text-amber-300" />
        세계관 다듬기
      </h3>
      <p className="text-xs text-white/50 mb-5">
        AI가 쓴 초안이에요. 마음껏 고쳐도 좋아요 — 일러스트를 시작하면 장소 구성은 바꿀 수 없어요.
      </p>

      <div className="space-y-4 mb-5">
        {/* 이름 */}
        <div>
          <label className="text-[11px] text-white/50 mb-1 block">세계관 이름</label>
          <input
            type="text"
            value={form.name}
            maxLength={30}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            className={fieldClass}
          />
        </div>

        {/* 소개 */}
        <div>
          <label className="text-[11px] text-white/50 mb-1 block">소개</label>
          <textarea
            value={form.intro}
            rows={3}
            maxLength={500}
            onChange={(e) => setForm((p) => ({ ...p, intro: e.target.value }))}
            placeholder="이 세계를 처음 만나는 사람에게 건네는 한두 문단"
            className={`${fieldClass} resize-none`}
          />
        </div>

        {/* 설정 본문 (lore) */}
        <div>
          <label className="text-[11px] text-white/50 mb-1 block">설정 본문</label>
          <textarea
            value={form.lore}
            rows={8}
            maxLength={LORE_MAX}
            onChange={(e) => setForm((p) => ({ ...p, lore: e.target.value }))}
            placeholder="세계의 규칙·역사·분위기를 자유롭게"
            className={`${fieldClass} resize-none`}
          />
          <div className="mt-1 text-right text-[11px] tabular-nums text-white/40">
            {form.lore.length} / {LORE_MAX}자
          </div>
        </div>

        {/* 무드 태그 */}
        <div>
          <label className="text-[11px] text-white/50 mb-1 block">무드 태그</label>
          <input
            type="text"
            value={form.moodTags}
            maxLength={120}
            onChange={(e) => setForm((p) => ({ ...p, moodTags: e.target.value }))}
            placeholder="쉼표로 구분해요 (예: 몽환적, 잿빛, 네온)"
            className={fieldClass}
          />
        </div>

        {/* 장소 리스트 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] text-white/50 flex items-center gap-1.5">
              <MapPin size={11} className="text-amber-300/70" />
              장소 ({locs.length}/{maxLocations})
            </label>
            <span className="text-[10px] text-amber-200/45">
              각 장소가 대화 배경 일러스트가 돼요
            </span>
          </div>
          <div className="space-y-3">
            {locs.map((loc, idx) => (
              <div
                key={loc.locationKey || `new-${idx}`}
                className="rounded-2xl border border-white/10 hover:border-amber-400/40 bg-white/[0.03] p-4 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-white/45 uppercase tracking-wider">
                    장소 {idx + 1}
                    {!loc.locationKey && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-400/15 text-amber-200 border border-amber-400/30 normal-case tracking-normal">
                        신규
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    disabled={busy || saving || locs.length <= 1}
                    onClick={() => removeLoc(idx)}
                    aria-label="장소 삭제"
                    className="w-7 h-7 flex items-center justify-center rounded-full bg-white/5 hover:bg-rose-500/15 text-white/40 hover:text-rose-300 transition-colors disabled:opacity-30"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <input
                  type="text"
                  value={loc.displayName}
                  maxLength={30}
                  placeholder="장소 이름 (예: 달빛 시장)"
                  onChange={(e) => setLoc(idx, "displayName", e.target.value)}
                  className={`${fieldClass} mb-2`}
                />
                <textarea
                  value={loc.description}
                  rows={2}
                  maxLength={300}
                  placeholder="이 장소의 풍경·분위기를 적어주세요 — 배경 일러스트의 재료가 돼요"
                  onChange={(e) => setLoc(idx, "description", e.target.value)}
                  className={`${fieldClass} resize-none`}
                />
              </div>
            ))}
          </div>
          {/* 장소 추가 */}
          <button
            type="button"
            disabled={busy || saving || locs.length >= maxLocations}
            onClick={addLoc}
            onMouseEnter={() => sfx.hover()}
            className="mt-3 w-full py-3 rounded-2xl border border-dashed border-white/20 hover:border-amber-400/50 bg-white/[0.02] hover:bg-amber-500/[0.04] text-white/50 hover:text-amber-100 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={13} />
            {locs.length >= maxLocations ? `장소는 최대 ${maxLocations}개까지예요` : "장소 추가"}
          </button>
        </div>
      </div>

      {!locsValid && (
        <p className="mb-3 text-[11px] text-amber-300/70">
          모든 장소에 이름과 설명을 채워주세요. (1~{maxLocations}개)
        </p>
      )}

      {(saveError || error) && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-400/25 text-rose-200 text-xs">
          {saveError || error}
        </div>
      )}

      {/* 저장 / 일러스트 시작 */}
      <div className="flex gap-3">
        <button
          type="button"
          disabled={!dirty || !valid || saving || busy}
          onClick={handleSave}
          className={`flex-1 py-3.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-1.5 ${
            dirty && valid && !saving && !busy
              ? "bg-white/5 hover:bg-white/10 border border-white/10 hover:border-amber-400/40 text-white/70 hover:text-amber-100"
              : "bg-white/5 text-white/25 cursor-not-allowed border border-transparent"
          }`}
        >
          <Check size={14} />
          {saving ? "저장 중…" : dirty ? "초안 저장" : "저장됨"}
        </button>
        <motion.button
          type="button"
          disabled={!valid || saving || busy}
          onClick={() => {
            if (!valid || saving || busy) { sfx.locked(); return; }
            sfx.click();
            onIllustrateRequest({ dirty, payload: buildDraftPayload(form) });
          }}
          onMouseEnter={() => sfx.hover()}
          whileTap={{ scale: valid && !busy ? 0.98 : 1 }}
          className={`flex-[2] py-3.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${
            valid && !saving && !busy
              ? "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-amber-500/25"
              : "bg-white/5 text-white/25 cursor-not-allowed"
          }`}
        >
          <ImageIcon size={15} />
          {busy ? "처리 중…" : "일러스트 시작"}
        </motion.button>
      </div>

      {/* 저장 성공 토스트 */}
      <AnimatePresence>
        {savedToast && (
          <motion.div
            className="fixed bottom-24 left-1/2 z-[115] px-5 py-3 rounded-2xl backdrop-blur-xl border shadow-2xl text-sm font-medium bg-emerald-900/80 border-emerald-400/30 text-emerald-200 shadow-emerald-500/20"
            initial={{ x: "-50%", y: 20, opacity: 0, scale: 0.9 }}
            animate={{ x: "-50%", y: 0, opacity: 1, scale: 1 }}
            exit={{ x: "-50%", y: 20, opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            초안을 저장했어요.
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  STEP 3 — 일러 검수 (ILLUSTRATING / REVIEW_WAIT) + BINDING 로딩
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const BindingView = () => (
  <div className="flex flex-col items-center justify-center py-20">
    <SpinnerRing size={64} className="mb-6" />
    <motion.p
      className="text-sm text-amber-100/85 font-medium mb-2"
      animate={{ opacity: [0.55, 1, 0.55] }}
      transition={{ duration: 2, repeat: Infinity }}
    >
      세계를 봉인하는 중…
    </motion.p>
    <p className="text-xs text-white/35">마지막 손질이에요. 곧 완성됩니다.</p>
  </div>
);

/** 16:9 일러 컷 셀 — GENERATING: 직전본 위 스피너 / READY: 리롤 / FAILED: 무료 재시도 */
const AssetCell = ({ title, asset, wide = false, busy, rerollCost, onZoom, onReroll }) => {
  const status = asset?.status;
  const url = asset?.url || null;
  const generating = status === "GENERATING";
  const failed = status === "FAILED";
  const ready = status === "READY";

  return (
    <div
      className={`relative rounded-2xl overflow-hidden border transition-colors bg-white/[0.03] ${
        failed ? "border-rose-400/40" : "border-white/10 hover:border-amber-400/40"
      } ${wide ? "border-amber-400/25" : ""}`}
    >
      <button
        type="button"
        onClick={() => { if (url) { sfx.click(); onZoom(); } }}
        className={`relative block w-full aspect-video ${url ? "cursor-zoom-in" : "cursor-default"}`}
      >
        {url ? (
          <img src={url} alt={title} className="w-full h-full object-cover" draggable={false} />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-stone-900/40 to-black/60">
            {failed ? (
              <AlertTriangle size={20} className="text-rose-300/80" />
            ) : (
              <SpinnerRing size={26} />
            )}
          </div>
        )}
        {/* GENERATING — 직전 선택본 위 스피너 오버레이 (url 유지 계약) */}
        {generating && url && (
          <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center gap-2">
            <SpinnerRing size={26} />
            <span className="text-[10px] text-amber-100/70">다시 그리는 중…</span>
          </div>
        )}
      </button>
      {/* 하단 컨트롤 바 */}
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-black/40">
        <span className="text-[10px] text-white/65 truncate flex items-center gap-1">
          {wide && <ImageIcon size={9} className="text-amber-300/70 flex-shrink-0" />}
          {title}
        </span>
        {failed ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => { sfx.click(); onReroll(true); }}
            className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/40 text-rose-200 text-[9px] font-bold disabled:opacity-50"
          >
            <RefreshCw size={8} /> 무료 재시도
          </button>
        ) : ready ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => { sfx.click(); onReroll(false); }}
            className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-white/5 hover:bg-white/15 border border-white/15 text-white/60 hover:text-amber-100 text-[9px] font-bold transition-colors disabled:opacity-50"
            title={`에너지 ${rerollCost}로 다시 그리기`}
          >
            <RefreshCw size={8} /> <Zap size={8} className="text-amber-300" />{rerollCost}
          </button>
        ) : (
          <span className="text-[9px] text-white/35">그리는 중</span>
        )}
      </div>
    </div>
  );
};

const WorldReviewStep = ({ job, busy, error, onRerollRequest, onVersionSelect, onConfirmRequest }) => {
  const status = job?.status;
  const thumb = job?.thumbnail || null;
  const locAssets = job?.locationAssets || {};
  const draftLocs = job?.draft?.locations || [];
  const rerollCost = job?.rerollCost ?? 1;
  const [zoom, setZoom] = useState(null); // {kind:'thumb'} | {kind:'loc', key} | null

  // 확대 대상은 매 렌더 job에서 다시 읽는다 — 폴링 갱신(버전 도착)을 그대로 반영
  const zoomAsset = zoom
    ? (zoom.kind === "thumb" ? thumb : locAssets[zoom.key]) || {}
    : {};
  const zoomTitle = zoom
    ? zoom.kind === "thumb"
      ? "월드 썸네일"
      : draftLocs.find((l) => l.locationKey === zoom.key)?.displayName || zoom.key
    : "";
  const zoomTarget = zoom ? { ...zoom, title: zoomTitle } : null;
  const zoomVersions = zoomAsset.versions || [];
  const zoomSelectedIdx = zoomAsset.selectedIndex ?? zoomVersions.length - 1;
  const zoomInProgress = Boolean(zoom) && zoomAsset.status === "GENERATING";

  const allReady =
    thumb?.status === "READY" &&
    draftLocs.length > 0 &&
    draftLocs.every((l) => locAssets[l.locationKey]?.status === "READY");
  const canConfirm = allReady && status === "REVIEW_WAIT";

  return (
    <div className="max-w-3xl mx-auto w-full">
      <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
        <ImageIcon size={16} className="text-amber-300" />
        세계의 풍경 검수
      </h3>
      <p className="text-xs text-white/50 mb-5">
        마음에 들지 않는 컷은 다시 그릴 수 있어요. 탭하면 크게 보고 버전을 고를 수 있습니다.
      </p>

      {/* 썸네일 — 와이드 1칸 */}
      <div className="mb-4">
        <AssetCell
          title={`월드 썸네일${job?.draft?.name ? ` · ${job.draft.name}` : ""}`}
          asset={thumb}
          wide
          busy={busy}
          rerollCost={rerollCost}
          onZoom={() => setZoom({ kind: "thumb" })}
          onReroll={(isFree) => onRerollRequest({ kind: "thumb", title: "월드 썸네일" }, isFree)}
        />
      </div>

      {/* 장소별 배경 그리드 (16:9) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        {draftLocs.map((loc) => (
          <AssetCell
            key={loc.locationKey}
            title={loc.displayName || loc.locationKey}
            asset={locAssets[loc.locationKey]}
            busy={busy}
            rerollCost={rerollCost}
            onZoom={() => setZoom({ kind: "loc", key: loc.locationKey })}
            onReroll={(isFree) =>
              onRerollRequest(
                { kind: "loc", key: loc.locationKey, title: loc.displayName || loc.locationKey },
                isFree
              )
            }
          />
        ))}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-400/25 text-rose-200 text-xs">
          {error}
        </div>
      )}

      <motion.button
        type="button"
        disabled={!canConfirm || busy}
        onClick={() => {
          if (!canConfirm || busy) { sfx.locked(); return; }
          sfx.click();
          onConfirmRequest();
        }}
        whileTap={{ scale: canConfirm && !busy ? 0.98 : 1 }}
        className={`w-full py-3.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${
          canConfirm && !busy
            ? "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-amber-500/25"
            : "bg-white/5 text-white/25 cursor-not-allowed"
        }`}
      >
        <Check size={16} />
        {canConfirm
          ? "이 세계로 확정"
          : status === "ILLUSTRATING"
          ? "세계의 풍경을 그리는 중이에요…"
          : "모든 컷이 준비되면 확정할 수 있어요"}
      </motion.button>
      <p className="mt-3 text-center text-[11px] text-white/35">
        생성은 서버에서 계속 진행돼요. 나가서 기다려도 괜찮아요.
      </p>

      {/* 확대 프리뷰 + 버전 스트립 (z-[120]) */}
      <AnimatePresence>
        {zoom && (
          <motion.div
            className="fixed inset-0 z-[120] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setZoom(null)} />
            {/* [폴리싱 #5] 확대 프리뷰 — 뷰포트 최대 활용 (이미지 크기에 맞춰 폭 결정) */}
            <motion.div
              className="relative z-10 flex flex-col max-w-[92vw] max-h-[86vh]"
              initial={{ scale: 0.92 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.92 }}
            >
              <div className="relative rounded-2xl overflow-hidden border border-amber-400/30 mx-auto">
                {zoomAsset.url ? (
                  <img
                    src={zoomAsset.url}
                    alt={zoomTitle}
                    className="max-w-[92vw] max-h-[72vh] w-auto h-auto object-contain bg-black/90"
                  />
                ) : (
                  <div className="w-[min(92vw,64rem)] aspect-video flex items-center justify-center bg-black/90">
                    <SpinnerRing size={36} />
                  </div>
                )}
                {/* 리롤/재시도 중 — 직전 선택본 위 스피너 오버레이 */}
                {zoomInProgress && zoomAsset.url && (
                  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2">
                    <SpinnerRing size={32} />
                    <span className="text-[11px] text-amber-100/70">다시 그리는 중…</span>
                  </div>
                )}
              </div>

              {/* 버전 스트립 — 완성본 누적 리스트에서 무료로 골라 되돌리기 */}
              {zoomVersions.length > 1 && (
                <div className="mt-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-[11px] text-white/55 font-bold">버전 선택</span>
                    <span className="px-1.5 py-0.5 rounded-full bg-teal-500/15 border border-teal-400/30 text-teal-200 text-[9px] font-bold">
                      무료
                    </span>
                    <span className="text-[10px] text-white/35">이전에 그린 컷으로 언제든 바꿀 수 있어요</span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1.5">
                    {zoomVersions.map((url, vi) => {
                      const isSelected = vi === zoomSelectedIdx;
                      return (
                        <button
                          key={vi}
                          type="button"
                          disabled={busy || zoomInProgress || isSelected}
                          onClick={() => { sfx.click(); onVersionSelect(zoomTarget, vi); }}
                          className={`relative flex-shrink-0 w-28 aspect-video rounded-lg overflow-hidden border-2 transition-colors ${
                            isSelected
                              ? "border-amber-400"
                              : "border-white/10 hover:border-amber-300/60"
                          } disabled:cursor-default ${busy || zoomInProgress ? "opacity-60" : ""}`}
                        >
                          <img src={url} alt={`버전 ${vi + 1}`} className="w-full h-full object-cover" draggable={false} />
                          {isSelected && (
                            <span className="absolute inset-x-0 bottom-0 bg-amber-500/85 text-[8px] text-white font-bold text-center py-0.5">
                              사용 중
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mt-3">
                <span className="text-sm text-amber-100 font-bold">{zoomTitle}</span>
                <button
                  type="button"
                  onClick={() => { sfx.click(); setZoom(null); }}
                  className="px-4 py-2 rounded-xl bg-white/10 text-white/70 text-xs hover:bg-white/20 transition"
                >
                  닫기
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  STEP 4 — 완성 (READY)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const WorldCompleteStep = ({ job, onExit, onCreateCharacter }) => {
  const draft = job?.draft || {};
  const thumbUrl = job?.thumbnail?.url || null;
  const locAssets = job?.locationAssets || {};
  const moodTags = draft.moodTags || [];

  // 등장 SFX — 1회
  const sparkledRef = useRef(false);
  useEffect(() => {
    if (sparkledRef.current) return;
    sparkledRef.current = true;
    sfx.sparkle();
  }, []);

  return (
    <div className="max-w-2xl mx-auto w-full">
      {/* 썸네일 히어로 */}
      <motion.div
        className="relative rounded-2xl overflow-hidden border border-amber-400/25 mb-5 shadow-[0_0_60px_rgba(251,191,36,0.12)]"
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        {thumbUrl ? (
          <img src={thumbUrl} alt={draft.name || "완성된 세계"} className="w-full aspect-video object-cover" draggable={false} />
        ) : (
          <div className="w-full aspect-video flex items-center justify-center bg-gradient-to-b from-stone-900/40 to-black/60">
            <Globe size={40} className="text-amber-300/40" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles size={14} className="text-amber-300" />
            <span className="text-[10px] uppercase tracking-[0.3em] text-amber-200/70 font-bold">
              World Complete
            </span>
          </div>
          <h3 className="text-2xl font-black text-white">{draft.name || "이름 없는 세계"}</h3>
          {moodTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {moodTags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-200 text-[10px] font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* 소개 */}
      {draft.intro && (
        <motion.p
          className="text-sm text-white/60 leading-relaxed mb-5 px-1"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.6 }}
        >
          {draft.intro}
        </motion.p>
      )}

      {/* 장소 리스트 요약 */}
      <motion.div
        className="rounded-2xl bg-white/[0.03] border border-white/10 p-4 mb-6"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.6 }}
      >
        <div className="flex items-center gap-1.5 mb-3">
          <MapPin size={13} className="text-amber-300/80" />
          <span className="text-xs font-bold text-white/70">
            이 세계의 장소 {draft.locations?.length || 0}곳
          </span>
        </div>
        <div className="space-y-2.5">
          {(draft.locations || []).map((loc) => (
            <div key={loc.locationKey} className="flex items-center gap-3">
              <div className="w-24 aspect-video rounded-lg overflow-hidden border border-white/10 flex-shrink-0 bg-black/40">
                {locAssets[loc.locationKey]?.url ? (
                  <img
                    src={locAssets[loc.locationKey].url}
                    alt={loc.displayName}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/15">
                    <ImageIcon size={14} />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">{loc.displayName}</div>
                <div className="text-[11px] text-white/40 truncate mt-0.5">{loc.description}</div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* CTA */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => { sfx.click(); onExit(); }}
          className="flex-1 py-3 rounded-xl bg-white/5 text-white/55 hover:bg-white/10 transition text-sm"
        >
          스튜디오로 돌아가기
        </button>
        <button
          type="button"
          onClick={() => { sfx.click(); onCreateCharacter(); }}
          onMouseEnter={() => sfx.hover()}
          className="flex-1 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-amber-500/25 transition flex items-center justify-center gap-1.5"
        >
          <Wand2 size={15} />
          캐릭터 만들러 가기
        </button>
      </div>
      <p className="mt-3 text-center text-[11px] text-white/35">
        이 세계에서 살아갈 캐릭터를 소환하고 연결해 보세요.
      </p>
    </div>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  메인 컴포넌트
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function WorldCreateFlow({
  initialJobId = null,
  energy = 0,
  onClose,
  onEnergyRefresh = null,
}) {
  const navigate = useNavigate();
  const [jobId, setJobId] = useState(initialJobId || null);
  const { job, loading: jobLoading, error: jobFetchError, refresh } = useUgcWorldJob(jobId);

  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [confirmState, setConfirmState] = useState(null); // {title,desc,confirmLabel,danger,action}

  const hasJob = Boolean(jobId);
  const status = job?.status || null;
  const isFailed = status === "FAILED" || status === "EXPIRED";
  const step = hasJob ? resolveStep(job) : 1;
  const rerollCost = job?.rerollCost ?? 1;

  // 스텝 전환 시 에러 초기화
  useEffect(() => { setActionError(null); }, [step]);

  // [적대 리뷰 #5] 잡 시작/재개 시 마지막 잡 ID 기록 — 이탈 중 종결(READY/FAILED/EXPIRED)되면
  // activeJob에서 빠지므로, StudioWorldPage 부트가 이 키로 종결 뷰를 1회 복원한다
  useEffect(() => {
    if (jobId) localStorage.setItem(LAST_WORLD_JOB_KEY, jobId);
  }, [jobId]);

  // ─── 공통 액션 러너 ───
  // [폴리싱 #8] state 기반 busy는 리렌더 전 2번째 클릭이 통과한다 — ref 기반 재진입 락으로 연타 차단
  const busyRef = useRef(false);
  const confirmFiredRef = useRef(false); // ConfirmModal 확인 버튼 이중 발화 가드
  const runAction = useCallback(
    async (fn, successSfx = null) => {
      if (busyRef.current) return false;
      busyRef.current = true;
      setActionBusy(true);
      setActionError(null);
      try {
        await fn();
        successSfx?.();
        await refresh();
        onEnergyRefresh?.();
        return true;
      } catch (e) {
        sfx.thud();
        setActionError(e?.response?.data?.message || "요청에 실패했습니다.");
        return false;
      } finally {
        busyRef.current = false;
        setActionBusy(false);
      }
    },
    [refresh, onEnergyRefresh]
  );

  // ─── STEP 1: 생성 시작 (confirm → POST) ───
  const handleConceptSubmitRequest = (payload) => {
    setConfirmState({
      title: "세계 생성 시작",
      desc: `에너지 ${CREATE_COST}를 사용해 세계관 생성을 시작합니다.\nAI가 설정 초안과 장소를 먼저 써 드려요.`,
      confirmLabel: "시작하기",
      action: async () => {
        setActionBusy(true);
        setActionError(null);
        try {
          const res = await createUgcWorld(payload);
          sfx.sparkle();
          setJobId(res.jobId);
          onEnergyRefresh?.();
        } catch (e) {
          sfx.thud();
          // 400(진행 중 잡/잔액 부족/모더레이션 차단): 서버 메시지 그대로
          setActionError(e?.response?.data?.message || "세계 생성을 시작하지 못했습니다.");
        } finally {
          setActionBusy(false);
        }
      },
    });
  };

  // ─── STEP 2: 초안 저장 (성공 여부는 스텝이 토스트로 처리) ───
  const handleDraftSave = useCallback(
    async (payload) => {
      try {
        await updateWorldDraft(jobId, payload);
        sfx.chime();
        await refresh(); // 폴링 주기를 기다리지 않고 저장 결과를 즉시 반영
        return { ok: true };
      } catch (e) {
        sfx.thud();
        return { ok: false, message: e?.response?.data?.message || "저장에 실패했습니다." };
      }
    },
    [jobId, refresh]
  );

  // ─── STEP 2: 일러스트 시작 (confirm → 미저장분 PATCH → POST illustrate) ───
  const handleIllustrateRequest = ({ dirty, payload }) => {
    setConfirmState({
      title: "일러스트 시작",
      desc: "장소 구성은 이후 수정할 수 없어요.\n썸네일과 장소별 배경 일러스트를 그리기 시작합니다.",
      confirmLabel: "일러스트 시작",
      action: () =>
        runAction(async () => {
          if (dirty) await updateWorldDraft(jobId, payload);
          await startWorldIllustration(jobId);
        }, sfx.sparkle),
    });
  };

  // ─── STEP 3: 리롤 (READY=유료 confirm / FAILED=무료 즉시) ───
  const handleAssetRerollRequest = (target, isFree) => {
    const fn =
      target.kind === "thumb"
        ? () => rerollWorldThumbnail(jobId)
        : () => rerollWorldLocation(jobId, target.key);
    if (isFree) {
      runAction(fn, sfx.chime);
      return;
    }
    setConfirmState({
      title: `${target.title} 다시 그리기`,
      desc: `에너지 ${rerollCost}을 사용해 이 컷을 다시 생성합니다.\n이전 완성본은 버전 목록에 남아 언제든 무료로 되돌릴 수 있어요.`,
      confirmLabel: "다시 그리기",
      action: () => runAction(fn, sfx.chime),
    });
  };

  // ─── STEP 3: 버전 선택 (무과금) ───
  const handleAssetVersionSelect = (target, versionIndex) => {
    const fn =
      target.kind === "thumb"
        ? () => selectWorldThumbnail(jobId, versionIndex)
        : () => selectWorldLocation(jobId, target.key, versionIndex);
    return runAction(fn, sfx.chime);
  };

  // ─── STEP 3: 확정 ───
  const handleConfirmRequest = () => {
    setConfirmState({
      title: "이 세계로 확정",
      desc: "확정하면 컷을 더 이상 다시 그릴 수 없어요.\n마무리 작업 후 세계관이 등록됩니다.",
      confirmLabel: "확정하기",
      action: () => runAction(() => confirmWorldCreation(jobId), sfx.chime),
    });
  };

  // ─── 중도 포기 (무환불) ───
  const handleAbandonRequest = () => {
    setConfirmState({
      danger: true,
      title: "세계 만들기 중도 포기",
      desc: "이 생성 작업을 삭제합니다. 사용한 에너지는 환불되지 않아요.",
      confirmLabel: "포기하기",
      action: async () => {
        setActionBusy(true);
        try {
          await abandonWorldCreationJob(jobId);
          clearLastWorldJobKey(); // 잡이 삭제됨 — 재진입 복원 대상 아님
          sfx.thud();
          onClose?.();
        } catch (e) {
          setActionError(e?.response?.data?.message || "삭제에 실패했습니다.");
        } finally {
          setActionBusy(false);
        }
      },
    });
  };

  // ─── FAILED/EXPIRED: 처음부터 다시 (정리 후 컨셉 스텝으로) ───
  const handleRestartRequest = () => {
    setConfirmState({
      title: "처음부터 다시",
      desc:
        status === "FAILED"
          ? "실패한 작업은 사용한 에너지가 전액 환불돼요.\n작업을 정리하고 새로 시작합니다."
          : "만료된 작업을 정리하고 새로 시작합니다.",
      confirmLabel: "다시 시작",
      action: async () => {
        setActionBusy(true);
        setActionError(null);
        try {
          await abandonWorldCreationJob(jobId);
          clearLastWorldJobKey(); // 잡이 정리됨 — 재진입 복원 대상 아님
          sfx.chime();
          setJobId(null);
          onEnergyRefresh?.();
        } catch (e) {
          sfx.thud();
          setActionError(e?.response?.data?.message || "작업 정리에 실패했습니다.");
        } finally {
          setActionBusy(false);
        }
      },
    });
  };

  // ─── 이탈 제어 — CONCEPT_PROCESSING엔 대기 유도, 그 외 진행 구간은 "나가서 기다리기" ───
  const canLeave = !hasJob || LEAVE_ALLOWED_STATUSES.has(status) || isFailed || status === "READY";
  const canAbandon = hasJob && ABANDON_ALLOWED_STATUSES.has(status);

  const handleLeave = () => {
    sfx.click();
    // [적대 리뷰 #5] 종결 뷰(완성/실패/만료)를 보고 닫는 경우 — 재진입 시 다시 보여주지 않는다
    if (isFailed || status === "READY") clearLastWorldJobKey();
    onClose?.();
  };

  // ─── 스텝 콘텐츠 키 (AnimatePresence mode="wait") ───
  const contentKey = isFailed
    ? "failed"
    : hasJob && !job
    ? "job-loading"
    : `step-${step}-${status === "BINDING" ? "binding" : "main"}`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col bg-gradient-to-br from-amber-950 via-stone-950 to-orange-950"
    >
      {/* ═══ 헤더 ═══ */}
      <div className="flex-shrink-0 px-5 sm:px-8 pt-4">
        <div className="flex items-center justify-between mb-4">
          {/* 좌: 이탈 */}
          {!hasJob ? (
            <button
              type="button"
              onClick={handleLeave}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-md border border-white/10 text-white/60 hover:text-white hover:bg-black/50 transition-colors"
            >
              <X size={14} />
              <span className="text-xs tracking-wide">닫기</span>
            </button>
          ) : canLeave ? (
            <button
              type="button"
              onClick={handleLeave}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-md border border-white/10 text-white/60 hover:text-white hover:bg-black/50 transition-colors"
            >
              <ArrowLeft size={14} />
              <span className="text-xs tracking-wide">나가서 기다리기</span>
            </button>
          ) : (
            <div className="w-8" />
          )}

          <div className="flex items-center gap-2 text-xs text-white/40 uppercase tracking-[0.3em]">
            <Globe size={12} className="text-amber-300/70" />
            World Builder
          </div>

          {/* 우: 에너지 */}
          <div className="flex items-center gap-1.5 bg-black/20 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/10">
            <Zap size={13} className="text-amber-300" />
            <span className="text-sm font-semibold text-white tabular-nums">{energy}</span>
          </div>
        </div>

        {/* 스테퍼 — StudioCreateFlow와 같은 폼팩터 */}
        {!isFailed && (
          <div className="max-w-xl mx-auto w-full">
            <div className="flex items-start gap-1.5 sm:gap-2">
              {STEP_LABELS.map(({ n, label }) => {
                const isCurrent = n === step;
                const isPast = n < step;
                return (
                  <div key={n} className="flex items-start gap-1.5 sm:gap-2 flex-1 last:flex-initial">
                    <div className="flex flex-col items-center min-w-0">
                      <motion.div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${
                          isPast
                            ? "bg-amber-500 border-amber-300 text-white shadow-md shadow-amber-500/20"
                            : isCurrent
                            ? "bg-amber-500/22 border-amber-300 text-amber-100"
                            : "bg-white/[0.04] border-white/15 text-white/45"
                        }`}
                      >
                        {isPast ? <Check size={14} /> : n}
                      </motion.div>
                      <span
                        className={`mt-1.5 text-[9px] sm:text-[10px] tracking-wider font-medium uppercase whitespace-nowrap transition-colors ${
                          isCurrent ? "text-amber-100" : isPast ? "text-amber-200/70" : "text-white/35"
                        }`}
                      >
                        {label}
                      </span>
                    </div>
                    {n < STEP_LABELS.length && (
                      <div
                        className={`flex-1 h-[1px] mt-3.5 transition-colors ${
                          isPast ? "bg-amber-300/60" : "bg-white/10"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ═══ 본문 ═══ */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-5 sm:px-8 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={contentKey}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.35 }}
            className="min-h-full flex flex-col justify-center"
          >
            {/* 잡 초기 로딩 — 로드 실패 시 이탈 경로 제공 */}
            {hasJob && !job && !isFailed && (
              <div className="flex flex-col items-center justify-center py-24">
                {!jobLoading && jobFetchError ? (
                  <>
                    <p className="text-sm text-rose-300/90 mb-4">{jobFetchError}</p>
                    <button
                      type="button"
                      onClick={handleLeave}
                      className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-sm transition-colors"
                    >
                      스튜디오로 돌아가기
                    </button>
                  </>
                ) : (
                  <>
                    <SpinnerRing size={48} className="mb-4" />
                    <p className="text-sm text-white/45">세계 생성 상태를 불러오는 중…</p>
                  </>
                )}
              </div>
            )}

            {/* 에러 뷰 — FAILED / EXPIRED */}
            {isFailed && (
              <div className="max-w-md mx-auto w-full text-center py-12">
                <div className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center bg-rose-500/10 border border-rose-400/30">
                  <AlertTriangle size={26} className="text-rose-300" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  {status === "EXPIRED" ? "생성 작업이 만료되었어요" : "세계 생성에 실패했어요"}
                </h3>
                <p className="text-sm text-white/50 leading-relaxed mb-3 whitespace-pre-line">
                  {job?.failReason ||
                    (status === "EXPIRED"
                      ? "오랫동안 진행되지 않아 작업이 만료되었습니다."
                      : "생성 과정에서 문제가 발생했습니다.")}
                </p>
                {status === "FAILED" && (
                  <p className="text-xs text-teal-200/80 mb-6">
                    사용한 에너지는 전액 환불돼요.
                  </p>
                )}
                {actionError && (
                  <div className="mb-4 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-400/25 text-rose-200 text-xs">
                    {actionError}
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => { sfx.click(); handleRestartRequest(); }}
                    className="flex-1 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-amber-500/25 transition disabled:opacity-50"
                  >
                    처음부터 다시
                  </button>
                  <button
                    type="button"
                    onClick={handleLeave}
                    className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-sm transition-colors"
                  >
                    스튜디오로 돌아가기
                  </button>
                </div>
              </div>
            )}

            {/* STEP 1 — 컨셉 입력 또는 분석 로딩 */}
            {!isFailed && !hasJob && (
              <WorldConceptStep
                busy={actionBusy}
                error={actionError}
                energy={energy}
                onSubmitRequest={handleConceptSubmitRequest}
              />
            )}
            {!isFailed && hasJob && job && step === 1 && <ConceptProcessingView />}

            {/* STEP 2 — 설정 편집 */}
            {!isFailed && hasJob && job && step === 2 && (
              <WorldEditStep
                job={job}
                busy={actionBusy}
                error={actionError}
                onSave={handleDraftSave}
                onIllustrateRequest={handleIllustrateRequest}
              />
            )}

            {/* STEP 3 — 일러 검수 / 봉인 */}
            {!isFailed && hasJob && job && step === 3 && (
              status === "BINDING" ? (
                <BindingView />
              ) : (
                <WorldReviewStep
                  job={job}
                  busy={actionBusy}
                  error={actionError}
                  onRerollRequest={handleAssetRerollRequest}
                  onVersionSelect={handleAssetVersionSelect}
                  onConfirmRequest={handleConfirmRequest}
                />
              )
            )}

            {/* STEP 4 — 완성 */}
            {!isFailed && hasJob && job && step === 4 && (
              <WorldCompleteStep
                job={job}
                onExit={handleLeave}
                onCreateCharacter={() => {
                  clearLastWorldJobKey(); // 완성 뷰에서 바로 이동해도 키 제거
                  navigate("/studio", { state: { openCreate: true } });
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ═══ 중도 포기 — 진행 구간에서만 노출 (하단 좌측, 은은하게) ═══ */}
      <AnimatePresence>
        {canAbandon && (
          <motion.button
            type="button"
            disabled={actionBusy}
            onClick={() => { sfx.click(); handleAbandonRequest(); }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-5 left-5 sm:bottom-7 sm:left-7 z-[105] px-3 py-1.5 rounded-full text-[11px] text-white/30 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-400/25 transition-colors disabled:opacity-40"
          >
            중도 포기
          </motion.button>
        )}
      </AnimatePresence>

      {/* ═══ confirm 모달 ═══ */}
      <ConfirmModal
        data={confirmState}
        busy={actionBusy}
        onCancel={() => setConfirmState(null)}
        onConfirm={async () => {
          // [폴리싱 #8] 확인 버튼 이중 발화 차단 — setConfirmState(null)이 플러시되기 전
          // 2번째 클릭이 confirmState를 다시 읽는 것을 ref 가드로 막는다
          if (confirmFiredRef.current) return;
          confirmFiredRef.current = true;
          try {
            const action = confirmState?.action;
            setConfirmState(null);
            if (action) await action();
          } finally {
            confirmFiredRef.current = false;
          }
        }}
      />
    </motion.div>
  );
}
