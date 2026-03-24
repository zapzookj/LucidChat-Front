import { motion, AnimatePresence } from "framer-motion";
import { Send, Heart, Zap, ChevronRight, Dices, Sparkles, Rocket, ShoppingBag, Activity, MessageSquare, Eye, Clock, EyeIcon } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";

/**
 * [Phase 5.5-IT] DialogueBox
 *
 * 변경점 vs Phase 5.5-v3:
 * 1. 속마음 토글 탭 추가 — [🗣️ 대사] / [💭 속마음]
 * 2. 속마음 뷰: slide 전환 + 보라색 이탤릭체
 * 3. 해금되지 않은 상태의 빈 속마음 뷰 없음 (해금 후에만 탭 노출)
 *
 * ⚠️ 대사 출력 로직(타이핑/씬 전환)은 원본과 100% 동일 — 수정 없음
 * ⚠️ 상단 정보바(부스트/BPM/에너지/상태창)도 100% 동일
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
 
  // changes가 null/빈 배열이 되면 큐 즉시 정리 (안전장치)
  useEffect(() => {
    if (!changes || changes.length === 0) {
      // 진행 중인 show 타이머 취소
      showTimersRef.current.forEach(t => clearTimeout(t));
      showTimersRef.current = [];
      // 큐 비우기 (잔류 토스트 강제 제거)
      setQueue([]);
      return;
    }
 
    const filtered = changes.filter(c => c.value !== 0);
    if (filtered.length === 0) return;
 
    // 각 스탯 변화를 순차적으로 큐에 추가
    filtered.forEach((change, i) => {
      const showTimer = setTimeout(() => {
        const id = Date.now() + Math.random(); // 고유 ID (동일 타임스탬프 방지)
 
        setQueue(prev => [...prev, { ...change, id }]);
 
        // ⭐ 핵심 수정: 제거 타이머를 useEffect cleanup과 무관하게 독립 실행
        // 이 타이머는 showTimersRef에 포함되지 않으므로 cleanup에 영향 없음
        setTimeout(() => {
          setQueue(prev => prev.filter(item => item.id !== id));
        }, 2200);
 
      }, i * 600);
 
      showTimersRef.current.push(showTimer);
    });
 
    // cleanup: show 타이머만 취소 (제거 타이머는 독립적으로 실행됨)
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
      {/* 속마음 라벨 */}
      <div className="flex items-center gap-2 mb-2 opacity-50">
        <span className="text-xs">💭</span>
        <span className="text-[10px] text-purple-300 uppercase tracking-widest font-bold">
          {characterName}의 속마음
        </span>
      </div>

      {/* 속마음 텍스트 */}
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
//  토글 탭 컴포넌트
// ═══════════════════════════════════════════════════════════════

const ThoughtToggleTabs = ({ activeTab, onTabChange }) => (
  <div className="flex gap-1 mb-3">
    <button
      onClick={() => onTabChange("dialogue")}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
        activeTab === "dialogue"
          ? "bg-white/10 text-white/80 border border-white/15 shadow-sm"
          : "text-white/25 hover:text-white/40 hover:bg-white/[0.03]"
      }`}
    >
      <MessageSquare size={12} />
      <span>대사</span>
    </button>
    <button
      onClick={() => onTabChange("thought")}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
        activeTab === "thought"
          ? "bg-purple-500/15 text-purple-300 border border-purple-500/25 shadow-[0_0_8px_rgba(168,85,247,0.15)]"
          : "text-purple-400/30 hover:text-purple-400/50 hover:bg-purple-500/[0.05]"
      }`}
    >
      <Eye size={12} />
      <span>속마음</span>
    </button>
  </div>
);


// ═══════════════════════════════════════════════════════════════
//  DialogueBox 메인 컴포넌트
// ═══════════════════════════════════════════════════════════════

