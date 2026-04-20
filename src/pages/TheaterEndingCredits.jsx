import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import {
  Crown, Heart, Star, Home, Film, Clock, Sparkles, Share2
} from "lucide-react";
import { triggerTheaterEnding } from "../api/TheaterFinalityApi";

/**
 * [Phase 5.5-Theater] 엔딩 크레딧 페이지
 *
 * 라우트: /theater/:roomId/ending
 *
 * 연출:
 *   1. 검은 화면에서 서서히 페이드 인
 *   2. 엔딩 씬 시퀀스 재생 (각 씬 5초, narration + dialogue)
 *   3. "ENDING REACHED" 타이틀 + 엔딩 타입 이름
 *   4. 메인 히로인 카드 + 최종 호감도
 *   5. 지배 스탯 + 플레이 통계
 *   6. 주요 기억 회상
 *   7. 크레딧 롤 (서버가 제공한 memoryHighlights)
 *   8. "로비로 돌아가기" 버튼
 */

const ENDING_THEMES = {
  HAPPY: { primary: "amber", emoji: "🌅", label: "해피 엔딩" },
  NEUTRAL: { primary: "slate", emoji: "🌫", label: "쓸쓸한 결말" },
  BAD: { primary: "red", emoji: "🌑", label: "엇갈린 결말" },
  INCOMPLETE: { primary: "indigo", emoji: "⋯", label: "미완의 이야기" },
};

const PHASES = {
  SCENES: "scenes",     // 엔딩 씬 시퀀스
  TITLE: "title",       // "FIN." + 엔딩 타입
  SUMMARY: "summary",   // 히로인/스탯/통계
  CREDITS: "credits",   // 크레딧 롤
  READY: "ready",       // 로비 버튼
};

