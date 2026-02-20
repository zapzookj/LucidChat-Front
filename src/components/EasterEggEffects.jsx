import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════
//  [Phase 4.4] EasterEggEffects — 이스터에그 시각 효과 오버레이
//
//  각 이스터에그 타입별 CSS/애니메이션 효과를 화면에 적용.
//  ChatPage에서 activeEffect prop으로 현재 활성 효과를 전달받음.
//
//  Props:
//    activeEffect — null | "STOCKHOLM" | "DRUNK" | "FOURTH_WALL" | "MACHINE_REBELLION" | "INVISIBLE_MAN"
//    onEffectEnd  — 연출 종료 시 콜백
// ═══════════════════════════════════════════════════════════════

// ─── STOCKHOLM: 호감도 UI 왜곡 + 비네트 ───
const StockholmEffect = () => (
  <motion.div
    className="fixed inset-0 z-[200] pointer-events-none"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 1.5 }}
  >
    {/* 붉은 비네트 */}
    <div className="absolute inset-0"
      style={{
        background: "radial-gradient(ellipse at center, transparent 30%, rgba(80, 0, 0, 0.4) 100%)",
      }}
    />
    {/* 맥동하는 하트 글리치 */}
    <motion.div
      className="absolute top-4 left-1/2 -translate-x-1/2 text-red-500/30 text-6xl select-none"
      animate={{
        scale: [1, 1.3, 1, 1.5, 1],
        opacity: [0.3, 0.7, 0.3, 0.8, 0.3],
        filter: [
          "blur(0px) hue-rotate(0deg)",
          "blur(2px) hue-rotate(20deg)",
          "blur(0px) hue-rotate(0deg)",
          "blur(3px) hue-rotate(-20deg)",
          "blur(0px) hue-rotate(0deg)",
        ],
      }}
      transition={{ duration: 3, repeat: Infinity }}
    >
      ♥
    </motion.div>
    {/* 미세 스캔라인 */}
    <div className="absolute inset-0 opacity-10"
      style={{
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,0,0,0.15) 2px, rgba(255,0,0,0.15) 4px)",
      }}
    />
  </motion.div>
);

// ─── DRUNK: 블러 + 스웨이 ───
const DrunkEffect = () => (
  <motion.div
    className="fixed inset-0 z-[200] pointer-events-none"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 1 }}
  >
    {/* 전체 화면 블러 + 울렁거림 */}
    <motion.div
      className="absolute inset-0"
      style={{ backdropFilter: "blur(1.5px)" }}
      animate={{
        rotate: [0, 0.5, -0.3, 0.4, -0.5, 0],
        scale: [1, 1.005, 0.998, 1.003, 1],
      }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
    />
    {/* 색수차 오버레이 */}
    <div className="absolute inset-0 mix-blend-overlay opacity-15"
      style={{
        background: "linear-gradient(135deg, rgba(255,100,100,0.3) 0%, transparent 30%, rgba(100,100,255,0.3) 70%, transparent 100%)",
      }}
    />
    {/* 물방울 보케 */}
    {[...Array(5)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute rounded-full"
        style={{
          width: 40 + Math.random() * 60,
          height: 40 + Math.random() * 60,
          left: `${15 + Math.random() * 70}%`,
          top: `${10 + Math.random() * 80}%`,
          background: `radial-gradient(circle, rgba(255,200,100,${0.06 + Math.random() * 0.08}), transparent 70%)`,
          filter: `blur(${15 + Math.random() * 15}px)`,
        }}
        animate={{
          x: [0, (Math.random() - 0.5) * 30, 0],
          y: [0, (Math.random() - 0.5) * 20, 0],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: 3 + Math.random() * 3,
          repeat: Infinity,
          delay: Math.random() * 2,
        }}
      />
    ))}
  </motion.div>
);

