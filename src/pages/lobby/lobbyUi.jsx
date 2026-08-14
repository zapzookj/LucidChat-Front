import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { DIFFICULTY_META } from "../../utils/difficultyMeta";

/**
 * [블록 A R2] 로비 공용 UI 원자 — 디자인 정본: aichat docs/15_assets/lobby_redesign_mockup.html
 *
 * 규약(구현 계약):
 *  - 모든 클릭 요소는 <button> (div+onClick 금지)
 *  - 타입은 lb-* 토큰, 본문 보조색은 lobby-tx1/tx2 (tx2는 12.5px 이상 전용)
 *  - 캐릭터 아트는 3:4 단일 비율, 썸네일 부재 시 그라데이션+이니셜 폴백
 *  - 캐릭터명·태그라인 1줄 ellipsis (UGC 자유 입력 방어)
 *  - 모션 절제: 카드 호버 -3px + 보더 강조, transition-only
 */

/** 전 화면 공용 중앙 컨테이너 — max 1200 중앙 정렬 (P3) */
export const LobbyContainer = ({ children, className = "" }) => (
  <div className={`relative max-w-[1200px] mx-auto px-4 sm:px-8 ${className}`}>{children}</div>
);

/** 429 공용 문구 — ErrorState message 분기용 단일 소스 */
export const RATE_LIMIT_MSG = "지금은 찾는 분이 많아요, 잠시 후 다시 만나요";

/** 페이지 헤더 — 탭 이름 + 1줄 기능 설명 (P2) */
export const PageHead = ({ title, desc }) => (
  <div className="mt-8">
    <h1 className="text-lb-page text-white tracking-tight">{title}</h1>
    {desc && <p className="text-lb-meta text-lobby-tx1 mt-1.5">{desc}</p>}
  </div>
);

/** 섹션 헤더 — 제목(기능어) + 서브(감성 1겹 허용) + 우측 액션 */
export const SectionHead = ({ title, sub, action }) => (
  <div className="flex items-baseline justify-between mb-4">
    <div>
      <h2 className="text-lb-sec text-white tracking-tight">{title}</h2>
      {sub && <p className="text-lb-meta text-lobby-tx2 mt-0.5">{sub}</p>}
    </div>
    {action}
  </div>
);

/** 난이도 배지 — label만 DIFFICULTY_META, 색은 로비 전용 맵(보더 없음 — badgeCls는 다른 표면용) */
const LOBBY_DIFFICULTY_CLS = {
  EASY:    "text-lobby-easy bg-emerald-400/[0.12]",
  NORMAL:  "text-lobby-normal bg-blue-400/[0.12]",
  HARD:    "text-lobby-hard bg-orange-400/[0.13]",
  EXTREME: "text-lobby-extreme bg-red-400/[0.13]",
};
export const DifficultyBadge = ({ difficulty }) => {
  const key = DIFFICULTY_META[difficulty] ? difficulty : "NORMAL";
  return (
    <span className={`inline-flex items-center text-lb-badge font-semibold px-2 py-0.5 rounded-full ${LOBBY_DIFFICULTY_CLS[key]}`}>
      {DIFFICULTY_META[key].label}
    </span>
  );
};

/** 모드 배지 — 자유/스토리/극장 (보관함·배너 공용) */
const MODE_BADGE = {
  SANDBOX: { label: "자유 대화", cls: "text-cyan-300 bg-cyan-400/10" },
  STORY:   { label: "스토리",    cls: "text-amber-300 bg-amber-400/10" },
  THEATER: { label: "극장",      cls: "text-indigo-300 bg-indigo-400/10" },
};
export const ModeBadge = ({ mode, suffix }) => {
  const m = MODE_BADGE[mode] || MODE_BADGE.SANDBOX;
  return (
    <span className={`inline-flex items-center text-lb-badge font-semibold px-2 py-0.5 rounded-full ${m.cls}`}>
      {m.label}{suffix ? ` · ${suffix}` : ""}
    </span>
  );
};

