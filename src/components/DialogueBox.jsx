import { motion, AnimatePresence } from "framer-motion";
import { Send, Heart, Zap, ChevronRight, Dices, Sparkles, Rocket, ShoppingBag, Activity, MessageSquare, Eye, Clock, EyeIcon, Gem, MessageCircle, ChevronUp, FastForward, MapPin } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { sanitizeScene } from "../utils/dialogueSanitizer";
import { sfx } from "../utils/sfx";

/**
 * [Phase 5.5-Fix] DialogueBox
 *
 * 변경점:
 * 1. [Fix #1] 에너지 UI 분리 — freeEnergy/paidEnergy 별도 표시 (paidEnergy > 0일 때)
 * 2. [Fix #5] 이벤트 진행 중 뱃지 + 속마음 토글 → 네임 플레이트 옆으로 이동 (에너지 UI와 겹침 해소)
 * 3. [Fix #4 동기화] BPM 툴팁에 현재 구간 하이라이트
 *
 * ⚠️ 대사 출력 로직(타이핑/씬 전환)은 원본과 100% 동일 — 수정 없음
 */

// ── 자립형 HeartPulse (외부 import 없이 동작) ──
const HeartPulse = ({ bpm, size = 18 }) => {
  const interval = 60 / Math.max(bpm, 60);
  const heartColor = bpm >= 140 ? "#ff2d55" : bpm >= 110 ? "#ff6b9d" : bpm >= 85 ? "#f472b6" : "#f9a8d4";

  return (
    <motion.div
      animate={{ scale: [1, 1.25, 1, 1.1, 1] }}
      transition={{ duration: interval, repeat: Infinity, ease: "easeInOut", times: [0, 0.15, 0.35, 0.5, 1] }}
    >
      <Heart size={size} fill={heartColor} color={heartColor}
        style={{ filter: `drop-shadow(0 0 ${bpm > 100 ? 6 : 3}px ${heartColor}80)` }} />
    </motion.div>
  );
};

// ── 자립형 스탯 변화 팝업 ──
const STAT_META = {
  intimacy:    { label: "친밀도", icon: "💬", color: "#60a5fa" },
  affection:   { label: "호감도", icon: "💕", color: "#f472b6" },
  dependency:  { label: "의존도", icon: "🫂", color: "#a78bfa" },
  playfulness: { label: "장난기", icon: "😜", color: "#34d399" },
  trust:       { label: "신뢰도", icon: "🤝", color: "#fbbf24" },
  lust:        { label: "음란도", icon: "🔥", color: "#ef4444" },
  corruption:  { label: "타락도", icon: "🌑", color: "#8b5cf6" },
  obsession:   { label: "집착도", icon: "⛓️", color: "#ec4899" },
};

