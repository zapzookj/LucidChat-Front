import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import {
  Coffee, Zap, Crown, Sparkles, ArrowRight, X, Heart
} from "lucide-react";
import {
  fetchIntermissionView,
  performIntermissionActivity,
  finishIntermission,
} from "../api/TheaterGameplayApi";

/**
 * [Phase 5.5-Theater] 인터미션 페이지
 *
 * 라우트: /theater/:roomId/intermission
 *
 * [연출]
 *  1. "Intermission" 타이틀 페이드인
 *  2. 피로도 게이지 + 현재 스탯 표시
 *  3. 5개 활동 카드 그리드
 *  4. 카드 클릭 → 전체 화면 활동 애니메이션 → 주사위 연출 → 결과
 *  5. 피로도 소진 시 에너지 사용 프롬프트 or 종료 버튼
 */

const STAT_META = {
  CHARM: { label: "매력", icon: "✨", color: "pink" },
  WIT: { label: "입담", icon: "💬", color: "cyan" },
  BOLDNESS: { label: "담력", icon: "🔥", color: "orange" },
  INTELLECT: { label: "지성", icon: "📘", color: "indigo" },
  EMPATHY: { label: "감수성", icon: "🌸", color: "rose" },
};

const OUTCOME_CONFIG = {
  GREAT_SUCCESS: {
    label: "대성공!",
    emoji: "💥",
    color: "from-amber-400 to-orange-400",
    textColor: "text-amber-300",
  },
  SUCCESS: {
    label: "성공",
    emoji: "✨",
    color: "from-cyan-400 to-blue-400",
    textColor: "text-cyan-300",
  },
  FAIL: {
    label: "실패",
    emoji: "😑",
    color: "from-gray-500 to-gray-600",
    textColor: "text-gray-400",
  },
};

