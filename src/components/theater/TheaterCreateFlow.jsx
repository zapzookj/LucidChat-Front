import { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  X, ChevronLeft, ChevronRight, Check, Sparkles, Users, User,
  Lock, RotateCcw, Heart, Crown, Star, Gem
} from "lucide-react";
import { createTheaterSession } from "../../api/TheaterLobbyApi";
import { useAuth } from "../../context/AuthContext";

/**
 * [Phase 5.5-Theater] Theater 세션 생성 플로우
 *
 * 4단계:
 *   STEP 1: 히로인 선택 (해당 세계관의 캐릭터들 — 단일/다중)
 *   STEP 2: 아바타 기본 정보 (이름 + 성별/나이/체형 프리셋)
 *   STEP 3: 성격/백스토리 (성격 태그 + 자유 텍스트)
 *   STEP 4: 스탯 분배 (Lucid Pass 가입자만 활성, 무료는 skip)
 *
 * Props:
 *   world         : 선택된 세계관 카드 (TheaterLobbyTab에서 전달)
 *   onClose       : 닫기
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  프리셋 데이터
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const GENDER_OPTIONS = [
  { value: "MALE", label: "남성", icon: "♂" },
  { value: "FEMALE", label: "여성", icon: "♀" },
  { value: "OTHER", label: "그 외", icon: "✦" },
];

const AGE_OPTIONS = [
  { value: "TEEN", label: "10대" },
  { value: "TWENTIES", label: "20대" },
  { value: "THIRTIES", label: "30대" },
  { value: "FORTIES", label: "40대" },
  { value: "MATURE", label: "50대 이상" },
];

const PHYSIQUE_OPTIONS = [
  { value: "SLIM", label: "마른" },
  { value: "AVERAGE", label: "보통" },
  { value: "TONED", label: "탄탄한" },
  { value: "STURDY", label: "우람한" },
  { value: "CURVY", label: "풍만한" },
];

const PERSONALITY_TAGS = [
  "내향적", "외향적", "냉소적", "낙천적", "열정적", "차분한",
  "유머러스", "진지한", "섬세한", "대담한", "호기심 많은", "고집스러운",
  "친절한", "까칠한", "낭만적", "현실적", "몽상가", "계산적",
];

const RELATION_START_OPTIONS = [
  { value: "FIRST_MEETING", label: "첫 만남", desc: "아무 인연도 없는 첫 조우" },
  { value: "OLD_FRIEND", label: "오랜 친구", desc: "이미 가까운 사이" },
  { value: "REUNION", label: "오랜만의 재회", desc: "과거의 인연이 되살아난다" },
  { value: "CONTRACT", label: "계약 관계", desc: "어떤 이해관계로 얽힌 관계" },
  { value: "ARRANGED", label: "주선된 관계", desc: "제3자가 맺어준 만남" },
];

const STAT_AXES = [
  { key: "charm", label: "매력", icon: "✨", color: "pink", desc: "외모와 첫인상" },
  { key: "wit", label: "입담", icon: "💬", color: "cyan", desc: "언변과 유머 감각" },
  { key: "boldness", label: "담력", icon: "🔥", color: "orange", desc: "용기와 결단력" },
  { key: "intellect", label: "지성", icon: "📘", color: "indigo", desc: "지식과 통찰" },
  { key: "empathy", label: "감수성", icon: "🌸", color: "rose", desc: "공감과 섬세함" },
];

// [Phase III · B-4] 스텝 인디케이터 라벨
const STEP_LABELS = [
  { n: 1, label: "히로인" },
  { n: 2, label: "아바타" },
  { n: 3, label: "페르소나" },
  { n: 4, label: "스탯" },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  공통 버튼 스타일
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const ChipButton = ({ selected, onClick, children, disabled, className = "" }) => (
  <motion.button
    type="button"
    onClick={onClick}
    disabled={disabled}
    whileTap={{ scale: disabled ? 1 : 0.95 }}
    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
      selected
        ? "bg-indigo-500/20 border-indigo-400/60 text-indigo-100"
        : "bg-white/[0.03] border-white/10 text-white/60 hover:bg-white/[0.08]"
    } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"} ${className}`}
  >
    {children}
  </motion.button>
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  메인 컴포넌트
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Props:
 *   world             : 선택된 세계관 카드 (TheaterPortalPage / LobbyPage에서 전달)
 *   onClose           : 닫기
 *   initialHeroineIds : Long[]  — 진입 시 미리 선택될 히로인 ID 배열
 *                       (LobbyPage의 ModeSelectOverlay에서 Theater 선택 시 사용)
 *   onOpenStore       : () => void  — [Phase III · B-4] 무료 유저 Step 4 업셀
 *                       Lucid Store를 열기 위한 콜백 (옵션, 없으면 버튼 미노출)
 */
