import { useEffect, useRef, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lock } from "lucide-react";
import { sfx } from "../utils/sfx";
import BottomSheet from "./mobile/BottomSheet";
import useDeviceProfile from "../hooks/useDeviceProfile";
import {
  NORMAL_AXES,
  SECRET_AXES,
  bandOf,
  bandLabel,
  narrate,
  headline,
  isUntouched,
  derivePulse,
  trendOf,
} from "../utils/relationNarrative";

// ═══════════════════════════════════════════════════════════════════
//  [블록 D · §G-8/§G-9] 상태창 — 수치 게이지에서 서술형으로
//
//  설계 정본: aichat `docs/17_assets/hud_redesign_mockup.html` (종원 컨펌 2026-08-20)
//
//  바뀐 것
//   1. BPM 숫자·게이지·3구간 표 → 박동 pill 하나 (숫자 없음).
//      LLM에게 bpm을 묻던 프롬프트 블록을 통째로 걷어냈고(V1 턴당 ~205-235 토큰 회수),
//      박동은 이미 페이로드에 있는 emotion에서 파생한다 → V2에서도 처음으로 작동한다.
//   2. 레이더 230px + 8축 수치 막대 → 축별 서술 한 줄 + 구간명 + 변화 방향 + 위치 마커.
//      절대 수치는 '숫자로 보기' 접힘 안으로. (레이더는 375px에서 잘렸고 음수를 못 그렸다.)
//   3. 시크릿 3축 블러 → 봉인 카드(클릭 가능 업셀). docs/16 §E 조교·타락 아크 자리를 비워둔다.
//   4. 모바일은 좌측 패널(375px에서 150px로 찌그러짐) → BottomSheet.
//
//  카피·구간 로직은 전부 `utils/relationNarrative.js`(순수 함수)에 있다.
// ═══════════════════════════════════════════════════════════════════

const RELATION_THEME = {
  STRANGER:     { ko: "타인", accent: "#94a3b8", glow: "rgba(148,163,184,0.18)" },
  ACQUAINTANCE: { ko: "지인", accent: "#34d399", glow: "rgba(52,211,153,0.25)" },
  FRIEND:       { ko: "친구", accent: "#60a5fa", glow: "rgba(96,165,250,0.25)" },
  LOVER:        { ko: "연인", accent: "#f472b6", glow: "rgba(244,114,182,0.3)" },
  ENEMY:        { ko: "적대", accent: "#ef4444", glow: "rgba(239,68,68,0.25)" },
};

const SectionTitle = ({ icon, children }) => (
  <div className="flex items-center gap-2 mb-3">
    <span className="text-[13px]" aria-hidden="true">{icon}</span>
    <span className="text-[11px] uppercase tracking-[0.18em] font-black text-white/60">{children}</span>
  </div>
);

/** 위치 마커 — 누적 채움(게이지)이 아니라 눈금 위 한 점. 냉각은 색을 달리해 '역방향'을 표시. */
const BandMarker = ({ band, color, cold }) => (
  <div className="flex gap-[3px] mt-2" aria-hidden="true">
    {[0, 1, 2, 3, 4].map((i) => (
      <i
        key={i}
        className={`flex-1 rounded-full ${i === band ? "h-[5px]" : "h-[3px]"}`}
        style={{
          background: i === band ? (cold ? "#f87171" : color) : "rgba(255,255,255,0.10)",
          boxShadow: i === band ? `0 0 7px ${cold ? "#f87171" : color}` : "none",
        }}
      />
    ))}
  </div>
);

const AxisRow = ({ axis, value, prevValue, name }) => {
  const band = bandOf(value);
  const cold = band === 0;
  const trend = trendOf(value, prevValue);
  const trendTone =
    trend.dir === "up" ? "text-emerald-300 bg-emerald-400/15"
      : trend.dir === "dn" ? "text-red-300 bg-red-400/15"
        : "text-white/60 bg-white/[0.07]";

  return (
    <div className="py-[11px] border-b border-white/[0.06] last:border-b-0">
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <span className="w-[7px] h-[7px] rounded-full flex-none" style={{ background: axis.color }} aria-hidden="true" />
        <span className="text-xs font-extrabold text-white/[0.78]">{axis.label}</span>
        <span className={`text-[10.5px] font-extrabold px-[7px] py-[2px] rounded-full ${cold ? "text-red-300 bg-red-400/15" : "text-white/[0.78] bg-white/[0.08]"}`}>
          {bandLabel(axis.key, value)}
        </span>
        <span className={`ml-auto text-[10.5px] font-extrabold px-[7px] py-[2px] rounded-full whitespace-nowrap ${trendTone}`}>
          {trend.label}
        </span>
      </div>
      <p className="text-[13px] leading-[1.7] text-white/[0.78] m-0">{narrate(axis.key, value, name)}</p>
      <BandMarker band={band} color={axis.color} cold={cold} />
    </div>
  );
};

