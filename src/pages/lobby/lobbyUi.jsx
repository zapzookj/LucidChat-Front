import { useId, useState } from "react";
import { RotateCcw, ArrowUpRight, Sparkles, PencilLine, CloudOff } from "lucide-react";
import { DIFFICULTY_META } from "../../utils/difficultyMeta";
import { getCharacterPresentation } from "../../utils/characterPresentation";
import { assetUrl } from "../../utils/assetUrl";

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
  <div className={`aurora-container ${className}`}>{children}</div>
);

/** 429 공용 문구 — ErrorState message 분기용 단일 소스 */
export const RATE_LIMIT_MSG = "지금은 찾는 분이 많아요, 잠시 후 다시 만나요";

/** 페이지 헤더 — 탭 이름 + 1줄 기능 설명 (P2) */
export const PageHead = ({ title, desc }) => (
  <div className="aurora-page-head">
    <h1>{title}</h1>
    {desc && <p>{desc}</p>}
  </div>
);

/** 섹션 헤더 — 제목(기능어) + 서브(감성 1겹 허용) + 우측 액션 */
export const SectionHead = ({ title, sub, action }) => (
  <div className="aurora-section-head">
    <div className="min-w-0">
      <h2>{title}</h2>
      {sub && <p>{sub}</p>}
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
    <PencilLine size={11} aria-hidden="true" className="flex-none" />
    <span className="truncate max-w-[100px]" title={nickname}>{nickname}</span>
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
export const CharacterArt = ({ name, thumbnailUrl, character = {}, className = "" }) => {
  const [brokenSrc, setBrokenSrc] = useState(null);
  const [brokenBackground, setBrokenBackground] = useState(null);
  const src = assetUrl(thumbnailUrl);
  const art = getCharacterPresentation({ ...character, name, thumbnailUrl });
  const showImg = Boolean(src) && brokenSrc !== src;
  return (
    <span className={`aurora-character-art ${className}`} style={{ '--character-glow': art.glow, '--character-accent': art.accent }}>
      {art.artMode === 'cutout' && <>
        {art.backgroundUrl && brokenBackground !== art.backgroundUrl && <img src={art.backgroundUrl} className="character-place" alt="" loading="lazy" decoding="async" onError={() => setBrokenBackground(art.backgroundUrl)} />}
        <span className="character-atmosphere" /><span className="character-arch" />
      </>}
      {showImg ? (
        <img
          src={src}
          alt=""
          className="character-portrait"
          style={{ objectPosition: art.objectPosition }}
          loading="lazy" decoding="async"
          draggable={false}
          onError={() => setBrokenSrc(src)}
        />
      ) : (
        <span className="character-fallback">
          {name?.[0] ?? ""}
        </span>
      )}
      <span className="character-scrim" />
      {art.artMode === 'cutout' && <span className="aurora-character-origin"><Sparkles size={10} aria-hidden="true" />루시드 오리지널</span>}
    </span>
  );
};

/**
 * 범용 이미지 폴백 래퍼 — 히어로(16:7 등) 비율용. children = 폴백 콘텐츠 없이
 * 그라데이션만 필요할 때 name 해시 폴백을 쓴다.
 */
export const ImageOrGrad = ({ src, name, className = "" }) => {
  const [brokenSrc, setBrokenSrc] = useState(null);
  const resolved = assetUrl(src);
  const showImg = Boolean(resolved) && brokenSrc !== resolved;
  return (
    <span className={`absolute inset-0 ${showImg ? "bg-slate-900" : fallbackGrad(name)} ${className}`}>
      {showImg && (
        <img
          src={resolved}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
          loading="lazy" decoding="async"
          onError={() => setBrokenSrc(resolved)}
        />
      )}
    </span>
  );
};

/**
 * 캐릭터 카드 — 홈 그리드·신작 레일·온보딩 공용.
 * item: { characterId, name, tagline, thumbnailUrl, difficulty, ugc, creatorNickname }
 */
export const CharacterCard = ({ item, onClick, selected = false, selectionMode = false, className = "" }) => {
  const descriptionId = useId();
  return (
  <button
    type="button"
    onClick={onClick}
    aria-label={`${item.name} ${selectionMode ? '선택' : '프로필 보기'}`}
    aria-describedby={descriptionId}
    aria-pressed={selectionMode ? selected : undefined}
    className={`aurora-character-card ${selected ? 'is-selected' : ''} ${className}`}
  >
    <CharacterArt name={item.name} thumbnailUrl={item.thumbnailUrl || item.defaultImageUrl} character={item} />
    <span className="aurora-character-copy">
      <span className="aurora-character-title"><span title={item.name}>{item.name}</span><ArrowUpRight size={15} aria-hidden="true" /></span>
      <span id={descriptionId}>
      <span className="aurora-character-tagline" title={item.tagline}>{item.tagline}</span>
      <span className="aurora-character-meta">
        <DifficultyBadge difficulty={item.difficulty} />
        {item.ugc && item.creatorNickname && <CreditTag nickname={item.creatorNickname} />}
      </span>
      </span>
    </span>
  </button>
  );
};

/* ── 상태 3종 (표면 × 상태 매트릭스 — 디자인 정본 '상태' 화면) ── */

/** 스켈레톤: 카드형(3:4) */
export const SkeletonCard = () => (
  <div className="aurora-skeleton" aria-hidden="true">
    <div className="aspect-[3/3.8] aurora-skeleton-shimmer" />
    <div className="px-3.5 py-3 space-y-2">
      <div className="h-3 rounded bg-white/[0.07] animate-pulse" />
      <div className="h-3 w-3/5 rounded bg-white/[0.05] animate-pulse" />
    </div>
  </div>
);

/** 스켈레톤: 월드형(16:7) */
export const SkeletonHero = () => (
  <div className="aurora-skeleton" aria-hidden="true">
    <div className="aspect-[16/7] aurora-skeleton-shimmer" />
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
  <div className="aurora-state">
    <div className="aurora-state-icon" aria-hidden="true">
      {icon}
    </div>
    <p className="text-lb-card font-bold text-white">{title}</p>
    {desc && <p className="text-lb-meta text-lobby-tx2">{desc}</p>}
    {ctaLabel && (
      <button
        onClick={onCta}
        className="aurora-button-primary mt-4"
      >
        {ctaLabel}
      </button>
    )}
  </div>
);

/** 오류 상태 — 429 포함 동일 패턴(문구만 분기), 섹션 단위 부분 실패에도 재사용 */
export const ErrorState = ({ message = "네트워크를 확인하고 다시 시도해 주세요", onRetry }) => (
  <div className="aurora-state" role="alert">
    <div className="aurora-state-icon" aria-hidden="true">
      <CloudOff size={24} />
    </div>
    <p className="text-lb-card font-semibold text-lobby-tx0">정보를 불러오지 못했어요</p>
    <p className="text-lb-meta text-lobby-tx2">{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="aurora-button-secondary mt-4"
      >
        <RotateCcw size={13} /> 다시 시도
      </button>
    )}
  </div>
);