export default function TheaterCreateFlow({
  world,
  onClose,
  initialHeroineIds = [],
  onOpenStore = null,
}) {
  const { user } = useAuth();
  const navigate = useNavigate();

  // 구독 티어로 스탯 분배 한도 결정.
  // [Polish · P0] 매핑 재정렬:
  //   - LUCID_MIDNIGHT_PASS (24,900원/월, 프리미엄) → 40 / perStat 20
  //   - LUCID_PASS         (14,900원/월, 표준)    → 20 / perStat 10
  //   - 그 외(미구독, deprecated LUCID_PASS_PREMIUM) → 0 (분배 잠김)
  //   기존엔 LUCID_PASS_PREMIUM이 Premium에 매핑되었지만 실제 결제 모델에는
  //   LUCID_PASS_PREMIUM이 존재하지 않아 모든 유저가 사실상 STANDARD(20/10) 또는
  //   FREE(0/0)였다. 백엔드(TheaterLobbyService.validateInitialStats)와 동일한
  //   매핑을 사용해 위변조 시도 시 검증 실패가 나도록 정합성 확보.
  // ⚠️ LUCID_MIDNIGHT_PASS는 추후 "분배 무제한" 정책으로 전환될 예정 — 지금은 임시 40/20.
  const statTier = useMemo(() => {
    const tier = user?.subscriptionTier;
    if (tier === "LUCID_MIDNIGHT_PASS") return { total: 500, perStat: 100, label: "프리미엄" };
    if (tier === "LUCID_PASS") return { total: 20, perStat: 10, label: "표준" };
    return { total: 0, perStat: 0, label: null };
  }, [user]);

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // 폼 상태
  // [Phase I] LobbyPage의 ModeSelectOverlay 진입 경로 지원 —
  //          캐릭터 카드에서 Theater를 고른 경우 그 캐릭터가 prefilled.
  //          단, 잘못된 ID 주입 방지를 위해 world.heroines와 교집합 처리.
  const [selectedHeroineIds, setSelectedHeroineIds] = useState(() => {
    if (!Array.isArray(initialHeroineIds) || initialHeroineIds.length === 0) return [];
    const validIds = new Set((world?.heroines || []).map((h) => h.id));
    return initialHeroineIds.filter((id) => validIds.has(id)).slice(0, 3);
  });
  const [form, setForm] = useState({
    avatarName: "",
    gender: "MALE",
    ageRange: "TWENTIES",
    physique: "AVERAGE",
    appearance: "",
    role: "",
    personalityTags: [],
    relationStart: "FIRST_MEETING",
    backstory: "",
    personaText: "",
  });
  const [stats, setStats] = useState({
    charm: 0, wit: 0, boldness: 0, intellect: 0, empathy: 0,
  });

  const heroines = world?.heroines || [];
  const isMultiHeroineWorld = heroines.length > 1;

  // ─── 히로인 토글 ───
  const toggleHeroine = (id) => {
    setSelectedHeroineIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  // ─── 성격 태그 토글 ───
  const togglePersonalityTag = (tag) => {
    setForm((f) => {
      const tags = f.personalityTags.includes(tag)
        ? f.personalityTags.filter((t) => t !== tag)
        : f.personalityTags.length < 5
        ? [...f.personalityTags, tag]
        : f.personalityTags;
      return { ...f, personalityTags: tags };
    });
  };

  // ─── 스탯 분배 ───
  const totalStatUsed = Object.values(stats).reduce((a, b) => a + b, 0);
  const remainingPoints = statTier.total - totalStatUsed;

  const adjustStat = (key, delta) => {
    setStats((prev) => {
      const cur = prev[key];
      const next = cur + delta;
      if (next < 0) return prev;
      if (next > statTier.perStat) return prev;
      const nextTotal = totalStatUsed + delta;
      if (nextTotal > statTier.total) return prev;
      return { ...prev, [key]: next };
    });
  };

  /**
   * [Polish] 슬라이더 드래그용 직접 값 설정.
   *
   * 단순히 다른 stat 합을 그대로 두고 target stat만 바꾼다. 다른 stat 합을
   * 줄여서 강제로 끼워 맞추진 않는다 (사용자 의도 보존).
   *
   * 제약:
   *   1) 0 <= value <= perStat
   *   2) (다른 stat 합) + value <= total
   *   → 위반하면 허용된 최대치로 클램프 (조용히 — 명시적 에러는 X)
   */
  const setStatDirect = (key, value) => {
    setStats((prev) => {
      const others = Object.entries(prev)
        .filter(([k]) => k !== key)
        .reduce((sum, [, v]) => sum + v, 0);
      const maxByTotal = statTier.total - others;
      const maxByPerStat = statTier.perStat;
      const clamped = Math.max(0, Math.min(value, maxByTotal, maxByPerStat));
      if (prev[key] === clamped) return prev;
      return { ...prev, [key]: clamped };
    });
  };

  const resetStats = () => {
    setStats({ charm: 0, wit: 0, boldness: 0, intellect: 0, empathy: 0 });
  };

  // ─── 진행 가능 검증 ───
  const canProceedStep1 = selectedHeroineIds.length >= 1;
  const canProceedStep2 =
    form.avatarName.trim().length >= 1 &&
    form.gender && form.ageRange && form.physique;
  const canProceedStep3 = true; // 성격/백스토리는 선택 항목
  const canSubmit = canProceedStep1 && canProceedStep2;

  // [Phase 5.5 UX Polish · R4] 활성극 충돌 confirm 모달 상태
  const [conflictData, setConflictData] = useState(null); // { payload, message } or null

  // ─── 최종 제출 ───
  const submitWithPayload = async (payload) => {
    setSubmitting(true);
    setError(null);
    try {
      const room = await createTheaterSession(payload);
      // 세션 생성 성공 → Theater 페이지로 이동
      navigate(`/theater/${room.roomId}`);
    } catch (e) {
      const status = e?.response?.status;
      // [R4] 409 Conflict — 활성극 존재 → confirm 받고 overwriteActive=true로 재호출
      if (status === 409 && !payload.overwriteActive) {
        setConflictData({
          payload,
          message:
            e?.response?.data?.message ||
            "이미 진행 중인 극이 있습니다. 이 극을 시작하면 기존 극은 아카이브로 보관됩니다.",
        });
        setSubmitting(false);
        return;
      }
      console.error("[Theater] Create failed:", e);
      setError(e?.response?.data?.message || "세션 생성에 실패했습니다.");
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const payload = {
      worldId: world.id,
      heroineIds: selectedHeroineIds,
      avatarName: form.avatarName.trim() || null,
      avatarProfile: {
        name: form.avatarName.trim() || null,
        gender: form.gender,
        ageRange: form.ageRange,
        physique: form.physique,
        appearance: form.appearance.trim() || null,
        role: form.role.trim() || null,
        personalityTags: form.personalityTags.length > 0 ? form.personalityTags : null,
        relationStart: form.relationStart,
        backstory: form.backstory.trim() || null,
      },
      personaText: form.personaText.trim() || null,
      initialStats: statTier.total > 0 ? stats : null,
      overwriteActive: false,
    };
    await submitWithPayload(payload);
  };

  // [R4] confirm 모달에서 "기존 극 보관하고 시작" 클릭 시
  const handleConfirmOverwrite = async () => {
    if (!conflictData) return;
    const overwritePayload = { ...conflictData.payload, overwriteActive: true };
    setConflictData(null);
    await submitWithPayload(overwritePayload);
  };

  // ─── 다음/이전 ───
  // [Phase 5.5 UX Polish · R5] silent skip 제거.
  // 기존: 무료 유저(statTier.total===0)는 step 3에서 바로 submit → step 4 잠긴 화면을 영원히 못 봄
  // 신규: step 4를 항상 표시 → 잠긴 화면 + 업셀 CTA를 보여주고 그 위에서 submit
  //       (4단계 일관성 + 업셀 노출 + 유저가 무엇을 놓치는지 명확히 인지)
  const goNext = () => {
    if (step === 1 && !canProceedStep1) return;
    if (step === 2 && !canProceedStep2) return;
    if (step < 4) setStep((s) => s + 1);
    else handleSubmit();
  };
  const goPrev = () => { if (step > 1) setStep((s) => s - 1); };

  if (!world) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="relative w-full max-w-2xl max-h-[90vh] bg-gradient-to-b from-slate-900 to-indigo-950 rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ═══ 헤더 ═══ */}
          <div className="relative p-6 pb-4 border-b border-white/5">
            <button
              onClick={onClose}
              className="absolute top-5 right-5 p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-2 text-xs text-white/40 uppercase tracking-widest mb-1">
              <Sparkles size={12} /> 새로운 극
            </div>
            <h2 className="text-xl font-black text-white mb-1">{world.displayName}</h2>
            <p className="text-sm text-white/50">{world.tagline}</p>

            {/*
              [Phase III · B-4] 스텝 인디케이터 — 라벨 추가
              기존: 숫자 버블만 (1-2-3-4)
              신규: 숫자 + 한글 라벨로 "지금 무엇을 정하고 있는지" 즉시 인지
                   비활성(무료 유저의 Step 4)도 dim 톤으로 전환
            */}
            <div className="mt-5">
              <div className="flex items-start gap-1.5 sm:gap-2">
                {STEP_LABELS.map(({ n, label }) => {
                  const isCurrent = n === step;
                  const isPast = n < step;
                  // [Phase 5.5 UX Polish · R5] step 4는 무료 유저에게 잠긴 상태로 표시(자물쇠) —
                  // 단, dim 처리하지 않고 amber 톤으로 "보이지만 잠금됐다"를 시각적으로 명시.
                  // 클릭은 가능 (Step 4에서 업셀 카드 + handleSubmit 진행).
                  const isLockedStep4 = n === 4 && statTier.total === 0;
                  return (
                    <div key={n} className="flex items-start gap-1.5 sm:gap-2 flex-1 last:flex-initial">
                      {/* 동그란 도트 + 라벨 */}
                      <div className="flex flex-col items-center min-w-0">
                        <motion.div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${
                            isPast
                              ? "bg-violet-500 border-violet-300 text-white shadow-md shadow-violet-500/20"
                              : isCurrent
                              ? isLockedStep4
                                ? "bg-amber-500/20 border-amber-300/60 text-amber-100"
                                : "bg-violet-500/22 border-violet-300 text-violet-100"
                              : isLockedStep4
                              ? "bg-amber-500/8 border-amber-300/30 text-amber-200/70"
                              : "bg-white/[0.04] border-white/15 text-white/45"
                          }`}
                        >
                          {isPast ? <Check size={14} /> : isLockedStep4 ? <Lock size={11} /> : n}
                        </motion.div>
                        <span
                          className={`mt-1.5 text-[9px] sm:text-[10px] tracking-wider font-medium uppercase whitespace-nowrap transition-colors ${
                            isCurrent
                              ? isLockedStep4 ? "text-amber-100" : "text-violet-100"
                              : isPast
                              ? "text-violet-200/70"
                              : isLockedStep4
                              ? "text-amber-200/65"
                              : "text-white/35"
                          }`}
                        >
                          {label}
                        </span>
                      </div>
                      {/* 연결선 */}
                      {n < 4 && (
                        <div
                          className={`flex-1 h-[1px] mt-3.5 transition-colors ${
                            isPast ? "bg-violet-300/60" : "bg-white/10"
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ═══ 본문 ═══ */}
          {/* [Polish] custom-scrollbar로 다른 모달들과 스크롤바 스타일 통일 */}
          <div className="flex-1 overflow-y-auto p-6 scroll-smooth custom-scrollbar">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                    <Users size={16} className="text-indigo-300" />
                    히로인 선택
                  </h3>
                  <p className="text-xs text-white/50 mb-4">
                    {isMultiHeroineWorld
                      ? "이 세계관엔 여러 히로인이 있습니다. 1~3명까지 선택할 수 있어요."
                      : "이 세계관의 주인공을 확인하세요."}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {heroines.map((h) => {
                      const selected = selectedHeroineIds.includes(h.id);
                      return (
                        <motion.button
                          type="button"
                          key={h.id}
                          onClick={() => toggleHeroine(h.id)}
                          whileTap={{ scale: 0.98 }}
                          className={`relative rounded-2xl border p-4 text-left transition-all overflow-hidden ${
                            selected
                              ? "bg-indigo-500/10 border-indigo-400/60 ring-1 ring-indigo-400/40"
                              : "bg-white/[0.03] border-white/10 hover:border-white/20"
                          }`}
                        >
                          {selected && (
                            <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-white">
                              <Check size={14} />
                            </div>
                          )}
                          <div className="flex items-start gap-3">
                            <div
                              className="w-14 h-14 rounded-xl bg-cover bg-center flex-shrink-0 border border-white/10"
                              style={{
                                backgroundImage: h.thumbnailUrl ? `url(${h.thumbnailUrl})` : "none",
                                backgroundColor: "#4c1d95",
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-white">{h.name}</div>
                              <div className="text-xs text-white/50 line-clamp-2 mt-0.5">
                                {h.tagline}
                              </div>
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>

                  <div className="mt-3 text-xs text-white/40 text-center">
                    {selectedHeroineIds.length}/3 선택
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                    <User size={16} className="text-indigo-300" />
                    아바타 기본 정보
                  </h3>
                  <p className="text-xs text-white/50 mb-4">
                    당신이 감독할 주인공의 외모와 기본 정보입니다.
                  </p>

                  {/* 이름 */}
                  <div className="mb-5">
                    <label className="text-xs text-white/60 mb-1.5 block">이름 *</label>
                    <input
                      type="text"
                      value={form.avatarName}
                      onChange={(e) => setForm({ ...form, avatarName: e.target.value })}
                      placeholder="주인공의 이름"
                      maxLength={20}
                      className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 focus:border-indigo-400/60 outline-none"
                    />
                  </div>

                  {/* 성별 */}
                  <div className="mb-5">
                    <label className="text-xs text-white/60 mb-1.5 block">성별</label>
                    <div className="flex gap-2">
                      {GENDER_OPTIONS.map((g) => (
                        <ChipButton
                          key={g.value}
                          selected={form.gender === g.value}
                          onClick={() => setForm({ ...form, gender: g.value })}
                        >
                          {g.icon} {g.label}
                        </ChipButton>
                      ))}
                    </div>
                  </div>

                  {/* 나이대 */}
                  <div className="mb-5">
                    <label className="text-xs text-white/60 mb-1.5 block">나이대</label>
                    <div className="flex flex-wrap gap-2">
                      {AGE_OPTIONS.map((a) => (
                        <ChipButton
                          key={a.value}
                          selected={form.ageRange === a.value}
                          onClick={() => setForm({ ...form, ageRange: a.value })}
                        >
                          {a.label}
                        </ChipButton>
                      ))}
                    </div>
                  </div>

                  {/* 체형 */}
                  <div className="mb-5">
                    <label className="text-xs text-white/60 mb-1.5 block">체형</label>
                    <div className="flex flex-wrap gap-2">
                      {PHYSIQUE_OPTIONS.map((p) => (
                        <ChipButton
                          key={p.value}
                          selected={form.physique === p.value}
                          onClick={() => setForm({ ...form, physique: p.value })}
                        >
                          {p.label}
                        </ChipButton>
                      ))}
                    </div>
                  </div>

                  {/* 외형 디테일 */}
                  <div>
                    <label className="text-xs text-white/60 mb-1.5 block">외형 상세 (선택)</label>
                    <input
                      type="text"
                      value={form.appearance}
                      onChange={(e) => setForm({ ...form, appearance: e.target.value })}
                      placeholder="예: 검은 머리에 서늘한 눈매..."
                      maxLength={150}
                      className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 focus:border-indigo-400/60 outline-none"
                    />
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                    <Sparkles size={16} className="text-purple-300" />
                    성격 & 배경
                  </h3>
                  <p className="text-xs text-white/50 mb-4">
                    주인공의 성격과 과거. 모두 선택 항목입니다.
                  </p>

                  {/* 신분/직업 */}
                  <div className="mb-5">
                    <label className="text-xs text-white/60 mb-1.5 block">신분/직업</label>
                    <input
                      type="text"
                      value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value })}
                      placeholder="예: 몰락한 귀족의 서자 / 평범한 대학생"
                      maxLength={50}
                      className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 focus:border-purple-400/60 outline-none"
                    />
                  </div>

                  {/* 성격 태그 */}
                  <div className="mb-5">
                    <label className="text-xs text-white/60 mb-1.5 block">
                      성격 키워드 ({form.personalityTags.length}/5)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {PERSONALITY_TAGS.map((tag) => {
                        const selected = form.personalityTags.includes(tag);
                        const disabled = !selected && form.personalityTags.length >= 5;
                        return (
                          <ChipButton
                            key={tag}
                            selected={selected}
                            disabled={disabled}
                            onClick={() => togglePersonalityTag(tag)}
                          >
                            {tag}
                          </ChipButton>
                        );
                      })}
                    </div>
                  </div>

                  {/* 관계 시작점 */}
                  <div className="mb-5">
                    <label className="text-xs text-white/60 mb-1.5 block">관계 시작점</label>
                    <div className="grid grid-cols-1 gap-2">
                      {RELATION_START_OPTIONS.map((r) => (
                        <button
                          type="button"
                          key={r.value}
                          onClick={() => setForm({ ...form, relationStart: r.value })}
                          className={`text-left px-3 py-2 rounded-xl border transition-colors ${
                            form.relationStart === r.value
                              ? "bg-purple-500/15 border-purple-400/60"
                              : "bg-white/[0.03] border-white/10 hover:border-white/20"
                          }`}
                        >
                          <div className="text-sm font-bold text-white">{r.label}</div>
                          <div className="text-xs text-white/50">{r.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 백스토리 */}
                  <div className="mb-5">
                    <label className="text-xs text-white/60 mb-1.5 block">백스토리 (선택)</label>
                    <textarea
                      value={form.backstory}
                      onChange={(e) => setForm({ ...form, backstory: e.target.value })}
                      placeholder="주인공은 어떤 사람이며, 왜 이 이야기에 휘말리게 되었을까요?"
                      rows={3}
                      maxLength={300}
                      className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 focus:border-purple-400/60 outline-none resize-none"
                    />
                  </div>

                  {/* 자유 텍스트 페르소나 */}
                  <div>
                    <label className="text-xs text-white/60 mb-1.5 block">
                      자유 페르소나 (선택)
                    </label>
                    <textarea
                      value={form.personaText}
                      onChange={(e) => setForm({ ...form, personaText: e.target.value })}
                      placeholder="주인공의 자기 인식. 페르소나와 스탯의 차이가 서사의 맛을 만듭니다."
                      rows={3}
                      maxLength={500}
                      className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 focus:border-purple-400/60 outline-none resize-none"
                    />
                    <div className="mt-2 text-[11px] text-amber-300/60 flex items-start gap-1.5">
                      <span>💡</span>
                      <span>
                        페르소나는 주인공의 자기 인식이고, 실제 능력은 <b>스탯</b>으로 결정됩니다.
                        이 갭이 재미있는 서사를 만들어냅니다.
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                    <Star size={16} className="text-amber-300" />
                    초기 스탯 분배
                    {statTier.total === 0 && (
                      <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-300/35 text-amber-200 text-[10px] font-bold">
                        <Lock size={9} />
                        잠김
                      </span>
                    )}
                  </h3>

                  {statTier.total === 0 ? (
                    /* [Phase 5.5 UX Polish · R5] 무료 유저용 잠금 + 업셀 화면
                       silent skip 제거 → 4단계 일관성 + 명확한 가치 제안 */
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500/10 via-orange-500/8 to-rose-500/10 border border-amber-400/25">
                      {/* 장식 글로우 */}
                      <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />
                      <div className="absolute -bottom-12 -left-12 w-32 h-32 rounded-full bg-rose-500/10 blur-3xl pointer-events-none" />

                      <div className="relative p-6">
                        <div className="flex flex-col items-center text-center">
                          <div className="relative mb-4">
                            <div className="w-14 h-14 rounded-full bg-amber-500/15 border border-amber-300/40 flex items-center justify-center">
                              <Lock size={22} className="text-amber-200" />
                            </div>
                            <motion.div
                              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-amber-300 to-orange-400 flex items-center justify-center shadow-lg shadow-amber-500/40"
                              animate={{ scale: [1, 1.12, 1] }}
                              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                            >
                              <Gem size={10} className="text-white" />
                            </motion.div>
                          </div>

                          <div className="text-base font-bold text-amber-100 mb-1.5">
                            Lucid Pass 전용 기능
                          </div>
                          <div className="text-xs text-white/70 leading-relaxed mb-4 max-w-[320px]">
                            Lucid Pass 가입자는 시작 단계에서 매력 / 위트 / 대담함 / 지성 / 공감
                            5개 스탯에 자유롭게 포인트를 분배할 수 있습니다.
                          </div>
                        </div>

                        {/* 비교표 — 무료 vs Pass */}
                        <div className="grid grid-cols-2 gap-2 mb-4">
                          <div className="rounded-xl bg-white/[0.03] border border-white/10 p-3">
                            <div className="text-[10px] uppercase tracking-widest text-white/45 font-bold mb-1.5">
                              무료
                            </div>
                            <div className="text-sm text-white/85 font-bold mb-0.5">0 포인트</div>
                            <div className="text-[11px] text-white/45 leading-relaxed">
                              모든 스탯 0에서 시작
                            </div>
                          </div>
                          <div className="rounded-xl bg-amber-500/8 border border-amber-300/30 p-3">
                            <div className="text-[10px] uppercase tracking-widest text-amber-200/85 font-bold mb-1.5 flex items-center gap-1">
                              <Gem size={9} />
                              Lucid Pass
                            </div>
                            <div className="text-sm text-amber-100 font-bold mb-0.5">최대 40 P</div>
                            <div className="text-[11px] text-amber-200/65 leading-relaxed">
                              자유 분배 + 분기 해금
                            </div>
                          </div>
                        </div>

                        {/* 업셀 CTA */}
                        {onOpenStore ? (
                          <motion.button
                            type="button"
                            onClick={() => onOpenStore?.()}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/95 to-orange-500/95 hover:from-amber-400 hover:to-orange-400 text-white text-xs font-bold shadow-lg shadow-amber-500/25 transition-colors"
                          >
                            <Gem size={12} />
                            Lucid Pass 보러가기
                            <ChevronRight size={12} />
                          </motion.button>
                        ) : (
                          <p className="text-[11px] text-white/40 text-center italic">
                            Lucid Pass는 곧 출시됩니다
                          </p>
                        )}

                        <p className="text-[11px] text-white/40 text-center leading-relaxed mt-3">
                          무료 유저는 그대로 진행하실 수 있습니다.
                          <br />
                          모든 스탯 0에서 시작해 인터미션으로 성장시키며 자신만의 길을 만듭니다.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-white/50 mb-1">
                        총 {statTier.total} 포인트를 5개 스탯에 분배하세요 (스탯당 최대 {statTier.perStat})
                      </p>
                      {statTier.label && (
                        <p className="text-[10px] text-amber-300/70 mb-4 tracking-wider uppercase">
                          {statTier.label} 구독자 혜택
                        </p>
                      )}

                      <div className="flex items-center justify-between mb-4 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                        <div className="flex items-center gap-2">
                          <Crown size={16} className="text-amber-300" />
                          <span className="text-sm font-bold text-amber-100">
                            남은 포인트: {remainingPoints}
                          </span>
                        </div>
                        <button
                          onClick={resetStats}
                          className="flex items-center gap-1 px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/70"
                        >
                          <RotateCcw size={12} /> 초기화
                        </button>
                      </div>

                      <div className="space-y-3">
                        {STAT_AXES.map((axis) => {
                          // 다른 stat의 합 — 이 stat이 가질 수 있는 절대 상한 계산용
                          const otherSum = Object.entries(stats)
                            .filter(([k]) => k !== axis.key)
                            .reduce((sum, [, v]) => sum + v, 0);
                          const maxByTotal = statTier.total - otherSum;
                          const maxAvailable = Math.min(statTier.perStat, maxByTotal);
                          return (
                            <div key={axis.key} className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <div className="text-sm font-bold text-white flex items-center gap-2">
                                    <span>{axis.icon}</span>
                                    {axis.label}
                                  </div>
                                  <div className="text-[10px] text-white/40">{axis.desc}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => adjustStat(axis.key, -1)}
                                    disabled={stats[axis.key] === 0}
                                    className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 text-white"
                                  >
                                    −
                                  </button>
                                  <span className="w-10 text-center font-bold text-white tabular-nums">
                                    {stats[axis.key]}
                                  </span>
                                  <button
                                    onClick={() => adjustStat(axis.key, +1)}
                                    disabled={
                                      remainingPoints === 0 ||
                                      stats[axis.key] >= statTier.perStat
                                    }
                                    className="w-7 h-7 rounded-lg bg-indigo-500/30 hover:bg-indigo-500/50 disabled:opacity-30 text-white"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                              {/* [Polish] 인터랙티브 슬라이더 — 클릭/드래그로 값 조정 */}
                              <StatSlider
                                value={stats[axis.key]}
                                max={statTier.perStat}
                                maxAvailable={maxAvailable}
                                colorClass={axis.color}
                                onChange={(v) => setStatDirect(axis.key, v)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-300"
              >
                {error}
              </motion.div>
            )}
          </div>

          {/* ═══ 푸터 ═══ */}
          <div className="flex items-center justify-between p-5 border-t border-white/5 bg-slate-900/50">
            <button
              onClick={goPrev}
              disabled={step === 1 || submitting}
              className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} /> 이전
            </button>

            <button
              onClick={goNext}
              disabled={
                submitting ||
                (step === 1 && !canProceedStep1) ||
                (step === 2 && !canProceedStep2)
              }
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 hover:from-indigo-400 hover:via-violet-400 hover:to-purple-400 text-white font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-violet-500/25 transition-colors"
            >
              {submitting ? (
                <>
                  <motion.div
                    className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                  />
                  생성 중...
                </>
              ) : step === 4 ? (
                <>극 시작 <Sparkles size={16} /></>
              ) : (
                <>다음 <ChevronRight size={16} /></>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>

      {/* [Phase 5.5 UX Polish · R4] 활성극 충돌 confirm 모달 */}
      <AnimatePresence>
        {conflictData && (
          <motion.div
            className="fixed inset-0 z-[110] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => !submitting && setConflictData(null)}
            />
            <motion.div
              className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-amber-400/30 p-6 shadow-2xl shadow-amber-500/15"
              initial={{ scale: 0.92, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 12 }}
            >
              <div className="flex flex-col items-center text-center mb-5">
                <div className="w-12 h-12 rounded-full bg-amber-500/15 border border-amber-300/40 flex items-center justify-center mb-3">
                  <Sparkles size={20} className="text-amber-200" />
                </div>
                <h3 className="text-base font-bold text-white mb-1.5">
                  진행 중인 극이 있습니다
                </h3>
                <p className="text-xs text-white/65 leading-relaxed">
                  {conflictData.message}
                </p>
              </div>

              <div className="rounded-xl bg-amber-500/8 border border-amber-300/25 p-3 mb-5">
                <p className="text-[11px] text-amber-100/85 leading-relaxed">
                  💡 보관된 극은 <strong className="text-amber-200">아카이브</strong>에서 언제든 다시 이어서 진행할 수 있습니다.
                  <br />
                  단, 한 명의 유저는 한 번에 하나의 극만 진행할 수 있습니다.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleConfirmOverwrite}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-sm font-bold shadow-lg shadow-amber-500/25 transition-colors disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <motion.div
                        className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                      />
                      시작 중...
                    </>
                  ) : (
                    <>기존 극 보관하고 새 극 시작 <ChevronRight size={14} /></>
                  )}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setConflictData(null)}
                  className="w-full px-4 py-2 rounded-xl text-white/55 hover:text-white text-xs font-medium transition-colors disabled:opacity-50"
                >
                  취소하고 기존 극으로 돌아가기
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  [Polish] 스탯 분배용 인터랙티브 슬라이더
//
//  요구: 바를 클릭하거나 드래그해서 값을 직접 조정.
//  접근:
//   - <input type="range">는 브라우저별 스타일링이 까다로워 톤 통일 어려움.
//   - 커스텀 div + pointer 이벤트로 구현. 마우스/터치/펜 모두 지원.
//   - value/max 시각화와 thumb(원형 핸들) 위치 동기.
//   - max를 초과하지 못함은 물론, maxAvailable(다른 stat의 합 제약)도 같이 고려.
//
//  접근성:
//   - role="slider" + aria-valuemin/max/now
//   - keyboard ←/→로도 조작 가능 (선택 시 focus, 1씩 증감)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const StatSlider = ({ value, max, maxAvailable, colorClass, onChange }) => {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  // [중요] colorClass를 동적으로 결합하면 Tailwind JIT가 못 잡아낸다.
  //   컴파일 시점에 알려진 정적 매핑을 사용. (기존 progress bar에서도 같은 문제 있었으나
  //   여기선 더 명시적으로.)
  const gradientByColor = {
    pink: "from-pink-500 to-pink-400",
    rose: "from-rose-500 to-rose-400",
    amber: "from-amber-500 to-amber-400",
    orange: "from-orange-500 to-orange-400",
    red: "from-red-500 to-red-400",
    sky: "from-sky-500 to-sky-400",
    emerald: "from-emerald-500 to-emerald-400",
    indigo: "from-indigo-500 to-indigo-400",
    violet: "from-violet-500 to-violet-400",
    cyan: "from-cyan-500 to-cyan-400",
  };
  const gradient = gradientByColor[colorClass] || "from-indigo-500 to-indigo-400";

  // pointer 좌표를 0~max 사이 정수로 변환
  const pointerToValue = (clientX) => {
    const el = trackRef.current;
    if (!el) return value;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(ratio * max);
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    e.target.setPointerCapture?.(e.pointerId);
    setDragging(true);
    onChange(pointerToValue(e.clientX));
  };

  const handlePointerMove = (e) => {
    if (!dragging) return;
    onChange(pointerToValue(e.clientX));
  };

  const handlePointerUp = (e) => {
    if (!dragging) return;
    e.target.releasePointerCapture?.(e.pointerId);
    setDragging(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(Math.max(0, value - 1));
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(Math.min(maxAvailable, value + 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(0);
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(maxAvailable);
    }
  };

  const fillPct = max > 0 ? (value / max) * 100 : 0;
  // 사용 가능한 최대치(maxAvailable)를 시각화 — 점선 배경으로 약하게 표시
  const availablePct = max > 0 ? (maxAvailable / max) * 100 : 0;

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
      className="relative h-2.5 rounded-full bg-white/[0.04] cursor-pointer touch-none select-none focus:outline-none focus:ring-2 focus:ring-indigo-400/40 group"
    >
      {/* 가용 영역 표시 — value 이상 maxAvailable까지 옅은 빛 */}
      {availablePct > fillPct && (
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-white/[0.06]"
          style={{ width: `${availablePct}%` }}
          aria-hidden
        />
      )}

      {/* 채워진 영역 */}
      <div
        className={`absolute left-0 top-0 h-full rounded-full bg-gradient-to-r ${gradient} transition-[width] duration-100`}
        style={{ width: `${fillPct}%` }}
      />

      {/* thumb — 둥근 핸들 */}
      <div
        className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white shadow-md ring-2 ring-indigo-400/30 transition-transform ${
          dragging ? "scale-125 ring-indigo-400/60" : "group-hover:scale-110"
        }`}
        style={{ left: `${fillPct}%` }}
        aria-hidden
      />
    </div>
  );
};