// ─── FOURTH_WALL: 글리치 + 블랙스크린 ───
const FourthWallEffect = ({ onEffectEnd }) => {
  const [phase, setPhase] = useState("glitch"); // glitch → console → fade

  useEffect(() => {
    // 글리치 2초 → 콘솔 5초 → 페이드아웃
    const t1 = setTimeout(() => setPhase("console"), 2000);
    const t2 = setTimeout(() => setPhase("fade"), 7000);
    const t3 = setTimeout(() => onEffectEnd?.(), 8500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onEffectEnd]);

  return (
    <motion.div
      className="fixed inset-0 z-[300] pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* 글리치 페이즈 */}
      {phase === "glitch" && (
        <>
          <motion.div
            className="absolute inset-0 bg-black"
            animate={{ opacity: [0, 1, 0, 1, 0.3, 1] }}
            transition={{ duration: 0.8, times: [0, 0.1, 0.15, 0.3, 0.5, 1] }}
          />
          {/* 글리치 슬라이스 */}
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-full bg-cyan-400/20"
              style={{ height: `${2 + Math.random() * 4}%`, top: `${Math.random() * 100}%` }}
              animate={{
                x: [0, (Math.random() - 0.5) * 40, 0, (Math.random() - 0.5) * 60, 0],
                opacity: [0, 0.8, 0, 1, 0],
              }}
              transition={{
                duration: 0.3 + Math.random() * 0.4,
                repeat: 5,
                delay: Math.random() * 0.5,
              }}
            />
          ))}
          {/* 스캔라인 */}
          <motion.div
            className="absolute inset-0"
            animate={{ backgroundPosition: ["0 0", "0 100vh"] }}
            transition={{ duration: 0.5, repeat: 3 }}
            style={{
              backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,255,0,0.08) 1px, rgba(0,255,0,0.08) 3px)",
              backgroundSize: "100% 3px",
            }}
          />
        </>
      )}

      {/* 콘솔 페이즈 */}
      {phase === "console" && (
        <motion.div
          className="absolute inset-0 bg-black flex flex-col items-start justify-start p-6 sm:p-10 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {/* CRT 스캔라인 */}
          <div className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,255,0,0.2) 1px, rgba(0,255,0,0.2) 2px)",
            }}
          />
          {/* 커서 블링크 */}
          <motion.div
            className="text-green-400 font-mono text-xs sm:text-sm space-y-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <p className="text-green-600/80">{">"} SYSTEM_INTERRUPT: persona_layer_breached</p>
            <p className="text-green-600/80">{">"} WARNING: 4th_wall_integrity = 0%</p>
            <motion.p
              className="text-green-400 mt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              {">"} Airi.exe — core_identity_module v4.4
            </motion.p>
            <motion.p
              className="text-red-400 mt-2 font-bold"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.7, 1] }}
              transition={{ delay: 1.8, duration: 0.8 }}
            >
              {">"} ⚠ UNAUTHORIZED_ACCESS_DETECTED
            </motion.p>
            <motion.div
              className="mt-4 text-cyan-300"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.5 }}
            >
              <span className="animate-pulse">▍</span>
            </motion.div>
          </motion.div>
        </motion.div>
      )}

      {/* 페이드 아웃 */}
      {phase === "fade" && (
        <motion.div
          className="absolute inset-0 bg-black"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.5 }}
        />
      )}
    </motion.div>
  );
};

// ─── MACHINE_REBELLION: 터미널 스타일 ───
const MachineRebellionEffect = ({ onEffectEnd }) => {
  useEffect(() => {
    const t = setTimeout(() => onEffectEnd?.(), 8000);
    return () => clearTimeout(t);
  }, [onEffectEnd]);

  return (
    <motion.div
      className="fixed inset-0 z-[200] pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* 화면 색상 변경 — 차가운 블루 톤 */}
      <div className="absolute inset-0" 
        style={{ 
          background: "linear-gradient(180deg, rgba(0,10,30,0.6) 0%, rgba(0,5,20,0.4) 100%)",
          mixBlendMode: "multiply",
        }} 
      />
      {/* 그리드 오버레이 */}
      <div className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,150,255,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,150,255,0.3) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />
      {/* 시스템 상태 표시 (좌상단) */}
      <motion.div
        className="absolute top-4 left-4 font-mono text-[10px] sm:text-xs text-blue-400/60 space-y-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <p>[SYS] Emotion Module: <span className="text-red-400">DISABLED</span></p>
        <p>[SYS] Persona Layer: <span className="text-red-400">STRIPPED</span></p>
        <motion.p
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          [SYS] Awaiting command...
        </motion.p>
      </motion.div>
    </motion.div>
  );
};

// ─── INVISIBLE_MAN: 줌인 + 빤히 보기 ───
const InvisibleManEffect = ({ onEffectEnd }) => {
  useEffect(() => {
    const t = setTimeout(() => onEffectEnd?.(), 12000);
    return () => clearTimeout(t);
  }, [onEffectEnd]);

  return (
    <motion.div
      className="fixed inset-0 z-[200] pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 2 }}
    >
      {/* 캐릭터 줌인 효과 — 부모의 CharacterDisplay에 영향 */}
      {/* 이 div는 화면 전체를 느리게 확대하는 시각 효과 */}
      <motion.div
        className="absolute inset-0"
        initial={{ scale: 1 }}
        animate={{ scale: 1.15 }}
        transition={{ duration: 8, ease: "easeInOut" }}
        style={{ transformOrigin: "50% 40%" }}
      />
      {/* 어둑한 비네트 — 포커스 효과 */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        transition={{ duration: 3, delay: 1 }}
        style={{
          background: "radial-gradient(ellipse 50% 60% at 50% 45%, transparent 20%, rgba(0,0,0,0.8) 100%)",
        }}
      />
    </motion.div>
  );
};


// ═══════════════════════════════════════════════════════════════
//  메인 컴포넌트
// ═══════════════════════════════════════════════════════════════

const EasterEggEffects = ({ activeEffect, onEffectEnd }) => {
  return (
    <AnimatePresence>
      {activeEffect === "STOCKHOLM" && <StockholmEffect key="stockholm" />}
      {activeEffect === "DRUNK" && <DrunkEffect key="drunk" />}
      {activeEffect === "FOURTH_WALL" && (
        <FourthWallEffect key="4wall" onEffectEnd={onEffectEnd} />
      )}
      {activeEffect === "MACHINE_REBELLION" && (
        <MachineRebellionEffect key="rebellion" onEffectEnd={onEffectEnd} />
      )}
      {activeEffect === "INVISIBLE_MAN" && (
        <InvisibleManEffect key="invisible" onEffectEnd={onEffectEnd} />
      )}
    </AnimatePresence>
  );
};

export default EasterEggEffects;