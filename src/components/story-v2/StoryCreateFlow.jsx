import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowLeft, ArrowRight, Check, Sparkles, Users, User as UserIcon } from "lucide-react";
import { sfx } from "../../utils/sfx";
// [2026-08-04 페르소나] 카드 선택/관리 오버레이
import PersonaManager from "../persona/PersonaManager";
import {
  fetchCreateContext,
  createStoryV2Room,
} from "../../api/StoryV2Api";

/**
 * [Story V2] CreateFlow — 3 step (시작 장소는 LLM이 오프닝에서 자율 확정)
 *
 * step 1: World 확인 (선택한 World의 전체 시놉시스)
 * step 2: 히로인 선택 (1~3명)
 * step 3: 페르소나 (사전 정의 또는 자유 입력)
  * → submit: createStoryV2Room
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
export default function StoryCreateFlow({ worldId, onCancel, onComplete, presetHeroineIds = null }) {
  // [Phase 7-V2 Pivot] presetHeroineIds 전달 시 (통합 로비에서 히로인 선택 완료) → step 3(페르소나)부터 시작
  const hasPreset = Array.isArray(presetHeroineIds) && presetHeroineIds.length > 0;
  const MIN_STEP = hasPreset ? 3 : 1;   // 뒤로가기 하한
  const [step, setStep] = useState(hasPreset ? 3 : 1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [context, setContext] = useState(null);

  // step 2: 히로인 선택 (preset 있으면 초기값으로 주입)
  const [selectedHeroineIds, setSelectedHeroineIds] = useState(hasPreset ? presetHeroineIds : []);

  // step 3: 페르소나
  const [personaMode, setPersonaMode] = useState("preset"); // "preset" | "free" | "card"
  const [selectedPresetKey, setSelectedPresetKey] = useState(null);
  const [freePersonaText, setFreePersonaText] = useState("");
  // [2026-08-04 페르소나] 카드 선택 — 본문·스탯·성별이 방에 스냅샷된다
  const [selectedCard, setSelectedCard] = useState(null);
  const [cardPickerOpen, setCardPickerOpen] = useState(false);
  // [Phase 7-V2 Pivot] 닉네임 — 페르소나 단계에서 함께 확정
  const [nickname, setNickname] = useState("");

  // [UX1] step 4(시작 장소) 제거 — 세계관+페르소나를 종합해 LLM이 오프닝에서 자연스럽게 확정.

  // 409 conflict 처리
  const [conflictPayload, setConflictPayload] = useState(null);

  // 초기 데이터 로드
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchCreateContext(worldId)
      .then((ctx) => {
        setContext(ctx);
        if (ctx.personaPresets?.length > 0) {
          setSelectedPresetKey(ctx.personaPresets[0].presetKey);
        } else {
          // [에픽 A] UGC 월드는 프리셋 없음(자유 텍스트만) — preset 모드에 갇히지 않게 전환
          setPersonaMode("free");
        }
      })
      .catch((e) => {
        console.error("[V2-CreateFlow] context load failed", e);
        setError("월드 정보를 불러올 수 없습니다.");
      })
      .finally(() => setLoading(false));
  }, [worldId]);

  // step 진행 조건
  const canProceedStep2 = selectedHeroineIds.length >= 1 && selectedHeroineIds.length <= 3;
  const canProceedStep3 = useMemo(() => {
    // [Phase 7-V2 Pivot] 닉네임 필수
    if (!nickname.trim()) return false;
    if (personaMode === "preset") return !!selectedPresetKey;
    if (personaMode === "card") return !!selectedCard;   // [페르소나] 카드 선택 필수
    return freePersonaText.trim().length > 0;
  }, [personaMode, selectedPresetKey, freePersonaText, nickname, selectedCard]);

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

  // 히로인 토글 (1~3명)
  const toggleHeroine = (id) => {
    setSelectedHeroineIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      } else {
        if (prev.length >= 3) {
          sfx.thud();
          return prev; // 최대 3명
        }
        sfx.click();
        return [...prev, id];
      }
    });
  };

  // 방 생성
  const submitCreate = async (overwriteExisting) => {
    setSubmitting(true);
    setError(null);
    const payload = {
      worldId,
      heroineIds: selectedHeroineIds,
      // [UX1] startLocationKey 미전송 — 백엔드 기본(첫 selectable) 시작, 오프닝 LLM이 location_change로 확정
      nickname: nickname.trim(),   // [Phase 7-V2 Pivot] 닉네임 전달
      personaText: personaMode === "free" ? freePersonaText.trim() : null,
      selectedPersonaPresetKey: personaMode === "preset" ? selectedPresetKey : null,
      // [2026-08-04 페르소나] 카드 모드 — 서버가 본문·스탯·성별 스냅샷(personaText보다 우선)
      userPersonaId: personaMode === "card" ? selectedCard?.personaId : null,
      overwriteExisting,
    };
    try {
      const res = await createStoryV2Room(payload);
      sfx.chime();
      onComplete(res.roomId);
    } catch (e) {
      if (e.response?.status === 409) {
        // 기존 방 존재 — confirm 후 재호출
        setConflictPayload(payload);
      } else if (e.response?.status === 402) {
        setError("자유 페르소나는 프리미엄 기능입니다.");
      } else {
        console.error("[V2-CreateFlow] create failed", e);
        setError(e.response?.data?.message || "방 생성에 실패했습니다.");
      }
    } finally {
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
      <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
        <div className="text-white/70">월드 정보를 불러오는 중...</div>
      </div>
    );
  }

  if (error && !context) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
        <div className="bg-stone-900 p-8 rounded-lg max-w-md">
          <p className="text-red-300 mb-4">{error}</p>
          <button onClick={onCancel} className="px-4 py-2 bg-stone-700 text-white rounded">
            로비로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-stone-900 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
        >
          {/* 헤더 — Step Indicator */}
          <div className="px-6 pt-6 pb-4 border-b border-stone-700/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      n === step
                        ? "bg-amber-500 text-black"
                        : n < step
                        ? "bg-amber-500/30 text-amber-200"
                        : "bg-stone-700 text-stone-500"
                    }`}
                  >
                    {n < step ? <Check size={16} /> : n}
                  </div>
                  {n < 4 && <div className={`w-8 h-px ${n < step ? "bg-amber-500/50" : "bg-stone-700"}`} />}
                </div>
              ))}
            </div>
            <button
              onClick={onCancel}
              className="text-stone-400 hover:text-white transition"
              aria-label="닫기"
            >
              <X size={22} />
            </button>
          </div>

          {/* 본문 */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-6">
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
                />
              )}
              {step === 3 && (
                <Step3Persona
                  key="s3"
                  presets={context.personaPresets}
                  hasFreeUnlock={context.hasFreePersonaUnlock}
                  personaMode={personaMode}
                  setPersonaMode={setPersonaMode}
                  selectedPresetKey={selectedPresetKey}
                  setSelectedPresetKey={setSelectedPresetKey}
                  freePersonaText={freePersonaText}
                  setFreePersonaText={setFreePersonaText}
                  selectedCard={selectedCard}
                  setCardPickerOpen={setCardPickerOpen}
                  nickname={nickname}
                  setNickname={setNickname}
                />
              )}
            </AnimatePresence>
          </div>

          {/* 푸터 — 네비게이션 */}
          <div className="px-6 py-4 border-t border-stone-700/50 flex items-center justify-between">
            <button
              onClick={goPrev}
              disabled={step === 1 || submitting}
              className="flex items-center gap-2 px-4 py-2 text-stone-300 disabled:opacity-30 hover:bg-stone-800 rounded transition"
            >
              <ArrowLeft size={18} /> 이전
            </button>

            {error && <div className="text-red-300 text-sm">{error}</div>}

            <button
              onClick={goNext}
              disabled={
                submitting ||
                (step === 2 && !canProceedStep2) ||
                (step === 3 && !canProceedStep3)
              }
              className="flex items-center gap-2 px-6 py-2 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded disabled:opacity-30 transition"
            >
              {step === 3 ? (submitting ? "생성 중..." : "시작") : "다음"}
              {step < 3 && <ArrowRight size={18} />}
            </button>
          </div>
        </motion.div>

        {/* 409 Conflict 모달 */}
        {conflictPayload && (
          <ConflictModal
            onConfirm={confirmOverwrite}
            onCancel={() => setConflictPayload(null)}
          />
        )}

        {/* [2026-08-04 페르소나] 카드 선택/관리 — onSelect로 카드 확정 */}
        <PersonaManager
          open={cardPickerOpen}
          onClose={() => setCardPickerOpen(false)}
          onSelect={(card) => { setSelectedCard(card); setCardPickerOpen(false); }}
        />
      </motion.div>
    </AnimatePresence>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Step 1 — World 확인
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function Step1WorldConfirm({ world }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      <h2 className="text-2xl font-bold text-amber-200 flex items-center gap-2">
        <Sparkles size={22} /> {world.displayName}
      </h2>
      {world.heroImageUrl && (
        <img
          src={world.heroImageUrl}
          alt={world.displayName}
          className="w-full h-48 object-cover rounded-lg"
        />
      )}
      {world.tagline && <p className="text-stone-300 italic">{world.tagline}</p>}
      {world.description && (
        <p className="text-stone-400 leading-relaxed whitespace-pre-wrap">{world.description}</p>
      )}
      {world.moodKeywords && (
        <div className="flex flex-wrap gap-2 pt-2">
          {world.moodKeywords.split(",").map((k, i) => (
            <span key={i} className="px-2 py-1 text-xs bg-stone-800 text-stone-400 rounded">
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

function Step2HeroineSelect({ heroines, selected, onToggle }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <h2 className="text-xl font-bold text-amber-200 mb-1 flex items-center gap-2">
        <Users size={20} /> 동행할 히로인 선택
      </h2>
      <p className="text-sm text-stone-400 mb-4">1~3명 선택 (현재 {selected.length}명)</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {heroines.map((h) => {
          const isSelected = selected.includes(h.characterId);
          return (
            <button
              key={h.characterId}
              onClick={() => onToggle(h.characterId)}
              className={`relative text-left bg-stone-800 rounded-lg overflow-hidden border-2 transition ${
                isSelected ? "border-amber-400" : "border-transparent hover:border-stone-600"
              }`}
            >
              {h.profileImageUrl && (
                <img src={h.profileImageUrl} alt={h.name} className="w-full h-32 object-cover" />
              )}
              <div className="p-3">
                <div className="font-medium text-white flex items-center gap-1.5">
                  {h.name}
                  {/* [2026-08-04 난이도] 공략 난이도 미니 표기 */}
                  {h.difficulty && h.difficulty !== "NORMAL" && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                      h.difficulty === "EASY"
                        ? "bg-emerald-400/15 text-emerald-200 border-emerald-400/25"
                        : h.difficulty === "EXTREME"
                          ? "bg-rose-400/15 text-rose-200 border-rose-400/25"
                          : "bg-orange-400/15 text-orange-200 border-orange-400/25"
                    }`}>
                      {h.difficulty === "EASY" ? "★" : h.difficulty === "HARD" ? "★★★" : "★★★★"}
                    </span>
                  )}
                </div>
                {h.role && <div className="text-xs text-stone-400 mt-0.5">{h.role}</div>}
                {h.tagline && (
                  <div className="text-xs text-stone-500 mt-1 line-clamp-2">{h.tagline}</div>
                )}
              </div>
              {isSelected && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-amber-500 text-black rounded-full flex items-center justify-center">
                  <Check size={14} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Step 3 — 페르소나
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function Step3Persona({
  presets,
  hasFreeUnlock,
  personaMode,
  setPersonaMode,
  selectedPresetKey,
  setSelectedPresetKey,
  freePersonaText,
  setFreePersonaText,
  nickname,
  setNickname,
  // [2026-08-04 페르소나] 카드 모드
  selectedCard,
  setCardPickerOpen,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <h2 className="text-xl font-bold text-amber-200 mb-1 flex items-center gap-2">
        <UserIcon size={20} /> 나의 페르소나
      </h2>
      <p className="text-sm text-stone-400 mb-4">이 세계에서 너는 누구인가</p>

      {/* [Phase 7-V2 Pivot] 닉네임 입력 — 페르소나와 함께 확정 */}
      <div className="mb-5">
        <label className="block text-xs text-stone-400 mb-1.5">닉네임 <span className="text-amber-400">*</span></label>
        <div className="relative">
          <input
            type="text"
            value={nickname}
            maxLength={20}
            onChange={(e) => { if (e.target.value.length <= 20) setNickname(e.target.value); }}
            placeholder="이 세계에서 불릴 이름"
            className={`w-full bg-stone-800 text-white rounded px-4 py-2.5 pr-12 focus:outline-none focus:ring-2 transition
              ${nickname.trim() ? 'focus:ring-amber-400' : 'ring-1 ring-rose-500/40 focus:ring-rose-500/60'}`}
          />
          {nickname.length > 0 && (
            <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium
              ${nickname.length >= 20 ? 'text-rose-400' : 'text-stone-500'}`}>
              {nickname.length}/20
            </span>
          )}
        </div>
        {!nickname.trim() && (
          <p className="text-[11px] text-rose-400/70 mt-1">닉네임을 입력해야 진행할 수 있습니다.</p>
        )}
      </div>

      {/* 페르소나 탭 */}
      <div className="border-t border-stone-700/50 pt-4">
        <label className="block text-xs text-stone-400 mb-2">페르소나</label>
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setPersonaMode("preset")}
            className={`flex-1 py-2 rounded text-sm font-medium transition ${
              personaMode === "preset"
                ? "bg-amber-500 text-black"
                : "bg-stone-800 text-stone-400 hover:bg-stone-700"
            }`}
          >
            사전 정의
          </button>
          <button
            onClick={() => setPersonaMode("free")}
            className={`flex-1 py-2 rounded text-sm font-medium transition ${
              personaMode === "free"
                ? "bg-amber-500 text-black"
                : "bg-stone-800 text-stone-400 hover:bg-stone-700"
            }`}
          >
            자유 입력 {!hasFreeUnlock && "🔒"}
          </button>
          {/* [2026-08-04 페르소나] 내 카드 — 본문·스탯·성별 일괄 스냅샷 */}
          <button
            onClick={() => { setPersonaMode("card"); if (!selectedCard) setCardPickerOpen(true); }}
            className={`flex-1 py-2 rounded text-sm font-medium transition ${
              personaMode === "card"
                ? "bg-sky-500 text-black"
                : "bg-stone-800 text-stone-400 hover:bg-stone-700"
            }`}
          >
            내 카드
          </button>
        </div>
      </div>

      {personaMode === "card" && (
        <div className="space-y-2">
          {selectedCard ? (
            <div className="p-3 rounded border-2 border-sky-400 bg-stone-800">
              <div className="font-medium text-white text-sm">{selectedCard.name}</div>
              <p className="text-xs text-stone-400 mt-1 line-clamp-2">{selectedCard.personaText}</p>
              <div className="text-[10px] text-sky-300/70 mt-1.5">
                스탯 {selectedCard.charm + selectedCard.wit + selectedCard.boldness + selectedCard.intellect + selectedCard.empathy}p — 본문·스탯·성별이 함께 적용됩니다
              </div>
            </div>
          ) : (
            <p className="text-xs text-stone-500">카드를 선택해 주세요.</p>
          )}
          <button
            onClick={() => setCardPickerOpen(true)}
            className="w-full py-2 rounded text-xs font-medium bg-stone-800 text-stone-300 hover:bg-stone-700 transition"
          >
            {selectedCard ? "다른 카드 선택 / 관리" : "카드 선택하기"}
          </button>
        </div>
      )}

      {personaMode === "preset" && (
        <div className="space-y-2">
          {presets.map((p) => (
            <button
              key={p.presetKey}
              onClick={() => setSelectedPresetKey(p.presetKey)}
              className={`block w-full text-left p-3 rounded border-2 transition ${
                selectedPresetKey === p.presetKey
                  ? "border-amber-400 bg-stone-800"
                  : "border-transparent bg-stone-800/50 hover:bg-stone-800"
              }`}
            >
              <div className="font-medium text-white">{p.name}</div>
              <div className="text-sm text-stone-400 mt-1 whitespace-pre-wrap">{p.description}</div>
            </button>
          ))}
        </div>
      )}

      {personaMode === "free" && (
        <div>
          {!hasFreeUnlock ? (
            <div className="p-4 bg-stone-800/50 rounded text-center">
              <p className="text-stone-300 mb-2">자유 페르소나는 프리미엄 기능입니다.</p>
              <p className="text-xs text-stone-500">결제 후 모든 월드에서 사용 가능합니다.</p>
            </div>
          ) : (
            <textarea
              value={freePersonaText}
              onChange={(e) => setFreePersonaText(e.target.value)}
              placeholder="이 세계에서 당신의 역할, 성격, 배경 등을 자유롭게 입력하세요. (최대 500자)"
              maxLength={500}
              rows={8}
              className="w-full p-3 bg-stone-800 text-white rounded resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          )}
        </div>
      )}
    </motion.div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Conflict Modal (기존 방 덮어쓰기 확인)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ConflictModal({ onConfirm, onCancel }) {
  return (
    <motion.div
      className="absolute inset-0 z-10 bg-black/70 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="bg-stone-900 rounded-lg p-6 max-w-md">
        <h3 className="text-lg font-bold text-amber-200 mb-3">기존 진행 중인 스토리가 있습니다</h3>
        <p className="text-stone-400 mb-2">
          이 월드에 이미 진행 중인 스토리가 있습니다. 새로 시작하면 *현재 진행이 모두 사라집니다*.
        </p>
        <p className="text-stone-500 text-sm mb-5">
          캐릭터 관계, 시간 진행, 호감도, 모든 누적 기억이 초기화됩니다.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-stone-300 hover:bg-stone-800 rounded transition"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-500 hover:bg-red-400 text-white font-medium rounded transition"
          >
            새로 시작
          </button>
        </div>
      </div>
    </motion.div>
  );
}