/** 제작자 크레딧 — 'UGC' 용어 대체 (P1). 닉네임 ellipsis 방어 */
export const CreditTag = ({ nickname, className = "" }) => (
  <span className={`inline-flex items-center gap-1 text-lb-badge text-lobby-tx2 min-w-0 ${className}`}>
    <span className="opacity-70 flex-none">✎</span>
    <span className="truncate max-w-[88px]">{nickname}</span>
  </span>
);

/** 썸네일 폴백 그라데이션 — 이름 해시로 고정 배정 (JIT: 전체 클래스 문자열) */
const FALLBACK_GRADS = [
  "bg-gradient-to-br from-[#4a1d33] via-[#8a2f4d] to-[#c46a5a]",
  "bg-gradient-to-br from-[#4a3320] via-[#9c6b35] to-[#d9a05b]",
  "bg-gradient-to-br from-[#2b2150] via-[#5b3d99] to-[#8f6ec9]",
  "bg-gradient-to-br from-[#232a38] via-[#48576e] to-[#8298b5]",
  "bg-gradient-to-br from-[#173a38] via-[#2c6e63] to-[#5ba58f]",
  "bg-gradient-to-br from-[#1c2f4a] via-[#2f5d8a] to-[#6fa3c9]",
  "bg-gradient-to-br from-[#4a2c17] via-[#a3652b] to-[#e0a34e]",
  "bg-gradient-to-br from-[#1a2340] via-[#33427a] to-[#5f6fb5]",
  "bg-gradient-to-br from-[#20351f] via-[#48663a] to-[#7d9c62]",
  "bg-gradient-to-br from-[#3a1f3d] via-[#6e3a70] to-[#a86ba3]",
];
export const fallbackGrad = (name = "") => {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return FALLBACK_GRADS[h % FALLBACK_GRADS.length];
};

/**
 * 캐릭터 아트 3:4 — 썸네일 or 그라데이션+이니셜 폴백 + 하단 스크림.
 * URL이 있어도 로드 실패(404·네트워크)하면 폴백으로 강등 — "썸네일이 없어도 성립하는 카드".
 */