export default function TheaterIntermissionPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [view, setView] = useState(null);
  const [loading, setLoading] = useState(true);
  const [performingActivity, setPerformingActivity] = useState(null);
  const [activityResult, setActivityResult] = useState(null);
  const [rollPhase, setRollPhase] = useState(null); // "rolling" | "revealed"
  const [finishing, setFinishing] = useState(false);

  // ─── 초기 로드 ───
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const v = await fetchIntermissionView(Number(roomId));
        if (alive) setView(v);
      } catch (e) {
        console.error("[Theater] Intermission view failed:", e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [roomId]);

  // ─── 활동 수행 ───
  const handleActivity = async (activity, useExtraEnergy = false) => {
    setPerformingActivity(activity);
    setRollPhase("rolling");
    setActivityResult(null);

    // 연출 지연 (주사위 굴리는 느낌)
    await new Promise((r) => setTimeout(r, 1200));

    try {
      const result = await performIntermissionActivity(Number(roomId), {
        activityId: activity.id,
        useExtraEnergy,
      });
      setActivityResult(result);
      setRollPhase("revealed");

      // 결과 보여주고 1.8초 후 자동 복귀
      setTimeout(async () => {
        // 뷰 재조회 (스탯/피로도 반영)
        try {
          const v = await fetchIntermissionView(Number(roomId));
          setView(v);
        } catch {}
        setPerformingActivity(null);
        setActivityResult(null);
        setRollPhase(null);
      }, 2400);
    } catch (e) {
      console.error("[Theater] Activity failed:", e);
      setPerformingActivity(null);
      setRollPhase(null);
    }
  };

  // ─── 인터미션 종료 ───
  const handleFinish = async () => {
    setFinishing(true);
    try {
      await finishIntermission(Number(roomId));
      navigate(`/theater/${roomId}`);
    } catch (e) {
      console.error("[Theater] Finish failed:", e);
      setFinishing(false);
    }
  };

  // ─── 렌더링 ───
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <motion.div
          className="w-10 h-10 border-2 border-amber-400/40 border-t-amber-400 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </div>
    );
  }

  if (!view) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center p-4">
        <p className="text-red-300 mb-4">인터미션 정보를 불러오지 못했습니다.</p>
        <button
          onClick={() => navigate(`/theater/${roomId}`)}
          className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/70"
        >
          되돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-950/30 via-slate-950 to-slate-950 relative overflow-hidden">
      {/* 배경 — 카페 무드 */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-[3px] h-[3px] bg-amber-300/40 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{ opacity: [0.1, 0.6, 0.1], scale: [0.5, 1.2, 0.5] }}
            transition={{ duration: 3 + Math.random() * 3, repeat: Infinity, delay: Math.random() * 5 }}
          />
        ))}
      </div>

      {/* ═══ 활동 오버레이 ═══ */}
      <AnimatePresence>
        {performingActivity && (
          <ActivityOverlay
            activity={performingActivity}
            rollPhase={rollPhase}
            result={activityResult}
          />
        )}
      </AnimatePresence>

      {/* ═══ 메인 컨텐츠 ═══ */}
      {!performingActivity && (
        <div className="relative z-10 max-w-4xl mx-auto px-6 py-10">
          {/* 헤더 */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-10"
          >
            <Coffee size={32} className="mx-auto text-amber-300/80 mb-3" />
            <div className="text-xs uppercase tracking-[0.4em] text-amber-300/60 mb-2">
              Intermission
            </div>
            <h1
              className="text-3xl font-bold text-white"
              style={{ fontFamily: "'Noto Serif KR', serif" }}
            >
              잠시의 휴식
            </h1>
            <p className="text-sm text-white/50 mt-2">
              다음 막이 오르기 전, 주인공이 성장할 시간입니다.
            </p>
          </motion.div>

          {/* 피로도 & 스탯 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
            {/* 피로도 */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-5 rounded-2xl bg-white/[0.04] border border-white/10"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-white/70 font-bold">피로도</div>
                <div className="text-xs text-white/40">{view.stamina} / {view.maxStamina}</div>
              </div>
              <div className="flex gap-1.5">
                {[...Array(view.maxStamina)].map((_, i) => (
                  <motion.div
                    key={i}
                    className={`flex-1 h-2 rounded-full ${
                      i < view.stamina
                        ? "bg-gradient-to-r from-emerald-400 to-teal-400"
                        : "bg-white/5"
                    }`}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.1 * i, duration: 0.4 }}
                  />
                ))}
              </div>
              {view.stamina === 0 && (
                <div className="mt-3 text-xs text-amber-300/80 flex items-center gap-1">
                  <Zap size={11} /> 에너지 2개로 추가 활동 가능
                </div>
              )}
            </motion.div>

            {/* 현재 스탯 */}
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-5 rounded-2xl bg-white/[0.04] border border-white/10"
            >
              <div className="text-sm text-white/70 font-bold mb-3">현재 스탯</div>
              <div className="space-y-1.5">
                {Object.entries(view.currentStats || {}).map(([key, value]) => {
                  const meta = STAT_META[key] || {};
                  return (
                    <div key={key} className="flex items-center gap-2 text-xs">
                      <span className="w-4">{meta.icon}</span>
                      <span className="text-white/60 w-14">{meta.label}</span>
                      <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                        <motion.div
                          className={`h-full bg-gradient-to-r from-${meta.color}-500 to-${meta.color}-400`}
                          initial={{ width: 0 }}
                          animate={{ width: `${value}%` }}
                          transition={{ duration: 0.6 }}
                        />
                      </div>
                      <span className="text-white/70 font-bold w-8 text-right">{value}</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>

          {/* 활동 카드 */}
          <div className="mb-8">
            <h3 className="text-sm font-bold text-white/70 mb-3">
              {view.stamina > 0 ? "무엇을 할까?" : "피로도가 바닥났습니다"}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {view.activities?.map((activity, i) => (
                <ActivityCard
                  key={activity.id + i}
                  activity={activity}
                  stamina={view.stamina}
                  onSelect={(useExtra) => handleActivity(activity, useExtra)}
                />
              ))}
            </div>
          </div>

          {/* 종료 버튼 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex justify-center"
          >
            <button
              onClick={handleFinish}
              disabled={finishing}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold shadow-xl disabled:opacity-50"
            >
              {finishing ? "이동 중..." : (
                <>다음 막으로 <ArrowRight size={16} /></>
              )}
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  활동 카드
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ActivityCard({ activity, stamina, onSelect }) {
  const exhausted = stamina === 0;
  const needsExtra = exhausted;

  const statMeta = activity.targetStat ? STAT_META[activity.targetStat] : null;

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      whileHover={{ scale: 1.03, y: -2 }}
      onClick={() => onSelect(needsExtra)}
      className={`relative p-4 rounded-2xl border text-center transition-all overflow-hidden ${
        activity.special
          ? "bg-gradient-to-br from-amber-500/15 to-rose-500/15 border-amber-400/40"
          : "bg-white/[0.04] border-white/10 hover:border-white/20"
      } cursor-pointer`}
    >
      {activity.special && (
        <div className="absolute top-2 right-2">
          <Sparkles size={12} className="text-amber-300" />
        </div>
      )}

      <div className="text-3xl mb-2">{activity.icon}</div>
      <div className="text-sm font-bold text-white mb-1">{activity.title}</div>
      <div className="text-[10px] text-white/50 leading-tight line-clamp-2 min-h-[26px]">
        {activity.description}
      </div>

      {/* 대상 스탯 */}
      {statMeta && (
        <div
          className={`mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-${statMeta.color}-500/20 border border-${statMeta.color}-400/30 text-[10px] text-${statMeta.color}-200 font-bold`}
        >
          {statMeta.icon} {statMeta.label}
        </div>
      )}

      {/* 비용 */}
      <div className="mt-2 text-[10px] text-white/40">
        {exhausted ? (
          <span className="text-amber-300 font-bold">⚡ 에너지 {activity.extraEnergyCost}</span>
        ) : (
          <span>피로도 {activity.staminaCost}</span>
        )}
      </div>
    </motion.button>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  활동 오버레이
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ActivityOverlay({ activity, rollPhase, result }) {
  const outcome = result?.outcome;
  const config = outcome ? OUTCOME_CONFIG[outcome] : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center text-center px-6"
    >
      {/* 활동 아이콘 애니메이션 */}
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{
          scale: rollPhase === "revealed" ? [1, 1.2, 1] : 1,
          rotate: rollPhase === "rolling" ? [0, 10, -10, 0] : 0,
        }}
        transition={{
          scale: { duration: 0.4 },
          rotate: rollPhase === "rolling" ? { duration: 0.5, repeat: Infinity } : {},
        }}
        className="text-8xl mb-6"
      >
        {activity.icon}
      </motion.div>

      <div className="text-sm text-white/60 mb-2">{activity.title}</div>

      <AnimatePresence mode="wait">
        {rollPhase === "rolling" && (
          <motion.div
            key="rolling"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* 주사위 */}
            <motion.div
              className="w-16 h-16 mx-auto bg-white/10 rounded-xl flex items-center justify-center text-4xl mb-4"
              animate={{ rotate: [0, 90, 180, 270, 360] }}
              transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
            >
              🎲
            </motion.div>
            <div className="text-sm text-white/50">결과를 기다리는 중...</div>
          </motion.div>
        )}

        {rollPhase === "revealed" && config && (
          <motion.div
            key="revealed"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.3, 1] }}
              transition={{ duration: 0.6 }}
              className="text-6xl mb-3"
            >
              {config.emoji}
            </motion.div>
            <h2
              className={`text-4xl font-black mb-3 bg-gradient-to-r ${config.color} bg-clip-text text-transparent`}
              style={{ fontFamily: "'Noto Serif KR', serif" }}
            >
              {config.label}
            </h2>
            <div className="text-white/80 text-lg">{result?.narrationLine}</div>
            {result?.statDelta > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className={`mt-3 text-xl font-bold ${config.textColor}`}
              >
                +{result.statDelta}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}