const StatChangeToasts = ({ changes }) => {
  const [queue, setQueue] = useState([]);
  const showTimersRef = useRef([]);
 
  useEffect(() => {
    if (!changes || changes.length === 0) {
      showTimersRef.current.forEach(t => clearTimeout(t));
      showTimersRef.current = [];
      setQueue([]);
      return;
    }
 
    const filtered = changes.filter(c => c.value !== 0);
    if (filtered.length === 0) return;
 
    filtered.forEach((change, i) => {
      const showTimer = setTimeout(() => {
        const id = Date.now() + Math.random();
        setQueue(prev => [...prev, { ...change, id }]);
        setTimeout(() => {
          setQueue(prev => prev.filter(item => item.id !== id));
        }, 2200);
      }, i * 600);
      showTimersRef.current.push(showTimer);
    });
 
    return () => {
      showTimersRef.current.forEach(t => clearTimeout(t));
      showTimersRef.current = [];
    };
  }, [changes]);
 
  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex flex-col items-center gap-1 pointer-events-none z-50">
      <AnimatePresence mode="popLayout">
        {queue.map((change) => {
          const meta = STAT_META[change.key] || { label: change.key, icon: "📊", color: "#aaa" };
          return (
            <motion.div
              key={change.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.7 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 350, damping: 22 }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full backdrop-blur-md whitespace-nowrap"
              style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}30` }}
            >
              <span className="text-xs">{meta.icon}</span>
              <span className="text-[11px] text-white/50 font-medium">{meta.label}</span>
              <span className={`text-sm font-black drop-shadow-lg ${change.value > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {change.value > 0 ? `+${change.value}` : change.value}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};


// ═══════════════════════════════════════════════════════════════
//  속마음 뷰 컴포넌트 (보라색 이탤릭)
// ═══════════════════════════════════════════════════════════════

const InnerThoughtView = ({ text, characterName }) => {
  const [displayedText, setDisplayedText] = useState("");
  const [isFullyDisplayed, setIsFullyDisplayed] = useState(false);

  useEffect(() => {
    if (!text) return;
    setDisplayedText("");
    setIsFullyDisplayed(false);

    let charIndex = 0;
    const typingInterval = setInterval(() => {
      charIndex++;
      setDisplayedText(text.slice(0, charIndex));
      if (charIndex >= text.length) {
        clearInterval(typingInterval);
        setIsFullyDisplayed(true);
      }
    }, 40);

    return () => clearInterval(typingInterval);
  }, [text]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="min-h-[3.5rem] flex flex-col justify-center py-2"
    >
      <div className="flex items-center gap-2 mb-2 opacity-50">
        <span className="text-xs">💭</span>
        <span className="text-[10px] text-purple-300 uppercase tracking-widest font-bold">
          {characterName}의 속마음
        </span>
      </div>
      <p
        className="text-lg leading-relaxed font-medium tracking-wide"
        style={{
          fontStyle: "italic",
          color: "rgba(216,180,254,0.9)",
          textShadow: "0 0 20px rgba(168,85,247,0.2)",
          fontFamily: "'Noto Serif KR', serif",
        }}
      >
        "{displayedText}"
        {!isFullyDisplayed && (
          <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.6, repeat: Infinity }}
            className="text-purple-400"
          >
            |
          </motion.span>
        )}
      </p>
    </motion.div>
  );
};


// ═══════════════════════════════════════════════════════════════
//  토글 탭 컴포넌트 — [Fix #5] 인라인 축소 버전 (네임 플레이트 옆)
// ═══════════════════════════════════════════════════════════════

const ThoughtToggleTabs = ({ activeTab, onTabChange }) => (
  <div className="flex gap-1">
    <button
      onClick={(e) => { e.stopPropagation(); onTabChange("dialogue"); }}
      className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all ${
        activeTab === "dialogue"
          ? "bg-white/10 text-white/80 border border-white/15 shadow-sm"
          : "text-white/25 hover:text-white/40 hover:bg-white/[0.03]"
      }`}
    >
      <MessageSquare size={10} />
      <span>대사</span>
    </button>
    <button
      onClick={(e) => { e.stopPropagation(); onTabChange("thought"); }}
      className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all ${
        activeTab === "thought"
          ? "bg-purple-500/15 text-purple-300 border border-purple-500/25 shadow-[0_0_8px_rgba(168,85,247,0.15)]"
          : "text-purple-400/30 hover:text-purple-400/50 hover:bg-purple-500/[0.05]"
      }`}
    >
      <Eye size={10} />
      <span>속마음</span>
    </button>
  </div>
);


// ═══════════════════════════════════════════════════════════════
//  [Fix #4 동기화] BPM 구간 정의
// ═══════════════════════════════════════════════════════════════

const BPM_RANGES = [
  { min: 60, max: 85, label: "평온", color: "#f9a8d4" },
  { min: 86, max: 120, label: "두근거림", color: "#f472b6" },
  { min: 121, max: 180, label: "쿵쾅거림", color: "#ef4444" },
];


// ═══════════════════════════════════════════════════════════════
//  DialogueBox 메인 컴포넌트
// ═══════════════════════════════════════════════════════════════

// [Bug1-UX] 시스템 나레이션(터미널 이벤트 씬) 직후 "당신의 차례" 행동 유도 큐.
//  시스템이 상황을 제시한 뒤 유저가 자유 입력/제안/행동으로 응답하도록, 명확하고 절제된 시각적 비트를 만든다.
function SystemTurnCue() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="mb-3 flex items-center gap-3 select-none"
    >
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-indigo-300/30" />
      <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-indigo-200/80 whitespace-nowrap">
        <motion.span
          className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-300"
          animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
        당신의 차례 · 어떻게 하시겠어요?
      </span>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-indigo-300/30" />
    </motion.div>
  );
}