export const CharacterArt = ({ name, thumbnailUrl, className = "" }) => {
  const [broken, setBroken] = useState(false);
  const showImg = Boolean(thumbnailUrl) && !broken;
  return (
    <span className={`relative block aspect-[3/4] overflow-hidden ${showImg ? "bg-slate-900" : fallbackGrad(name)} ${className}`}>
      {showImg ? (
        <img
          src={thumbnailUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-[44px] font-extrabold text-white/25 tracking-tight">
          {name?.[0] ?? ""}
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-b from-transparent to-black/45" />
    </span>
  );
};

/**
 * 범용 이미지 폴백 래퍼 — 히어로(16:7 등) 비율용. children = 폴백 콘텐츠 없이
 * 그라데이션만 필요할 때 name 해시 폴백을 쓴다.
 */
export const ImageOrGrad = ({ src, name, className = "" }) => {
  const [broken, setBroken] = useState(false);
  const showImg = Boolean(src) && !broken;
  return (
    <span className={`absolute inset-0 ${showImg ? "bg-slate-900" : fallbackGrad(name)} ${className}`}>
      {showImg && (
        <img
          src={src}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
          onError={() => setBroken(true)}
        />
      )}
    </span>
  );
};

/**
 * 캐릭터 카드 — 홈 그리드·신작 레일·온보딩 공용.
 * item: { characterId, name, tagline, thumbnailUrl, difficulty, ugc, creatorNickname }
 */
export const CharacterCard = ({ item, onClick, selected = false, className = "" }) => (
  <button
    onClick={onClick}
    className={`block w-full text-left rounded-2xl overflow-hidden border bg-white/[0.035] transition-all duration-200 ease-out
      hover:-translate-y-[3px] hover:bg-white/[0.06]
      ${selected ? "border-violet-400/60 shadow-[0_0_36px_rgba(167,139,250,0.16)]" : "border-white/[0.09] hover:border-violet-400/45"}
      ${className}`}
  >
    <CharacterArt name={item.name} thumbnailUrl={item.thumbnailUrl} />
    <span className="block px-3.5 pt-3 pb-3.5">
      <span className="block text-lb-card font-bold text-white truncate">{item.name}</span>
      <span className="block text-lb-meta text-lobby-tx1 mt-0.5 truncate">{item.tagline}</span>
      <span className="flex items-center gap-1.5 mt-2 flex-wrap">
        <DifficultyBadge difficulty={item.difficulty} />
        {item.ugc && item.creatorNickname && <CreditTag nickname={item.creatorNickname} />}
      </span>
    </span>
  </button>
);

/* ── 상태 3종 (표면 × 상태 매트릭스 — 디자인 정본 '상태' 화면) ── */

/** 스켈레톤: 카드형(3:4) */
export const SkeletonCard = () => (
  <div className="rounded-2xl overflow-hidden border border-white/[0.09]">
    <div className="aspect-[3/4] bg-white/[0.05] animate-pulse" />
    <div className="px-3.5 py-3 space-y-2">
      <div className="h-3 rounded bg-white/[0.07] animate-pulse" />
      <div className="h-3 w-3/5 rounded bg-white/[0.05] animate-pulse" />
    </div>
  </div>
);

/** 스켈레톤: 월드형(16:7) */
export const SkeletonHero = () => (
  <div className="rounded-[20px] overflow-hidden border border-white/[0.09]">
    <div className="aspect-[16/7] bg-white/[0.05] animate-pulse" />
    <div className="px-5 py-4 space-y-2">
      <div className="h-3.5 rounded bg-white/[0.07] animate-pulse" />
      <div className="h-3 w-1/2 rounded bg-white/[0.05] animate-pulse" />
    </div>
  </div>
);

/** 스켈레톤: 리스트형(행) */
export const SkeletonRow = () => (
  <div className="flex items-center gap-3.5 rounded-2xl border border-white/[0.09] px-4 py-3.5 mb-3">
    <div className="w-11 h-11 rounded-full bg-white/[0.07] animate-pulse flex-none" />
    <div className="flex-1 space-y-2">
      <div className="h-3 rounded bg-white/[0.07] animate-pulse" />
      <div className="h-3 w-3/5 rounded bg-white/[0.05] animate-pulse" />
    </div>
  </div>
);

/** 빈 상태 — 세그별 카피는 호출부에서 주입(정본 표 참조) */
export const EmptyState = ({ icon = "🌙", title, desc, ctaLabel, onCta }) => (
  <div className="flex flex-col items-center justify-center text-center py-14 gap-1.5">
    <div className="w-14 h-14 mb-2 rounded-full flex items-center justify-center text-[22px] border border-violet-400/25 bg-gradient-to-br from-violet-300/15 to-sky-300/10">
      {icon}
    </div>
    <p className="text-lb-card font-bold text-white">{title}</p>
    {desc && <p className="text-lb-meta text-lobby-tx2">{desc}</p>}
    {ctaLabel && (
      <button
        onClick={onCta}
        className="mt-3.5 px-5 py-2.5 rounded-full text-lb-meta font-bold text-slate-900 bg-gradient-to-r from-violet-300 to-sky-300 hover:-translate-y-px hover:shadow-[0_4px_20px_rgba(167,139,250,0.35)] transition-all"
      >
        {ctaLabel}
      </button>
    )}
  </div>
);

/** 오류 상태 — 429 포함 동일 패턴(문구만 분기), 섹션 단위 부분 실패에도 재사용 */
export const ErrorState = ({ message = "네트워크를 확인하고 다시 시도해 주세요", onRetry }) => (
  <div className="flex flex-col items-center justify-center text-center py-14 gap-1.5">
    <div className="w-14 h-14 mb-2 rounded-full flex items-center justify-center text-[22px] border border-white/10 bg-white/[0.04] grayscale">
      🌫
    </div>
    <p className="text-lb-card font-bold text-white">잠시 연결이 흐려졌어요</p>
    <p className="text-lb-meta text-lobby-tx2">{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="mt-3.5 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-lb-meta font-semibold text-lobby-tx1 border border-white/[0.09] hover:text-white hover:border-white/[0.16] transition-colors"
      >
        <RotateCcw size={13} /> 다시 시도
      </button>
    )}
  </div>
);