const DialogueBox = ({
  characterName,
  scene,
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
  innerThought = null,           // 해금된 속마음 텍스트 (null이면 미해금 or 없음)
  hasInnerThought = false,       // 속마음 존재 여부 (해금과 무관)
  thoughtUnlocked = false,       // 해금 완료 여부
  // ── [Phase 5.5-EV] 이벤트 시스템 강화 ──
  topicConcluded = false,         // 주제 종료 플래그
  eventStatus = null,              // "ONGOING" | "RESOLVED" | null
  onWatch,                         // 👀 계속 지켜보기 콜백
  // [Phase 5.5-NPC]
  speaker = null,          // 현재 씬의 화자 이름 (null → 메인 캐릭터)
  onTimeSkip,                      // ⏭ 시간 넘기기 콜백
  // [Phase 5.5-Fix] SSE 응답 대기 플래그 — final_result 도착 전 premature 입력창 방지
  awaitingFinalResult = false,
}) => {
  const [input, setInput] = useState("");
  const [displayedText, setDisplayedText] = useState("");
  const [isTextFullyDisplayed, setIsTextFullyDisplayed] = useState(false);

  // [Phase 5.5-IT] 속마음 토글 상태
  const [activeTab, setActiveTab] = useState("dialogue");

  const isEventScene = scene?.isEvent;

  // [Phase 5.5-EV] 디렉터 모드 진행 중 여부
  const isDirectorOngoing = eventStatus === "ONGOING";

  // [Phase 5.5-NPC] 현재 화자가 NPC인지 판별
  const isNpcSpeaking = speaker && speaker !== characterName;
  const displaySpeakerName = speaker || characterName;

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
    onSend(input);
    setInput("");
  };

  // ━━━ 클릭 핸들러 (원본 100% 동일) ━━━
  const handleBoxClick = () => {
    // 속마음 탭이 활성화되어 있으면 클릭으로 씬 넘기지 않음
    if (activeTab === "thought") return;

    if (scene?.dialogue && !isTextFullyDisplayed) {
      setDisplayedText(scene.dialogue);
      setIsTextFullyDisplayed(true);
    } else if (hasNextScene || isEventScene) {
      onNextScene();
    }
  };

  const noEnergy = energy <= 0;
  const lowEnergy = energy < energyCost && energy > 0;

  // BPM 게이지 퍼센트 (60~180 → 0~100%)
  const bpmPercent = Math.min(100, Math.max(0, ((bpm - 60) / 120) * 100));

  // 속마음 토글 탭 표시 조건: 해금 완료 + 속마음 텍스트 존재
  const showThoughtTabs = thoughtUnlocked && innerThought;

  // [Phase 5.5-EV] 이벤트 트리거 버튼 활성화 조건
  const canTriggerEvent = topicConcluded && !isDirectorOngoing && energy >= 2;
 
  // [Phase 5.5-EV] 시간 넘기기 버튼 표시 조건
  const canTimeSkip = topicConcluded && !isDirectorOngoing && energy >= 1;

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

            {/* BPM 툴팁 */}
            <div className="absolute bottom-full right-0 mb-3 w-56 bg-black/95 border border-rose-500/30 p-4 rounded-xl text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-2xl backdrop-blur-xl">
              <p className="font-bold text-rose-400 mb-2 text-sm">{characterName}의 심박수</p>
              <p className="leading-relaxed text-gray-400">대화 텐션과 감정에 따라 실시간으로 변화합니다.</p>
              <div className="mt-2 space-y-1 text-[10px] text-gray-500">
                <p>60~85 : 평온</p>
                <p>86~120 : 두근거림</p>
                <p>121~180 : 쿵쾅거림</p>
              </div>
            </div>
          </div>

          {/* 에너지 */}
          <div className="relative group cursor-help">
            <div className="flex items-center gap-3 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-yellow-500/40 shadow-[0_0_15px_rgba(234,179,8,0.3)] hover:bg-black/80 transition-colors">
              <Zap size={20} className={`text-yellow-400 ${energy < 20 ? 'animate-pulse' : ''}`} fill={energy > 0 ? "currentColor" : "none"} />
              <div className="flex flex-col w-12">
                <span className="text-[10px] text-yellow-400 font-bold uppercase leading-none mb-0.5">에너지</span>
                <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${energy < 20 ? 'bg-red-500' : 'bg-yellow-400'}`}
                    style={{ width: `${Math.min(100, (energy / freeEnergyMax) * 100)}%` }}
                  />
                </div>
              </div>
              <span className="text-sm font-bold text-white ml-1">{energy}</span>
            </div>

            {/* 에너지 툴팁 */}
            <div className="absolute bottom-full right-0 mb-3 w-72 bg-black/95 border border-yellow-500/30 p-4 rounded-xl text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-2xl backdrop-blur-xl">
              <p className="font-bold text-yellow-400 mb-2 text-sm">에너지</p>
              <p className="leading-relaxed text-gray-400 mb-3">대화를 보낼 때마다 에너지가 소모됩니다.</p>
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
          {/* ═══ [Phase 5.5-NPC] 화자 이름표 ═══ */}
          {!isEventScene && (
            <AnimatePresence mode="wait">
              <motion.div
                key={displaySpeakerName}
                initial={{ opacity: 0, y: -4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className={`absolute -top-5 left-8 font-bold px-8 py-2 rounded-2xl shadow-lg border transform -rotate-1 z-20 ${
                  isNpcSpeaking
                    ? 'bg-gradient-to-r from-red-800 to-rose-900 text-red-200 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-white/20'
                }`}
              >
                {isNpcSpeaking && <span className="mr-1.5 text-sm">👤</span>}
                {displaySpeakerName}
              </motion.div>
            </AnimatePresence>
          )}

          {/* [Phase 5.5-EV] 디렉터 모드 진행 중 뱃지 */}
          {isDirectorOngoing && !isEventScene && (
            <div className="absolute -top-5 right-8 z-20">
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 border border-amber-400/30 shadow-lg"
              >
                <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                  🎬
                </motion.span>
                <span className="text-xs font-bold text-white">이벤트 진행 중</span>
              </motion.div>
            </div>
          )}

          {/* ━━━ [Phase 5.5-IT] 속마음 토글 탭 ━━━ */}
          {showThoughtTabs && !isEventScene && (
            <div className="absolute -top-5 right-8 z-20">
              <ThoughtToggleTabs activeTab={activeTab} onTabChange={setActiveTab} />
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
              /* ── 대사 뷰 (원본 100% 동일) ── */
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
              /* ── 속마음 뷰 ── */
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

          {/* [Phase 5.5-Fix] final_result 대기 중 인디케이터 — first_scene은 도착했지만 나머지 씬이 아직 없을 때 */}
          {activeTab === "dialogue" && !hasNextScene && !isEventScene && awaitingFinalResult && isTextFullyDisplayed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 flex items-center justify-center gap-2 py-3"
            >
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-white/30"
                animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
              />
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-white/30"
                animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
              />
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-white/30"
                animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
              />
            </motion.div>
          )}

          {/* ═══ 입력 영역 ═══ */}
          {/* [Phase 5.5-Fix] awaitingFinalResult: first_scene 도착 후 final_result 도착 전까지 입력창 숨김 */}
          {activeTab === "dialogue" && !hasNextScene && !isEventScene && !awaitingFinalResult && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 relative z-10">
 
              {/* ━━━ [Phase 5.5-EV] 디렉터 모드 진행 중: 지켜보기 + 난입 UI ━━━ */}
              {isDirectorOngoing ? (
                <div className="flex flex-col gap-3">
                  {/* 👀 계속 지켜보기 버튼 */}
                  <motion.button
                    onClick={onWatch}
                    disabled={isTyping || noEnergy || lowEnergy}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-600/30 to-orange-600/30 border border-amber-500/40
                               hover:from-amber-600/50 hover:to-orange-600/50 hover:border-amber-400/60
                               transition-all shadow-lg disabled:opacity-30 disabled:cursor-not-allowed
                               flex items-center justify-center gap-3 group"
                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                  >
                    <motion.span
                      animate={{ scale: [1, 1.15, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="text-xl"
                    >
                      👀
                    </motion.span>
                    <span className="text-amber-200 font-bold text-sm group-hover:text-white transition">
                      계속 지켜보기
                    </span>
                    <span className="text-amber-400/50 text-xs">
                      -{energyCost} ⚡
                    </span>
                  </motion.button>
 
                  {/* 난입용 채팅 입력 */}
                  <form onSubmit={handleSubmit} className="flex gap-3">
                    <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
                      placeholder="직접 개입하기... (채팅을 입력하세요)"
                      disabled={isTyping || noEnergy || lowEnergy}
                      className="flex-1 bg-white/5 border border-amber-500/20 rounded-xl px-5 py-3.5 text-white placeholder-amber-200/30
                                 focus:bg-white/10 focus:border-amber-400/50 transition duration-300 shadow-inner"
                    />
                    <button type="submit" disabled={isTyping || !input.trim()}
                      className="bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500
                                 text-white p-3.5 rounded-xl transition shadow-lg disabled:opacity-50 disabled:grayscale transform active:scale-95"
                    >
                      <Send size={22} />
                    </button>
                  </form>
                </div>
              ) : (
                /* ━━━ 일반 모드: 기존 입력 UI + 시간 넘기기 ━━━ */
                <form onSubmit={handleSubmit} className="flex gap-3">
                  {/* 이벤트 트리거 버튼 */}
                  <div className="relative group">
                    <button type="button" onClick={onTriggerEvent}
                      disabled={isTyping || !canTriggerEvent}
                      className={`h-full px-4 rounded-xl border transition flex items-center justify-center
                        ${canTriggerEvent
                          ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300 hover:bg-indigo-600/40 hover:text-white'
                          : 'bg-white/[0.02] border-white/5 text-white/15 cursor-not-allowed'
                        }`}
                    >
                      <Dices size={20} />
                    </button>
                    {/* 이벤트 트리거 툴팁 */}
                    <div className="absolute right-full bottom-0 mr-3 w-64 bg-black/95 border border-indigo-500/30 p-4 rounded-xl text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-2xl backdrop-blur-xl">
                      <p className="font-bold text-indigo-300 mb-2 text-sm flex items-center gap-2">
                        <Sparkles size={16} /> 이벤트 트리거
                      </p>
                      {canTriggerEvent ? (
                        <p className="leading-relaxed text-gray-400">랜덤 이벤트를 발생시킵니다.<br/>운명의 흐름이 바뀔 수도 있어요.</p>
                      ) : (
                        <p className="leading-relaxed text-amber-400/80">
                          현재 대화가 마무리되면 활성화됩니다.
                        </p>
                      )}
                    </div>
                  </div>
 
                  {/* [Phase 5.5-EV] 시간 넘기기 버튼 */}
                  <AnimatePresence>
                    {canTimeSkip && (
                      <motion.div
                        className="relative group"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      >
                        <button
                          type="button"
                          onClick={onTimeSkip}
                          disabled={isTyping}
                          className="h-full px-4 rounded-xl bg-sky-600/20 border border-sky-500/50 text-sky-300
                                     hover:bg-sky-600/40 hover:text-white transition flex items-center justify-center
                                     disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Clock size={20} />
                        </button>
                        {/* 시간 넘기기 툴팁 */}
                        <div className="absolute right-full bottom-0 mr-3 w-56 bg-black/95 border border-sky-500/30 p-4 rounded-xl text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-2xl backdrop-blur-xl">
                          <p className="font-bold text-sky-300 mb-2 text-sm flex items-center gap-2">
                            <Clock size={16} /> 시간 넘기기
                          </p>
                          <p className="leading-relaxed text-gray-400">
                            시간을 흘려보내 새로운 상황으로<br/>전환합니다.
                          </p>
                          <div className="mt-3 flex items-center justify-between text-[11px]">
                            <span className="text-gray-500">소모</span>
                            <span className="text-yellow-300 font-bold">-1 에너지</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
 
                  <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
                    placeholder={noEnergy ? "에너지가 부족합니다" : lowEnergy ? `에너지가 부족합니다 (필요: ${energyCost})` : "대화를 입력하세요..."}
                    disabled={isTyping || noEnergy || lowEnergy}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 text-white placeholder-white/40 focus:bg-white/10 focus:border-pink-500/50 transition duration-300 shadow-inner"
                  />
 
                  {noEnergy || lowEnergy ? (
                    <motion.button type="button" onClick={() => onOpenStore?.("energy")}
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
              )}
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default DialogueBox;