const DialogueBox = ({
  characterName,
  scene: rawScene,
  onSend,
  isTyping,
  affection,
  energy,
  onNextScene,
  hasNextScene,
  nickname,
  onTriggerEvent,
  boostMode = false,
  isSubscriber = false,
  freeEnergyMax = 30,
  chatMode = "SANDBOX",
  onOpenStore,
  // ── [Phase 5.5-v3] 기존 props ──
  bpm = 65,
  onOpenStatusPanel,
  statChanges = null,
  // ── [Phase 5.5-IT] 속마음 props ──
  innerThought = null,
  hasInnerThought = false,
  thoughtUnlocked = false,
  // ── [Phase 5.5-EV] 이벤트 시스템 강화 ──
  topicConcluded = false,
  eventStatus = null,
  isObserverEvent = false,  // [Issue #3 Fix] 관찰자 모드 이벤트 여부
  onWatch,
  // [Phase 5.5-NPC]
  speaker = null,
  onTimeSkip,
  // [Phase 5.5-Fix] SSE 응답 대기 플래그
  awaitingFinalResult = false,
  // ── [Fix #1] 에너지 분리 ──
  freeEnergy = null,       // null이면 레거시 모드 (energy만 사용)
  paidEnergy = 0,
  illustrationAvailable = false,
  onGenerateIllustration,
  // ── [Phase 5.5-Director] 디렉터 통합 ──
  onRequestDirector,      // 유저 수동 디렉터 호출 핸들러
  directorLoading = false, // 디렉터 요청 로딩 중
  // ── [Phase 7-V2 Pivot] V2 전용 (additive — 미전달 시 V1 동작 100% 보존) ──
  storyV2Mode = false,            // V2 모드 활성 — V2 통합 UI 노출 게이트
  dialogueOptions = [],           // V2 디렉터 제안 선택지 (버튼 토글로 노출)
  onSelectDialogueOption,         // 선택지 클릭 → (option: string) => void
  showStoryActions = false,       // V2 액션바 노출 (topicConcluded 연동)
  onStoryAction,                  // 액션 클릭 → (type: "NEXT_SCENE"|"TIME_ADVANCE"|"MOVE") => void
}) => {
  const [input, setInput] = useState("");
  const [displayedText, setDisplayedText] = useState("");
  const [isTextFullyDisplayed, setIsTextFullyDisplayed] = useState(false);
  // [Phase 7-V2 Pivot] 디렉터 제안 패널 펼침 상태 (기본 닫힘 — 버튼으로 토글)
  const [showOptionsPanel, setShowOptionsPanel] = useState(false);

  // [Polish · P1 #2] 표시 직전 dialogue/narration prefix 방어 sanitize.
  //   백엔드는 이제 깨끗이 정리하지만 과거 MongoDB에 저장된 chatLog 중 prefix가 묻은
  //   데이터가 있을 수 있다. 화이트리스트 = 캐릭터 이름 + 유저 nickname (NPC는 보존).
  const knownNames = useMemo(() => {
    const list = [];
    if (characterName) list.push(characterName);
    if (nickname) list.push(nickname);
    return list;
  }, [characterName, nickname]);

  const scene = useMemo(
    () => sanitizeScene(rawScene, knownNames),
    [rawScene, knownNames]
  );

  // [Bug Fix #5] 액션 모드 감지 개선
  const isActionMode = (() => {
    const trimmed = input.trimStart();
    if (!trimmed.startsWith('*')) return false;
    const afterFirst = trimmed.substring(1);
    return !afterFirst.includes('*');
  })();
  const hasActionText = input.includes('*');

  // [Phase 5.5-IT] 속마음 토글 상태
  const [activeTab, setActiveTab] = useState("dialogue");

  const isEventScene = scene?.isEvent;

  // [Phase 5.5-EV] 디렉터 모드 진행 중 여부
  const isDirectorOngoing = eventStatus === "ONGOING";

  // [Phase 5.5-Sep] 모드별 기능 플래그
  const isStoryMode = chatMode === "STORY";

  // [Phase 5.5-NPC] 현재 화자가 NPC인지 판별
  const isNpcSpeaking = speaker && speaker !== characterName;
  const displaySpeakerName = speaker || characterName;

  // [Phase 5.5-Guard] 메시지 최대 길이
  const MAX_MESSAGE_LENGTH = 200;

  // [Phase 5.5-Guard] 길이 제한이 적용된 입력 핸들러
  const handleInputChange = (e) => {
    const val = e.target.value;
    if (val.length <= MAX_MESSAGE_LENGTH) {
      setInput(val);
    }
  };

  // 새 씬이 오면 대사 탭으로 리셋
  useEffect(() => {
    setActiveTab("dialogue");
  }, [scene]);

  // 부스트 모드 에너지 비용 계산
  const getEnergyCost = () => {
    const base = chatMode === "STORY" ? 2 : 1;
    if (!boostMode) return base;
    return isSubscriber ? base : base * 5;
  };
  const energyCost = getEnergyCost();

  // ━━━ 타이핑 효과 (원본 100% 동일) ━━━
  useEffect(() => {
    const fullText = isEventScene ? (scene?.narration || "") : (scene?.dialogue || "");

    if (!fullText && !scene?.narration && !isEventScene) {
      setDisplayedText("");
      setIsTextFullyDisplayed(true);
      return;
    }

    setDisplayedText("");
    setIsTextFullyDisplayed(false);

    let charIndex = 0;
    const speed = isEventScene ? 50 : 30;

    const typingInterval = setInterval(() => {
      charIndex++;
      setDisplayedText(fullText.slice(0, charIndex));
      if (charIndex >= fullText.length) {
        clearInterval(typingInterval);
        setIsTextFullyDisplayed(true);
      }
    }, speed);

    return () => clearInterval(typingInterval);
  }, [scene, isEventScene]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isTyping || hasNextScene) return;
    sfx.click();
    onSend(input);
    setInput("");
  };

  const prevAffectionRef = useRef(affection);
  useEffect(() => {
    if (typeof affection !== "number") return;
    const prev = prevAffectionRef.current;
    if (typeof prev !== "number") {
      prevAffectionRef.current = affection;
      return;
    }
    if (affection > prev) sfx.affection();
    else if (affection < prev) sfx.thud();
    prevAffectionRef.current = affection;
  }, [affection]);

  // ━━━ 클릭 핸들러 (원본 100% 동일) ━━━
  const handleBoxClick = () => {
    if (activeTab === "thought") return;

    if (scene?.dialogue && !isTextFullyDisplayed) {
      setDisplayedText(scene.dialogue);
      setIsTextFullyDisplayed(true);
    } else if (hasNextScene || (isEventScene && !storyV2Mode)) {
      sfx.pageTurn();
      onNextScene();
    }
  };

  const noEnergy = energy <= 0;
  const lowEnergy = energy < energyCost && energy > 0;

  // BPM 게이지 퍼센트 (60~180 → 0~100%)
  const bpmPercent = Math.min(100, Math.max(0, ((bpm - 60) / 120) * 100));

  // [Phase 5.5-Sep] 속마음: 스토리 모드 전용
  const showThoughtTabs = isStoryMode && thoughtUnlocked && innerThought;

  // [Phase 5.5-Sep] 이벤트/시간넘기기: 스토리 모드 전용
  // [Phase 7-V2 Pivot] !!onRequestDirector 가드 추가 — onRequestDirector 콜백이 없으면
  //   Sparkles "다음 씬" 버튼 자동 비노출. V1 호출 (callback 있음) → 동작 불변.
  //   V2 호출 (callback undefined — V2는 별도 StoryV2ActionBar 사용) → 버튼 비노출.
  const canRequestDirector = !!onRequestDirector && isStoryMode && topicConcluded && !isDirectorOngoing
                             && !awaitingFinalResult && !isTyping && energy >= 1;

  // [Fix #1] 에너지 분리 계산
  const hasPaidEnergy = paidEnergy > 0;
  // freeEnergy가 null이면 레거시 모드 — energy를 그대로 freeEnergy로 취급
  const displayFreeEnergy = freeEnergy !== null ? freeEnergy : energy;
  const displayPaidEnergy = paidEnergy || 0;

  // [Fix #4 동기화] 현재 BPM 구간
  const currentBpmRange = BPM_RANGES.find(r => bpm >= r.min && bpm <= r.max);

  return (
    <div className="absolute bottom-0 w-full z-20 p-4 pb-8 flex justify-center select-none">
      <div className="w-full max-w-4xl flex flex-col gap-3">

        {/* ═══ 상단 정보바 ═══ */}
        <div className="flex justify-end items-center px-2 gap-3 relative">

          {/* 부스트 모드 뱃지 */}
          <AnimatePresence>
            {boostMode && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, x: 10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: 10 }}
                className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3.5 py-2 rounded-full border border-cyan-500/40 shadow-[0_0_15px_rgba(34,211,238,0.25)]"
              >
                <motion.div animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                  <Rocket size={16} className="text-cyan-400" />
                </motion.div>
                <div className="flex flex-col">
                  <span className="text-[9px] text-cyan-400 font-bold uppercase leading-none">Boost</span>
                  <span className="text-[10px] text-cyan-200 font-bold leading-none">Pro Model</span>
                </div>
                {!isSubscriber && <span className="text-[9px] text-cyan-400/60 ml-0.5">x5</span>}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ━━━ 상태창 버튼 + 스탯 변화 팝업 ━━━ */}
          <div className="relative">
            <StatChangeToasts changes={statChanges} />
            <button
              onClick={onOpenStatusPanel}
              className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3.5 py-2 rounded-full border border-purple-500/30
                         hover:border-purple-400/50 hover:bg-black/80 transition-all shadow-[0_0_12px_rgba(168,85,247,0.15)] group"
              title="캐릭터 상태창"
            >
              <Activity size={18} className="text-purple-400/80 group-hover:text-purple-300 transition" />
              <span className="text-[10px] text-purple-300/70 font-bold uppercase leading-none hidden sm:block">Status</span>
            </button>
          </div>

          {/* ━━━ BPM 심박수 바 ━━━ */}
          <div className="relative group cursor-help">
            <div className="flex items-center gap-3 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-rose-500/40 shadow-[0_0_15px_rgba(244,114,182,0.3)] hover:bg-black/80 transition-colors">
              <HeartPulse bpm={bpm} size={20} />
              <div className="flex flex-col w-12">
                <span className="text-[10px] text-rose-400 font-bold uppercase leading-none mb-0.5">심박수</span>
                <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: bpm >= 120 ? "linear-gradient(90deg, #f472b6, #ef4444)" : "linear-gradient(90deg, #f9a8d4, #f472b6)" }}
                    animate={{ width: `${bpmPercent}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              </div>
              <span className="text-sm font-bold text-white ml-1 tabular-nums">{bpm}</span>
            </div>

            {/* [Fix #4 동기화] BPM 툴팁 — 현재 구간 하이라이트 */}
            <div className="absolute bottom-full right-0 mb-3 w-56 bg-black/95 border border-rose-500/30 p-4 rounded-xl text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-2xl backdrop-blur-xl">
              <p className="font-bold text-rose-400 mb-2 text-sm">{characterName}의 심박수</p>
              <p className="leading-relaxed text-gray-400 mb-3">대화 텐션과 감정에 따라 실시간으로 변화합니다.</p>
              <div className="space-y-1">
                {BPM_RANGES.map((range) => {
                  const isCurrent = bpm >= range.min && bpm <= range.max;
                  return (
                    <div key={range.label} className={`flex items-center justify-between px-2 py-1 rounded-lg transition-all ${
                      isCurrent ? "bg-white/[0.06]" : ""
                    }`}>
                      <div className="flex items-center gap-2">
                        {isCurrent && (
                          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: range.color }} />
                        )}
                        <span className={`text-[11px] ${isCurrent ? "text-white/80 font-bold" : "text-gray-500"}`}>
                          {range.label}
                        </span>
                      </div>
                      <span className={`text-[10px] tabular-nums ${isCurrent ? "text-white/50" : "text-gray-600"}`}>
                        {range.min}~{range.max}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ━━━ [Fix #1] 에너지 표시 — freeEnergy/paidEnergy 분리 ━━━ */}
          <div className="relative group cursor-help">
            <div className="flex items-center gap-3 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-yellow-500/40 shadow-[0_0_15px_rgba(234,179,8,0.3)] hover:bg-black/80 transition-colors">
              <Zap size={20} className={`text-yellow-400 ${energy < 20 ? 'animate-pulse' : ''}`} fill={energy > 0 ? "currentColor" : "none"} />
              <div className="flex flex-col w-12">
                <span className="text-[10px] text-yellow-400 font-bold uppercase leading-none mb-0.5">에너지</span>
                <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden flex">
                  {/* Free 에너지 바 */}
                  <div
                    className={`h-full transition-all duration-500 ${displayFreeEnergy < 10 ? 'bg-red-500' : 'bg-yellow-400'}`}
                    style={{ width: `${Math.min(100, (displayFreeEnergy / freeEnergyMax) * 100)}%` }}
                  />
                  {/* Paid 에너지 바 (존재할 때만 표시) */}
                  {hasPaidEnergy && (
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-500"
                      style={{ width: `${Math.min(100 - (displayFreeEnergy / freeEnergyMax) * 100, (displayPaidEnergy / freeEnergyMax) * 100)}%` }}
                    />
                  )}
                </div>
              </div>
              {/* [Fix #1] 에너지 수치 — paid가 있으면 합산 + 분리 표시 */}
              <div className="flex items-center gap-1 ml-1">
                <span className="text-sm font-bold text-white tabular-nums">{energy}</span>
                {hasPaidEnergy && (
                  <span className="text-[9px] text-emerald-400/70 font-bold tabular-nums">
                    +{displayPaidEnergy}
                  </span>
                )}
              </div>
            </div>

            {/* 에너지 툴팁 */}
            <div className="absolute bottom-full right-0 mb-3 w-72 bg-black/95 border border-yellow-500/30 p-4 rounded-xl text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-2xl backdrop-blur-xl">
              <p className="font-bold text-yellow-400 mb-2 text-sm">에너지</p>
              <p className="leading-relaxed text-gray-400 mb-3">대화를 보낼 때마다 에너지가 소모됩니다.</p>

              {/* [Fix #1] Free/Paid 분리 표시 */}
              {hasPaidEnergy && (
                <div className="mb-3 space-y-1.5 p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                      <span className="text-[11px] text-gray-400">자연 에너지</span>
                    </div>
                    <span className="text-[11px] text-yellow-300 font-bold tabular-nums">{displayFreeEnergy} / {freeEnergyMax}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" />
                      <span className="text-[11px] text-gray-400">충전 에너지</span>
                    </div>
                    <span className="text-[11px] text-emerald-300 font-bold tabular-nums">{displayPaidEnergy}</span>
                  </div>
                  <div className="h-px bg-white/5 my-1" />
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-gray-500">소모 우선순위</span>
                    <span className="text-[10px] text-white/40">자연 → 충전</span>
                  </div>
                </div>
              )}

              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-gray-500">자유 모드</span>
                  <span className="text-yellow-300 font-bold">{boostMode && !isSubscriber ? "5" : "1"} 에너지</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">스토리 모드</span>
                  <span className="text-yellow-300 font-bold">{boostMode && !isSubscriber ? "10" : "2"} 에너지</span>
                </div>
                {boostMode && !isSubscriber && (
                  <div className="flex justify-between text-cyan-400">
                    <span>부스트 모드 (비구독)</span>
                    <span className="font-bold">x5 소모</span>
                  </div>
                )}
                <div className="h-px bg-white/10 my-2" />
                <div className="flex justify-between">
                  <span className="text-gray-500">자연 회복</span>
                  <span className="text-white/60">{isSubscriber ? "5분마다 +1" : "10분마다 +1"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">최대 보유량</span>
                  <span className="text-white/60">{freeEnergyMax}</span>
                </div>
              </div>
              {isSubscriber && (
                <div className="mt-2 px-2 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px]">
                  ✨ 루시드 패스: 회복 2배 + 최대 보유량 증가
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══ 메인 대화창 ═══ */}
        <motion.div
          onClick={handleBoxClick}
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`relative border rounded-[2rem] p-6 pt-10 shadow-2xl transition-all ${
            activeTab === "dialogue" && (hasNextScene || (!isTextFullyDisplayed && (scene?.dialogue || isEventScene))) ? 'cursor-pointer' : ''
          } ${
            isEventScene
              ? 'bg-gradient-to-br from-indigo-900/90 to-purple-900/90 border-indigo-400/50 backdrop-blur-xl ring-1 ring-purple-500/30'
              : isDirectorOngoing
                ? 'bg-gradient-to-br from-amber-950/60 to-orange-950/60 border-amber-500/30 backdrop-blur-xl ring-1 ring-amber-500/20'
              : activeTab === "thought"
                ? 'bg-gradient-to-br from-purple-950/70 to-indigo-950/70 border-purple-500/20 backdrop-blur-xl'
                : 'bg-black/50 border-white/10 backdrop-blur-xl hover:bg-black/60'
          }`}
        >
          {/* ═══ [Fix #5] 네임 플레이트 + 뱃지 영역 — 한 줄로 통합 ═══ */}
          {!isEventScene && (
            <div className="absolute -top-5 left-8 right-8 flex items-center gap-2 z-20">
              {/* 화자 이름표 */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={displaySpeakerName}
                  initial={{ opacity: 0, y: -4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className={`font-bold px-8 py-2 rounded-2xl shadow-lg border transform -rotate-1 shrink-0 ${
                    isNpcSpeaking
                      ? 'bg-gradient-to-r from-red-800 to-rose-900 text-red-200 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                      : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-white/20'
                  }`}
                >
                  {isNpcSpeaking && <span className="mr-1.5 text-sm">👤</span>}
                  {displaySpeakerName}
                </motion.div>
              </AnimatePresence>

              {/* [Fix #5] 속마음 토글 — 네임 플레이트 바로 옆 */}
              {showThoughtTabs && (
                <ThoughtToggleTabs activeTab={activeTab} onTabChange={setActiveTab} />
              )}

              {/* [v3] "이벤트 진행 중" 뱃지 제거 — 투명 디렉터 패턴 */}
            </div>
          )}

          {/* 나레이션 (대사 탭에서만) */}
          <AnimatePresence mode="wait">
            {activeTab === "dialogue" && !isEventScene && scene?.narration && (
              <motion.div
                key={scene.narration}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-3 text-sm text-pink-200/90 font-medium italic flex items-center gap-2"
              >
                <span>* {scene.narration}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ━━━ 텍스트 출력 영역 ━━━ */}
          <AnimatePresence mode="wait">
            {activeTab === "dialogue" ? (
              <motion.div
                key="dialogue-view"
                initial={false}
                className={`min-h-[3.5rem] leading-relaxed font-medium drop-shadow-md tracking-wide flex flex-col justify-center ${
                  isEventScene ? 'items-center text-center py-4' : 'text-lg text-white/95'
                }`}
              >
                {isEventScene && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mb-3 text-yellow-300">
                    <Sparkles size={24} />
                  </motion.div>
                )}

                {isTyping ? (
                  <div className="flex gap-1.5 items-center justify-center h-full opacity-70 mt-2">
                    <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce" />
                    <span className="ml-2 text-sm text-indigo-200/50 font-light">
                      {isDirectorOngoing ? "상황이 전개되고 있습니다..." : isEventScene ? "운명의 주사위를 굴리는 중..." : "생각 중..."}
                    </span>
                  </div>
                ) : (
                  <>
                    <span className={isEventScene ? "text-xl text-indigo-100 font-serif italic" : ""}>
                      {displayedText}
                    </span>
                    {!scene?.dialogue && !scene?.narration && !isTyping && (
                      <span className="text-white/30 text-sm">　대화를 시작해보세요...</span>
                    )}
                  </>
                )}
              </motion.div>
            ) : (
              <InnerThoughtView
                key="thought-view"
                text={innerThought}
                characterName={characterName}
              />
            )}
          </AnimatePresence>

          {/* 다음 씬 아이콘 */}
          {activeTab === "dialogue" && hasNextScene && isTextFullyDisplayed && (
            <motion.div
              animate={{ x: [0, 5, 0] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="absolute bottom-6 right-6 text-white/50"
            >
              <ChevronRight size={24} />
            </motion.div>
          )}

          {/* [Phase 5.5-Fix] final_result 대기 중 인디케이터 */}
          {activeTab === "dialogue" && !hasNextScene && !isEventScene && awaitingFinalResult && isTextFullyDisplayed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 flex items-center justify-center gap-2 py-3"
            >
              <motion.div className="w-1.5 h-1.5 rounded-full bg-white/30"
                animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: 0 }} />
              <motion.div className="w-1.5 h-1.5 rounded-full bg-white/30"
                animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }} />
              <motion.div className="w-1.5 h-1.5 rounded-full bg-white/30"
                animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }} />
            </motion.div>
          )}

          {/* [Phase 5.5-Illust] 일러스트 생성 버튼 */}
          <AnimatePresence>
            {illustrationAvailable && !isTyping && isTextFullyDisplayed && (
              <motion.button
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.9 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onGenerateIllustration}
                className="w-full py-3 px-4 rounded-xl text-sm font-medium
                  bg-gradient-to-r from-purple-600/20 to-pink-600/20
                  border border-purple-500/30 text-purple-200
                  hover:from-purple-600/30 hover:to-pink-600/30
                  transition-all flex items-center justify-center gap-2"
                style={{
                  boxShadow: '0 0 20px rgba(168,85,247,0.1)',
                }}
              >
                <Sparkles size={16} className="text-purple-300" />
                이 순간을 일러스트로 남기기
                <span className="text-purple-400/50 text-xs ml-1">⚡10</span>
              </motion.button>
            )}
          </AnimatePresence>

          {/* ═══ 입력 영역 ═══ */}
          {activeTab === "dialogue" && !hasNextScene && !awaitingFinalResult && (!isEventScene || storyV2Mode) && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 relative z-10">

              {storyV2Mode && isEventScene && <SystemTurnCue />}

              {/* ━━━ [Phase 7-V2 Pivot] 디렉터 제안 패널 + 액션 바 (입력 form 위 통합) ━━━ */}
              {storyV2Mode && (
                <div className="mb-3">
                  {/* 디렉터 제안 펼침 패널 — 토글 버튼으로 노출/숨김 */}
                  <AnimatePresence>
                    {showOptionsPanel && dialogueOptions.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden mb-2"
                      >
                        <div className="flex flex-col gap-1.5 pb-1">
                          {dialogueOptions.map((opt, i) => (
                            <motion.button
                              key={`${opt}-${i}`}
                              type="button"
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05 }}
                              onClick={() => {
                                sfx.click();
                                setShowOptionsPanel(false);
                                onSelectDialogueOption?.(opt);
                              }}
                              className="group relative w-full text-left pl-8 pr-9 py-2.5 bg-gradient-to-r from-amber-500/12 to-amber-500/5 hover:from-amber-500/22 hover:to-amber-500/10 border border-amber-400/30 hover:border-amber-400/55 rounded-lg transition-all duration-200"
                            >
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-amber-300/45 font-mono">{i + 1}</span>
                              <span className="text-sm text-amber-100 leading-snug">{opt}</span>
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-300/55 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200">→</span>
                            </motion.button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* 버튼 행: [디렉터의 제안 토글] + [다음 씬 / 시간 진전 / 장소 이동] */}
                  {(dialogueOptions.length > 0 || showStoryActions) && (
                    <div className="flex flex-wrap items-center gap-2">
                      {/* 디렉터 제안 토글 — dialogueOptions 있을 때만 */}
                      {dialogueOptions.length > 0 && (
                        <button
                          type="button"
                          onClick={() => { sfx.click(); setShowOptionsPanel((v) => !v); }}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition
                            ${showOptionsPanel
                              ? 'bg-amber-500/25 border-amber-400/55 text-amber-100'
                              : 'bg-amber-500/10 border-amber-400/30 text-amber-300 hover:bg-amber-500/20'}`}
                        >
                          <MessageCircle size={13} />
                          디렉터의 제안
                          <span className="text-amber-300/50">({dialogueOptions.length})</span>
                          <ChevronUp size={13} className={`transition-transform ${showOptionsPanel ? '' : 'rotate-180'}`} />
                        </button>
                      )}

                      {/* 액션 바 — topicConcluded(showStoryActions) 시 */}
                      {showStoryActions && (
                        <>
                          <button type="button" onClick={() => { sfx.click(); onStoryAction?.("NEXT_SCENE"); }}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:border-white/20 text-xs font-medium transition">
                            <FastForward size={13} /> 다음 씬
                          </button>
                          <button type="button" onClick={() => { sfx.click(); onStoryAction?.("TIME_ADVANCE"); }}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:border-white/20 text-xs font-medium transition">
                            <Clock size={13} /> 시간 진전
                          </button>
                          <button type="button" onClick={() => { sfx.click(); onStoryAction?.("MOVE"); }}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:border-white/20 text-xs font-medium transition">
                            <MapPin size={13} /> 장소 이동
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* [v3] 투명 디렉터: 이벤트 중에도 일반 입력 폼만 표시 */}
              {/* AWAY 이벤트: 유저가 채팅을 입력하면 자연스럽게 개입 */}
                <form onSubmit={handleSubmit} className="flex gap-3">
                  {/* ── "다음 씬" 디렉터 호출 버튼 ── */}

                  <AnimatePresence>
                    {canRequestDirector && (
                      <motion.div
                        className="relative group"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      >
                        <button
                          type="button"
                          onClick={onRequestDirector}
                          disabled={directorLoading}
                          className={`h-full px-4 rounded-xl border transition flex items-center justify-center
                            ${directorLoading
                              ? 'bg-white/[0.02] border-white/5 text-white/15 cursor-wait'
                              : 'bg-gradient-to-br from-amber-600/20 to-purple-600/20 border-amber-500/40 text-amber-300 hover:from-amber-600/40 hover:to-purple-600/40 hover:text-white'
                            }`}
                        >
                          {directorLoading ? (
                            <motion.div
                              className="w-5 h-5 border-2 border-white/20 border-t-amber-400 rounded-full"
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            />
                          ) : (
                            <Sparkles size={20} />
                          )}
                        </button>
 
                        {/* 툴팁 */}
                        <div className="absolute right-full bottom-0 mr-3 w-56 bg-black/95 border border-amber-500/30 p-4 rounded-xl text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-2xl backdrop-blur-xl">
                          <p className="font-bold text-amber-300 mb-2 text-sm flex items-center gap-2">
                            <Sparkles size={16} /> 다음 씬
                          </p>
                          <p className="leading-relaxed text-gray-400">
                            감독에게 다음 씬을 요청합니다.<br/>
                            이벤트, 장소 전환, 선택지 등<br/>
                            다양한 연출이 펼쳐질 수 있어요.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
 
                  <div className="flex-1 relative">
                    {/* [Feature #1] 유저 디렉터 모드 — *로 시작하면 상황 설명 입력 모드 */}
                    <input type="text" value={input} onChange={handleInputChange}
                      maxLength={MAX_MESSAGE_LENGTH}
                      placeholder={noEnergy ? "에너지가 부족합니다" : lowEnergy ? `에너지가 부족합니다 (필요: ${energyCost})` : "대화를 입력하세요... ( * 로 상황 설명 )"}
                      disabled={isTyping || noEnergy || lowEnergy}
                      style={isActionMode ? {
                        fontStyle: 'italic',
                        color: 'rgba(196, 181, 253, 0.85)',
                        letterSpacing: '0.02em',
                      } : undefined}
                      className={`w-full bg-white/5 border rounded-xl px-5 py-3.5 pr-10 text-white placeholder-white/40 focus:bg-white/10 transition duration-300 shadow-inner
                        ${isActionMode ? 'border-indigo-400/40 focus:border-indigo-400/70 bg-indigo-950/10' : ''}
                        ${hasActionText && !isActionMode ? 'border-indigo-400/20 focus:border-indigo-400/40' : ''}
                        ${input.length >= MAX_MESSAGE_LENGTH ? 'border-rose-500/60 focus:border-rose-500/80' : !isActionMode && !hasActionText ? 'border-white/10 focus:border-pink-500/50' : ''}`}
                    />

                    {/* [Feature #1] 상황 설명 도움말 툴팁 */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 group/help">
                      <div className="w-5 h-5 rounded-full bg-white/10 border border-white/20 flex items-center justify-center cursor-help hover:bg-indigo-500/30 hover:border-indigo-400/50 transition">
                        <span className="text-[11px] text-white/60 group-hover/help:text-white font-bold">?</span>
                      </div>
                      <div className="absolute right-0 bottom-full mb-2 w-64 bg-black/95 border border-indigo-500/30 p-3 rounded-xl text-[11px] text-gray-300 opacity-0 group-hover/help:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-2xl backdrop-blur-xl">
                        <p className="font-bold text-indigo-300 mb-1.5 flex items-center gap-1.5">
                          <span>✨</span> 상황 설명 입력
                        </p>
                        <p className="leading-relaxed text-gray-400 mb-1.5">
                          메시지 앞에 <span className="text-indigo-300 font-mono">*</span>를 붙이면 상황 설명이 됩니다.
                        </p>
                        <p className="text-gray-500 italic text-[10px]">
                          예: <span className="text-indigo-300">*</span>창밖을 바라보며<span className="text-indigo-300">*</span> 오늘 날씨 좋네요
                        </p>
                      </div>
                    </div>

                    {input.length > 0 && (
                      <span className={`absolute right-10 bottom-1 text-[10px] font-medium transition-colors
                        ${input.length >= MAX_MESSAGE_LENGTH ? 'text-rose-400' : input.length >= MAX_MESSAGE_LENGTH * 0.8 ? 'text-amber-400/60' : 'text-white/20'}`}>
                        {input.length}/{MAX_MESSAGE_LENGTH}
                      </span>
                    )}
                  </div>
 
                  {noEnergy || lowEnergy ? (
                    <motion.button type="button" onClick={() => { sfx.click(); onOpenStore?.("energy"); }}
                      className="bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white px-4 py-3.5 rounded-xl transition shadow-lg flex items-center gap-2 font-medium text-sm whitespace-nowrap"
                      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                      <ShoppingBag size={18} /><span className="hidden sm:inline">충전하기</span>
                    </motion.button>
                  ) : (
                    <button type="submit" disabled={isTyping || !input.trim()}
                      className="bg-gradient-to-br from-pink-500 to-rose-600 hover:from-pink-400 hover:to-rose-500 text-white p-3.5 rounded-xl transition shadow-lg disabled:opacity-50 disabled:grayscale transform active:scale-95">
                      <Send size={22} />
                    </button>
                  )}
                </form>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default DialogueBox;