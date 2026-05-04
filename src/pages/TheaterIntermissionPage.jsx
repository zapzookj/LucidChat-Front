import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import {
  Coffee, Zap, Sparkles, ArrowRight
} from "lucide-react";
import {
  fetchIntermissionView,
  performIntermissionActivity,
  finishIntermission,
} from "../api/TheaterGamePlayApi";

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

/**
 * [Phase III · B-2] STAT_META — 정적 className으로 매핑
 * 기존: `from-${meta.color}-500 to-${meta.color}-400` 동적 합성 →
 *       Tailwind purge가 잡지 못해 실제로는 색이 적용되지 않는 버그
 *       (스탯 바가 무색으로 렌더되는 원인이었음)
 * 수정: 풀 클래스 문자열을 직접 매핑하여 빌드 시 추출 가능하게.
 */
const STAT_META = {
  CHARM:     { label: "매력",   icon: "✨", barClass: "from-pink-500 to-pink-400",     textClass: "text-pink-200",    pillClass: "bg-pink-500/20 border-pink-400/30 text-pink-200" },
  WIT:       { label: "입담",   icon: "💬", barClass: "from-cyan-500 to-cyan-400",     textClass: "text-cyan-200",    pillClass: "bg-cyan-500/20 border-cyan-400/30 text-cyan-200" },
  BOLDNESS:  { label: "담력",   icon: "🔥", barClass: "from-orange-500 to-orange-400", textClass: "text-orange-200",  pillClass: "bg-orange-500/20 border-orange-400/30 text-orange-200" },
  INTELLECT: { label: "지성",   icon: "📘", barClass: "from-indigo-500 to-indigo-400", textClass: "text-indigo-200",  pillClass: "bg-indigo-500/20 border-indigo-400/30 text-indigo-200" },
  EMPATHY:   { label: "감수성", icon: "🌸", barClass: "from-rose-500 to-rose-400",     textClass: "text-rose-200",    pillClass: "bg-rose-500/20 border-rose-400/30 text-rose-200" },
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
    <div className="min-h-screen bg-slate-950 relative overflow-hidden">
      {/*
        [Phase III · B-2] 배경 톤 재설계
         - 기존: amber-only ("카페")
         - 신규: violet (Theater 정체성) + emerald (휴식의 색) 하이브리드
                "영사기 꺼진 극장 로비"의 따뜻하지만 차분한 인상
      */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-950/40 via-slate-950 to-emerald-950/25" />
        {/* 별빛 입자 — Theater의 시그니처. 이번엔 emerald 톤도 섞어서 "휴식" 정체성 표현 */}
        {[...Array(28)].map((_, i) => {
          const tone = i % 3 === 0 ? "bg-emerald-300/45" : "bg-violet-200/45";
          return (
            <motion.div
              key={i}
              className={`absolute w-[2px] h-[2px] rounded-full ${tone}`}
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{ opacity: [0.1, 0.55, 0.1], scale: [0.5, 1.2, 0.5] }}
              transition={{ duration: 3 + Math.random() * 3, repeat: Infinity, delay: Math.random() * 5 }}
            />
          );
        })}
        {/* 하단 그림자 */}
        <div className="absolute bottom-0 inset-x-0 h-1/4 bg-gradient-to-t from-slate-950 to-transparent" />
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
          {/* [B-2] 헤더 — Theater 폼팩터에 맞게 정돈 (LobbyPage / TheaterPortalPage와 같은 시스템) */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-10"
          >
            <div className="inline-flex items-center gap-2 mb-3">
              <Coffee size={18} className="text-emerald-300/85" />
              <span className="text-[10px] uppercase tracking-[0.4em] text-emerald-200/60 font-medium">
                Intermission
              </span>
            </div>
            <h1
              className="text-3xl sm:text-4xl font-bold text-white tracking-wider"
              style={{ fontFamily: "'Pretendard', sans-serif" }}
            >
              잠시의 휴식
            </h1>
            <p className="text-xs sm:text-sm text-white/45 mt-2 tracking-wider">
              다음 막이 오르기 전, 주인공이 성장할 시간입니다
            </p>
          </motion.div>

          {/* 피로도 & 스탯 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
            {/* [B-2] 피로도 — 별 5개로 시각화 (감성 + 즉각 인지) */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-5 rounded-2xl bg-white/[0.04] border border-white/10"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5 text-sm text-white/75 font-bold">
                  <Sparkles size={14} className="text-emerald-300" />
                  <span>피로도</span>
                </div>
                <div className="text-xs text-white/45 font-mono tabular-nums">
                  {view.stamina} <span className="text-white/25">/ {view.maxStamina}</span>
                </div>
              </div>
              {/* 별 5개 게이지 */}
              <div className="flex items-center gap-2.5 py-1">
                {[...Array(view.maxStamina)].map((_, i) => {
                  const filled = i < view.stamina;
                  return (
                    <motion.div
                      key={i}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{
                        delay: 0.05 * i,
                        type: "spring",
                        stiffness: 280,
                        damping: 18,
                      }}
                      className="relative"
                    >
                      <Sparkles
                        size={22}
                        className={
                          filled
                            ? "text-emerald-300 drop-shadow-[0_0_6px_rgba(110,231,183,0.5)]"
                            : "text-white/15"
                        }
                        fill={filled ? "currentColor" : "none"}
                      />
                    </motion.div>
                  );
                })}
              </div>
              {view.stamina === 0 && (
                <div className="mt-3 text-xs text-amber-300/85 flex items-center gap-1.5 bg-amber-500/8 border border-amber-300/20 rounded-lg px-2.5 py-1.5">
                  <Zap size={11} />
                  <span>에너지 2개로 추가 활동 가능</span>
                </div>
              )}
            </motion.div>

            {/* 현재 스탯 */}
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-5 rounded-2xl bg-white/[0.04] border border-white/10"
            >
              <div className="flex items-center gap-1.5 text-sm text-white/75 font-bold mb-3">
                <TrendingUpIcon />
                <span>현재 스탯</span>
              </div>
              <div className="space-y-2">
                {Object.entries(view.currentStats || {}).map(([key, value]) => {
                  const meta = STAT_META[key] || {};
                  return (
                    <div key={key} className="flex items-center gap-2 text-xs">
                      <span className="w-4">{meta.icon}</span>
                      <span className="text-white/65 w-14 font-medium">{meta.label}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
                        <motion.div
                          className={`h-full bg-gradient-to-r ${meta.barClass || "from-white/30 to-white/30"}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${value}%` }}
                          transition={{ duration: 0.6, delay: 0.05 }}
                        />
                      </div>
                      <span className={`font-bold w-8 text-right tabular-nums ${meta.textClass || "text-white/70"}`}>
                        {value}
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>

          {/* 활동 카드 */}
          <div className="mb-8">
            <h3 className="text-sm font-bold text-white/75 mb-3 tracking-wide">
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

          {/* 종료 버튼 — mode-theater 그라디언트 통일 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex justify-center"
          >
            <motion.button
              onClick={handleFinish}
              disabled={finishing}
              whileTap={!finishing ? { scale: 0.96 } : {}}
              whileHover={!finishing ? { scale: 1.03 } : {}}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 hover:from-indigo-400 hover:via-violet-400 hover:to-purple-400 text-white font-bold shadow-xl shadow-violet-500/25 disabled:opacity-50 transition-colors"
            >
              {finishing ? "이동 중..." : (
                <>다음 막으로 <ArrowRight size={16} /></>
              )}
            </motion.button>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// 작은 헬퍼 — 스탯 헤더용 아이콘 (Sparkles와 구분되도록 별도 SVG)
const TrendingUpIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-violet-300">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </svg>
);

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
      className={`relative p-4 rounded-2xl border text-center transition-colors duration-200 overflow-hidden ${
        activity.special
          ? "bg-gradient-to-br from-amber-500/15 to-rose-500/15 border-amber-400/40 hover:border-amber-300/60"
          : "bg-white/[0.04] border-white/10 hover:border-violet-300/30"
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

      {/* [B-2] 대상 스탯 — 동적 클래스 합성 버그 수정 (정적 pillClass 사용) */}
      {statMeta && (
        <div
          className={`mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${statMeta.pillClass || "bg-white/10 border-white/20 text-white/70"}`}
        >
          <span>{statMeta.icon}</span>
          <span>{statMeta.label}</span>
        </div>
      )}

      {/* 비용 */}
      <div className="mt-2 text-[10px] text-white/45">
        {exhausted ? (
          <span className="text-amber-300 font-bold inline-flex items-center gap-0.5">
            <Zap size={9} className="inline" />
            에너지 {activity.extraEnergyCost}
          </span>
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