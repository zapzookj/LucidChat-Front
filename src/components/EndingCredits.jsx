import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Sparkles, MessageSquare, Calendar, Star, Clock, Activity } from "lucide-react";
import { sfx } from "../utils/sfx";

// ═══════════════════════════════════════════════════════════════
//  [Phase 4] EndingCredits — 시네마틱 엔딩 크레딧
//
//  Flow:
//    1. Fade to Black
//    2. Epilogue Scenes (캐릭터 마지막 대사들)
//    3. Ending Title Card (동적 엔딩 제목)
//    4. Character Quote
//    5. Memory Scroll (RAG 추억 회고)
//    6. Play Stats
//    7. Developer Comment
//    8. "Fin." (최종 카드)
//
//  Props:
//    endingData     — EndingResponse from backend
//    onComplete     — 엔딩 완료 콜백
//    onSceneChange  — 씬 변경 시 (emotion, location 등 전달)
//
//  [Fix #13] 에필로그 나레이션 → 대사창 바로 위로 이동, 대사창 확대
//  [Fix #14] 2-Tap Skip: 1st tap = 현재 플로우 즉시 표시, 2nd tap = 다음 플로우
// ═══════════════════════════════════════════════════════════════

/** 텍스트 길이에 비례하는 대기 시간 계산 (ms) */
const calcTextDuration = (text, baseMs = 5000, msPerChar = 120) => {
  if (!text) return baseMs;
  return Math.max(baseMs, text.length * msPerChar + 3000);
};

// ─── 파티클 시스템 ───
const Particle = ({ type, delay, duration }) => {
  const isHappy = type === "HAPPY";

  // 해피: 벚꽃잎 | 배드: 빗방울
  const size = isHappy ? Math.random() * 12 + 8 : Math.random() * 2 + 1;
  const left = Math.random() * 100;
  const swayAmount = isHappy ? Math.random() * 80 - 40 : Math.random() * 4 - 2;

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        left: `${left}%`,
        top: "-20px",
        width: isHappy ? `${size}px` : `${size}px`,
        height: isHappy ? `${size * 0.7}px` : `${size * 8}px`,
        borderRadius: isHappy ? "50% 0 50% 50%" : "0",
        background: isHappy
          ? `hsl(${340 + Math.random() * 30}, ${70 + Math.random() * 20}%, ${75 + Math.random() * 15}%)`
          : `rgba(180, 200, 220, ${0.3 + Math.random() * 0.3})`,
        rotate: isHappy ? `${Math.random() * 360}deg` : "0deg",
      }}
      initial={{ y: -20, x: 0, opacity: 0 }}
      animate={{
        y: "110vh",
        x: swayAmount,
        opacity: [0, 0.8, 0.8, 0],
        rotate: isHappy ? `${Math.random() * 720}deg` : "0deg",
      }}
      transition={{
        duration: isHappy ? duration : duration * 0.4,
        delay,
        ease: isHappy ? "easeInOut" : "linear",
        repeat: Infinity,
        repeatDelay: Math.random() * 2,
      }}
    />
  );
};

const ParticleField = ({ type, count = 25 }) => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none z-10">
    {Array.from({ length: count }).map((_, i) => (
      <Particle
        key={i}
        type={type}
        delay={Math.random() * 8}
        duration={6 + Math.random() * 6}
      />
    ))}
  </div>
);

// ─── [Fix #14] 타자기 효과 (forceComplete 지원) ───
const TypeWriter = ({ text, speed = 45, onComplete, forceComplete = false, className = "" }) => {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!text) { setDone(true); onComplete?.(); return; }
    setDisplayed("");
    setDone(false);
    let i = 0;
    intervalRef.current = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        setDone(true);
        setTimeout(() => onComplete?.(), 600);
      }
    }, speed);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [text]);

  // [Fix #14] forceComplete → 즉시 전체 텍스트 표시
  useEffect(() => {
    if (forceComplete && text && !done) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setDisplayed(text);
      setDone(true);
      onComplete?.();
    }
  }, [forceComplete]);

  return (
    <span className={className}>
      {displayed}
      {!done && <span className="animate-pulse ml-0.5 opacity-70">▍</span>}
    </span>
  );
};


