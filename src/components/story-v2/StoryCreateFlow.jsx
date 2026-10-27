import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowLeft, ArrowRight, Check, Sparkles, Users, User as UserIcon, History, Info } from "lucide-react";
import { sfx } from "../../utils/sfx";
import "../../styles/aurora-secondary.css";

// [docs/55 결정 ⑥] 스토리 히로인 상한 3→5 — 백엔드 CreateStoryV2Request @Size(max=5)와 동기. 극장(TheaterCreateFlow)은 3 유지.
const MAX_HEROINES = 5;
// [docs/55 Carry-Over] 자유 모드 관계 표기 — 동적 관계 태그가 있으면 그것, 없으면 단계 라벨
const RELATION_LABEL = { STRANGER: "타인", ACQUAINTANCE: "지인", FRIEND: "친구", LOVER: "연인", ENEMY: "적" };
const relationLabel = (r) => r?.dynamicRelationTag || RELATION_LABEL[r?.statusLevel] || "관계";
// [2026-08-05 난이도 배지 승격] 난이도 4색 단일 소스
import { DIFFICULTY_META, difficultyFilledStars } from "../../utils/difficultyMeta";
// [블록 B 페르소나] '시작 전 프로필 편집' 오버레이
import PersonaManager from "../persona/PersonaManager";
import useOverlayFocus from "../mobile/useOverlayFocus";
import { getCharacterPresentation } from "../../utils/characterPresentation";
import { assetUrl } from "../../utils/assetUrl";
import {
  fetchCreateContext,
  createStoryV2Room,
} from "../../api/StoryV2Api";
import { fetchProfile, LENS_FIELDS } from "../../api/PersonaApi";

/**
 * [Story V2] CreateFlow — 3 step (시작 장소는 LLM이 오프닝에서 자율 확정)
 *
 * step 1: World 확인 (선택한 World의 전체 시놉시스)
 * step 2: 히로인 선택 (1~3명)
 * step 3: 내 프로필 확인 — [블록 B] 피커 없이 현재 프로필 자동 적용(+시작 전 편집 진입점 1개)
  * → submit: createStoryV2Room (서버가 현재 프로필을 스냅샷)
 *
 * Props:
 *   worldId    — 진입한 World ID
 *   onCancel() — 로비로 복귀
 *   onComplete(roomId) — 방 생성 완료, ChatPage로 이동
 *
 * 409 Conflict 처리:
 *   기존 방이 있으면 overwriteExisting=false로 1차 요청 → 409 응답 →
 *   confirm 모달 → overwriteExisting=true로 재호출
 */
