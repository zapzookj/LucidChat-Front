import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, Crown, Sparkles, ChevronRight, Zap, Film, Star, TrendingUp
} from "lucide-react";

/**
 * [Phase 5.5-Theater] Chapter 종료 리포트 모달
 *
 * 연출 흐름:
 *   1. "Chapter N FIN." 타이포 페이드인 (1초)
 *   2. 배경 전환 (별이 빛나는 밤하늘 느낌)
 *   3. "이번 이야기" 타이틀
 *   4. 각 히로인 카드 순차 등장 — 호감도 바 애니메이션
 *   5. 리드 히로인 강조 + 역전 이펙트
 *   6. 배지 표시 (Act 전환, 인터미션 등)
 *   7. 요약 통계
 *   8. 다음 Chapter 버튼
 */

const PHASES = {
  INTRO: "intro",        // "Chapter N FIN." 연출
  HEROINES: "heroines",  // 히로인 카드 순차
  BADGES: "badges",      // 배지 + 통계
  READY: "ready",        // 다음 버튼 노출
};

export default function TheaterChapterReportModal({
  report,
  onClose,
  currentAct = 1,           // [v2] 현재 Act (닫기 이후 기준)
  actTotalChapters = 5,     // [v2] 이 Act의 총 Chapter 수 (미정이면 5 기본)
}) {
  const [phase, setPhase] = useState(PHASES.INTRO);

  // 연출 시퀀스
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(PHASES.HEROINES), 1600);
    const t2 = setTimeout(
      () => setPhase(PHASES.BADGES),
      1600 + (report.heroines?.length || 0) * 1000 + 500
    );
    const t3 = setTimeout(
      () => setPhase(PHASES.READY),
      1600 + (report.heroines?.length || 0) * 1000 + 500 + 1200
    );
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [report]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-xl flex items-center justify-center overflow-hidden"
    >
      {/* 별빛 파티클 배경 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(40)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-[2px] h-[2px] bg-white/60 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              opacity: [0.1, 0.6, 0.1],
              scale: [0.5, 1.2, 0.5],
            }}
            transition={{
              duration: 2 + Math.random() * 3,
              repeat: Infinity,
              delay: Math.random() * 3,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-2xl px-6 py-8">
        <AnimatePresence mode="wait">
          {phase === PHASES.INTRO && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.8 }}
              className="text-center"
            >
              <div className="text-xs uppercase tracking-[0.4em] text-white/50 mb-3">
                Act {report.actNumber} · Chapter {report.chapterNumber}
              </div>
              <h1
                className="text-6xl font-black text-white tracking-wider"
                style={{ fontFamily: "'Noto Serif KR', serif", letterSpacing: "0.1em" }}
              >
                FIN.
              </h1>
              <motion.div
                className="mt-4 text-sm text-white/40 italic"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                {report.chapterTitle}
              </motion.div>
            </motion.div>
          )}

          {(phase === PHASES.HEROINES || phase === PHASES.BADGES || phase === PHASES.READY) && (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              {/* 타이틀 */}
              <div className="text-center mb-8">
                <div className="text-xs uppercase tracking-[0.3em] text-indigo-300/60 mb-2">
                  Chapter {report.chapterNumber}의 흔적
                </div>
                <h2
                  className="text-2xl font-bold text-white"
                  style={{ fontFamily: "'Noto Serif KR', serif" }}
                >
                  이번 이야기
                </h2>
              </div>

              {/* 히로인 카드들 */}
              <div className="space-y-3 mb-6">
                {report.heroines?.map((h, i) => (
                  <HeroineCard
                    key={h.characterId}
                    heroine={h}
                    index={i}
                    phase={phase}
                  />
                ))}
              </div>

              {/* 배지 & 통계 */}
              {(phase === PHASES.BADGES || phase === PHASES.READY) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="space-y-3"
                >
                  {/* 배지 */}
                  {report.badges?.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-2">
                      {report.badges.map((b, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.1 * i }}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-400/30"
                        >
                          <span>{b.icon}</span>
                          <div>
                            <div className="text-xs font-bold text-amber-200">{b.title}</div>
                            <div className="text-[10px] text-amber-100/60">{b.description}</div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* 통계 */}
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <StatBlock
                      icon={<Film size={14} />}
                      label="감상한 씬"
                      value={`${report.scenesConsumed}개`}
                    />
                    <StatBlock
                      icon={<Zap size={14} />}
                      label="내린 선택"
                      value={`${report.branchesTaken}회`}
                    />
                    {report.transitioningToNewAct && (
                      <StatBlock
                        icon={<Sparkles size={14} />}
                        label="다음 막"
                        value={report.nextActTitle || "-"}
                        highlight
                      />
                    )}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 다음 버튼 */}
        <AnimatePresence>
          {phase === PHASES.READY && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 flex flex-col items-center gap-4"
            >
              {/* [v2] Act 진행도 힌트 */}
              {!report.leadsToIntermission && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="flex flex-col items-center gap-2"
                >
                  <div className="text-[10px] uppercase tracking-widest text-white/40">
                    Act {currentAct} 진행도
                  </div>
                  <div className="flex gap-1.5">
                    {Array.from({ length: actTotalChapters }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-[3px] w-8 rounded-full ${
                          i < report.chapterNumber
                            ? "bg-gradient-to-r from-indigo-400 to-purple-400"
                            : i === report.chapterNumber - 1
                            ? "bg-white/80"
                            : "bg-white/15"
                        }`}
                      />
                    ))}
                  </div>
                  <div className="text-xs text-white/60">
                    {actTotalChapters - report.chapterNumber > 0 ? (
                      <>
                        Act {currentAct} 종료까지{" "}
                        <span className="text-amber-200 font-bold">
                          {actTotalChapters - report.chapterNumber}
                        </span>{" "}
                        Chapter 남음
                      </>
                    ) : (
                      <span className="text-amber-200 font-bold">이 Chapter로 Act {currentAct} 마무리</span>
                    )}
                  </div>
                </motion.div>
              )}

              <motion.button
                onClick={onClose}
                whileTap={{ scale: 0.96 }}
                whileHover={{ scale: 1.03 }}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold shadow-xl"
              >
                {report.leadsToIntermission ? (
                  <>☕ 인터미션으로</>
                ) : (
                  <>Chapter {report.chapterNumber + 1} 시작</>
                )}
                <ChevronRight size={16} />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  히로인 카드
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function HeroineCard({ heroine, index, phase }) {
  const [displayAffection, setDisplayAffection] = useState(heroine.previousAffection);

  useEffect(() => {
    if (phase === PHASES.HEROINES || phase === PHASES.BADGES || phase === PHASES.READY) {
      const timer = setTimeout(() => {
        // 호감도 값을 천천히 증가시키는 애니메이션
        const duration = 1200;
        const start = heroine.previousAffection;
        const end = heroine.currentAffection;
        const startTime = Date.now();

        const tick = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(1, elapsed / duration);
          const eased = 1 - Math.pow(1 - progress, 3);
          const value = Math.round(start + (end - start) * eased);
          setDisplayAffection(value);
          if (progress < 1) requestAnimationFrame(tick);
        };
        tick();
      }, 300 + index * 1000);
      return () => clearTimeout(timer);
    }
  }, [phase, heroine.previousAffection, heroine.currentAffection, index]);

  const deltaPositive = heroine.delta > 0;
  const deltaZero = heroine.delta === 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.2 + index * 1.0, duration: 0.5 }}
      className={`relative rounded-2xl p-4 border backdrop-blur-sm overflow-hidden ${
        heroine.isLeader
          ? "bg-gradient-to-r from-rose-500/15 to-pink-500/15 border-rose-400/40"
          : "bg-white/[0.04] border-white/10"
      }`}
    >
      {heroine.isLeader && (
        <motion.div
          className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-amber-300"
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 + index * 1.0 }}
        >
          <Crown size={10} /> 리드
        </motion.div>
      )}

      {heroine.justBecameLeader && (
        <motion.div
          className="absolute top-2 left-2 px-2 py-0.5 bg-amber-500 text-black text-[10px] font-black rounded-full"
          initial={{ scale: 0, rotate: -15 }}
          animate={{ scale: [0, 1.3, 1], rotate: 0 }}
          transition={{ delay: 0.8 + index * 1.0, duration: 0.4 }}
        >
          역전!
        </motion.div>
      )}

      <div className="flex items-center gap-3">
        {/* 썸네일 — [Polish-v2] characterSlug 폴백 추가 */}
        <div
          className="w-12 h-12 rounded-full bg-cover bg-center border-2 border-white/20 flex-shrink-0"
          style={{
            backgroundImage: heroine.thumbnailUrl
              ? `url(${heroine.thumbnailUrl})`
              : heroine.characterSlug
              ? `url(/characters/${heroine.characterSlug}/thumb.jpg)`
              : "none",
            backgroundColor: "#4c1d95",
          }}
        />

        {/* 정보 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="font-bold text-white">{heroine.name}</div>
            <div className="flex items-center gap-1.5">
              <Heart size={12} className="text-rose-400" fill="currentColor" />
              <motion.span
                className="text-sm font-bold text-white"
                key={displayAffection}
              >
                {displayAffection}
              </motion.span>
              {!deltaZero && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 + index * 1.0 }}
                  className={`text-xs font-bold ${
                    deltaPositive ? "text-emerald-300" : "text-red-300"
                  }`}
                >
                  {deltaPositive ? "+" : ""}
                  {heroine.delta}
                </motion.span>
              )}
            </div>
          </div>
          {/* 호감도 바 */}
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-rose-500 to-pink-400"
              initial={{ width: `${Math.max(0, heroine.previousAffection)}%` }}
              animate={{ width: `${Math.max(0, heroine.currentAffection)}%` }}
              transition={{ delay: 0.3 + index * 1.0, duration: 1.2, ease: "easeOut" }}
            />
          </div>
          {/* 하이라이트 대사 */}
          {heroine.highlightQuote && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 + index * 1.0 }}
              className="mt-2 text-xs text-white/50 italic line-clamp-1"
            >
              "{heroine.highlightQuote}"
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  통계 블록
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function StatBlock({ icon, label, value, highlight }) {
  return (
    <div
      className={`rounded-xl border p-3 text-center ${
        highlight
          ? "bg-amber-500/10 border-amber-400/30"
          : "bg-white/[0.03] border-white/10"
      }`}
    >
      <div
        className={`flex justify-center mb-1 ${
          highlight ? "text-amber-300" : "text-white/50"
        }`}
      >
        {icon}
      </div>
      <div className="text-sm font-bold text-white">{value}</div>
      <div className="text-[10px] text-white/40 mt-0.5">{label}</div>
    </div>
  );
}