// ═══════════════════════════════════════════════════════════════
//  메인 컴포넌트
// ═══════════════════════════════════════════════════════════════

const PHASES = {
  FADE_IN: "FADE_IN",
  EPILOGUE: "EPILOGUE",
  TITLE_CARD: "TITLE_CARD",
  QUOTE: "QUOTE",
  MEMORIES: "MEMORIES",
  STATS: "STATS",
  ACKNOWLEDGMENTS: "ACKNOWLEDGMENTS", // 추가된 조력자 섹션
  DEVELOPER: "DEVELOPER",
  FIN: "FIN",
};

const ACK_DATA = [
  {
    name: "강승구",
    role: "Special Advisor",
    comment: "비주얼 노벨의 권위자로서 무한한 피드백과 열정적인 베타 테스트, 그리고 든든한 물적 지원까지. 이 프로젝트의 기틀을 잡아준 최고의 조력자입니다."
  },
  {
    name: "권호중",
    role: "Lead Beta Tester",
    comment: "언제나 긍정적인 에너지로 확신을 주었으며, '아이리'의 유지비(사료 값)를 기꺼이 분담해 준 든든한 후원자입니다."
  },
  {
    name: "이세웅",
    role: "Strategic Supporter",
    comment: "장르를 불문한 진지한 분석과 테스트, 그리고 '언제나 지원할 수 있다'는 믿음직한 말 한마디로 개발자의 자신감을 지켜주었습니다."
  },
  {
    name: "이병현",
    role: "Visual Assistant",
    comment: "함께 고뇌하는 작업실 동료로서, 디자인 전공자의 감각을 발휘해 루시드 챗의 시각적 디테일을 완성하는 데 큰 도움을 주었습니다."
  }
];