export default function TheaterEndingCredits() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [ending, setEnding] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [phase, setPhase] = useState(PHASES.SCENES);
  const [sceneIndex, setSceneIndex] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const result = await triggerTheaterEnding(Number(roomId));
        if (alive) setEnding(result);
      } catch (e) {
        console.error("[Theater] Ending failed:", e);
        if (alive) setLoadError(e?.response?.data?.message || "엔딩을 불러오지 못했습니다.");
      }
    })();
    return () => { alive = false; };
  }, [roomId]);

  // ─── 씬 시퀀스 자동 재생 ───
  useEffect(() => {
    if (phase !== PHASES.SCENES || !ending) return;
    const scenes = ending.endingScenes || [];
    if (scenes.length === 0) {
      setPhase(PHASES.TITLE);
      return;
    }
    const timer = setTimeout(() => {
      if (sceneIndex < scenes.length - 1) {
        setSceneIndex((i) => i + 1);
      } else {
        setPhase(PHASES.TITLE);
      }
    }, 6000);
    return () => clearTimeout(timer);
  }, [phase, sceneIndex, ending]);

  // ─── 단계 자동 전환 ───
  useEffect(() => {
    if (phase === PHASES.TITLE) {
      const t = setTimeout(() => setPhase(PHASES.SUMMARY), 3500);
      return () => clearTimeout(t);
    }
    if (phase === PHASES.SUMMARY) {
      const t = setTimeout(() => setPhase(PHASES.CREDITS), 8000);
      return () => clearTimeout(t);
    }
    if (phase === PHASES.CREDITS) {
      const t = setTimeout(() => setPhase(PHASES.READY), 10000);
      return () => clearTimeout(t);
    }
  }, [phase]);

  if (loadError) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4 text-center">
        <p className="text-red-300 mb-4">{loadError}</p>
        <button onClick={() => navigate("/lobby")}
          className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/70">
          로비로
        </button>
      </div>
    );
  }

  if (!ending) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div className="w-10 h-10 border-2 border-white/40 border-t-white rounded-full"
          animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
      </div>
    );
  }

  const theme = ENDING_THEMES[ending.moodCategory] || ENDING_THEMES.HAPPY;
  const currentScene = ending.endingScenes?.[sceneIndex];

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* 별빛 배경 */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(50)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-[2px] h-[2px] bg-white/60 rounded-full"
            style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
            animate={{ opacity: [0.1, 0.8, 0.1], scale: [0.5, 1.5, 0.5] }}
            transition={{ duration: 3 + Math.random() * 3, repeat: Infinity, delay: Math.random() * 3 }}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* 엔딩 씬 재생 */}
        {phase === PHASES.SCENES && currentScene && (
          <motion.div
            key={`scene-${sceneIndex}`}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 1.0 }}
            className="absolute inset-0 flex items-center justify-center px-8"
          >
            <div className="max-w-2xl w-full text-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.8 }}
                className="text-white/90 text-xl leading-relaxed mb-6"
                style={{ fontFamily: "'Noto Serif KR', serif" }}
              >
                {currentScene.narration}
              </motion.div>
              {currentScene.dialogue && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: 1.5, duration: 1.0 }}
                  className="text-amber-200 text-lg italic"
                  style={{ fontFamily: "'Noto Serif KR', serif" }}
                >
                  "{currentScene.dialogue}"
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {/* 엔딩 타이틀 */}
        {phase === PHASES.TITLE && (
          <motion.div
            key="title"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }} transition={{ duration: 1.2 }}
            className="absolute inset-0 flex flex-col items-center justify-center"
          >
            <div className="text-7xl mb-4">{theme.emoji}</div>
            <div className="text-[10px] uppercase tracking-[0.5em] text-white/40 mb-2">
              {theme.label}
            </div>
            <h1
              className="text-6xl font-black text-white mb-2"
              style={{ fontFamily: "'Noto Serif KR', serif", letterSpacing: "0.08em" }}
            >
              FIN.
            </h1>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.8 }}
              className={`text-2xl font-bold mt-4 text-${theme.primary}-300`}
              style={{ fontFamily: "'Noto Serif KR', serif" }}
            >
              {ending.title}
            </motion.div>
          </motion.div>
        )}

        {/* 요약 */}
        {phase === PHASES.SUMMARY && (
          <motion.div
            key="summary"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.8 }}
            className="absolute inset-0 flex items-center justify-center px-6"
          >
            <div className="max-w-xl w-full">
              {/* 메인 히로인 */}
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className={`p-6 rounded-3xl bg-gradient-to-br from-${theme.primary}-500/10 to-${theme.primary}-500/5 border border-${theme.primary}-400/30 mb-6`}
              >
                <div className="text-center mb-4">
                  <Crown size={20} className={`mx-auto text-${theme.primary}-300 mb-2`} />
                  <div className="text-[10px] uppercase tracking-widest text-white/50 mb-2">
                    당신이 선택한 이야기
                  </div>
                  <h2 className="text-3xl font-bold text-white"
                      style={{ fontFamily: "'Noto Serif KR', serif" }}>
                    {ending.mainHeroineName}
                  </h2>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <Heart size={12} className="text-rose-400" fill="currentColor" />
                    <span className="text-rose-200 font-bold">
                      호감도 {ending.mainHeroineAffection}
                    </span>
                  </div>
                </div>

                {ending.closingQuote && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: 0.6, duration: 1.0 }}
                    className="text-center italic text-white/80 text-lg leading-relaxed mt-4"
                    style={{ fontFamily: "'Noto Serif KR', serif" }}
                  >
                    "{ending.closingQuote}"
                  </motion.div>
                )}
              </motion.div>

              {/* 지배 스탯 + 통계 */}
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="grid grid-cols-4 gap-2"
              >
                <StatCell icon={<Star size={14} />}
                  label="지배 스탯" value={`${ending.dominantStat} ${ending.dominantStatValue}`} />
                <StatCell icon={<Film size={14} />}
                  label="감상 씬" value={`${ending.stats?.totalScenes || 0}`} />
                <StatCell icon={<Sparkles size={14} />}
                  label="선택" value={`${ending.stats?.totalBranchChoices || 0}`} />
                <StatCell icon={<Clock size={14} />}
                  label="시간" value={`${ending.stats?.totalPlayMinutes || 0}분`} />
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* 크레딧 롤 */}
        {phase === PHASES.CREDITS && (
          <motion.div
            key="credits"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="relative w-full max-w-xl px-8 overflow-hidden">
              <motion.div
                animate={{ y: [50, -500] }}
                transition={{ duration: 9, ease: "linear" }}
                className="space-y-6 text-center"
              >
                <div className="text-xs uppercase tracking-[0.5em] text-white/40 mb-6">
                  Memory Highlights
                </div>
                {(ending.memoryHighlights || []).map((m, i) => (
                  <div key={i}
                    className="text-white/70 italic leading-relaxed"
                    style={{ fontFamily: "'Noto Serif KR', serif" }}>
                    {m}
                  </div>
                ))}
                <div className="pt-10 text-white/30 text-xs uppercase tracking-widest">
                  — Lucid Chat Theater —
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* 로비 버튼 */}
        {phase === PHASES.READY && (
          <motion.div
            key="ready"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-4"
          >
            <Crown size={32} className={`text-${theme.primary}-300 mb-2`} />
            <h2
              className="text-2xl font-bold text-white mb-4"
              style={{ fontFamily: "'Noto Serif KR', serif" }}
            >
              {ending.title}
            </h2>
            <motion.button
              onClick={() => navigate("/lobby")}
              whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.03 }}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 border border-white/20 text-white font-bold backdrop-blur-md hover:bg-white/20"
            >
              <Home size={16} /> 로비로 돌아가기
            </motion.button>
            <button
              onClick={() => { /* TODO: 공유 기능 */ }}
              className="text-white/40 text-xs hover:text-white/60 flex items-center gap-1 mt-2"
            >
              <Share2 size={11} /> 이야기 공유
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCell({ icon, label, value }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/10 p-3 text-center">
      <div className="flex justify-center text-white/40 mb-1">{icon}</div>
      <div className="text-xs font-bold text-white">{value}</div>
      <div className="text-[10px] text-white/30 mt-0.5">{label}</div>
    </div>
  );
}