export default function StoryCreateFlow({ worldId, onCancel, onComplete, presetHeroineIds = null, carryOverSeed = null }) {
  // [Phase 7-V2 Pivot] presetHeroineIds 전달 시 (통합 로비에서 히로인 선택 완료) → step 3(프로필)부터 시작
  const hasPreset = Array.isArray(presetHeroineIds) && presetHeroineIds.length > 0;
  // [docs/55 Carry-Over] 보관함 '스토리로 이어가기'에서 온 진입 — 그 캐릭터를 미리 고르고 토글 ON, 캐릭터 단계부터 시작
  const seedCharacterId = carryOverSeed?.characterId ?? null;
  const MIN_STEP = hasPreset ? 3 : 1;   // 뒤로가기 하한
  const [step, setStep] = useState(hasPreset ? 3 : (seedCharacterId ? 2 : 1));
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [context, setContext] = useState(null);

  // step 2: 히로인 선택 (preset 있으면 초기값으로 주입)
  const [selectedHeroineIds, setSelectedHeroineIds] = useState(
    hasPreset ? presetHeroineIds : (seedCharacterId ? [seedCharacterId] : [])
  );
  // [docs/55] 히로인별 '관계 이어가기' 토글 — 항목 없음=아직 안 정함(관계 있으면 ON으로 간주), false=유저가 껐음
  const [carryOn, setCarryOn] = useState(() => (seedCharacterId ? { [seedCharacterId]: true } : {}));

  // step 3: [블록 B] 현재 프로필 요약 + '시작 전 편집' 진입점
  const [profile, setProfile] = useState(null);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);

  // [UX1] step 4(시작 장소) 제거 — 세계관+페르소나를 종합해 LLM이 오프닝에서 자연스럽게 확정.

  // 409 conflict 처리
  const [conflictPayload, setConflictPayload] = useState(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const dialogRef = useRef(null);
  const submittingRef = useRef(false);
  useOverlayFocus(!loading && Boolean(context) && !profileEditorOpen && !conflictPayload, dialogRef, submitting ? undefined : onCancel);

  // 초기 데이터 로드 — 월드 컨텍스트 + 현재 프로필(서버 자동 적용분 미리보기)
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([fetchCreateContext(worldId), fetchProfile()])
      .then(([ctx, prof]) => {
        if (!alive) return;
        setContext(ctx);
        setProfile(prof);
      })
      .catch((e) => {
        if (!alive) return;
        console.error("[V2-CreateFlow] context load failed", e);
        setError("월드 정보를 불러올 수 없습니다.");
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [worldId, loadAttempt]);

  // [docs/55 Carry-Over] 자유 모드 관계가 있는 히로인(대화 1건 이상)만 — 카드 뱃지/토글 근거
  const relationById = useMemo(() => {
    const map = {};
    for (const h of context?.availableHeroines || []) {
      const r = h.sandboxRelation;
      if (r && (r.logCount ?? 0) > 0) map[h.characterId] = r;
    }
    return map;
  }, [context]);
  // 시드 캐릭터가 이 세계관 풀에 없으면(세계관 불일치·비활성) 조용히 내린다 — 서버 400을 미리 막는다
  useEffect(() => {
    if (!context || !seedCharacterId) return;
    const ok = (context.availableHeroines || []).some((h) => h.characterId === seedCharacterId);
    if (!ok) setSelectedHeroineIds((prev) => prev.filter((id) => id !== seedCharacterId));
  }, [context, seedCharacterId]);
  const carryOvers = useMemo(
    () => selectedHeroineIds
      .filter((id) => relationById[id] && carryOn[id] !== false)
      .map((id) => ({ characterId: id, sandboxRoomId: relationById[id].roomId, includeLogs: true })),
    [selectedHeroineIds, relationById, carryOn],
  );
  const carriedSummary = useMemo(
    () => carryOvers.map((c) => {
      const h = (context?.availableHeroines || []).find((x) => x.characterId === c.characterId);
      return { characterId: c.characterId, name: h?.name || "캐릭터", relation: relationById[c.characterId] };
    }),
    [carryOvers, context, relationById],
  );
  const toggleCarry = (id) => {
    setCarryOn((prev) => ({ ...prev, [id]: prev[id] === false }));
  };

  // step 진행 조건
  const canProceedStep2 = selectedHeroineIds.length >= 1 && selectedHeroineIds.length <= MAX_HEROINES;
  const canProceedStep3 = useMemo(() => !!profile, [profile]);

  const goNext = () => {
    if (step === 1) {
      sfx.click();
      setStep(2);
    } else if (step === 2 && canProceedStep2) {
      sfx.click();
      setStep(3);
    } else if (step === 3 && canProceedStep3) {
      void submitCreate(false);
    }
  };

  const goPrev = () => {
    if (step > MIN_STEP) {
      sfx.click();
      setStep((s) => s - 1);
    } else {
      // [Phase 7-V2 Pivot] 하한에서 뒤로 → 상위 플로우(통합 로비)로 복귀
      sfx.click();
      onCancel?.();
    }
  };

  // 히로인 토글 (1~5명 — [docs/55 결정 ⑥])
  const toggleHeroine = (id) => {
    setSelectedHeroineIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      } else {
        if (prev.length >= MAX_HEROINES) {
          sfx.thud();
          return prev; // 최대 5명
        }
        sfx.click();
        return [...prev, id];
      }
    });
    // [docs/55] 관계가 있는 히로인을 고르면 '이어가기'는 기본 ON — 유저가 직접 끈 적 없을 때만
    if (relationById[id]) setCarryOn((prev) => (prev[id] === undefined ? { ...prev, [id]: true } : prev));
  };

  // 방 생성 — [블록 B] 페르소나·닉네임은 서버가 현재 프로필을 자동 스냅샷
  const submitCreate = async (overwriteExisting) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    const payload = {
      worldId,
      heroineIds: selectedHeroineIds,
      // [UX1] startLocationKey 미전송 — 백엔드 기본(첫 selectable) 시작, 오프닝 LLM이 location_change로 확정
      overwriteExisting,
      // [docs/55 Carry-Over] 토글 ON인 히로인만 — 없으면 필드 자체를 보내지 않는다
      ...(carryOvers.length > 0 ? { carryOvers } : {}),
    };
    try {
      const res = await createStoryV2Room(payload);
      sfx.chime();
      onComplete(res.roomId);
    } catch (e) {
      if (e.response?.status === 409) {
        // 기존 방 존재 — confirm 후 재호출
        setConflictPayload(payload);
      } else {
        console.error("[V2-CreateFlow] create failed", e);
        setError(e.response?.data?.message || "방 생성에 실패했습니다.");
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const confirmOverwrite = () => {
    if (!conflictPayload) return;
    setConflictPayload(null);
    void submitCreate(true);
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  렌더
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  if (loading) {
    return (
      <CreateStatusDialog onClose={onCancel}>
        <div role="status" className="flex flex-col items-center gap-5 text-lobby-tx1 text-sm"><span className="aurora-secondary-spinner w-8 h-8 rounded-full border-2 border-lobby-accent/20 border-t-lobby-accent" />세계의 이야기를 불러오고 있어요</div>
      </CreateStatusDialog>
    );
  }

  if (error && !context) {
    return (
      <CreateStatusDialog onClose={onCancel}>
        <p role="alert" className="text-rose-200 mb-5 leading-relaxed">{error}</p>
        <button onClick={() => setLoadAttempt((n) => n + 1)} className="aurora-secondary-primary min-h-11 w-full px-5 rounded-xl text-sm font-semibold">다시 불러오기</button>
      </CreateStatusDialog>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 bg-[#080d1d]/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          ref={dialogRef} tabIndex={-1}
          role="dialog" aria-modal="true" aria-label="이야기 시작 준비"
          className="aurora-gate border border-white/15 rounded-[28px] max-w-3xl w-full max-h-[calc(100dvh-32px)] overflow-hidden flex flex-col shadow-2xl"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
        >
          {/* 헤더 — Step Indicator */}
          <div className="shrink-0 px-5 sm:px-7 pt-5 pb-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3" aria-label={`3단계 중 ${step}단계`}>
              {[1, 2, 3].map((n) => (
                <div key={n} className="flex items-center gap-2" aria-current={n === step ? "step" : undefined}>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      n === step
                        ? "bg-lobby-accent text-[#25253b]"
                        : n < step
                        ? "bg-lobby-accent/20 text-lobby-accent"
                        : "bg-lobby-surface2 text-lobby-tx2"
                    }`}
                  >
                    {n < step ? <Check size={16} /> : n}
                  </div>
                  <span className={`hidden sm:block text-xs ${n === step ? "text-lobby-tx0 font-semibold" : "text-lobby-tx2"}`}>{["세계관", "캐릭터", "내 프로필"][n - 1]}</span>
                  {n < 3 && <div className={`w-8 h-px ${n < step ? "bg-lobby-accent/40" : "bg-lobby-surface2"}`} />}
                </div>
              ))}
            </div>
            <button
              onClick={onCancel}
              disabled={submitting}
              className="w-11 h-11 rounded-full flex items-center justify-center text-lobby-tx1 hover:bg-white/5 hover:text-white transition"
              aria-label="닫기"
            >
              <X size={22} />
            </button>
          </div>

          {/* 본문 */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain custom-scrollbar px-5 sm:px-7 py-6">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <Step1WorldConfirm key="s1" world={context.world} />
              )}
              {step === 2 && (
                <Step2HeroineSelect
                  key="s2"
                  heroines={context.availableHeroines}
                  selected={selectedHeroineIds}
                  onToggle={toggleHeroine}
                  relationById={relationById}
                  carryOn={carryOn}
                  onToggleCarry={toggleCarry}
                  seedCharacterId={seedCharacterId}
                />
              )}
              {step === 3 && (
                <Step3Profile
                  key="s3"
                  profile={profile}
                  onEdit={() => { sfx.click(0.2); setProfileEditorOpen(true); }}
                  carried={carriedSummary}
                />
              )}
            </AnimatePresence>
          </div>

          {/* 푸터 — 네비게이션 */}
          <div className="shrink-0 px-5 sm:px-7 py-4 border-t border-white/10 flex flex-wrap gap-3 items-center justify-between">
            <button
              onClick={goPrev}
              disabled={step === 1 || submitting}
              className="flex items-center gap-2 min-h-11 px-4 py-2 text-sm text-lobby-tx1 disabled:opacity-30 hover:bg-lobby-surface2 rounded transition"
            >
              <ArrowLeft size={18} /> 이전
            </button>

            {error && <div className="text-rose-200 text-sm order-last w-full leading-relaxed" role="alert">{error}</div>}

            <button
              onClick={goNext}
              disabled={
                submitting ||
                (step === 2 && !canProceedStep2) ||
                (step === 3 && !canProceedStep3)
              }
              className="flex items-center gap-2 min-h-11 px-6 py-2 text-sm aurora-secondary-primary font-semibold rounded-xl disabled:opacity-30 transition"
            >
              {step === 3 ? (submitting ? "이야기 준비 중…" : "이야기 시작하기") : "다음"}
              {step < 3 && <ArrowRight size={18} />}
            </button>
          </div>
        </motion.div>

        {/* 409 Conflict 모달 */}
        {conflictPayload && (
          <ConflictModal
            onConfirm={confirmOverwrite}
            onCancel={() => setConflictPayload(null)}
            carryCount={carryOvers.length}
          />
        )}

        {/* [블록 B 페르소나] '시작 전 프로필 편집' — 저장/로드 시 요약 즉시 갱신 */}
        <PersonaManager
          open={profileEditorOpen}
          onClose={() => setProfileEditorOpen(false)}
          onProfileChange={(p) => setProfile(p)}
        />
      </motion.div>
    </AnimatePresence>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Step 1 — World 확인
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function Step1WorldConfirm({ world }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      <h2 className="text-2xl font-semibold text-lobby-tx0 flex items-start gap-2 break-words">
        <Sparkles size={22} /> {world.displayName}
      </h2>
      {world.heroImageUrl && (
        <img
          src={assetUrl(world.heroImageUrl)}
          alt={world.displayName}
          className="w-full h-48 object-cover rounded-lg"
        />
      )}
      {world.tagline && <p className="text-lobby-tx1 italic">{world.tagline}</p>}
      {world.description && (
        <p className="text-lobby-tx1 leading-relaxed whitespace-pre-wrap">{world.description}</p>
      )}
      {world.moodKeywords && (
        <div className="flex flex-wrap gap-2 pt-2">
          {world.moodKeywords.split(",").map((k, i) => (
            <span key={i} className="px-2.5 py-1 text-xs bg-lobby-surface2 text-lobby-tx1 rounded-full">
              {k.trim()}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Step 2 — 히로인 선택
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function Step2HeroineSelect({ heroines, selected, onToggle, relationById = {}, carryOn = {}, onToggleCarry, seedCharacterId = null }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <h2 className="text-xl font-bold text-lobby-accent mb-1 flex items-center gap-2">
        <Users size={20} /> 동행할 히로인 선택
      </h2>
      <p className="text-sm text-lobby-tx1 mb-4" aria-live="polite">1~{MAX_HEROINES}명 선택 (현재 {selected.length}명)</p>
      {/* [docs/55 §6-C] 4명째부터 분산 힌트 — 차단이 아니라 안내 */}
      {selected.length >= 4 && (
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-lobby-tx1 -mt-2 mb-4" role="note">
          <Info size={14} className="shrink-0 mt-px text-lobby-accent" aria-hidden="true" />
          인원이 많으면 한 장면에 모이는 이들이 늘어 이야기가 분산될 수 있어요.
        </p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {heroines.map((h) => {
          const isSelected = selected.includes(h.characterId);
          const presentation = getCharacterPresentation({ ...h, thumbnailUrl: h.profileImageUrl });
          // [docs/55 Carry-Over] 자유 모드 관계(대화 1건 이상)가 있으면 카드 아래 뱃지 + 선택 시 토글
          const relation = relationById[h.characterId] || null;
          const carrying = Boolean(relation) && isSelected && carryOn[h.characterId] !== false;
          return (
            <div key={h.characterId} className="flex flex-col">
            <button
              type="button" aria-pressed={isSelected}
              onClick={() => onToggle(h.characterId)}
              className={`relative text-left bg-lobby-surface2 rounded-2xl overflow-hidden border transition ${
                isSelected ? "border-lobby-accent" : "border-transparent hover:border-stone-600"
              }`}
            >
              <div className="relative h-40 overflow-hidden bg-lobby-bg/40">
                {presentation.backgroundUrl && <img src={presentation.backgroundUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-70" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
                {h.profileImageUrl ? <img src={assetUrl(h.profileImageUrl)} alt="" className="relative w-full h-full object-cover object-top" /> : <div className="flex items-center justify-center h-full text-lobby-accent/40"><UserIcon size={40} /></div>}
              </div>
              <div className="p-3">
                <div className="font-medium text-white flex items-start flex-wrap gap-1.5">
                  <span className="min-w-0 break-words">{h.name}</span>
                  {/* [2026-08-04 난이도] 공략 난이도 미니 표기 — NORMAL 숨김 정책 유지
                      [2026-08-05 난이도 배지 승격] 하드코딩 3색 → difficultyMeta 단일 소스 소비 */}
                  {h.difficulty !== "NORMAL" && DIFFICULTY_META[h.difficulty] && (
                    <span
                      className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md border ${DIFFICULTY_META[h.difficulty].badgeCls}`}
                    >
                      {difficultyFilledStars(h.difficulty)}
                    </span>
                  )}
                </div>
                {h.role && <div className="text-xs text-lobby-tx1 mt-0.5">{h.role}</div>}
                {h.tagline && (
                  <div className="text-xs text-lobby-tx2 mt-1 line-clamp-2">{h.tagline}</div>
                )}
              </div>
              {isSelected && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-lobby-accent text-[#25253b] rounded-full flex items-center justify-center">
                  <Check size={14} />
                </div>
              )}
            </button>
            {relation && (
              <div className="mt-1.5 rounded-xl border border-white/[0.08] bg-lobby-surface2/70 px-2.5 py-2 flex flex-col gap-1.5 min-w-0">
                {/* 1행: 관계 요약(좁은 카드에서도 핵심어가 남도록 짧게) · 2행: 선택 시에만 토글 — 라벨은 상태와 무관하게 고정 */}
                <span className="flex items-start gap-1.5 min-w-0 text-xs leading-snug text-lobby-tx1" title={`자유 모드 · ${relationLabel(relation)} · 호감 ${relation.affectionScore} · 대화 ${relation.logCount}건`}>
                  <History size={13} className="shrink-0 mt-px text-cyan-300" aria-hidden="true" />
                  <span className="min-w-0 break-keep">자유 모드 · {relationLabel(relation)} · 대화 {relation.logCount}건</span>
                </span>
                {isSelected && (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={carrying}
                    aria-label={`${h.name} 관계 이어가기`}
                    onClick={() => onToggleCarry?.(h.characterId)}
                    className={carrying
                      ? "w-full inline-flex items-center justify-between gap-2 min-h-8 rounded-lg px-2 text-[11px] font-semibold bg-cyan-400/15 text-cyan-200 transition-colors"
                      : "w-full inline-flex items-center justify-between gap-2 min-h-8 rounded-lg px-2 text-[11px] font-semibold bg-white/[0.06] text-lobby-tx2 hover:text-lobby-tx1 transition-colors"}
                  >
                    <span className="truncate">관계 이어가기</span>
                    <span className={carrying ? "relative shrink-0 inline-block w-7 h-4 rounded-full bg-cyan-400 transition-colors" : "relative shrink-0 inline-block w-7 h-4 rounded-full bg-white/20 transition-colors"} aria-hidden="true">
                      <span className={carrying ? "absolute top-0.5 left-3.5 w-3 h-3 rounded-full bg-[#101624] transition-all" : "absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-[#101624] transition-all"} />
                    </span>
                  </button>
                )}
              </div>
            )}
            {/* 보관함 '이어가기'로 들어왔는데 그 자유 방에 가시 대화가 없으면(logCount 0) 이어갈 기록이 없다 — 말없이 새로 시작하지 않고 알린다 */}
            {!relation && seedCharacterId != null && seedCharacterId === h.characterId && (
              <p className="mt-1.5 rounded-xl border border-white/[0.08] bg-lobby-surface2/70 px-2.5 py-2 text-xs leading-snug text-lobby-tx1" role="note">
                아직 나눈 대화가 없어 이어갈 기록이 없어요. 새 관계로 시작해요.
              </p>
            )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Step 3 — 페르소나
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function Step3Profile({ profile, onEdit, carried = [] }) {
  // [블록 B] 피커 제거 — 서버가 현재 프로필을 자동 스냅샷하므로 여기서는 확인+편집 진입점만
  const lensTotal = profile
    ? LENS_FIELDS.reduce((s, [k]) => s + (Number(profile[k]) || 0), 0)
    : 0;
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <h2 className="text-xl font-bold text-lobby-accent mb-1 flex items-center gap-2">
        <UserIcon size={20} /> 내 프로필로 시작
      </h2>
      <p className="text-sm text-lobby-tx1 mb-4">
        이 세계에는 지금의 프로필이 그대로 들어가요 — 시작 후에는 바꿀 수 없어요.
      </p>

      {profile ? (
        <div className="p-5 rounded-2xl border border-lobby-accent/60 bg-lobby-surface2 space-y-2.5">
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-white">{profile.name}</span>
            <span className="text-xs text-lobby-tx1">
              {profile.gender === "FEMALE" ? "여성" : "남성"}{profile.age ? ` · ${profile.age}세` : " · 나이 미설정"}
            </span>
          </div>
          {profile.personaText ? (
            <p className="text-xs text-lobby-tx1 line-clamp-3 whitespace-pre-wrap">{profile.personaText}</p>
          ) : (
            <p className="text-xs text-lobby-tx2">소개가 비어 있어요 — 편집에서 채울 수 있어요.</p>
          )}
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {LENS_FIELDS.map(([key, label]) => (
              <span key={key}
                className="text-xs px-2 py-0.5 rounded-full bg-lobby-surface2/60 text-lobby-tx1">
                {label} {Number(profile[key]) || 0}
              </span>
            ))}
            <span className="text-xs px-2 py-0.5 rounded-full bg-lobby-accent/10 text-lobby-accent">
              렌즈 {lensTotal}p
            </span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-lobby-tx2">프로필을 불러오는 중…</p>
      )}

      <button
        onClick={onEdit}
        className="mt-3 w-full min-h-11 py-2.5 rounded-xl text-sm font-medium bg-lobby-surface2 text-lobby-tx1 hover:bg-white/10 transition"
      >
        시작 전 프로필 편집
      </button>

      {/* [docs/55 Carry-Over] 이어갈 관계 요약 — 시작 직전 마지막 확인 (복사임을 명시) */}
      {carried.length > 0 && (
        <section className="mt-5 p-4 rounded-2xl border border-cyan-400/25 bg-cyan-400/[0.06]" aria-labelledby="carry-over-head">
          <h3 id="carry-over-head" className="flex items-center gap-2 text-sm font-semibold text-cyan-200">
            <History size={15} aria-hidden="true" /> 자유 모드에서 이어갈 관계
          </h3>
          <ul className="mt-2.5 space-y-1.5">
            {carried.map((c) => (
              <li key={c.characterId} className="flex items-center justify-between gap-3 text-xs">
                <span className="font-medium text-lobby-tx0 truncate">{c.name}</span>
                <span className="text-lobby-tx1 shrink-0">
                  {relationLabel(c.relation)} · 호감 {c.relation?.affectionScore ?? 0} · 대화 {c.relation?.logCount ?? 0}건
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-xs leading-relaxed text-lobby-tx1">
            관계와 기억, 나눈 대화를 그대로 안고 이 세계에서 다시 만나요. 자유 모드 기록은 그대로 남아요.
          </p>
        </section>
      )}
    </motion.div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Conflict Modal (기존 방 덮어쓰기 확인)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ConflictModal({ onConfirm, onCancel, carryCount = 0 }) {
  const dialogRef = useRef(null);
  useOverlayFocus(true, dialogRef, onCancel);
  return (
    <motion.div
      className="absolute inset-0 z-10 bg-black/70 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="기존 스토리 초기화 확인" tabIndex={-1} className="aurora-gate border border-white/15 rounded-[24px] p-6 max-w-md max-h-[calc(100dvh-32px)] overflow-y-auto">
        <h3 className="text-lg font-bold text-lobby-accent mb-3">기존 진행 중인 스토리가 있습니다</h3>
        <p className="text-lobby-tx1 mb-2">
          이 월드에 이미 진행 중인 스토리가 있습니다. 새로 시작하면 <strong className="font-semibold text-rose-200">현재 진행이 모두 사라집니다.</strong>
        </p>
        <p className="text-lobby-tx2 text-sm mb-5">
          캐릭터 관계, 시간 진행, 호감도, 모든 누적 기억이 초기화되고 <strong className="font-semibold text-lobby-tx1">방금 고른 캐릭터로</strong> 1일차부터 다시 시작합니다.
        </p>
        {carryCount > 0 && (
          <p className="text-cyan-200/90 text-sm -mt-3 mb-5">
            자유 모드에서 이어가기로 한 관계 {carryCount}건은 새 스토리에 그대로 적용돼요.
          </p>
        )}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="min-h-11 px-4 py-2 text-lobby-tx1 hover:bg-lobby-surface2 rounded-xl transition"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="min-h-11 px-4 py-2 bg-rose-700 hover:bg-rose-600 text-white font-medium rounded-xl transition"
          >
            새로 시작
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function CreateStatusDialog({ children, onClose }) {
  const dialogRef = useRef(null);
  useOverlayFocus(true, dialogRef, onClose);
  return (
    <div className="fixed inset-0 z-50 bg-[#080d1d]/80 backdrop-blur-md flex items-center justify-center p-4">
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-label="이야기 시작 준비" tabIndex={-1} className="aurora-gate w-full max-w-md border border-white/15 p-8 rounded-[28px] text-center max-h-[calc(100dvh-32px)] overflow-y-auto">
        {children}
        <button onClick={onClose} className="min-h-11 mt-5 w-full px-4 py-2 text-sm text-lobby-tx1 hover:bg-white/5 rounded-xl">로비로 돌아가기</button>
      </section>
    </div>
  );
}