const EndingCredits = ({ endingData, onComplete, onSceneChange, characterName = "아이리" }) => {
  const [phase, setPhase] = useState(PHASES.FADE_IN);
  const [epilogueIndex, setEpilogueIndex] = useState(0);
  const [epilogueTypeDone, setEpilogueTypeDone] = useState(false);
  const [memoryIndex, setMemoryIndex] = useState(0);

  // ── [Fix #14] 2-Tap Skip 시스템 ──
  // phaseRevealed === false → 애니메이션/타이머 진행 중 (1st tap: 즉시 표시)
  // phaseRevealed === true  → 콘텐츠 모두 표시됨 (2nd tap: 다음 플로우)
  const [phaseRevealed, setPhaseRevealed] = useState(false);

  const isHappy = endingData.endingType === "HAPPY";
  const scenes = endingData.epilogueScenes || [];
  const memories = endingData.memories || [];

  // ── 페이즈 전환 시 revealed 상태 초기화 ──
  useEffect(() => {
    setPhaseRevealed(false);
  }, [phase]);

  useEffect(() => {
    sfx.wooshDeep();
  }, []);

  useEffect(() => {
    if (phase === PHASES.TITLE_CARD) sfx.boom();
  }, [phase]);

  // ── 자동 진행 타이머 ──

  // Phase 1: Fade In → Epilogue
  useEffect(() => {
    if (phase === PHASES.FADE_IN) {
      const t = setTimeout(() => setPhase(PHASES.EPILOGUE), 3000);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // 에필로그 씬 변경 시 부모에게 전달 (배경/감정 변경)
  useEffect(() => {
    if (phase === PHASES.EPILOGUE && scenes[epilogueIndex]) {
      const scene = scenes[epilogueIndex];
      onSceneChange?.({
        emotion: scene.emotion || "NEUTRAL",
        location: scene.location,
        time: scene.time,
        outfit: scene.outfit,
        bgmMode: scene.bgmMode,
      });
    }
  }, [phase, epilogueIndex]);

  // 에필로그 자동 다음 씬 (대사 완료 후 5초)
  useEffect(() => {
    if (phase !== PHASES.EPILOGUE || !epilogueTypeDone) return;

    const t = setTimeout(() => {
      if (epilogueIndex < scenes.length - 1) {
        setEpilogueIndex(i => i + 1);
        setEpilogueTypeDone(false);
      } else {
        setPhase(PHASES.TITLE_CARD);
      }
    }, 5000);  // 타자기 완료 후 5초 여운
    return () => clearTimeout(t);
  }, [phase, epilogueTypeDone, epilogueIndex, scenes.length]);

  // 타이틀 카드 → 인용문 (자동 진행)
  useEffect(() => {
    if (phase === PHASES.TITLE_CARD) {
      const t = setTimeout(() => {
        setPhaseRevealed(true);  // 자연스럽게 revealed 처리
      }, 10000);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // revealed 후 2초 대기 → 다음 페이즈 자동 이동
  useEffect(() => {
    if (!phaseRevealed) return;
    if (phase === PHASES.EPILOGUE || phase === PHASES.FADE_IN || phase === PHASES.FIN) return;

    const order = Object.values(PHASES);
    const currentIdx = order.indexOf(phase);
    if (currentIdx >= order.length - 1) return;

    const t = setTimeout(() => {
      setPhase(order[currentIdx + 1]);
    }, 2000);
    return () => clearTimeout(t);
  }, [phaseRevealed, phase]);

  // 인용문 자동 revealed
  useEffect(() => {
    if (phase === PHASES.QUOTE) {
      const duration = calcTextDuration(endingData?.characterQuote, 10000, 150);
      const t = setTimeout(() => setPhaseRevealed(true), duration);
      return () => clearTimeout(t);
    }
  }, [phase, endingData?.characterQuote]);

  // 추억 자동 스크롤
  useEffect(() => {
    if (phase !== PHASES.MEMORIES) return;

    const mems = endingData?.memories || [];
    if (mems.length === 0) {
      const t = setTimeout(() => setPhaseRevealed(true), 3000);
      return () => clearTimeout(t);
    }

    const timers = [];
    mems.forEach((_, idx) => {
      timers.push(setTimeout(() => setMemoryIndex(idx + 1), (idx + 1) * 4000));
    });

    timers.push(setTimeout(() => setPhaseRevealed(true), mems.length * 4000 + 3000));

    return () => timers.forEach(clearTimeout);
  }, [phase, endingData?.memories]);

  // Stats 자동 revealed
  useEffect(() => {
    if (phase === PHASES.STATS) {
      const t = setTimeout(() => setPhaseRevealed(true), 18000);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // Developer 자동 revealed
  useEffect(() => {
    if (phase === PHASES.DEVELOPER) {
      const t = setTimeout(() => setPhaseRevealed(true), 18000);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // ── [Fix #14] 2-Tap Skip 핸들러 ──
  const handleSkip = useCallback(() => {
    // ─── FADE_IN: 바로 스킵 ───
    if (phase === PHASES.FADE_IN) {
      setPhase(PHASES.EPILOGUE);
      return;
    }

    // ─── EPILOGUE: 기존 3단계 로직 유지 ───
    // 1st: 타자기 즉시 완성 → 2nd: 다음 에필로그 씬 → 3rd: 다음 페이즈
    if (phase === PHASES.EPILOGUE) {
      if (!epilogueTypeDone) {
        setEpilogueTypeDone(true);  // 타자기 즉시 완성
      } else if (epilogueIndex < scenes.length - 1) {
        setEpilogueIndex(prev => prev + 1);
        setEpilogueTypeDone(false);
      } else {
        setPhase(PHASES.TITLE_CARD);
      }
      return;
    }

    // ─── FIN: 닫기 ───
    if (phase === PHASES.FIN) {
      sfx.click();
      onComplete?.();
      return;
    }

    // ─── 나머지 페이즈: 2-Tap 시스템 ───
    if (!phaseRevealed) {
      // 1st tap: 현재 플로우 콘텐츠 즉시 표시
      setPhaseRevealed(true);

      // MEMORIES: 모든 메모리 카드 즉시 표시
      if (phase === PHASES.MEMORIES) {
        setMemoryIndex(memories.length);
      }
    } else {
      // 2nd tap: 다음 플로우로 이동
      const order = Object.values(PHASES);
      const currentIdx = order.indexOf(phase);
      if (currentIdx < order.length - 1) {
        setPhase(order[currentIdx + 1]);
      }
    }
  }, [phase, epilogueIndex, epilogueTypeDone, scenes.length, memories.length, phaseRevealed, onComplete]);

  // ── 스타일 ──
  const themeColor = isHappy ? "rgba(255, 182, 193, 0.15)" : "rgba(100, 120, 140, 0.15)";
  const accentColor = isHappy ? "#f9a8c9" : "#8ca0b3";
  const textColor = isHappy ? "text-rose-100" : "text-slate-300";
  const subtitleColor = isHappy ? "text-rose-300/80" : "text-slate-400/80";

  const currentScene = scenes[epilogueIndex];

  // [Fix #14] revealed 상태에서 애니메이션 즉시 완료
  const revealTransition = (normalDuration, normalDelay = 0) =>
    phaseRevealed
      ? { duration: 0.2, delay: 0 }
      : { duration: normalDuration, delay: normalDelay };

  return (
    <div
      className="fixed inset-0 z-[9999] overflow-hidden cursor-pointer select-none"
      onClick={handleSkip}
      style={{ background: "linear-gradient(180deg, #0a0a0f 0%, #111118 50%, #0a0a0f 100%)" }}
    >
      {/* 비네트 오버레이 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)`,
        }}
      />

      {/* 파티클 */}
      <ParticleField type={endingData.endingType} count={isHappy ? 30 : 40} />

      {/* 스킵 힌트 */}
      <motion.div
        className="absolute bottom-4 right-4 z-50 text-white/20 text-xs tracking-widest"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 3 }}
      >
        TAP TO CONTINUE
      </motion.div>

      <AnimatePresence mode="wait">
        {/* ═══ Phase 1: Fade In ═══ */}
        {phase === PHASES.FADE_IN && (
          <motion.div
            key="fade"
            className="absolute inset-0 bg-black z-50"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 2.5, ease: "easeInOut" }}
          />
        )}

        {/* ═══ Phase 2: Epilogue Scenes ═══ */}
        {/* [Fix #13] 나레이션을 대사창 바로 위로 이동 + 대사창 확대 */}
        {phase === PHASES.EPILOGUE && currentScene && (
          <motion.div
            key={`epi-${epilogueIndex}`}
            className="absolute inset-0 flex flex-col justify-end items-center pb-16 sm:pb-24 px-4 sm:px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* 나레이션 + 대사 묶음 (하단 정렬) */}
            <div className="w-full max-w-xl">

              {/* [Fix #13] 나레이션 — 대사창 바로 위에 위치 */}
              <AnimatePresence mode="wait">
                {currentScene.narration && (
                  <motion.div
                    key={`narr-${epilogueIndex}`}
                    className="mb-3 sm:mb-4 px-2"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.8 }}
                  >
                    <p className={`text-sm leading-relaxed text-center italic ${subtitleColor}`}
                       style={{ fontFamily: "'Noto Serif KR', serif", letterSpacing: "0.02em" }}>
                      {currentScene.narration}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* [Fix #13] 대사 (확대된 텍스트 창) */}
              <div
                className="rounded-2xl px-6 py-5 sm:px-8 sm:py-7 backdrop-blur-xl border"
                style={{
                  background: `linear-gradient(135deg, ${themeColor}, rgba(0,0,0,0.6))`,
                  borderColor: `${accentColor}33`,
                  boxShadow: `0 0 40px ${accentColor}15`,
                }}
              >
                {/* 캐릭터 이름 */}
                <div className={`text-xs tracking-[0.2em] mb-2 sm:mb-3 ${subtitleColor}`}
                     style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
                  {characterName}
                </div>
                {/* [Fix #13] 대사 (확대: text-base sm:text-lg, minHeight 4.5rem) */}
                <div className={`text-base sm:text-lg leading-relaxed sm:leading-loose ${textColor}`}
                     style={{ fontFamily: "'Noto Serif KR', serif", minHeight: "4.5rem" }}>
                  <TypeWriter
                    text={currentScene.dialogue}
                    speed={50}
                    forceComplete={epilogueTypeDone}
                    onComplete={() => setEpilogueTypeDone(true)}
                  />
                </div>
              </div>

              {/* 씬 인디케이터 */}
              <div className="flex justify-center gap-1.5 mt-4">
                {scenes.map((_, i) => (
                  <div
                    key={i}
                    className="h-1 rounded-full transition-all duration-500"
                    style={{
                      width: i === epilogueIndex ? "24px" : "6px",
                      background: i <= epilogueIndex ? accentColor : `${accentColor}33`,
                    }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══ Phase 3: Title Card ═══ */}
        {phase === PHASES.TITLE_CARD && (
          <motion.div
            key="title"
            className="absolute inset-0 flex flex-col items-center justify-center px-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={revealTransition(1.5)}
          >
            {/* 엔딩 타입 레이블 */}
            <motion.div
              className={`text-xs tracking-[0.4em] uppercase mb-6 ${subtitleColor}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={revealTransition(1, 0.5)}
              style={{ fontFamily: "'Noto Sans KR', sans-serif" }}
            >
              {isHappy ? "— HAPPY ENDING —" : "— BAD ENDING —"}
            </motion.div>

            {/* 엔딩 제목 */}
            <motion.h1
              className={`text-3xl sm:text-4xl md:text-5xl font-bold text-center leading-tight ${textColor}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={revealTransition(1.5, 1)}
              style={{
                fontFamily: "'Noto Serif KR', serif",
                textShadow: `0 0 60px ${accentColor}40, 0 0 120px ${accentColor}20`,
                letterSpacing: "0.05em",
              }}
            >
              {endingData.title}
            </motion.h1>

            {/* 장식선 */}
            <motion.div
              className="mt-8 h-px w-32"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 128, opacity: 0.5 }}
              transition={revealTransition(1.5, 2)}
              style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }}
            />

            {/* 글로우 효과 */}
            <motion.div
              className="absolute w-64 h-64 rounded-full pointer-events-none"
              style={{
                background: `radial-gradient(circle, ${accentColor}15, transparent 70%)`,
                filter: "blur(40px)",
              }}
              animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 4, repeat: Infinity }}
            />
          </motion.div>
        )}

        {/* ═══ Phase 4: Character Quote ═══ */}
        {phase === PHASES.QUOTE && (
          <motion.div
            key="quote"
            className="absolute inset-0 flex flex-col items-center justify-center px-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={revealTransition(1.2)}
          >
            <motion.div
              className="max-w-md text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={revealTransition(1.5, 0.5)}
            >
              {/* 인용 부호 */}
              <span className={`text-4xl ${subtitleColor} block mb-4`}
                    style={{ fontFamily: "Georgia, serif" }}>
                ❝
              </span>
              <p className={`text-lg sm:text-xl leading-relaxed italic ${textColor}`}
                 style={{ fontFamily: "'Noto Serif KR', serif", letterSpacing: "0.03em" }}>
                {endingData.characterQuote}
              </p>
              <span className={`text-4xl ${subtitleColor} block mt-4`}
                    style={{ fontFamily: "Georgia, serif" }}>
                ❞
              </span>
              <p className={`text-sm mt-6 ${subtitleColor}`}
                 style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
                — {characterName}
              </p>
            </motion.div>
          </motion.div>
        )}

        {/* ═══ Phase 5: Memories ═══ */}
        {phase === PHASES.MEMORIES && (
          <motion.div
            key="memories"
            className="absolute inset-0 flex flex-col items-center pt-16 px-6 overflow-y-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={revealTransition(1)}
          >
            {/* 섹션 타이틀 */}
            <motion.div
              className="text-center mb-8"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={revealTransition(0.6)}
            >
              <Sparkles className={`w-5 h-5 mx-auto mb-3`} style={{ color: accentColor }} />
              <h2 className={`text-lg tracking-[0.15em] ${textColor}`}
                  style={{ fontFamily: "'Noto Serif KR', serif" }}>
                우리가 함께한 시간
              </h2>
              <div className="h-px w-16 mx-auto mt-3"
                   style={{ background: `linear-gradient(90deg, transparent, ${accentColor}60, transparent)` }} />
            </motion.div>

            {/* 추억 카드들 */}
            <div className="w-full max-w-sm space-y-3 pb-24">
              {memories.length > 0 ? (
                memories.slice(0, memoryIndex).map((memory, idx) => (
                  <motion.div
                    key={idx}
                    className="rounded-xl px-5 py-4 backdrop-blur-sm border"
                    style={{
                      background: `linear-gradient(135deg, ${themeColor}, rgba(0,0,0,0.3))`,
                      borderColor: `${accentColor}20`,
                    }}
                    initial={{ opacity: 0, x: idx % 2 === 0 ? -20 : 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={revealTransition(0.8)}
                  >
                    <p className={`text-sm leading-relaxed ${subtitleColor}`}
                       style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
                      {memory}
                    </p>
                  </motion.div>
                ))
              ) : (
                <motion.p
                  className={`text-center text-sm ${subtitleColor}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  짧지만 잊지 못할 시간이었습니다.
                </motion.p>
              )}
            </div>
          </motion.div>
        )}

        {/* ═══ Phase 6: Stats — [Bug #2 Fix] Phase 5.5 입체적 스탯 반영 ═══ */}
        {phase === PHASES.STATS && endingData.stats && (
          <motion.div
            key="stats"
            className="absolute inset-0 flex flex-col items-center justify-center px-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={revealTransition(1)}
          >
            <motion.div className="w-full max-w-sm space-y-5">
              {/* 타이틀 */}
              <motion.h3
                className={`text-center text-sm tracking-[0.15em] mb-6 ${subtitleColor}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={revealTransition(0.6, 0.3)}
              >
                PLAY RECORD
              </motion.h3>

              {/* ── 기본 통계 ── */}
              {[
                { icon: MessageSquare, label: "나눈 대화", value: `${endingData.stats.totalMessages}회` },
                { icon: Calendar, label: "함께한 시간", value: `${endingData.stats.totalDays}일` },
                { icon: Clock, label: "첫 만남", value: endingData.stats.firstMessageDate },
              ].map((stat, idx) => (
                <motion.div
                  key={idx}
                  className="flex items-center gap-4"
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={revealTransition(0.6, 0.5 + idx * 0.3)}
                >
                  <stat.icon className="w-4 h-4 flex-shrink-0" style={{ color: `${accentColor}99` }} />
                  <span className={`text-xs tracking-wider flex-1 ${subtitleColor}`}
                        style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
                    {stat.label}
                  </span>
                  <span className={`text-sm ${textColor}`}
                        style={{ fontFamily: "'Noto Serif KR', serif" }}>
                    {stat.value}
                  </span>
                </motion.div>
              ))}

              {/* ── 동적 관계 & BPM ── */}
              <motion.div
                className="flex items-center justify-between pt-3 border-t"
                style={{ borderColor: `${accentColor}15` }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={revealTransition(0.6, 1.6)}
              >
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4" style={{ color: `${accentColor}99` }} />
                  <span className={`text-xs ${subtitleColor}`} style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
                    최종 관계
                  </span>
                </div>
                <span className={`text-sm font-medium ${textColor}`}
                      style={{ fontFamily: "'Noto Serif KR', serif" }}>
                  {endingData.stats.dynamicRelationTag || endingData.stats.finalRelation}
                </span>
              </motion.div>

              <motion.div
                className="flex items-center justify-between"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={revealTransition(0.6, 1.9)}
              >
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4" style={{ color: `${accentColor}99` }} />
                  <span className={`text-xs ${subtitleColor}`} style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
                    마지막 심박수
                  </span>
                </div>
                <span className={`text-sm ${textColor}`}
                      style={{ fontFamily: "'Noto Serif KR', serif" }}>
                  {endingData.stats.finalBpm || 65} BPM
                </span>
              </motion.div>

              {/* ── 5종 스탯 바 차트 ── */}
              <motion.div
                className="pt-4 space-y-2.5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={revealTransition(0.8, 2.2)}
              >
                <p className={`text-[10px] tracking-[0.2em] uppercase mb-3 ${subtitleColor}`}>
                  FINAL STATUS
                </p>
                {[
                  { label: "친밀도", value: endingData.stats.intimacy, icon: "💬", color: "#60a5fa" },
                  { label: "호감도", value: endingData.stats.affection, icon: "💕", color: "#f472b6" },
                  { label: "의존도", value: endingData.stats.dependency, icon: "🫂", color: "#a78bfa" },
                  { label: "장난기", value: endingData.stats.playfulness, icon: "😜", color: "#34d399" },
                  { label: "신뢰도", value: endingData.stats.trust, icon: "🤝", color: "#fbbf24" },
                  // 시크릿 스탯 (null이면 렌더링 제외)
                  ...(endingData.stats.lust != null ? [
                    { label: "음란도", value: endingData.stats.lust, icon: "🔥", color: "#ef4444" },
                  ] : []),
                  ...(endingData.stats.corruption != null ? [
                    { label: "타락도", value: endingData.stats.corruption, icon: "🌑", color: "#8b5cf6" },
                  ] : []),
                  ...(endingData.stats.obsession != null ? [
                    { label: "집착도", value: endingData.stats.obsession, icon: "⛓️", color: "#ec4899" },
                  ] : []),
                ].map((stat, idx) => {
                  const pct = Math.min(100, Math.max(0, stat.value));
                  return (
                    <motion.div
                      key={stat.label}
                      className="flex items-center gap-2"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={revealTransition(0.5, 2.4 + idx * 0.15)}
                    >
                      <span className="text-xs w-4 text-center">{stat.icon}</span>
                      <span className={`text-[11px] w-12 ${subtitleColor}`}
                            style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
                        {stat.label}
                      </span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden"
                           style={{ background: `${stat.color}15` }}>
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: stat.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 1.2, delay: 2.6 + idx * 0.15, ease: "easeOut" }}
                        />
                      </div>
                      <span className={`text-[11px] w-8 text-right ${textColor}`}>
                        {stat.value}
                      </span>
                    </motion.div>
                  );
                })}
              </motion.div>
            </motion.div>
          </motion.div>
        )}

        {/* ═══ Phase 7: Acknowledgments ═══ */}
        {phase === PHASES.ACKNOWLEDGMENTS && (
        <motion.div
            key="ack"
            className="absolute inset-0 flex flex-col items-center pt-12 px-6 overflow-y-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={revealTransition(1.2)}
        >
            <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            >
            <Star className="w-5 h-5 mx-auto mb-2" style={{ color: accentColor }} />
            <h2 className={`text-lg tracking-[0.2em] font-bold ${textColor}`}
                style={{ fontFamily: "'Noto Serif KR', serif" }}>
                SPECIAL THANKS
            </h2>
            <p className={`text-[10px] mt-1 opacity-50 ${subtitleColor}`}>함께 이야기를 만들어준 고마운 사람들</p>
            </motion.div>

            <div className="w-full max-w-lg space-y-4 pb-32">
            {ACK_DATA.map((person, idx) => (
                <motion.div
                key={idx}
                className="rounded-xl p-5 border backdrop-blur-md"
                style={{
                    background: `linear-gradient(145deg, ${themeColor}, rgba(0,0,0,0.4))`,
                    borderColor: `${accentColor}15`,
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={revealTransition(0.8, 0.3 + idx * 0.2)}
                >
                <div className="flex items-baseline gap-2 mb-2">
                    <h4 className={`text-base font-bold ${textColor}`} style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
                    {person.name}
                    </h4>
                    <span className={`text-[10px] uppercase tracking-widest ${subtitleColor}`}>
                    [{person.role}]
                    </span>
                </div>
                <p className={`text-sm leading-relaxed opacity-90 ${subtitleColor}`}
                    style={{ fontFamily: "'Noto Sans KR', sans-serif", wordBreak: "keep-all" }}>
                    {person.comment}
                </p>
                </motion.div>
            ))}
            </div>
            
            {/* 하단 페이드 효과 (스크롤 대비) */}
            <div className="fixed bottom-0 left-0 right-0 h-32 pointer-events-none bg-gradient-to-t from-[#0a0a0f] to-transparent" />
        </motion.div>
        )}

        {/* ═══ Phase 7: Developer Comment ═══ */}
        {phase === PHASES.DEVELOPER && (
          <motion.div
            key="dev"
            className="absolute inset-0 flex flex-col items-center justify-center px-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={revealTransition(1.2)}
          >
            <motion.div
              className="max-w-sm text-center space-y-4"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={revealTransition(1.2, 0.5)}
            >
              <p className={`text-xs tracking-[0.2em] uppercase ${subtitleColor}`}>
                From the Developer
              </p>
              <div className="h-px w-12 mx-auto"
                   style={{ background: `linear-gradient(90deg, transparent, ${accentColor}40, transparent)` }} />
              <p className={`text-sm leading-relaxed ${subtitleColor}`}
                 style={{ fontFamily: "'Noto Sans KR', sans-serif", lineHeight: "1.8" }}>
                {isHappy
                  ? `당신의 선택 하나하나가 이 이야기를 완성했습니다. ${characterName}와(과) 함께한 이 여정이 당신에게도 특별한 기억으로 남기를.`
                  : `모든 이별에는 의미가 있습니다. 이 결말도 당신만의 이야기입니다. 다시 문을 열 용기가 생긴다면, ${characterName}은(는) 언제나 그 자리에 있을 거예요.`
                }
              </p>
              <p className={`text-xs mt-4 ${subtitleColor} opacity-60`}
                 style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
                Lucid Chat — AI Visual Novel
              </p>
            </motion.div>
          </motion.div>
        )}

        {/* ═══ Phase 8: Fin ═══ */}
        {phase === PHASES.FIN && (
          <motion.div
            key="fin"
            className="absolute inset-0 flex flex-col items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 2 }}
          >
            <motion.p
              className={`text-4xl sm:text-5xl italic ${textColor}`}
              style={{
                fontFamily: "'Noto Serif KR', serif",
                textShadow: `0 0 80px ${accentColor}30`,
                letterSpacing: "0.1em",
              }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 2, ease: "easeOut" }}
            >
              Fin.
            </motion.p>

            {/* 엔딩 제목 리마인드 */}
            <motion.p
              className={`text-xs mt-6 tracking-[0.15em] ${subtitleColor}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              transition={{ delay: 2, duration: 1.5 }}
            >
              {endingData.title}
            </motion.p>

            {/* 닫기 힌트 */}
            <motion.p
              className="text-white/15 text-xs mt-12 tracking-widest"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 3.5, duration: 1 }}
            >
              TAP TO CLOSE
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EndingCredits;