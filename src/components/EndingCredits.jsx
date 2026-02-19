import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Sparkles, MessageSquare, Calendar, Star, Clock } from "lucide-react";

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
// ═══════════════════════════════════════════════════════════════

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

// ─── 타자기 효과 ───
const TypeWriter = ({ text, speed = 45, onComplete, className = "" }) => {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!text) { setDone(true); onComplete?.(); return; }
    setDisplayed("");
    setDone(false);
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(timer);
        setDone(true);
        setTimeout(() => onComplete?.(), 600);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text]);

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
  DEVELOPER: "DEVELOPER",
  FIN: "FIN",
};

const EndingCredits = ({ endingData, onComplete, onSceneChange }) => {
  const [phase, setPhase] = useState(PHASES.FADE_IN);
  const [epilogueIndex, setEpilogueIndex] = useState(0);
  const [epilogueTypeDone, setEpilogueTypeDone] = useState(false);
  const [memoryIndex, setMemoryIndex] = useState(0);
  const [showMemories, setShowMemories] = useState(false);

  const isHappy = endingData.endingType === "HAPPY";
  const scenes = endingData.epilogueScenes || [];
  const memories = endingData.memories || [];

  // ── 자동 진행 타이머 ──

  // Phase 1: Fade In → Epilogue
  useEffect(() => {
    if (phase === PHASES.FADE_IN) {
      const t = setTimeout(() => setPhase(PHASES.EPILOGUE), 2500);
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

  // 에필로그 자동 다음 씬 (대사 완료 후 2.5초)
  useEffect(() => {
    if (phase !== PHASES.EPILOGUE || !epilogueTypeDone) return;

    const t = setTimeout(() => {
      if (epilogueIndex < scenes.length - 1) {
        setEpilogueIndex(prev => prev + 1);
        setEpilogueTypeDone(false);
      } else {
        // 에필로그 종료 → 타이틀 카드
        setPhase(PHASES.TITLE_CARD);
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [phase, epilogueTypeDone, epilogueIndex, scenes.length]);

  // 타이틀 카드 → 인용문
  useEffect(() => {
    if (phase === PHASES.TITLE_CARD) {
      const t = setTimeout(() => setPhase(PHASES.QUOTE), 5500);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // 인용문 → 추억
  useEffect(() => {
    if (phase === PHASES.QUOTE) {
      const t = setTimeout(() => setPhase(PHASES.MEMORIES), 5000);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // 추억 자동 스크롤
  useEffect(() => {
    if (phase !== PHASES.MEMORIES) return;
    setShowMemories(true);

    if (memories.length === 0) {
      const t = setTimeout(() => setPhase(PHASES.STATS), 3000);
      return () => clearTimeout(t);
    }

    // 각 추억 0.8초 간격으로 표시
    const timers = [];
    memories.forEach((_, idx) => {
      timers.push(setTimeout(() => setMemoryIndex(idx + 1), (idx + 1) * 1200));
    });
    // 전체 표시 후 3초 대기 → Stats
    timers.push(setTimeout(() => setPhase(PHASES.STATS), memories.length * 1200 + 3500));

    return () => timers.forEach(clearTimeout);
  }, [phase, memories.length]);

  // Stats → Developer
  useEffect(() => {
    if (phase === PHASES.STATS) {
      const t = setTimeout(() => setPhase(PHASES.DEVELOPER), 6000);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // Developer → Fin
  useEffect(() => {
    if (phase === PHASES.DEVELOPER) {
      const t = setTimeout(() => setPhase(PHASES.FIN), 7000);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // ── 스킵 (터치/클릭) ──
  const handleSkip = useCallback(() => {
    const order = Object.values(PHASES);
    const currentIdx = order.indexOf(phase);
    if (phase === PHASES.EPILOGUE) {
      // 에필로그 중에는 다음 씬으로 빨리감기
      if (!epilogueTypeDone) {
        setEpilogueTypeDone(true);
      } else if (epilogueIndex < scenes.length - 1) {
        setEpilogueIndex(prev => prev + 1);
        setEpilogueTypeDone(false);
      } else {
        setPhase(PHASES.TITLE_CARD);
      }
      return;
    }
    if (phase === PHASES.FIN) {
      onComplete?.();
      return;
    }
    // 다른 페이즈에서는 다음 단계로
    if (currentIdx < order.length - 1) {
      setPhase(order[currentIdx + 1]);
    }
  }, [phase, epilogueIndex, epilogueTypeDone, scenes.length, onComplete]);

  // ── 스타일 ──
  const themeColor = isHappy ? "rgba(255, 182, 193, 0.15)" : "rgba(100, 120, 140, 0.15)";
  const accentColor = isHappy ? "#f9a8c9" : "#8ca0b3";
  const textColor = isHappy ? "text-rose-100" : "text-slate-300";
  const subtitleColor = isHappy ? "text-rose-300/80" : "text-slate-400/80";

  const currentScene = scenes[epilogueIndex];

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
        {phase === PHASES.EPILOGUE && currentScene && (
          <motion.div
            key={`epi-${epilogueIndex}`}
            className="absolute inset-0 flex flex-col justify-end items-center pb-24 px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* 나레이션 (상단) */}
            {currentScene.narration && (
              <motion.div
                className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[85%] max-w-lg"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1 }}
              >
                <p className={`text-sm leading-relaxed text-center italic ${subtitleColor}`}
                   style={{ fontFamily: "'Noto Serif KR', serif", letterSpacing: "0.02em" }}>
                  {currentScene.narration}
                </p>
              </motion.div>
            )}

            {/* 대사 (하단) */}
            <div className="w-full max-w-lg">
              <div
                className="rounded-2xl px-6 py-5 backdrop-blur-xl border"
                style={{
                  background: `linear-gradient(135deg, ${themeColor}, rgba(0,0,0,0.6))`,
                  borderColor: `${accentColor}33`,
                  boxShadow: `0 0 40px ${accentColor}15`,
                }}
              >
                {/* 캐릭터 이름 */}
                <div className={`text-xs tracking-[0.2em] mb-2 ${subtitleColor}`}
                     style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
                  아이리
                </div>
                {/* 대사 (타자기) */}
                <div className={`text-base leading-relaxed ${textColor}`}
                     style={{ fontFamily: "'Noto Serif KR', serif", minHeight: "3rem" }}>
                  <TypeWriter
                    text={currentScene.dialogue}
                    speed={50}
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
            transition={{ duration: 1.5 }}
          >
            {/* 엔딩 타입 레이블 */}
            <motion.div
              className={`text-xs tracking-[0.4em] uppercase mb-6 ${subtitleColor}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 1 }}
              style={{ fontFamily: "'Noto Sans KR', sans-serif" }}
            >
              {isHappy ? "— HAPPY ENDING —" : "— BAD ENDING —"}
            </motion.div>

            {/* 엔딩 제목 */}
            <motion.h1
              className={`text-3xl sm:text-4xl md:text-5xl font-bold text-center leading-tight ${textColor}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1, duration: 1.5, ease: "easeOut" }}
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
              transition={{ delay: 2, duration: 1.5 }}
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
            transition={{ duration: 1.2 }}
          >
            <motion.div
              className="max-w-md text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 1.5 }}
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
                — 아이리
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
            transition={{ duration: 1 }}
          >
            {/* 섹션 타이틀 */}
            <motion.div
              className="text-center mb-8"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
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
                    transition={{ duration: 0.8 }}
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

        {/* ═══ Phase 6: Stats ═══ */}
        {phase === PHASES.STATS && endingData.stats && (
          <motion.div
            key="stats"
            className="absolute inset-0 flex flex-col items-center justify-center px-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
          >
            <motion.div className="w-full max-w-xs space-y-5">
              {/* 타이틀 */}
              <motion.h3
                className={`text-center text-sm tracking-[0.15em] mb-6 ${subtitleColor}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                PLAY RECORD
              </motion.h3>

              {/* 스탯 아이템들 */}
              {[
                { icon: MessageSquare, label: "나눈 대화", value: `${endingData.stats.totalMessages}회` },
                { icon: Calendar, label: "함께한 시간", value: `${endingData.stats.totalDays}일` },
                { icon: Heart, label: "최종 호감도", value: `${endingData.stats.finalAffection}` },
                { icon: Star, label: "최종 관계", value: endingData.stats.finalRelation },
                { icon: Clock, label: "첫 만남", value: endingData.stats.firstMessageDate },
              ].map((stat, idx) => (
                <motion.div
                  key={idx}
                  className="flex items-center gap-4"
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + idx * 0.4, duration: 0.6 }}
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
            </motion.div>
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
            transition={{ duration: 1.2 }}
          >
            <motion.div
              className="max-w-sm text-center space-y-4"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 1.2 }}
            >
              <p className={`text-xs tracking-[0.2em] uppercase ${subtitleColor}`}>
                From the Developer
              </p>
              <div className="h-px w-12 mx-auto"
                   style={{ background: `linear-gradient(90deg, transparent, ${accentColor}40, transparent)` }} />
              <p className={`text-sm leading-relaxed ${subtitleColor}`}
                 style={{ fontFamily: "'Noto Sans KR', sans-serif", lineHeight: "1.8" }}>
                {isHappy
                  ? "당신의 선택 하나하나가 이 이야기를 완성했습니다. 아이리와 함께한 이 여정이 당신에게도 특별한 기억으로 남기를."
                  : "모든 이별에는 의미가 있습니다. 이 결말도 당신만의 이야기입니다. 다시 문을 열 용기가 생긴다면, 아이리는 언제나 그 자리에 있을 거예요."
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