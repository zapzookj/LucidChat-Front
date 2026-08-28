import { useEffect, useRef, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lock } from "lucide-react";
import { sfx } from "../utils/sfx";
import BottomSheet from "./mobile/BottomSheet";
import useDeviceProfile from "../hooks/useDeviceProfile";
import useSecretStatus from "../hooks/useSecretStatus";
import {
  NORMAL_AXES,
  SECRET_AXES,
  bandOf,
  bandLabel,
  narrate,
  headline,
  isUntouched,
  derivePulse,
  deltaSumOfStats,
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
  pulse: pulseProp = null, // [D-32] 상위가 계산한 박동. 전달되면 이것을 쓴다(DialogueBox와 같은 값 보장)
  characterThought,
  characterId = null,      // [D-32] 스탯 추적 아이덴티티 — V2 히로인 전환 시 prevStats 리셋 키
  characterName = "캐릭터",
  statusLevel = "STRANGER",
  isSecretMode = false,
  onUnlockSecret,          // [§G-9] 봉인 카드 CTA — 미전달이면 안내 전용 카드로 폴백(D-26)
  excludeRef = null,
}) => {
  const panelRef = useRef(null);
  const { isMobile } = useDeviceProfile();
  const theme = RELATION_THEME[statusLevel] || RELATION_THEME.STRANGER;

  // [적대적 리뷰 P1 · 안건 7(b) 확정(decisions_confirmed.md §A #7)] 시크릿 노출 노브.
  //   서버 노브 `bm.secret-products-enabled`가 off면 상점의 시크릿 탭·상품이 전부 사라지는데,
  //   봉인 카드의 "해금하고 보기 →"는 조건 없이 떠 있었다 → 눌러도 살 수 없는 탭으로 떨어지고,
  //   PG 심사 중 '완전 게이팅' 주장과 화면이 어긋난다. SecretModeFlow와 **같은 판정**을 쓰도록
  //   공용 스토어(hooks/useSecretStatus)를 구독한다(각자 fetch하면 판정이 갈린다).
  //   조회 실패·비로그인은 false(닫힘) 폴백. useSyncExternalStore 기반이라
  //   effect 안 동기 setState를 새로 만들지 않는다(react-hooks/set-state-in-effect).
  const { secretProductsEnabled } = useSecretStatus({ active: isOpen });
  // 노브 off면 CTA를 걷어내고, 아래 D-26 폴백(안내 전용 블록) 경로를 그대로 재사용한다.
  const unlockCta = secretProductsEnabled ? onUnlockSecret : null;

  const safeStats = useMemo(() => {
    const s = stats || {};
    const out = {};
    for (const a of [...NORMAL_AXES, ...SECRET_AXES]) out[a.key] = Number(s[a.key]) || 0;
    return out;
  }, [stats]);

  // 직전 스탯을 패널이 자체 추적한다 — 호출부(ChatPage/ChatPageV2)가 상태를 하나 더 들 필요가 없다.
  // stats는 매 턴 새 객체로 들어오므로 identity가 아니라 값으로 비교한다.
  // ref는 effect 안에서만 만진다(렌더 중 ref 접근은 동시성 렌더에서 깨진다 — react-hooks/refs).
  //
  // [D-32 · docs/19_assets/decision_agenda.md] **'어느 히로인의 값인가'를 함께 추적한다.**
  //  기존 추적기에는 캐릭터 식별자가 없어서, V2에서 히로인을 바꾸면 직전 히로인의 스냅샷과
  //  비교돼 5축 전부에 거짓 '직전 턴 ↓/↑' 배지가 붙었다(E-1.11 픽스로 V2 수치가 0이 아니게
  //  되면서 비로소 눈에 보이게 된 회귀). 아이덴티티가 바뀌면 비교 자체를 버린다 —
  //  다른 캐릭터의 값과의 차이는 '변화'가 아니라 '다른 대상'이기 때문이다.
  //  characterId 미전달 호출부(현행 ChatPage/ChatPageV2)를 위해 characterName으로 폴백한다.
  //  V2 히로인 전환 시 roomInfo.characterName도 함께 갈아끼워지므로 폴백도 실효가 있다.
  const identityKey = String(characterId ?? characterName ?? "");
  //  ★ 아이덴티티 전환은 **setState로 리셋하지 않는다.** 스냅샷에 소유자(__id)를 함께 실어 두고
  //    렌더에서 소유자가 다르면 비교를 버린다 — effect 안 동기 setState는 캐스케이딩 렌더를
  //    유발하고(react-hooks/set-state-in-effect) 이 경로는 상태를 새로 쓸 필요가 없다.
  const [prevSnap, setPrevSnap] = useState(null);   // { __id, ...stats }
  const lastKeyRef = useRef("");
  const identityRef = useRef(identityKey);
  useEffect(() => {
    const key = JSON.stringify(safeStats);
    if (identityRef.current !== identityKey) {
      identityRef.current = identityKey;
      lastKeyRef.current = key;   // 새 캐릭터의 첫 스냅샷 — 비교 대상 없음(상태는 건드리지 않는다)
      return;
    }
    if (key === lastKeyRef.current) return;
    if (lastKeyRef.current) setPrevSnap({ __id: identityKey, ...JSON.parse(lastKeyRef.current) });
    lastKeyRef.current = key;
  }, [safeStats, identityKey]);
  // 소유자가 다른 스냅샷은 '변화'가 아니라 '다른 대상'이므로 비교 대상에서 제외한다.
  const prevStats = prevSnap && prevSnap.__id === identityKey ? prevSnap : null;

  const untouched = isUntouched(safeStats);
  // [D-32] 박동은 상위가 준 값을 우선한다 — DialogueBox 정보바와 상태창 헤더가
  //  같은 화면에서 서로 다른 '심박'을 표시하던 문제(상태창 '쿵쾅' / DialogueBox '두근')는
  //  두 컴포넌트가 서로 다른 인자로 derivePulse를 부르던 데서 왔다. 상위가 한 번 계산해
  //  두 곳에 같은 pulse를 넘기면 구조적으로 어긋날 수 없다. 미전달 시에는 종전 자체 파생.
  const deltaSum = deltaSumOfStats(safeStats, prevStats);
  const pulse = pulseProp || derivePulse(emotion, deltaSum, isSecretMode, safeStats.lust);

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
          /* ─────────────────────────────────────────────────────────────
             [D-26 · 안건 8 확정(decisions_confirmed.md §A #8)] 봉인 카드.

             바뀐 것 2가지:
              1. **폴백 동작 정의.** 예전엔 onUnlockSecret 미전달 시 버튼을 비활성 처리해서, prop을 넘기는
                 호출부가 저장소 전체에 0건인 지금 카드가 영구 비활성이었고, CTA 문구조차
                 렌더되지 않아 docs/16이 핵심 BM으로 지정한 인게임 업셀 진입점이 통째로
                 죽어 있었다. 이제 prop이 없으면 **버튼이 아니라 안내 블록**으로 렌더한다 —
                 '눌리지 않는 버튼'(무엇을 눌러야 할지 모르는 상태)이 아니라 어디서 해금하는지
                 알려주는 안내가 된다. prop이 오면 그대로 CTA 버튼이 된다.
              2. **카피 교정.** 시크릿 상품은 계정 단위(user-global)로 확정됐다
                 ("전 캐릭터 확장 + 대상 선택 UI 제거"). 코드의 user-global 판정과도 정합한다.
                 따라서 이 캐릭터만 열린다는 오해를 낳지 않도록 '전 캐릭터 영구 해금'을 명시한다.

             레지스터: 시스템 안내·CTA는 해요체(relationNarrative.js 카피 계약).
             ───────────────────────────────────────────────────────────── */
          (() => {
            const cardClass =
              "w-full text-center rounded-xl px-3.5 py-3.5 border border-dashed border-red-500/40 bg-red-500/[0.07]";
            const inner = (
              <>
                <Lock size={17} className="mx-auto text-red-300/70" aria-hidden="true" />
                <p className="mt-1.5 m-0 text-xs leading-[1.6] text-white/[0.78]">
                  시크릿 모드에서만 보이는 마음이 있어요.
                </p>
                {/* [적대적 리뷰 P1] 노브 off면 상품 혜택 문구도 지운다 —
                    '영구 해금'은 판매 중인 상품의 혜택 설명이라 게이팅 대상이다. */}
                {secretProductsEnabled && (
                  <p className="mt-1 m-0 text-[11px] leading-[1.6] text-white/[0.46]">
                    한 번 해금하면 <span className="text-red-300/90 font-bold">전 캐릭터에 영구 적용</span>돼요.
                  </p>
                )}
                {unlockCta ? (
                  <span className="inline-block mt-2 text-xs font-extrabold text-red-300">해금하고 보기 →</span>
                ) : (
                  /* 폴백 — 진입점이 배선되기 전에도, 그리고 노브 off일 때도 안내 전용 블록이 된다.
                     노브 off에서는 '상점에서 해금' 안내가 거짓이 되므로(탭 자체가 숨겨짐) 문구를 바꾼다. */
                  <span className="inline-block mt-2 text-[11px] font-bold text-white/[0.46]">
                    {secretProductsEnabled ? "상점의 시크릿에서 해금할 수 있어요." : "지금은 준비 중이에요."}
                  </span>
                )}
              </>
            );
            return unlockCta ? (
              <button
                type="button"
                onClick={() => { sfx.click(); unlockCta(); }}
                className={`${cardClass} hover:bg-red-500/[0.11] transition`}
              >
                {inner}
              </button>
            ) : (
              <div className={cardClass}>{inner}</div>
            );
          })()
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
