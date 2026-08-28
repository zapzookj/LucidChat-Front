import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import {
  Crown, Heart, Star, Home, Film, Clock, Sparkles, Share2
} from "lucide-react";
import { triggerTheaterEnding, fetchTheaterEnding } from "../api/TheaterFinalityApi";
import { sfx } from "../utils/sfx";

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

/**
 * [Phase III · B-3] ENDING_THEMES — 정적 className 매핑
 * 기존: `text-${theme.primary}-300` 동적 합성 → Tailwind purge 미잡음 (엔딩 색상 누락)
 * 수정: 풀 클래스 문자열을 직접 매핑.
 *
 * 또한 Dialogue 모드의 EndingCredits와 동일한 시그니처 톤(Noto Serif KR, FIN. 타이포)
 * 을 그대로 유지하되, 모드별 정체성은 카드/버튼의 액센트 색상으로 차별화.
 */
const ENDING_THEMES = {
  HAPPY: {
    label: "해피 엔딩",
    emoji: "🌅",
    accentText: "text-amber-300",
    accentText2: "text-amber-200",
    cardGradient: "from-amber-500/12 to-amber-500/5",
    cardBorder: "border-amber-400/35",
    glowColor: "rgba(251,191,36,0.45)",
  },
  NEUTRAL: {
    label: "쓸쓸한 결말",
    emoji: "🌫",
    accentText: "text-slate-300",
    accentText2: "text-slate-200",
    cardGradient: "from-slate-500/12 to-slate-500/5",
    cardBorder: "border-slate-400/35",
    glowColor: "rgba(148,163,184,0.4)",
  },
  BAD: {
    label: "엇갈린 결말",
    emoji: "🌑",
    accentText: "text-red-300",
    accentText2: "text-red-200",
    cardGradient: "from-red-500/12 to-red-500/5",
    cardBorder: "border-red-400/35",
    glowColor: "rgba(248,113,113,0.4)",
  },
  INCOMPLETE: {
    label: "미완의 이야기",
    emoji: "⋯",
    accentText: "text-indigo-300",
    accentText2: "text-indigo-200",
    cardGradient: "from-indigo-500/12 to-indigo-500/5",
    cardBorder: "border-indigo-400/35",
    glowColor: "rgba(129,140,248,0.4)",
  },
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

  // ─── [D-11] 엔딩 생성 진행 상태 ───
  //   generating=true 구간이 LLM 20~60초다. 이 구간에 아무 문구도 없는 스피너만 돌아서
  //   유저가 "멈췄나?" 하고 새로고침 → POST 재발동 → D-10 동시 발동 경합이 실제로 발생했다.
  //   즉 D-11(UX)은 D-10(경합)의 트리거다. 서버 락과 별개로 여기서도 원인을 없앤다.
  const [generating, setGenerating] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  //   [D-11] 진행 중 POST 가드 — "이 방에 대해 이미 요청을 보냈는가"를 ref에 남긴다.
  //   ⚠️ 기존의 `let alive` + cleanup 패턴을 여기서 쓰면 안 된다. StrictMode(dev)는 이펙트를
  //      mount→cleanup→mount로 두 번 돌리는데, 그러면 1회차의 alive가 false가 되어 응답이 와도
  //      setEnding이 스킵되고 스피너가 영원히 돈다. roomId 기준 ref 가드는 두 번째 실행만
  //      조용히 건너뛰고 1회차 응답을 그대로 반영한다.
  //   (탭 안 중복만 막는다. 새로고침으로 넘어오는 중복 POST는 서버측 비관적 락이 막는다 — D-10.)
  const requestedRoomRef = useRef(null);

  useEffect(() => {
    sfx.wooshDeep();
    if (requestedRoomRef.current === roomId) return;
    requestedRoomRef.current = roomId;

    (async () => {
      try {
        // [블록 D · 극장 엔딩 부활] 저장된 엔딩 우선 — 없을 때만 발동(POST).
        //   기존에는 진입할 때마다 발동 API를 재호출해서 "엔딩 다시 보기"가 항상 400이었다.
        const saved = await fetchTheaterEnding(Number(roomId));
        let result = saved;
        if (!result) {
          setGenerating(true);   // [D-11] 여기부터가 LLM 대기 구간 (20~60초)
          result = await triggerTheaterEnding(Number(roomId));
        }
        setEnding(result);
      } catch (e) {
        console.error("[Theater] Ending failed:", e);
        setLoadError(e?.response?.data?.message || "엔딩을 불러오지 못했습니다.");
      } finally {
        setGenerating(false);
      }
    })();
  }, [roomId]);

  // [D-11] 경과 시간 카운터 — "얼마나 더?"에 답이 없는 것이 새로고침을 부른다.
  useEffect(() => {
    if (!generating) return;
    setElapsedSec(0);
    const t = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [generating]);

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
      sfx.boom();
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
        <button onClick={() => navigate("/")}
          className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition-colors">
          로비로
        </button>
      </div>
    );
  }

  if (!ending) {
    // [D-11 · docs/19_assets/blockd_regressions.md] 텍스트 없는 스피너가 20~60초 떠 있는 것이
    //   "멈춘 줄 알고 새로고침" → POST 재발동 → D-10 동시 발동 경합의 실제 유발 원인이었다.
    //   무엇을 기다리는지 / 얼마나 걸리는지 / 새로고침하지 말라는 것 — 세 가지를 명시한다.
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center">
        <motion.div className="w-10 h-10 border-2 border-white/40 border-t-white rounded-full"
          animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />

        {generating ? (
          <motion.div
            className="mt-7 max-w-sm"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <p className="text-white/85 text-[15px] font-medium tracking-tight">
              엔딩을 쓰는 중입니다
            </p>
            <p className="mt-1.5 text-white/45 text-[13px] leading-relaxed">
              당신이 지나온 선택들을 모아 마지막 장면을 만들고 있어요.
              <br />
              최대 1분 정도 걸립니다.
            </p>
            <p className="mt-4 text-white/30 text-[12px]">
              창을 닫거나 새로고침하지 말아 주세요 · {elapsedSec}초
            </p>
          </motion.div>
        ) : (
          <p className="mt-7 text-white/45 text-[13px]">엔딩을 불러오는 중…</p>
        )}
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
              style={{
                fontFamily: "'Noto Serif KR', serif",
                letterSpacing: "0.08em",
                textShadow: `0 0 40px ${theme.glowColor}`,
              }}
            >
              FIN.
            </h1>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.8 }}
              className={`text-2xl font-bold mt-4 ${theme.accentText}`}
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
                className={`p-6 rounded-3xl bg-gradient-to-br ${theme.cardGradient} border ${theme.cardBorder} mb-6`}
              >
                <div className="text-center mb-4">
                  <Crown size={20} className={`mx-auto ${theme.accentText} mb-2`} />
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
                    className="text-center italic text-white/85 text-lg leading-relaxed mt-4"
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
            <Crown size={32} className={`${theme.accentText} mb-2`} />
            <h2
              className="text-2xl font-bold text-white mb-4"
              style={{ fontFamily: "'Noto Serif KR', serif" }}
            >
              {ending.title}
            </h2>
            <motion.button
              onClick={() => { sfx.click(); navigate("/"); }}
              whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.03 }}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 border border-white/20 text-white font-bold backdrop-blur-md hover:bg-white/15 transition-colors"
            >
              <Home size={16} /> 로비로 돌아가기
            </motion.button>
            <button
              onClick={() => { /* TODO: 공유 기능 (Phase IV) */ }}
              className="text-white/45 text-xs hover:text-white/70 flex items-center gap-1 mt-2 transition-colors"
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