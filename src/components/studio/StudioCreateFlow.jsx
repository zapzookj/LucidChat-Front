import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  X, Check, Sparkles, Wand2, RefreshCw, Zap, ArrowLeft, Brush, ChevronDown,
  Eye, LayoutGrid, Globe, MessageCircle, Pencil, AlertTriangle, Moon, Feather,
} from "lucide-react";
import api from "../../api/axios";
import {
  createUgcCharacter, selectGoldenShot, rerollGoldenShots, rerollEmotionCut,
  selectBaseStanding, rerollBaseStandings, selectEmotionVersion, updateUgcProfile,
  confirmCreation, abandonCreationJob, fetchMyUgcCharacters, requestPublish,
  requestSecret, updateUgcTexts,
} from "../../api/StudioApi";
// [World Builder] 세계관 연결 셀렉터 — 공식 4종 상수 + 내 월드 조회
import { fetchMyUgcWorlds, OFFICIAL_WORLDS } from "../../api/WorldStudioApi";
import useUgcCreationJob from "../../hooks/useUgcCreationJob";
import ProfileEditPanel from "./ProfileEditPanel";
import { sfx } from "../../utils/sfx";

/**
 * [Studio v1] StudioCreateFlow — UGC 캐릭터 소환 전체화면 위저드
 *
 * TheaterCreateFlow의 골격(fixed inset-0 z-[100] 오버레이 + STEP_LABELS 스테퍼 +
 * AnimatePresence mode="wait" x슬라이드)을 따르되, 스텝 전환이 유저 입력이 아니라
 * 서버 잡 status에 의해 구동된다는 점이 다르다.
 *
 * status → 스텝 매핑:
 *   CONCEPT_PROCESSING (hint CONCEPT_ANALYZING)  → 1 (컨셉 분석 로딩)
 *   CONCEPT_PROCESSING (hint GOLDEN_GENERATING)  → 2 (원화 소환 연출)
 *   GACHA_WAIT                                   → 2 (원화 2장 카드 선택 = 원화·썸네일 확정)
 *   BASE_PROCESSING                              → 3 (스탠딩 후보 파생 로딩)
 *   BASE_WAIT                                    → 3 (스탠딩 후보 2장 선택 = 베이스 확정)
 *   EMOTIONS_PROCESSING                          → 4 (소환 — 15컷 진행 그리드)
 *   REVIEW_WAIT                                  → 5 (검수 그리드/미리보기)
 *   POSTPROCESSING · BINDING                     → 5 (누끼 로딩)
 *   READY                                        → 6 (완성)
 *   FAILED · EXPIRED                             → 에러 뷰
 *
 * 로딩·대기 구간(GOLDEN_GENERATING~REVIEW_WAIT)에서는 ProfileEditPanel("설정 다듬기")
 * 플로팅 CTA를 상시 노출한다 — 생성 대기 시간을 설정 손질 시간으로 바꾸는 레이턴시 하이딩.
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
  { n: 2, label: "원화" },
  { n: 3, label: "스탠딩" },
  { n: 4, label: "소환" },
  { n: 5, label: "검수" },
  { n: 6, label: "완성" },
];

const EMOTION_ORDER = [
  "NEUTRAL", "JOY", "SAD", "ANGRY", "SHY", "SURPRISE",
  "PANIC", "RELAX", "DISGUST", "FRIGHTENED", "FLIRTATIOUS", "HEATED",
  "DUMBFOUNDED", "SULKING", "PLEADING",
];

const EMOTION_LABELS = {
  NEUTRAL: "기본", JOY: "기쁨", SAD: "슬픔", ANGRY: "분노", SHY: "수줍음",
  SURPRISE: "놀람", PANIC: "당황", RELAX: "편안", DISGUST: "불쾌",
  FRIGHTENED: "겁먹음", FLIRTATIOUS: "유혹", HEATED: "달아오름",
  DUMBFOUNDED: "황당", SULKING: "삐짐", PLEADING: "애원",
};

const CONCEPT_MIN = 30;
const CONCEPT_MAX = 1000;
const CREATE_COST = 20;

// 원화(황금샷) 대기 중 순환 서사 카피
const GACHA_LOADING_COPY = [
  "영혼의 형태를 빚는 중…",
  "운명의 실을 고르는 중…",
  "두 갈래의 가능성을 그리는 중…",
  "빛과 그림자를 섞는 중…",
  "마지막 숨결을 불어넣는 중…",
];

// 스탠딩 후보 파생 중 순환 서사 카피
const BASE_LOADING_COPY = [
  "자세를 잡는 중…",
  "빛을 고르는 중…",
  "옷자락을 매만지는 중…",
  "시선의 방향을 맞추는 중…",
];

// 감정 컷이 완료 취급되는 상태 (READY 이후 파이프라인 포함)
const EMOTION_DONE_STATUSES = new Set(["READY", "CUTTING", "DONE"]);

// "나가서 기다리기"가 허용되는 상태 — 잡이 서버에서 계속 돌아가는 구간
const LEAVE_ALLOWED_STATUSES = new Set([
  "GACHA_WAIT", "BASE_WAIT", "REVIEW_WAIT",
  "BASE_PROCESSING", "EMOTIONS_PROCESSING", "POSTPROCESSING", "BINDING",
]);

// "설정 다듬기"(ProfileEditPanel)를 열 수 있는 상태 — 로딩·대기 구간 전반.
// CONCEPT_PROCESSING은 GOLDEN_GENERATING 힌트일 때만 (canEditProfile에서 처리)
const PROFILE_EDIT_STATUSES = new Set([
  "GACHA_WAIT", "BASE_PROCESSING", "BASE_WAIT",
  "EMOTIONS_PROCESSING", "REVIEW_WAIT",
]);

function resolveStep(job) {
  const s = job?.status;
  if (s === "CONCEPT_PROCESSING") {
    return job?.currentStepHint === "GOLDEN_GENERATING" ? 2 : 1;
  }
  if (s === "GACHA_WAIT") return 2;
  if (s === "BASE_PROCESSING" || s === "BASE_WAIT") return 3;
  if (s === "EMOTIONS_PROCESSING") return 4;
  if (s === "REVIEW_WAIT" || s === "POSTPROCESSING" || s === "BINDING") return 5;
  if (s === "READY") return 6;
  return 0; // FAILED / EXPIRED
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  공용 소품
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  STEP 1 — 컨셉 입력
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const CONCEPT_PLACEHOLDER = `예시처럼 자유롭게 적어주세요.

· 비 오는 날마다 옥상에서 만나는 무뚝뚝한 선배. 말은 차갑지만 우산은 항상 두 개 챙긴다.
· 마왕성에서 도망쳐 카페 알바를 하는 전직 마왕. 손님에게는 상냥하지만 커피 맛에는 목숨을 건다.
· 낡은 서점을 지키는 조용한 사서. 책 속 주인공의 말투를 그날 기분에 따라 빌려 쓴다.`;

// 외형 디테일 (선택) — 구조화 힌트 6필드. 값이 하나라도 있으면 요청의 appearance로 전송
const APPEARANCE_FIELDS = [
  { key: "hair", label: "머리", placeholder: "예) 은발 롱헤어, 히메컷" },
  { key: "eyes", label: "눈", placeholder: "예) 붉은 눈동자, 처진 눈매" },
  { key: "body", label: "체형", placeholder: "예) 큰 키에 마른 체형" },
  { key: "outfit", label: "의상", placeholder: "예) 검은 교복, 오버사이즈 가디건" },
  { key: "accessories", label: "액세서리", placeholder: "예) 은테 안경, 초커" },
  { key: "extra", label: "기타", placeholder: "예) 왼쪽 눈가의 점, 창백한 피부" },
];

const EMPTY_APPEARANCE = APPEARANCE_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: "" }), {});

const ConceptStep = ({ busy, error, energy, onSubmit }) => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  // [2026-08-04 남캐] 성별 명시 선택 — 파이프라인 분기(앵커 태그·Male LoRA·연출 가이드)의 단일 기준
  const [gender, setGender] = useState("FEMALE");
  const [concept, setConcept] = useState("");
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [appearance, setAppearance] = useState(EMPTY_APPEARANCE);
  // [World Builder] 세계관 연결 (선택) — {type:"NONE"} | {type:"OFFICIAL",id,name} | {type:"UGC",id,name}
  const [worldOpen, setWorldOpen] = useState(false);
  const [worldSel, setWorldSel] = useState({ type: "NONE" });
  const [myWorlds, setMyWorlds] = useState(null); // null = 로딩 중
  const len = concept.trim().length;
  const valid = len >= CONCEPT_MIN && len <= CONCEPT_MAX;
  const lackEnergy = energy < CREATE_COST;
  const filledAppearanceCount = APPEARANCE_FIELDS.filter((f) => appearance[f.key].trim()).length;

  // [World Builder] 내 커스텀 월드(READY) 목록 — 마운트 시 1회
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await fetchMyUgcWorlds();
        if (alive) setMyWorlds(data?.worlds || []);
      } catch {
        if (alive) setMyWorlds([]);
      }
    })();
    return () => { alive = false; };
  }, []);

  // 값이 있는 필드만 추려 appearance 페이로드 구성 — 전부 비었으면 null
  const buildAppearance = () => {
    const entries = APPEARANCE_FIELDS
      .map((f) => [f.key, appearance[f.key].trim()])
      .filter(([, v]) => v);
    return entries.length ? Object.fromEntries(entries) : null;
  };

  return (
    <div className="max-w-xl mx-auto w-full">
      <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
        <Wand2 size={16} className="text-amber-300" />
        어떤 존재를 소환할까요?
      </h3>
      <p className="text-xs text-white/50 mb-5">
        떠오르는 인물의 이미지를 자유롭게 적어주세요. 나머지는 스튜디오가 빚어냅니다.
      </p>

      {/* 이름 (선택) */}
      <div className="mb-5">
        <label className="text-xs text-white/60 mb-1.5 block">이름 (선택)</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="비우면 AI가 지어줘요"
          maxLength={20}
          className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 focus:border-amber-400/60 outline-none"
        />
      </div>

      {/* [2026-08-04 남캐] 성별 — 명시 선택(파이프라인 분기 기준) */}
      <div className="mb-5">
        <label className="text-xs text-white/60 mb-1.5 block">성별</label>
        <div className="grid grid-cols-2 gap-2">
          {[["FEMALE", "여성"], ["MALE", "남성"]].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => { sfx.click(0.2); setGender(value); }}
              className={`py-2.5 rounded-xl text-sm font-medium border transition ${
                gender === value
                  ? "bg-amber-500/15 border-amber-400/50 text-amber-200"
                  : "bg-white/[0.04] border-white/10 text-white/50 hover:bg-white/[0.06]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 컨셉 */}
      <div className="mb-2">
        <label className="text-xs text-white/60 mb-1.5 block">컨셉 *</label>
        <textarea
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          placeholder={CONCEPT_PLACEHOLDER}
          rows={8}
          maxLength={CONCEPT_MAX}
          className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-white text-sm leading-relaxed placeholder:text-white/25 focus:border-amber-400/60 outline-none resize-none"
        />
        <div className={`mt-1 text-right text-[11px] tabular-nums ${valid ? "text-white/40" : "text-amber-300/70"}`}>
          {len} / {CONCEPT_MIN}~{CONCEPT_MAX}자
        </div>
      </div>

      {/* 외형 디테일 (선택) — 접이식 */}
      <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
        <button
          type="button"
          onClick={() => { sfx.click(0.2); setAppearanceOpen((o) => !o); }}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
        >
          <span className="flex items-center gap-1.5 text-xs text-white/60 font-medium">
            <Brush size={12} className="text-amber-300/70" />
            외형 디테일 (선택)
            {filledAppearanceCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-400/15 text-amber-200 border border-amber-400/30">
                {filledAppearanceCount}
              </span>
            )}
          </span>
          <motion.span animate={{ rotate: appearanceOpen ? 180 : 0 }} transition={{ duration: 0.25 }}>
            <ChevronDown size={14} className="text-white/40" />
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {appearanceOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 pt-1">
                <p className="text-[11px] text-white/35 mb-3">
                  확실히 그리고 싶은 부분만 짧게 적어주세요. 비워둔 항목은 AI가 채웁니다.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {APPEARANCE_FIELDS.map((f) => (
                    <div key={f.key}>
                      <label className="text-[11px] text-white/50 mb-1 block">{f.label}</label>
                      <input
                        type="text"
                        value={appearance[f.key]}
                        maxLength={60}
                        placeholder={f.placeholder}
                        onChange={(e) =>
                          setAppearance((p) => ({ ...p, [f.key]: e.target.value }))
                        }
                        className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-white text-xs placeholder:text-white/25 focus:border-amber-400/60 outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* [World Builder] 세계관 연결 (선택) — 접이식 */}
      <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
        <button
          type="button"
          onClick={() => { sfx.click(0.2); setWorldOpen((o) => !o); }}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
        >
          <span className="flex items-center gap-1.5 text-xs text-white/60 font-medium">
            <Globe size={12} className="text-amber-300/70" />
            세계관 연결 (선택)
            {worldSel.type !== "NONE" && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-400/15 text-amber-200 border border-amber-400/30 max-w-[140px] truncate">
                {worldSel.name}
              </span>
            )}
          </span>
          <motion.span animate={{ rotate: worldOpen ? 180 : 0 }} transition={{ duration: 0.25 }}>
            <ChevronDown size={14} className="text-white/40" />
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {worldOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 pt-1">
                <p className="text-[11px] text-white/35 mb-3">
                  캐릭터가 살아갈 세계를 정해요. 완성 후에도 언제든 바꿀 수 있어요.
                </p>

                {/* ③ 기본값 — 나중에 연결 */}
                <button
                  type="button"
                  onClick={() => { sfx.click(0.2); setWorldSel({ type: "NONE" }); }}
                  className={`mb-3 px-3 py-1.5 rounded-full text-[11px] font-medium border transition-colors ${
                    worldSel.type === "NONE"
                      ? "bg-amber-500/20 border-amber-400/60 text-amber-100"
                      : "bg-white/[0.03] border-white/10 text-white/55 hover:bg-white/[0.08]"
                  }`}
                >
                  나중에 연결
                </button>

                {/* ① 공식 세계관 — 가로 스크롤 칩 */}
                <div className="text-[10px] text-white/40 uppercase tracking-widest mb-1.5">
                  공식 세계관
                </div>
                <div className="flex gap-1.5 overflow-x-auto custom-scrollbar pb-1.5 mb-3">
                  {OFFICIAL_WORLDS.map((w) => {
                    const selected = worldSel.type === "OFFICIAL" && worldSel.id === w.id;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => {
                          sfx.click(0.2);
                          setWorldSel(
                            selected ? { type: "NONE" } : { type: "OFFICIAL", id: w.id, name: w.name }
                          );
                        }}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium border transition-colors ${
                          selected
                            ? "bg-amber-500/20 border-amber-400/60 text-amber-100"
                            : "bg-white/[0.03] border-white/10 text-white/55 hover:bg-white/[0.08]"
                        }`}
                      >
                        {w.name}
                      </button>
                    );
                  })}
                </div>

                {/* ② 내 커스텀 월드 — 썸네일 칩 */}
                <div className="text-[10px] text-white/40 uppercase tracking-widest mb-1.5">
                  내 세계관
                </div>
                {myWorlds === null ? (
                  <div className="py-3 text-[11px] text-white/35">불러오는 중…</div>
                ) : myWorlds.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1.5">
                    {myWorlds.map((w) => {
                      const selected = worldSel.type === "UGC" && worldSel.id === w.worldId;
                      return (
                        <button
                          key={w.worldId}
                          type="button"
                          onClick={() => {
                            sfx.click(0.2);
                            setWorldSel(
                              selected ? { type: "NONE" } : { type: "UGC", id: w.worldId, name: w.name }
                            );
                          }}
                          className={`flex-shrink-0 w-32 rounded-xl overflow-hidden border-2 text-left transition-colors ${
                            selected ? "border-amber-400" : "border-white/10 hover:border-amber-300/50"
                          }`}
                        >
                          <div className="aspect-video bg-black/40">
                            {w.thumbnailUrl ? (
                              <img
                                src={w.thumbnailUrl}
                                alt={w.name}
                                className="w-full h-full object-cover"
                                draggable={false}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-white/15">
                                <Globe size={16} />
                              </div>
                            )}
                          </div>
                          <div
                            className={`px-2 py-1.5 text-[10px] font-bold truncate ${
                              selected ? "bg-amber-500/20 text-amber-100" : "bg-black/30 text-white/60"
                            }`}
                          >
                            {w.name}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { sfx.click(); navigate("/studio/world"); }}
                    className="w-full py-3 rounded-xl border border-dashed border-white/15 hover:border-amber-400/50 bg-white/[0.02] hover:bg-amber-500/[0.04] text-[11px] text-white/45 hover:text-amber-100 transition-colors"
                  >
                    아직 만든 세계관이 없어요 — 월드 빌더에서 만들기
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 에너지 고지 */}
      <div className="flex items-center gap-1.5 mb-5 text-amber-300/85">
        <Zap size={14} />
        <span className="text-xs font-semibold">소환 시작 시 에너지 {CREATE_COST} 소모</span>
        {lackEnergy && <span className="text-xs text-rose-300/80 ml-1">· 에너지가 부족해요</span>}
      </div>

      {/* 에러 (400/402 — 서버 메시지 그대로, 모더레이션 상세 사유 미노출 원칙) */}
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
          onSubmit({
            name,
            gender,   // [남캐] FEMALE/MALE
            concept: concept.trim(),
            appearance: buildAppearance(),
            // [World Builder] 세계관 연결 — 동시 지정은 UI에서 원천 차단 (단일 선택)
            officialWorldId: worldSel.type === "OFFICIAL" ? worldSel.id : null,
            ugcWorldId: worldSel.type === "UGC" ? worldSel.id : null,
          });
        }}
        whileTap={{ scale: valid && !busy ? 0.98 : 1 }}
        className={`w-full py-3.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${
          valid && !busy && !lackEnergy
            ? "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-amber-500/25"
            : "bg-white/5 text-white/25 cursor-not-allowed"
        }`}
      >
        <Sparkles size={16} />
        {busy ? "소환 준비 중…" : "소환 시작"}
      </motion.button>
    </div>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  STEP 2 — 원화(황금샷) (로딩 연출 → 2장 카드 reveal → 선택/리롤)
//  선택한 원화가 캐릭터의 대표 일러스트·썸네일로 확정된다.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const GachaStep = ({ job, busy, error, rerollCost, appearanceRerollPending, onSelect, onRerollRequest }) => {
  // [리롤 누적] goldenShots는 리롤마다 +2장씩 누적 — 리롤 중(CONCEPT_PROCESSING·GOLDEN_GENERATING)
  // 이어도 기존 후보는 응답에 유지되므로, 상태와 무관하게 존재하는 카드는 계속 보여준다.
  const shots = job?.goldenShots || [];
  const canSelect = job?.status === "GACHA_WAIT";
  const isRerolling = !canSelect && shots.length > 0; // 기존 카드 유지한 채 새 후보 소환 중
  const isWaiting = shots.length === 0;
  const gridScrolls = shots.length + (isRerolling ? 2 : 0) > 4; // 4장 초과 시 스크롤 그리드
  const [preview, setPreview] = useState(null); // {index,url} | null

  // 카드 reveal 시 chime — 같은 shots 세트에 1번만
  const shotsKey = shots.map((s) => s.url).join("|");
  const chimedKeyRef = useRef(null);
  useEffect(() => {
    if (!shotsKey || chimedKeyRef.current === shotsKey) return;
    chimedKeyRef.current = shotsKey;
    sfx.cardFanout();
    // [리롤 누적] 새로 도착하는 카드는 한 번에 최대 2장 — chime도 2회로 캡
    const timers = shots.slice(0, 2).map((_, i) =>
      setTimeout(() => sfx.chime(0.25), 350 + i * 550 + 350)
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shotsKey]);

  // shots가 갈렸으면(리롤) 프리뷰 초기화
  useEffect(() => { setPreview(null); }, [shotsKey]);

  if (isWaiting) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="relative mb-8">
          <SpinnerRing size={72} />
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkles size={26} className="text-amber-300" />
          </motion.div>
        </div>
        {/* [폴리싱 #1] 외형 수정 리롤 — 백엔드가 구외형 원화를 의도적으로 비운 상태.
            "원화가 사라졌다" 오해가 없도록 전용 카피로 안내한다. */}
        {appearanceRerollPending ? (
          <>
            <p className="text-sm text-amber-100/85 font-medium text-center mb-2">
              외형을 바꿔서 새 원화를 소환하는 중이에요.
            </p>
            <p className="text-xs text-white/35 text-center leading-relaxed px-6 mb-2">
              이전 원화는 새 외형과 달라 목록에서 제외했어요.
            </p>
            <p className="text-xs text-white/35">보통 30~90초 정도 걸려요. 잠시만 기다려 주세요.</p>
          </>
        ) : (
          <>
            <CyclingCopy lines={GACHA_LOADING_COPY} className="w-full mb-2" />
            <p className="text-xs text-white/35">보통 30~90초 정도 걸려요. 잠시만 기다려 주세요.</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto w-full">
      <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
        <Sparkles size={16} className="text-amber-300" />
        원화 선택
      </h3>
      <p className="text-xs text-white/50 mb-5">
        캐릭터의 대표 일러스트가 돼요. 두 갈래의 가능성 중 하나를 고르세요.
      </p>

      {/* 후보 카드 — 리롤 누적으로 2·4·6…장. 4장 초과 시 내부 스크롤 그리드 */}
      <div
        className={`grid grid-cols-2 gap-3 sm:gap-4 mb-5 max-w-lg mx-auto ${
          gridScrolls ? "max-h-[56vh] overflow-y-auto custom-scrollbar pr-1" : ""
        }`}
      >
        {shots.map((shot, i) => (
          <div key={shot.index} style={{ perspective: 1000 }}>
            <motion.div
              className="relative w-full aspect-[3/4]"
              style={{ transformStyle: "preserve-3d" }}
              initial={{ rotateY: 180 }}
              animate={{ rotateY: 0 }}
              transition={{ delay: 0.35 + (i % 2) * 0.55, duration: 0.7, ease: "easeOut" }}
            >
              {/* 앞면 — 결과 이미지 */}
              <button
                type="button"
                onClick={() => { sfx.click(); setPreview(shot); }}
                className="absolute inset-0 rounded-2xl overflow-hidden border border-amber-400/25 hover:border-amber-300/70 transition-colors group"
                style={{ backfaceVisibility: "hidden" }}
              >
                <img src={shot.url} alt={`원화 ${shot.index + 1}`} className="w-full h-full object-cover" draggable={false} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-white/80 opacity-0 group-hover:opacity-100 transition-opacity">
                  탭해서 확대
                </span>
              </button>
              {/* 뒷면 — 카드 커버 */}
              <div
                className="absolute inset-0 rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-900/60 via-stone-950 to-black flex items-center justify-center"
                style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
              >
                <Sparkles size={28} className="text-amber-300/50" />
              </div>
            </motion.div>
          </div>
        ))}
        {/* [리롤 누적] 리롤 중 — 새 카드 자리 로딩 플레이스홀더 2칸 (도착하면 flip reveal) */}
        {isRerolling &&
          [0, 1].map((k) => (
            <motion.div
              key={`pending-${k}`}
              className="relative w-full aspect-[3/4] rounded-2xl border border-amber-400/20 bg-gradient-to-br from-amber-900/40 via-stone-950 to-black flex flex-col items-center justify-center gap-3"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: k * 0.15, duration: 0.4 }}
            >
              <SpinnerRing size={30} />
              <span className="text-[10px] text-amber-100/50">새 후보 소환 중…</span>
            </motion.div>
          ))}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-400/25 text-rose-200 text-xs">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-white/35">
          마음에 드는 모습을 탭해서 크게 확인해 보세요.
          <span className="block text-amber-200/45 mt-0.5">다시 소환해도 기존 후보는 유지돼요.</span>
        </p>
        <button
          type="button"
          disabled={busy || isRerolling}
          onClick={() => { sfx.click(); onRerollRequest(); }}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-amber-400/40 text-white/70 hover:text-amber-100 text-xs font-bold transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={isRerolling ? "animate-spin" : ""} />
          {isRerolling ? "소환 중…" : "다시 소환"}
          <span className="inline-flex items-center gap-0.5 text-amber-300/90">
            <Zap size={10} />{rerollCost}
          </span>
        </button>
      </div>

      {/* 확대 프리뷰 */}
      <AnimatePresence>
        {preview && (
          <motion.div
            className="fixed inset-0 z-[120] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setPreview(null)} />
            {/* [폴리싱 #5] 확대 프리뷰 — 뷰포트 최대 활용 (이미지 크기에 맞춰 폭 결정) */}
            <motion.div
              className="relative z-10 flex flex-col max-w-[92vw] max-h-[86vh]"
              initial={{ scale: 0.92, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
            >
              <div className="rounded-2xl overflow-hidden border border-amber-400/30 shadow-[0_0_60px_rgba(251,191,36,0.15)] mx-auto">
                <img src={preview.url} alt={`원화 ${preview.index + 1}`} className="max-w-[92vw] max-h-[72vh] w-auto h-auto object-contain bg-black/90" />
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => { sfx.click(); setPreview(null); }}
                  className="flex-1 py-3 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 transition text-sm disabled:opacity-50"
                >
                  다른 모습 보기
                </button>
                <button
                  type="button"
                  disabled={busy || !canSelect}
                  onClick={() => onSelect(preview.index)}
                  className="flex-1 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-amber-500/25 transition flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  <Check size={15} />
                  {!canSelect ? "새 후보 생성 중…" : busy ? "확정 중…" : "이 모습으로 확정"}
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
//  원화(황금샷) 리롤 전용 모달 — 비용 고지 + 외형 수정(선택)
//  ConfirmModal 폼팩터(z-[130], 앰버 무드)를 확장한 전용 모달.
//  외형 필드가 하나라도 채워지면 appearance 객체(빈 필드 생략), 전부 비면 null을
//  onConfirm으로 넘긴다 — null = 기존 외형 유지(순수 seed 리롤).
//  황금샷(GACHA_WAIT) 전용: 스탠딩(BASE_WAIT) 리롤은 원화가 고정이라 외형 수정 불가.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const GoldenRerollModal = ({ open, busy, rerollCost, onConfirm, onCancel }) => {
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [appearance, setAppearance] = useState(EMPTY_APPEARANCE);
  const filledCount = APPEARANCE_FIELDS.filter((f) => appearance[f.key].trim()).length;

  // 열릴 때마다 입력 초기화 — 직전 리롤의 외형 입력이 남지 않도록
  useEffect(() => {
    if (open) {
      setAppearance(EMPTY_APPEARANCE);
      setAppearanceOpen(false);
    }
  }, [open]);

  // 값이 있는 필드만 추려 appearance 페이로드 구성 — 전부 비었으면 null (ConceptStep 패턴)
  const buildAppearance = () => {
    const entries = APPEARANCE_FIELDS
      .map((f) => [f.key, appearance[f.key].trim()])
      .filter(([, v]) => v);
    return entries.length ? Object.fromEntries(entries) : null;
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[130] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={busy ? undefined : onCancel} />
          <motion.div
            className="relative z-10 w-full max-w-md rounded-2xl p-6 border border-amber-400/25 max-h-[85vh] overflow-y-auto custom-scrollbar"
            style={{
              background: "linear-gradient(145deg, rgba(28,18,8,0.97), rgba(20,12,6,0.96))",
              boxShadow: "0 30px 60px rgba(0,0,0,0.6)",
            }}
            initial={{ scale: 0.92, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: 16, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
          >
            {/* 비용 고지 — 기존 ConfirmModal 카피 유지 */}
            <h3 className="font-bold mb-2 text-amber-100">원화 다시 소환</h3>
            <p className="text-white/60 text-sm leading-relaxed mb-4 whitespace-pre-line">
              {`에너지 ${rerollCost}을 사용해 원화 2장을 새로 소환합니다.\n기존 후보는 사라지지 않고 그대로 유지돼요.`}
            </p>

            {/* 외형을 바꿔서 다시 뽑기 (선택) — ConceptStep 외형 아코디언과 동일 폼팩터 */}
            <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
              <button
                type="button"
                onClick={() => { sfx.click(0.2); setAppearanceOpen((o) => !o); }}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
              >
                <span className="flex items-center gap-1.5 text-xs text-white/60 font-medium">
                  <Brush size={12} className="text-amber-300/70" />
                  외형을 바꿔서 다시 뽑기 (선택)
                  {filledCount > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-400/15 text-amber-200 border border-amber-400/30">
                      {filledCount}
                    </span>
                  )}
                </span>
                <motion.span animate={{ rotate: appearanceOpen ? 180 : 0 }} transition={{ duration: 0.25 }}>
                  <ChevronDown size={14} className="text-white/40" />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {appearanceOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-1">
                      <p className="text-[11px] text-white/35 mb-1">
                        바꾸고 싶은 부분만 짧게 적어주세요. 비워둔 항목은 지금 모습 그대로 유지돼요.
                      </p>
                      {/* [폴리싱 #1] 사전 안내 — 외형 수정 시 백엔드가 구외형 원화 후보를 비운다 */}
                      <p className="text-[11px] text-amber-200/70 mb-3">
                        외형을 바꾸면 기존 원화 후보는 사라져요.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {APPEARANCE_FIELDS.map((f) => (
                          <div key={f.key}>
                            <label className="text-[11px] text-white/50 mb-1 block">{f.label}</label>
                            <input
                              type="text"
                              value={appearance[f.key]}
                              maxLength={60}
                              placeholder="비워두면 기존 유지"
                              onChange={(e) =>
                                setAppearance((p) => ({ ...p, [f.key]: e.target.value }))
                              }
                              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-white text-xs placeholder:text-white/25 focus:border-amber-400/60 outline-none"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 외형 입력 시 안내 — 새 원화부터 적용, 스탠딩 확정 후 변경 불가 */}
            <AnimatePresence initial={false}>
              {filledCount > 0 && (
                <motion.p
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden text-[11px] text-amber-200/70 leading-relaxed mb-4"
                >
                  외형이 바뀌면 새 원화부터 적용돼요 — 스탠딩 확정 후에는 바꿀 수 없어요
                </motion.p>
              )}
            </AnimatePresence>

            <div className="flex gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => { sfx.click(); onCancel(); }}
                onMouseEnter={() => sfx.hover()}
                className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 transition text-sm disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => { sfx.click(); onConfirm(buildAppearance()); }}
                onMouseEnter={() => sfx.hover()}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-amber-500/20"
              >
                {busy ? "처리 중…" : filledCount > 0 ? "외형 바꿔서 소환" : "다시 소환"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  STEP 3 — 스탠딩 (BASE_PROCESSING 로딩 → BASE_WAIT 후보 2장 선택/리롤)
//  GachaStep의 카드 뒤집기 reveal 패턴을 재사용. 선택 = 베이스 스탠딩 확정.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const BaseSelectStep = ({ job, busy, error, rerollCost, onSelect, onRerollRequest, onOpenProfile }) => {
  // [리롤 누적] baseCandidates는 리롤마다 +2장씩 누적 — 리롤 중(BASE_PROCESSING)에도
  // 기존 READY 후보는 응답에 유지되므로 계속 선택 대상으로 보여준다.
  const candidates = job?.baseCandidates || [];
  const canSelect = job?.status === "BASE_WAIT";
  // 보여줄 수 있는 후보(READY url 보유 or FAILED)가 하나도 없으면 초기 파생 대기 뷰
  const hasRevealed = candidates.some((c) => c.url || c.status === "FAILED");
  const isWaiting = !hasRevealed;
  const isRerolling = !canSelect && hasRevealed; // 기존 후보 유지한 채 새 후보 파생 중
  // 새 후보가 배열에 pending(DERIVING/REFINING)으로 들어와 있으면 그 칸이 로딩 칸 역할.
  // [폴리싱 #6] 백엔드는 파생 시작 시 후보 2개를 미리 배열에 넣으므로, pending이 하나라도
  // 있으면 합성 플레이스홀더는 0 — 1장이 먼저 완성돼 pending이 1로 줄어도 유령 로딩 칸이 생기지 않는다.
  const pendingInList = candidates.filter((c) => !c.url && c.status !== "FAILED").length;
  const placeholderCount = isRerolling && pendingInList === 0 ? 2 : 0;
  const gridScrolls = candidates.length + placeholderCount > 4; // 4장 초과 시 스크롤 그리드
  const [preview, setPreview] = useState(null); // {index,url} | null

  // 카드 reveal 시 chime — 완성(READY/FAILED)된 후보 세트 기준 1번만 (GachaStep 패턴)
  // pending 상태 변화(DERIVING→REFINING)로는 chime이 재발화하지 않도록 url/FAILED만 키에 포함
  const candKey = candidates
    .filter((c) => c.url || c.status === "FAILED")
    .map((c) => `${c.index}:${c.status}:${c.url || ""}`)
    .join("|");
  const chimedKeyRef = useRef(null);
  useEffect(() => {
    if (!candKey || chimedKeyRef.current === candKey) return;
    chimedKeyRef.current = candKey;
    sfx.cardFanout();
    // [리롤 누적] 새로 도착하는 후보는 한 번에 최대 2장 — chime도 2회로 캡
    const timers = candidates.slice(0, 2).map((_, i) =>
      setTimeout(() => sfx.chime(0.25), 350 + i * 550 + 350)
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candKey]);

  // 후보 세트가 갈렸으면(리롤) 프리뷰 초기화
  useEffect(() => { setPreview(null); }, [candKey]);

  if (isWaiting) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="relative mb-8">
          <SpinnerRing size={72} />
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkles size={26} className="text-amber-300" />
          </motion.div>
        </div>
        <CyclingCopy lines={BASE_LOADING_COPY} className="w-full mb-2" />
        <p className="text-xs text-white/35 mb-8">확정한 원화에서 전신 스탠딩 후보를 파생하고 있어요.</p>
        {/* 레이턴시 하이딩 CTA — 설정 다듬기 */}
        <button
          type="button"
          onClick={() => { sfx.click(); onOpenProfile(); }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-500/12 hover:bg-amber-500/22 border border-amber-400/35 hover:border-amber-300/60 text-amber-100 text-xs font-bold transition-colors"
        >
          <Feather size={13} />
          기다리는 동안 설정을 다듬어보세요
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto w-full">
      <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
        <Sparkles size={16} className="text-amber-300" />
        스탠딩 선택
      </h3>
      <p className="text-xs text-white/50 mb-5">
        캐릭터의 기본 자세예요. 이 스탠딩에서 15가지 표정이 태어나요.
      </p>

      <div
        className={`grid grid-cols-2 gap-3 sm:gap-4 mb-5 max-w-lg mx-auto ${
          gridScrolls ? "max-h-[56vh] overflow-y-auto custom-scrollbar pr-1" : ""
        }`}
      >
        {candidates.map((cand, i) => (
          <div key={cand.index} style={{ perspective: 1000 }}>
            <motion.div
              className="relative w-full aspect-[3/4]"
              style={{ transformStyle: "preserve-3d" }}
              initial={{ rotateY: 180 }}
              animate={{ rotateY: 0 }}
              transition={{ delay: 0.35 + (i % 2) * 0.55, duration: 0.7, ease: "easeOut" }}
            >
              {/* 앞면 — 결과 이미지 / FAILED 에러 카드 */}
              {cand.status === "FAILED" ? (
                <div
                  className="absolute inset-0 rounded-2xl border border-rose-400/40 bg-rose-500/[0.06] flex flex-col items-center justify-center gap-2 px-3 text-center"
                  style={{ backfaceVisibility: "hidden" }}
                >
                  <AlertTriangle size={20} className="text-rose-300/80" />
                  <span className="text-[11px] text-rose-200/80 leading-relaxed">
                    이 후보는 생성에 실패했어요
                  </span>
                </div>
              ) : cand.url ? (
                <button
                  type="button"
                  onClick={() => { sfx.click(); setPreview(cand); }}
                  className="absolute inset-0 rounded-2xl overflow-hidden border border-amber-400/25 hover:border-amber-300/70 transition-colors group"
                  style={{ backfaceVisibility: "hidden" }}
                >
                  <img src={cand.url} alt={`스탠딩 후보 ${cand.index + 1}`} className="w-full h-full object-cover" draggable={false} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-white/80 opacity-0 group-hover:opacity-100 transition-opacity">
                    탭해서 확대
                  </span>
                </button>
              ) : (
                /* [리롤 누적] 아직 파생 중인 후보(DERIVING/REFINING) — 새 카드 로딩 칸 */
                <div
                  className="absolute inset-0 rounded-2xl border border-white/10 bg-white/[0.03] flex flex-col items-center justify-center gap-3"
                  style={{ backfaceVisibility: "hidden" }}
                >
                  <SpinnerRing size={28} />
                  <span className="text-[10px] text-amber-100/50">새 후보 파생 중…</span>
                </div>
              )}
              {/* 뒷면 — 카드 커버 */}
              <div
                className="absolute inset-0 rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-900/60 via-stone-950 to-black flex items-center justify-center"
                style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
              >
                <Sparkles size={28} className="text-amber-300/50" />
              </div>
            </motion.div>
          </div>
        ))}
        {/* [리롤 누적] 리롤 중인데 새 후보가 아직 배열에 없으면 부족분만큼 로딩 칸 */}
        {placeholderCount > 0 &&
          Array.from({ length: placeholderCount }, (_, k) => (
            <motion.div
              key={`pending-${k}`}
              className="relative w-full aspect-[3/4] rounded-2xl border border-amber-400/20 bg-gradient-to-br from-amber-900/40 via-stone-950 to-black flex flex-col items-center justify-center gap-3"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: k * 0.15, duration: 0.4 }}
            >
              <SpinnerRing size={30} />
              <span className="text-[10px] text-amber-100/50">새 후보 파생 중…</span>
            </motion.div>
          ))}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-400/25 text-rose-200 text-xs">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-white/35">
          마음에 드는 자세를 탭해서 크게 확인해 보세요.
          <span className="block text-amber-200/45 mt-0.5">다시 파생해도 기존 후보는 유지돼요.</span>
        </p>
        <button
          type="button"
          disabled={busy || isRerolling}
          onClick={() => { sfx.click(); onRerollRequest(); }}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-amber-400/40 text-white/70 hover:text-amber-100 text-xs font-bold transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={isRerolling ? "animate-spin" : ""} />
          {isRerolling ? "파생 중…" : "다시 파생"}
          <span className="inline-flex items-center gap-0.5 text-amber-300/90">
            <Zap size={10} />{rerollCost}
          </span>
        </button>
      </div>

      {/* 확대 프리뷰 → 확정 */}
      <AnimatePresence>
        {preview && (
          <motion.div
            className="fixed inset-0 z-[120] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setPreview(null)} />
            {/* [폴리싱 #5] 확대 프리뷰 — 뷰포트 최대 활용 (이미지 크기에 맞춰 폭 결정) */}
            <motion.div
              className="relative z-10 flex flex-col max-w-[92vw] max-h-[86vh]"
              initial={{ scale: 0.92, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
            >
              <div className="rounded-2xl overflow-hidden border border-amber-400/30 shadow-[0_0_60px_rgba(251,191,36,0.15)] mx-auto">
                <img src={preview.url} alt={`스탠딩 후보 ${preview.index + 1}`} className="max-w-[92vw] max-h-[72vh] w-auto h-auto object-contain bg-black/90" />
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => { sfx.click(); setPreview(null); }}
                  className="flex-1 py-3 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 transition text-sm disabled:opacity-50"
                >
                  다른 자세 보기
                </button>
                <button
                  type="button"
                  disabled={busy || !canSelect}
                  onClick={() => onSelect(preview.index)}
                  className="flex-1 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-amber-500/25 transition flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  <Check size={15} />
                  {!canSelect ? "새 후보 생성 중…" : busy ? "확정 중…" : "이 모습으로 확정"}
                </button>
              </div>
              <p className="mt-3 text-center text-[11px] text-amber-100/60">
                이 스탠딩에서 15가지 표정이 태어나요
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  STEP 4 — 소환 진행 (15칸 감정 그리드)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const ForgeProgressStep = ({ job, onOpenWorldBuilder }) => {
  const assets = job?.emotionAssets || {};
  const readyCount = EMOTION_ORDER.filter(
    (t) => t !== "NEUTRAL" && EMOTION_DONE_STATUSES.has(assets[t]?.status)
  ).length;
  const copy = `표정을 하나씩 새기는 중… (${readyCount}/14)`;

  return (
    <div className="max-w-2xl mx-auto w-full">
      <div className="flex flex-col items-center mb-6">
        {job?.baseStandingUrl ? (
          <motion.img
            src={job.baseStandingUrl}
            alt="베이스 스탠딩"
            className="h-44 object-contain mb-4 drop-shadow-[0_0_30px_rgba(251,191,36,0.2)]"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7 }}
            draggable={false}
          />
        ) : (
          <div className="mb-4"><SpinnerRing size={56} /></div>
        )}
        <motion.p
          className="text-sm text-amber-100/85 font-medium"
          animate={{ opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 2.5, repeat: Infinity }}
        >
          {copy}
        </motion.p>
      </div>

      {/* 15칸 감정 그리드 */}
      <div className="grid grid-cols-5 gap-2 sm:gap-3">
        {EMOTION_ORDER.map((tag) => {
          const asset = assets[tag];
          const done = EMOTION_DONE_STATUSES.has(asset?.status) && asset?.thumbUrl;
          const failed = asset?.status === "FAILED";
          return (
            <div
              key={tag}
              className={`relative aspect-square rounded-xl overflow-hidden border ${
                done
                  ? "border-amber-400/30"
                  : failed
                  ? "border-rose-400/40 bg-rose-500/5"
                  : "border-white/10 bg-white/[0.03]"
              }`}
            >
              {done ? (
                // "깨어나는" 연출 — 스켈레톤 → 페이드인
                <motion.img
                  src={asset.thumbUrl}
                  alt={EMOTION_LABELS[tag]}
                  className="w-full h-full object-cover"
                  initial={{ opacity: 0, scale: 1.08, filter: "brightness(1.8)" }}
                  animate={{ opacity: 1, scale: 1, filter: "brightness(1)" }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                  draggable={false}
                />
              ) : (
                <motion.div
                  className="absolute inset-0 flex items-center justify-center"
                  animate={failed ? {} : { opacity: [0.35, 0.7, 0.35] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  {failed ? (
                    <AlertTriangle size={14} className="text-rose-300/70" />
                  ) : (
                    <Sparkles size={12} className="text-amber-200/30" />
                  )}
                </motion.div>
              )}
              <span className="absolute bottom-0.5 left-0 right-0 text-center text-[9px] text-white/55 drop-shadow">
                {EMOTION_LABELS[tag]}
              </span>
            </div>
          );
        })}
      </div>

      {/* [World Builder] 감정 파생 대기 CTA — 기다리는 시간을 세계관 만들기로 (레이턴시 하이딩) */}
      {onOpenWorldBuilder && (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={() => { sfx.click(); onOpenWorldBuilder(); }}
            onMouseEnter={() => sfx.hover()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-500/12 hover:bg-amber-500/22 border border-amber-400/35 hover:border-amber-300/60 text-amber-100 text-xs font-bold transition-colors"
          >
            <Globe size={13} />
            기다리는 동안 이 캐릭터의 세계관 만들기
          </button>
        </div>
      )}

      <p className="mt-5 text-center text-[11px] text-white/35">
        소환은 서버에서 계속 진행돼요. 나가서 기다려도 괜찮아요.
      </p>
    </div>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  STEP 5 — 검수 (그리드 / 미리보기 모드) + 후처리 로딩
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const PostProcessingView = ({ status }) => (
  <div className="flex flex-col items-center justify-center py-20">
    <SpinnerRing size={64} className="mb-6" />
    <motion.p
      className="text-sm text-amber-100/85 font-medium mb-2"
      animate={{ opacity: [0.55, 1, 0.55] }}
      transition={{ duration: 2, repeat: Infinity }}
    >
      {status === "BINDING" ? "세계와 캐릭터를 잇는 중…" : "누끼를 따는 중…"}
    </motion.p>
    <p className="text-xs text-white/35">마지막 손질이에요. 곧 완성됩니다.</p>
  </div>
);

const ReviewGridStep = ({ job, busy, error, rerollCost, onRerollRequest, onVersionSelect, onCompleteRequest }) => {
  const assets = job?.emotionAssets || {};
  const [mode, setMode] = useState("grid"); // grid | preview
  const [zoomTag, setZoomTag] = useState(null);
  const [previewTag, setPreviewTag] = useState("NEUTRAL");

  const allReady = EMOTION_ORDER.every((t) => assets[t]?.status === "READY");
  const previewUrl = assets[previewTag]?.thumbUrl || job?.baseStandingUrl;

  // [리롤 누적] 확대 중인 컷 정보 — versions(완성본 누적 리스트)/selectedIndex 기반 버전 스트립용
  const zoomAsset = zoomTag ? assets[zoomTag] || {} : {};
  const zoomVersions = zoomAsset.versions || [];
  const zoomSelectedIdx = zoomAsset.selectedIndex ?? zoomVersions.length - 1;
  const zoomInProgress =
    Boolean(zoomTag) && zoomAsset.status !== "READY" && zoomAsset.status !== "FAILED";

  return (
    <div className="max-w-3xl mx-auto w-full">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Eye size={16} className="text-amber-300" />
          15가지 표정 검수
        </h3>
        <button
          type="button"
          onClick={() => { sfx.click(); setMode((m) => (m === "grid" ? "preview" : "grid")); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-[11px] font-bold transition-colors"
        >
          {mode === "grid" ? <Eye size={11} /> : <LayoutGrid size={11} />}
          {mode === "grid" ? "미리보기 모드" : "그리드 보기"}
        </button>
      </div>
      <p className="text-xs text-white/50 mb-5">
        마음에 들지 않는 컷은 다시 뽑을 수 있어요. 기본 컷은 캐릭터의 기준이라 바꿀 수 없습니다.
      </p>

      {mode === "grid" ? (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5 mb-5">
          {EMOTION_ORDER.map((tag) => {
            const asset = assets[tag] || {};
            const status = asset.status;
            const isNeutral = tag === "NEUTRAL";
            const isReady = status === "READY";
            const isFailed = status === "FAILED";
            const inProgress = !isReady && !isFailed;
            return (
              <div
                key={tag}
                className={`relative rounded-xl overflow-hidden border ${
                  isFailed
                    ? "border-rose-400/50"
                    : isNeutral
                    ? "border-amber-400/40"
                    : "border-white/10"
                } bg-white/[0.03]`}
              >
                <button
                  type="button"
                  onClick={() => { if (asset.thumbUrl) { sfx.click(); setZoomTag(tag); } }}
                  className="block w-full aspect-square"
                >
                  {asset.thumbUrl ? (
                    <img src={asset.thumbUrl} alt={EMOTION_LABELS[tag]} className="w-full h-full object-cover" draggable={false} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">?</div>
                  )}
                  {inProgress && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <SpinnerRing size={22} />
                    </div>
                  )}
                </button>
                {/* 하단 컨트롤 바 */}
                <div className="flex items-center justify-between px-1.5 py-1 bg-black/40">
                  <span className="text-[9px] text-white/60">{EMOTION_LABELS[tag]}</span>
                  {isNeutral ? (
                    <span className="text-[8px] text-amber-300/70 font-bold">기준 컷</span>
                  ) : isFailed ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => { sfx.click(); onRerollRequest(tag, true); }}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/40 text-rose-200 text-[8px] font-bold disabled:opacity-50"
                    >
                      <RefreshCw size={7} /> 무료 재시도
                    </button>
                  ) : isReady ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => { sfx.click(); onRerollRequest(tag, false); }}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-white/5 hover:bg-white/15 border border-white/15 text-white/60 hover:text-amber-100 text-[8px] font-bold transition-colors disabled:opacity-50"
                      title={`에너지 ${rerollCost}로 다시 뽑기`}
                    >
                      <RefreshCw size={7} /> <Zap size={7} className="text-amber-300" />{rerollCost}
                    </button>
                  ) : (
                    <span className="text-[8px] text-white/35">생성 중</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ─── 미리보기 모드: 스탠딩 핫스왑 ─── */
        <div className="mb-5">
          <div className="relative h-[46vh] min-h-[280px] rounded-2xl border border-white/10 bg-gradient-to-b from-stone-900/40 to-black/60 flex items-end justify-center overflow-hidden mb-3">
            <AnimatePresence mode="popLayout">
              {previewUrl ? (
                <motion.img
                  key={previewTag}
                  src={previewUrl}
                  alt={EMOTION_LABELS[previewTag]}
                  className="h-[94%] object-contain select-none"
                  initial={{ opacity: 0, scale: 1.02 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  transition={{ duration: 0.25 }}
                  draggable={false}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-white/25 text-sm">이미지가 아직 없어요</div>
              )}
            </AnimatePresence>
            <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/50 border border-white/10 text-[10px] text-amber-100 font-bold">
              {EMOTION_LABELS[previewTag]}
            </span>
          </div>
          {/* 하단 감정 버튼 바 */}
          <div className="flex gap-1.5 overflow-x-auto custom-scrollbar pb-1.5">
            {EMOTION_ORDER.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => { sfx.click(0.15); setPreviewTag(tag); }}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium border transition-colors ${
                  previewTag === tag
                    ? "bg-amber-500/20 border-amber-400/60 text-amber-100"
                    : "bg-white/[0.03] border-white/10 text-white/55 hover:bg-white/[0.08]"
                }`}
              >
                {EMOTION_LABELS[tag]}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-400/25 text-rose-200 text-xs">
          {error}
        </div>
      )}

      <motion.button
        type="button"
        disabled={!allReady || busy}
        onClick={() => {
          if (!allReady || busy) { sfx.locked(); return; }
          sfx.click();
          onCompleteRequest();
        }}
        whileTap={{ scale: allReady && !busy ? 0.98 : 1 }}
        className={`w-full py-3.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${
          allReady && !busy
            ? "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-amber-500/25"
            : "bg-white/5 text-white/25 cursor-not-allowed"
        }`}
      >
        <Check size={16} />
        {allReady ? "완성하기" : "모든 컷이 준비되면 완성할 수 있어요"}
      </motion.button>

      {/* 컷 확대 */}
      <AnimatePresence>
        {zoomTag && (
          <motion.div
            className="fixed inset-0 z-[120] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setZoomTag(null)} />
            {/* [폴리싱 #5] 컷 확대 — 뷰포트 최대 활용 (이미지 크기에 맞춰 폭 결정) */}
            <motion.div
              className="relative z-10 flex flex-col max-w-[92vw] max-h-[86vh]"
              initial={{ scale: 0.92 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.92 }}
            >
              <div className="relative rounded-2xl overflow-hidden border border-amber-400/30 mx-auto">
                <img
                  src={assets[zoomTag]?.thumbUrl}
                  alt={EMOTION_LABELS[zoomTag]}
                  className="max-w-[92vw] max-h-[72vh] w-auto h-auto object-contain bg-black/90"
                />
                {/* [리롤 누적] 리롤/재시도 중 — 직전 선택본 위 스피너 오버레이 (thumbUrl 유지) */}
                {zoomInProgress && (
                  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2">
                    <SpinnerRing size={32} />
                    <span className="text-[11px] text-amber-100/70">다시 생성하는 중…</span>
                  </div>
                )}
              </div>

              {/* [리롤 누적] 버전 스트립 — 완성본 누적 리스트에서 무료로 골라 되돌리기 */}
              {zoomVersions.length > 1 && (
                <div className="mt-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-[11px] text-white/55 font-bold">버전 선택</span>
                    <span className="px-1.5 py-0.5 rounded-full bg-teal-500/15 border border-teal-400/30 text-teal-200 text-[9px] font-bold">
                      무료
                    </span>
                    <span className="text-[10px] text-white/35">이전에 뽑은 컷으로 언제든 바꿀 수 있어요</span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1.5">
                    {zoomVersions.map((url, vi) => {
                      const isSelected = vi === zoomSelectedIdx;
                      return (
                        <button
                          key={vi}
                          type="button"
                          disabled={busy || zoomInProgress || isSelected}
                          onClick={() => { sfx.click(); onVersionSelect(zoomTag, vi); }}
                          className={`relative flex-shrink-0 w-16 aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
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
                <span className="text-sm text-amber-100 font-bold">{EMOTION_LABELS[zoomTag]}</span>
                <button
                  type="button"
                  onClick={() => { sfx.click(); setZoomTag(null); }}
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
//  STEP 6 — 완성
//
//  [역할 분리] 여기의 인라인 텍스트 수정은 완성 후 characterId 기반
//  PATCH /ugc/characters/{characterId}/texts (updateUgcTexts) — 기존 그대로 유지.
//  진행 중(GOLDEN_GENERATING~REVIEW_WAIT) 설정 편집은 ProfileEditPanel이
//  jobId 기반 PATCH /ugc/characters/{jobId}/profile (updateUgcProfile)로 담당한다.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const CompleteStep = ({
  job, character, busy, error,
  onSaveTexts, onTogglePublish, onRequestSecret, onChat, onExit,
}) => {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);

  // 등장 SFX — 1회
  const sparkledRef = useRef(false);
  useEffect(() => {
    if (sparkledRef.current) return;
    sparkledRef.current = true;
    sfx.sparkle();
  }, []);

  const startEdit = () => {
    sfx.click();
    setForm({
      name: character?.name || "",
      tagline: character?.tagline || "",
      personality: character?.personality || "",
      tone: character?.tone || "",
      firstGreeting: character?.firstGreeting || "",
    });
    setEditing(true);
  };

  const standingUrl =
    job?.baseStandingUrl || job?.emotionAssets?.NEUTRAL?.thumbUrl || character?.defaultImageUrl;

  const visibility = character?.visibility || "PRIVATE";
  const publishOn = visibility === "PENDING_PUBLIC" || visibility === "PUBLIC";
  const secretStatus = character?.secretReviewStatus || "NONE";

  return (
    <div className="max-w-3xl mx-auto w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* 스탠딩 등장 */}
        <div className="relative h-[46vh] min-h-[300px] rounded-2xl border border-amber-400/20 bg-gradient-to-b from-amber-950/30 to-black/60 flex items-end justify-center overflow-hidden">
          <motion.div
            className="absolute left-1/2 -translate-x-1/2 bottom-[8%] w-64 h-32 rounded-full pointer-events-none"
            style={{ filter: "blur(60px)", backgroundColor: "rgba(251,191,36,0.14)" }}
            animate={{ opacity: [0.4, 0.75, 0.4] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
          {standingUrl ? (
            <motion.img
              src={standingUrl}
              alt={character?.name || "완성된 캐릭터"}
              className="relative h-[94%] object-contain select-none"
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
              draggable={false}
            />
          ) : (
            <div className="h-full flex items-center justify-center"><SpinnerRing size={40} /></div>
          )}
        </div>

        {/* 정보 카드 */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="rounded-2xl bg-white/[0.04] border border-white/10 p-5 mb-4"
          >
            {!editing ? (
              <>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="text-xl font-black text-white">{character?.name || "이름을 짓는 중…"}</h3>
                  <button
                    type="button"
                    onClick={startEdit}
                    disabled={!character}
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/15 text-white/50 hover:text-white transition disabled:opacity-40"
                    aria-label="텍스트 수정"
                  >
                    <Pencil size={13} />
                  </button>
                </div>
                <p className="text-sm text-amber-100/75 mb-3">{character?.tagline || ""}</p>
                {character?.personality && (
                  <p className="text-xs text-white/50 leading-relaxed mb-1.5">
                    <span className="text-white/35">성격</span> · {character.personality}
                  </p>
                )}
                {character?.tone && (
                  <p className="text-xs text-white/50 leading-relaxed mb-1.5">
                    <span className="text-white/35">말투</span> · {character.tone}
                  </p>
                )}
                {character?.firstGreeting && (
                  <p className="text-xs text-white/55 leading-relaxed mt-3 px-3 py-2.5 rounded-xl bg-black/30 border border-white/5 italic">
                    “{character.firstGreeting}”
                  </p>
                )}
              </>
            ) : (
              <div className="space-y-3">
                {[
                  { key: "name", label: "이름", max: 20 },
                  { key: "tagline", label: "태그라인", max: 60 },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="text-[11px] text-white/50 mb-1 block">{f.label}</label>
                    <input
                      type="text"
                      value={form[f.key]}
                      maxLength={f.max}
                      onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder:text-white/25 focus:border-amber-400/60 outline-none"
                    />
                  </div>
                ))}
                {[
                  { key: "personality", label: "성격", rows: 2 },
                  { key: "tone", label: "말투", rows: 2 },
                  { key: "firstGreeting", label: "첫인사", rows: 3 },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="text-[11px] text-white/50 mb-1 block">{f.label}</label>
                    <textarea
                      value={form[f.key]}
                      rows={f.rows}
                      onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder:text-white/25 focus:border-amber-400/60 outline-none resize-none"
                    />
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => { sfx.click(); setEditing(false); }}
                    className="flex-1 py-2 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 transition text-xs disabled:opacity-50"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      sfx.click();
                      const ok = await onSaveTexts(form);
                      if (ok) setEditing(false);
                    }}
                    className="flex-1 py-2 rounded-xl bg-amber-600/80 hover:bg-amber-500/80 text-white text-xs font-bold transition disabled:opacity-50"
                  >
                    {busy ? "저장 중…" : "저장"}
                  </button>
                </div>
              </div>
            )}
          </motion.div>

          {/* 공개 토글 */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="rounded-2xl bg-white/[0.03] border border-white/10 p-4 mb-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Globe size={15} className={publishOn ? "text-teal-300" : "text-white/40"} />
                <div>
                  <div className="text-sm font-bold text-white">
                    {visibility === "PUBLIC" ? "공개 중" : "탐색 피드에 공개"}
                  </div>
                  <div className="text-[11px] text-white/45 mt-0.5">
                    {visibility === "PUBLIC"
                      ? "다른 유저가 이 캐릭터와 대화할 수 있어요"
                      : "검토 후 공개돼요. 그동안은 나만 대화할 수 있어요"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                disabled={busy || !character || visibility === "PUBLIC"}
                onClick={() => { sfx.click(); onTogglePublish(!publishOn); }}
                className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${
                  publishOn ? "bg-teal-500/70" : "bg-white/10"
                } disabled:opacity-50`}
                aria-label="공개 토글"
              >
                <motion.span
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow"
                  animate={{ left: publishOn ? 22 : 2 }}
                  transition={{ type: "spring", stiffness: 500, damping: 32 }}
                />
              </button>
            </div>
          </motion.div>

          {/* Secret 신청 */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="rounded-2xl bg-white/[0.03] border border-white/10 p-4 mb-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Moon size={15} className="text-rose-300/80" />
                <div>
                  <div className="text-sm font-bold text-white">Secret 모드 신청</div>
                  <div className="text-[11px] text-white/45 mt-0.5">
                    성인 인증 유저 전용 기능이에요. 심사 후 활성화됩니다.
                  </div>
                </div>
              </div>
              {secretStatus === "PENDING" ? (
                <span className="text-[11px] font-bold text-amber-300/80 flex-shrink-0">심사 중</span>
              ) : secretStatus === "APPROVED" ? (
                <span className="text-[11px] font-bold text-rose-300 flex-shrink-0">승인됨</span>
              ) : (
                <button
                  type="button"
                  disabled={busy || !character || !character.secretEligible}
                  onClick={() => { sfx.click(); onRequestSecret(); }}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 text-rose-200 text-[11px] font-bold transition-colors disabled:opacity-40"
                >
                  {secretStatus === "REJECTED" ? "다시 신청" : "신청하기"}
                </button>
              )}
            </div>
            {secretStatus === "REJECTED" && character?.reviewNote && (
              <p className="mt-2 text-[11px] text-rose-200/70">{character.reviewNote}</p>
            )}
          </motion.div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-400/25 text-rose-200 text-xs">
              {error}
            </div>
          )}

          {/* CTA */}
          <div className="flex gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => { sfx.click(); onExit(); }}
              className="flex-1 py-3 rounded-xl bg-white/5 text-white/55 hover:bg-white/10 transition text-sm disabled:opacity-50"
            >
              스튜디오로
            </button>
            <button
              type="button"
              disabled={busy || !job?.characterId}
              onClick={onChat}
              className="flex-1 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-amber-500/25 transition flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              <MessageCircle size={15} />
              바로 대화하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  메인 컴포넌트
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function StudioCreateFlow({
  initialJobId = null,
  energy = 0,
  onClose,
  onEnergyRefresh = null,
}) {
  const navigate = useNavigate();
  const [jobId, setJobId] = useState(initialJobId || null);
  const { job, loading: jobLoading, error: jobFetchError, refresh } = useUgcCreationJob(jobId);

  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [confirmState, setConfirmState] = useState(null); // {title,desc,confirmLabel,danger,action}
  const [completedChar, setCompletedChar] = useState(null);

  const hasJob = Boolean(jobId);
  const status = job?.status || null;
  const isFailed = status === "FAILED" || status === "EXPIRED";
  const step = hasJob ? resolveStep(job) : 1;
  const rerollCosts = job?.rerollCosts || { goldenShot: 2, baseStanding: 2, emotion: 2 };

  // ─── "설정 다듬기" 패널 (레이턴시 하이딩 핵심 UI) ───
  const [profileOpen, setProfileOpen] = useState(false);
  const canEditProfile =
    hasJob && Boolean(job) && !isFailed &&
    (PROFILE_EDIT_STATUSES.has(status) ||
      (status === "CONCEPT_PROCESSING" && job?.currentStepHint === "GOLDEN_GENERATING"));

  // 편집 불가 상태로 전이(완성 확정/실패 등)하면 패널을 닫는다
  useEffect(() => {
    if (profileOpen && !canEditProfile) setProfileOpen(false);
  }, [profileOpen, canEditProfile]);

  // 스텝 전환 시 에러 초기화 (이전 스텝의 액션 에러가 남지 않도록)
  useEffect(() => { setActionError(null); }, [step]);

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

  // ─── STEP 1: 소환 시작 ───
  const handleConceptSubmit = async ({ name, gender, concept, appearance, officialWorldId, ugcWorldId }) => {
    if (busyRef.current) return; // [폴리싱 #8] 연타 재진입 방어
    busyRef.current = true;
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await createUgcCharacter({ name, gender, concept, appearance, officialWorldId, ugcWorldId });
      sfx.sparkle();
      setJobId(res.jobId);
      onEnergyRefresh?.();
    } catch (e) {
      sfx.thud();
      // 400(진행 중 잡/잔액 부족/모더레이션 차단): 서버 메시지 그대로
      setActionError(e?.response?.data?.message || "소환을 시작하지 못했습니다.");
    } finally {
      busyRef.current = false;
      setActionBusy(false);
    }
  };

  // ─── STEP 2: 원화(황금샷) ───
  const handleGoldenSelect = (index) =>
    runAction(() => selectGoldenShot(jobId, index), sfx.sparkle);

  // 리롤은 전용 모달(GoldenRerollModal)로 — 비용 고지 + 외형 수정(선택)까지 담당
  const [goldenRerollOpen, setGoldenRerollOpen] = useState(false);
  const handleGoldenRerollRequest = () => setGoldenRerollOpen(true);

  // [폴리싱 #1] 외형 수정 리롤 중 — 백엔드가 구외형 원화를 비우므로 대기 뷰에 전용 카피를 띄운다
  const [appearanceRerollPending, setAppearanceRerollPending] = useState(false);

  // 다음 GACHA_WAIT 도달(새 원화 도착) 시 해제
  useEffect(() => {
    if (status === "GACHA_WAIT") setAppearanceRerollPending(false);
  }, [status]);

  // appearance: 값 있는 필드만 담긴 객체 | null(외형 유지 순수 seed 리롤) — 모달이 구성
  // [폴리싱 #8] 확인 버튼 이중 발화 차단 — 핸들러 최상단 ref 가드
  const goldenConfirmFiredRef = useRef(false);
  const handleGoldenRerollConfirm = async (appearance) => {
    if (goldenConfirmFiredRef.current) return;
    goldenConfirmFiredRef.current = true;
    try {
      setGoldenRerollOpen(false);
      if (appearance) setAppearanceRerollPending(true);
      const ok = await runAction(() => rerollGoldenShots(jobId, appearance), sfx.cardFanout);
      if (!ok) setAppearanceRerollPending(false); // 요청 실패 — 기존 후보 유지되므로 안내 철회
    } finally {
      goldenConfirmFiredRef.current = false;
    }
  };

  // ─── STEP 3: 스탠딩 후보 선택 / 리롤 ───
  const handleBaseSelect = (index) =>
    runAction(() => selectBaseStanding(jobId, index), sfx.sparkle);

  const handleBaseRerollRequest = () => {
    setConfirmState({
      title: "스탠딩 다시 파생",
      desc: `에너지 ${rerollCosts.baseStanding}을 사용해 스탠딩 후보 2장을 새로 파생합니다.\n기존 후보는 사라지지 않고 그대로 유지돼요.`,
      confirmLabel: "다시 파생",
      action: () => runAction(() => rerollBaseStandings(jobId), sfx.cardFanout),
    });
  };

  // ─── 설정 다듬기 저장 — 변경 필드만 PATCH (성공 여부는 패널이 토스트로 처리) ───
  const handleProfileSave = useCallback(
    async (changedFields) => {
      try {
        await updateUgcProfile(jobId, changedFields);
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

  // ─── STEP 5: 감정 컷 리롤 / 완성 ───
  const handleEmotionRerollRequest = (tag, isFree) => {
    if (isFree) {
      // FAILED 컷 — 무료 재시도, confirm 없이 즉시
      runAction(() => rerollEmotionCut(jobId, tag), sfx.chime);
      return;
    }
    setConfirmState({
      title: `${EMOTION_LABELS[tag]} 컷 다시 뽑기`,
      desc: `에너지 ${rerollCosts.emotion}을 사용해 이 표정을 다시 생성합니다.\n이전 완성본은 버전 목록에 남아 언제든 무료로 되돌릴 수 있어요.`,
      confirmLabel: "다시 뽑기",
      action: () => runAction(() => rerollEmotionCut(jobId, tag), sfx.chime),
    });
  };

  // ─── STEP 5: 감정 컷 버전 선택 (무과금, REVIEW_WAIT 전용) ───
  const handleEmotionVersionSelect = (tag, versionIndex) =>
    runAction(() => selectEmotionVersion(jobId, tag, versionIndex), sfx.chime);

  const handleCompleteRequest = () => {
    setConfirmState({
      title: "캐릭터 완성",
      desc: "완성하면 표정 컷을 더 이상 다시 뽑을 수 없어요.\n마무리 작업 후 캐릭터가 등록됩니다.",
      confirmLabel: "완성하기",
      action: () => runAction(() => confirmCreation(jobId), sfx.chime),
    });
  };

  // ─── 실패/만료: 작업 정리 ───
  const handleAbandonRequest = () => {
    setConfirmState({
      danger: true,
      title: "작업 정리",
      desc: "이 소환 작업을 삭제합니다. 사용한 에너지는 환불되지 않아요.",
      confirmLabel: "삭제하기",
      action: async () => {
        setActionBusy(true);
        try {
          await abandonCreationJob(jobId);
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

  // ─── STEP 6: 완성 캐릭터 로드 + 액션 ───
  const refreshCompletedChar = useCallback(async () => {
    if (!job?.characterId) return;
    try {
      const data = await fetchMyUgcCharacters();
      const c = (data?.characters || []).find((x) => x.characterId === job.characterId);
      if (c) setCompletedChar(c);
    } catch { /* noop — 다음 액션에서 재시도 */ }
  }, [job?.characterId]);

  useEffect(() => {
    if (status === "READY" && job?.characterId) refreshCompletedChar();
  }, [status, job?.characterId, refreshCompletedChar]);

  const runCharAction = useCallback(
    async (fn, successSfx = null) => {
      if (busyRef.current) return false; // [폴리싱 #8] 연타 재진입 방어
      busyRef.current = true;
      setActionBusy(true);
      setActionError(null);
      try {
        await fn();
        successSfx?.();
        await refreshCompletedChar();
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
    [refreshCompletedChar]
  );

  const handleSaveTexts = (texts) =>
    runCharAction(() => updateUgcTexts(completedChar.characterId, texts), sfx.chime);

  const handleTogglePublish = (publish) =>
    runCharAction(() => requestPublish(completedChar.characterId, !publish), sfx.chime);

  const handleRequestSecret = () =>
    runCharAction(() => requestSecret(completedChar.characterId), sfx.chime);

  // 대화 진입 — 기존 로비 방 생성 API 재사용 (SANDBOX)
  const handleChat = async () => {
    if (!job?.characterId) return;
    sfx.click();
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await api.post("/lobby/rooms", {
        characterId: job.characterId,
        chatMode: "SANDBOX",
      });
      localStorage.setItem("roomId", res.data.roomId);
      navigate(`/chat/${res.data.roomId}`);
    } catch (e) {
      sfx.thud();
      setActionError(e?.response?.data?.message || "대화방 생성에 실패했습니다.");
      setActionBusy(false);
    }
  };

  // ─── 이탈 제어: WAIT/백그라운드 진행 상태에서만 "나가서 기다리기" ───
  const canLeave = !hasJob || LEAVE_ALLOWED_STATUSES.has(status);

  const handleLeave = () => {
    sfx.click();
    onClose?.();
  };

  // ─── 스텝 콘텐츠 키 (AnimatePresence mode="wait") ───
  const contentKey = isFailed
    ? "failed"
    : hasJob && !job
    ? "job-loading"
    : `step-${step}-${status === "POSTPROCESSING" || status === "BINDING" ? "post" : "main"}`;

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
            <Wand2 size={12} className="text-amber-300/70" />
            Lucid Studio
          </div>

          {/* 우: 에너지 */}
          <div className="flex items-center gap-1.5 bg-black/20 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/10">
            <Zap size={13} className="text-amber-300" />
            <span className="text-sm font-semibold text-white tabular-nums">{energy}</span>
          </div>
        </div>

        {/* 스테퍼 — TheaterCreateFlow와 같은 폼팩터, 앰버 톤 */}
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
                    <p className="text-sm text-white/45">소환 상태를 불러오는 중…</p>
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
                  {status === "EXPIRED" ? "소환 작업이 만료되었어요" : "소환에 실패했어요"}
                </h3>
                <p className="text-sm text-white/50 leading-relaxed mb-6 whitespace-pre-line">
                  {job?.failReason ||
                    (status === "EXPIRED"
                      ? "오랫동안 진행되지 않아 작업이 만료되었습니다."
                      : "생성 과정에서 문제가 발생했습니다.")}
                </p>
                {actionError && (
                  <div className="mb-4 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-400/25 text-rose-200 text-xs">
                    {actionError}
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={handleAbandonRequest}
                    className="flex-1 py-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-400/25 text-rose-200 text-sm font-bold transition-colors disabled:opacity-50"
                  >
                    작업 정리하기
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
              <ConceptStep
                busy={actionBusy}
                error={actionError}
                energy={energy}
                onSubmit={handleConceptSubmit}
              />
            )}
            {!isFailed && hasJob && job && step === 1 && (
              <div className="flex flex-col items-center justify-center py-20">
                <SpinnerRing size={56} className="mb-6" />
                <motion.p
                  className="text-sm text-amber-100/85 font-medium mb-2"
                  animate={{ opacity: [0.55, 1, 0.55] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  컨셉을 읽어내는 중…
                </motion.p>
                <p className="text-xs text-white/35">당신의 문장에서 인물의 윤곽을 찾고 있어요.</p>
              </div>
            )}

            {/* STEP 2 — 원화(황금샷) */}
            {!isFailed && hasJob && job && step === 2 && (
              <GachaStep
                job={job}
                busy={actionBusy}
                error={actionError}
                rerollCost={rerollCosts.goldenShot}
                appearanceRerollPending={appearanceRerollPending}
                onSelect={handleGoldenSelect}
                onRerollRequest={handleGoldenRerollRequest}
              />
            )}

            {/* STEP 3 — 스탠딩 후보 선택 */}
            {!isFailed && hasJob && job && step === 3 && (
              <BaseSelectStep
                job={job}
                busy={actionBusy}
                error={actionError}
                rerollCost={rerollCosts.baseStanding}
                onSelect={handleBaseSelect}
                onRerollRequest={handleBaseRerollRequest}
                onOpenProfile={() => setProfileOpen(true)}
              />
            )}

            {/* STEP 4 — 소환 진행 */}
            {!isFailed && hasJob && job && step === 4 && (
              <ForgeProgressStep
                job={job}
                // [World Builder] 캐릭터 잡은 서버에서 계속 진행 — 월드 빌더로 이동해도 안전
                onOpenWorldBuilder={() => navigate("/studio/world")}
              />
            )}

            {/* STEP 5 — 검수 / 후처리 */}
            {!isFailed && hasJob && job && step === 5 && (
              status === "REVIEW_WAIT" ? (
                <ReviewGridStep
                  job={job}
                  busy={actionBusy}
                  error={actionError}
                  rerollCost={rerollCosts.emotion}
                  onRerollRequest={handleEmotionRerollRequest}
                  onVersionSelect={handleEmotionVersionSelect}
                  onCompleteRequest={handleCompleteRequest}
                />
              ) : (
                <PostProcessingView status={status} />
              )
            )}

            {/* STEP 6 — 완성 */}
            {!isFailed && hasJob && job && step === 6 && (
              <CompleteStep
                job={job}
                character={completedChar}
                busy={actionBusy}
                error={actionError}
                onSaveTexts={handleSaveTexts}
                onTogglePublish={handleTogglePublish}
                onRequestSecret={handleRequestSecret}
                onChat={handleChat}
                onExit={handleLeave}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ═══ "설정 다듬기" 플로팅 CTA — 로딩·대기 구간 상시 노출 (레이턴시 하이딩) ═══ */}
      <AnimatePresence>
        {canEditProfile && !profileOpen && (
          <motion.button
            type="button"
            onClick={() => { sfx.click(); setProfileOpen(true); }}
            onMouseEnter={() => sfx.hover()}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            whileTap={{ scale: 0.96 }}
            className="absolute bottom-5 right-5 sm:bottom-7 sm:right-7 z-[105] inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 hover:border-amber-300/60 text-amber-100 text-xs font-bold backdrop-blur-md shadow-lg shadow-amber-500/10 transition-colors"
          >
            <motion.span
              className="flex items-center"
              animate={{ opacity: [0.65, 1, 0.65] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <Feather size={13} />
            </motion.span>
            설정 다듬기
          </motion.button>
        )}
      </AnimatePresence>

      {/* ═══ 설정 다듬기 패널 ═══ */}
      <ProfileEditPanel
        open={profileOpen}
        profile={job?.profile || null}
        onSave={handleProfileSave}
        onClose={() => setProfileOpen(false)}
      />

      {/* ═══ 원화(황금샷) 리롤 전용 모달 — 비용 고지 + 외형 수정(선택) ═══ */}
      <GoldenRerollModal
        open={goldenRerollOpen}
        busy={actionBusy}
        rerollCost={rerollCosts.goldenShot}
        onConfirm={handleGoldenRerollConfirm}
        onCancel={() => setGoldenRerollOpen(false)}
      />

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