const BiometricStatusPanel = ({
  isOpen,
  onClose,
  stats,
  emotion,                 // [§G-8] 직전 턴 EmotionTag — 박동 파생 입력
  characterThought,
  characterName = "캐릭터",
  statusLevel = "STRANGER",
  isSecretMode = false,
  onUnlockSecret,          // [§G-9] 봉인 카드 CTA — 없으면 카드가 비활성
  excludeRef = null,
}) => {
  const panelRef = useRef(null);
  const { isMobile } = useDeviceProfile();
  const theme = RELATION_THEME[statusLevel] || RELATION_THEME.STRANGER;

  const safeStats = useMemo(() => {
    const s = stats || {};
    const out = {};
    for (const a of [...NORMAL_AXES, ...SECRET_AXES]) out[a.key] = Number(s[a.key]) || 0;
    return out;
  }, [stats]);

  // 직전 스탯을 패널이 자체 추적한다 — 호출부(ChatPage/ChatPageV2)가 상태를 하나 더 들 필요가 없다.
  // stats는 매 턴 새 객체로 들어오므로 identity가 아니라 값으로 비교한다.
  // ref는 effect 안에서만 만진다(렌더 중 ref 접근은 동시성 렌더에서 깨진다 — react-hooks/refs).
  const [prevStats, setPrevStats] = useState(null);
  const lastKeyRef = useRef("");
  useEffect(() => {
    const key = JSON.stringify(safeStats);
    if (key === lastKeyRef.current) return;
    if (lastKeyRef.current) setPrevStats(JSON.parse(lastKeyRef.current));
    lastKeyRef.current = key;
  }, [safeStats]);

  const untouched = isUntouched(safeStats);
  const deltaSum = prevStats
    ? [...NORMAL_AXES, ...SECRET_AXES].reduce((s, a) => s + Math.abs(safeStats[a.key] - (prevStats[a.key] ?? 0)), 0)
    : 0;
  const pulse = derivePulse(emotion, deltaSum, isSecretMode, safeStats.lust);

  // 데스크톱 패널만 바깥 클릭으로 닫는다(모바일은 BottomSheet가 백드롭을 처리).
  useEffect(() => {
    if (!isOpen || isMobile) return undefined;
    sfx.wooshLight();
    const handler = (e) => {
      if (!panelRef.current || panelRef.current.contains(e.target)) return;
      if (excludeRef?.current?.contains(e.target)) return;
      onClose?.();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, isMobile, onClose, excludeRef]);

  // ── 본문 (데스크톱/모바일 공용) ──
  const body = (
    <>
      {/* 헤더 — 이름 + 박동 */}
      <div className="px-[18px] pt-[15px] pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <span className="text-[13px] font-extrabold text-white/[0.94] truncate">{characterName}</span>
          <span
            className="ml-auto inline-flex items-center gap-1.5 pl-2 pr-2.5 py-[3px] rounded-full bg-black/45 border border-white/[0.12]"
            title={`심박 · ${pulse.label}`}
          >
            <span
              className="lucid-pulse-dot w-2 h-2 rounded-full"
              style={{ background: pulse.color, boxShadow: `0 0 9px ${pulse.color}`, animationDuration: `${pulse.beatSec}s` }}
              aria-hidden="true"
            />
            <span className="text-[10.5px] font-extrabold tracking-[0.05em] text-white/[0.78]">심박 · {pulse.label}</span>
          </span>
        </div>
      </div>

      {/* 지금 이 관계 */}
      <div className="px-[18px] py-[15px] border-b border-white/[0.06]">
        <SectionTitle icon="💫">지금 이 관계</SectionTitle>
        <div
          className="rounded-xl px-3.5 py-3 border"
          style={{ borderColor: `${theme.accent}40`, background: `${theme.accent}12` }}
        >
          <div className="text-[10.5px] font-black tracking-[0.14em] uppercase" style={{ color: theme.accent }}>
            {theme.ko}
          </div>
          <p className="mt-1.5 m-0 text-[14.5px] leading-[1.65] text-white/[0.94]" style={{ fontFamily: "'Noto Serif KR', serif" }}>
            {untouched ? "아직 아무것도 아니에요 — 몇 마디 나눠 봐야 알 수 있어요." : headline(statusLevel, safeStats)}
          </p>
        </div>
      </div>

      {/* 마음 */}
      <div className="px-[18px] py-[15px] border-b border-white/[0.06]">
        <SectionTitle icon="🫧">마음</SectionTitle>
        {untouched ? (
          <p className="text-[13px] leading-[1.7] text-white/60 m-0">
            아직 읽을 게 없어요. 몇 번 더 이야기를 나누면 여기에 채워집니다.
          </p>
        ) : (
          <>
            {NORMAL_AXES.map((a) => (
              <AxisRow key={a.key} axis={a} value={safeStats[a.key]} prevValue={prevStats?.[a.key]} name={characterName} />
            ))}
            <details className="mt-3">
              <summary className="text-xs font-bold text-white/60 cursor-pointer tracking-[0.04em] list-none">
                숫자로 보기
              </summary>
              <div className="mt-2 text-xs leading-[1.95] tabular-nums text-white/[0.78]">
                {[...NORMAL_AXES, ...(isSecretMode ? SECRET_AXES : [])].map((a) => (
                  <div key={a.key}>
                    <span style={{ color: a.color }}>{a.label}</span> {safeStats[a.key]}
                    <span className="text-white/[0.46]"> / 100</span>
                  </div>
                ))}
              </div>
            </details>
          </>
        )}
      </div>

      {/* 비밀 */}
      <div className="px-[18px] py-[15px] border-b border-white/[0.06]">
        <SectionTitle icon="🔒">비밀</SectionTitle>
        {isSecretMode ? (
          SECRET_AXES.map((a) => (
            <AxisRow key={a.key} axis={a} value={safeStats[a.key]} prevValue={prevStats?.[a.key]} name={characterName} />
          ))
        ) : (
          <button
            type="button"
            onClick={() => { sfx.click(); onUnlockSecret?.(); }}
            disabled={!onUnlockSecret}
            className="w-full text-center rounded-xl px-3.5 py-3.5 border border-dashed border-red-500/40 bg-red-500/[0.07]
                       enabled:hover:bg-red-500/[0.11] disabled:opacity-70 disabled:cursor-default transition"
          >
            <Lock size={17} className="mx-auto text-red-300/70" aria-hidden="true" />
            <p className="mt-1.5 m-0 text-xs leading-[1.6] text-white/[0.78]">
              시크릿 모드에서만 보이는 마음이 있어요.
            </p>
            {onUnlockSecret && (
              <span className="inline-block mt-2 text-xs font-extrabold text-red-300">해금하고 보기 →</span>
            )}
          </button>
        )}
      </div>

      {/* 속마음 — 미생성이면 섹션 자체를 숨긴다(빈 따옴표 금지) */}
      {characterThought && (
        <div className="px-[18px] py-[15px]">
          <SectionTitle icon="💭">속마음</SectionTitle>
          <p className="m-0 text-[13px] italic leading-[1.75] text-white/60" style={{ fontFamily: "'Noto Serif KR', serif" }}>
            {characterThought}
          </p>
        </div>
      )}
    </>
  );

  // 박동 애니메이션·reduced-motion 대응은 전역(index.css .lucid-pulse-dot)으로 일원화.
  // 여기 남는 것은 이 패널 전용 스크롤바/마커 숨김뿐.
  const pulseStyle = (
    <style>{`
      .status-scroll::-webkit-scrollbar { display: none; }
      details > summary::-webkit-details-marker { display: none; }
    `}</style>
  );

  // ── 모바일: BottomSheet ──
  if (isMobile) {
    return (
      <>
        {pulseStyle}
        <BottomSheet open={isOpen} onClose={onClose} title="상태창" zIndex={70} maxHeight="78vh">
          {body}
        </BottomSheet>
      </>
    );
  }

  // ── 데스크톱: 좌측 슬라이드 패널 ──
  return (
    <>
      {pulseStyle}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-label={`${characterName} 상태창`}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            className="fixed left-3 sm:left-5 z-[65] flex flex-col"
            style={{ top: "72px", bottom: "72px", width: "min(330px, 42vw)", willChange: "transform, opacity", transform: "translateZ(0)" }}
          >
            <div
              className="h-full rounded-2xl border border-white/[0.08] flex flex-col overflow-hidden"
              style={{
                background: "linear-gradient(160deg, rgba(8,4,20,0.82), rgba(15,8,30,0.88))",
                backdropFilter: "blur(28px) saturate(1.3)",
                boxShadow: `0 12px 60px rgba(0,0,0,0.5), 0 0 80px ${theme.glow}, inset 0 1px 0 rgba(255,255,255,0.04)`,
              }}
            >
              <div className="h-[2px] w-full flex-none" style={{ background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)`, opacity: 0.75 }} />
              <button
                type="button"
                onClick={() => { sfx.click(); onClose?.(); }}
                aria-label="상태창 닫기"
                className="absolute right-3 top-4 z-10 p-1 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.08] transition"
              >
                <X size={14} />
              </button>
              <div className="status-scroll flex-1 overflow-y-auto" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
                {body}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default BiometricStatusPanel;
