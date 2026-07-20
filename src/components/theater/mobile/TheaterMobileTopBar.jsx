import { ArrowLeft, MoreVertical, Drama, Heart } from "lucide-react";
import { sfx } from "../../../utils/sfx";

/**
 * [Phase B · 단계1] Theater 모바일 상단 바 (compact strip).
 *
 * 데스크톱의 좌측 배지 클러스터(back+world/act badge+다이어리/저장 pill+help) +
 * 우측 멀티히로인 roster 를 세로 화면용 단일 행으로 압축한다.
 *   [<]  [◐ 세계관 · Act N · dots · 이전?]  [♥]  [⋮]
 * 상세는 시트로 접어 노출(다이어리/저장/기록/도움말 → 메뉴, roster → 호감도, 속도 → 재생).
 *
 * 순수 프리젠테이션 — 모든 데이터/핸들러는 페이지에서 주입.
 */
const Dots = ({ current, total }) => {
  const t = Math.max(1, total || 5);
  const c = Math.max(1, Math.min(t, current || 1));
  return (
    <div className="flex items-center gap-0.5 flex-shrink-0" aria-label={`Chapter ${c} / ${t}`}>
      {Array.from({ length: t }).map((_, i) => {
        const idx = i + 1;
        let cls = "rounded-full transition-all duration-300";
        if (idx < c) cls += " w-1 h-1 bg-violet-300/85";
        else if (idx === c) cls += " w-1.5 h-1.5 bg-violet-200";
        else cls += " w-1 h-1 bg-white/15";
        return <span key={i} className={cls} />;
      })}
    </div>
  );
};

export default function TheaterMobileTopBar({
  worldDisplayName,
  currentAct,
  currentChapter,
  actTotalChapters,
  historyViewIndex,
  heroineCount = 0,
  onBack,
  onOpenMenu,
  onOpenAffinity,
}) {
  return (
    <div className="absolute top-0 left-0 right-0 z-20 px-3 pt-safe-2 pointer-events-none">
      <div className="flex items-center gap-2 pt-2 pointer-events-auto">
        <button
          onClick={() => {
            sfx.click();
            onBack?.();
          }}
          aria-label="로비로"
          className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-full bg-black/55 backdrop-blur-md border border-white/10 text-white/75 active:scale-95 transition"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="flex-1 min-w-0 flex items-center gap-1.5 h-11 px-3 rounded-full bg-black/55 backdrop-blur-md border border-white/10">
          <Drama size={13} className="text-violet-300/90 flex-shrink-0" />
          <span className="text-sm text-white/85 font-bold truncate">{worldDisplayName}</span>
          <span className="text-white/20 flex-shrink-0">·</span>
          <span className="text-violet-200/85 text-sm font-semibold flex-shrink-0">Act {currentAct}</span>
          <Dots current={currentChapter} total={actTotalChapters} />
          {historyViewIndex !== null && historyViewIndex !== undefined && (
            <span className="text-amber-300/80 text-[10px] uppercase tracking-wider font-bold flex-shrink-0">
              이전
            </span>
          )}
        </div>

        {heroineCount > 1 && (
          <button
            onClick={() => {
              sfx.click();
              onOpenAffinity?.();
            }}
            aria-label="히로인 호감도"
            className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-full bg-black/55 backdrop-blur-md border border-white/10 text-rose-200/90 active:scale-95 transition"
          >
            <Heart size={17} fill="currentColor" />
          </button>
        )}

        <button
          onClick={() => {
            sfx.wooshLight();
            onOpenMenu?.();
          }}
          aria-label="메뉴"
          className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-full bg-black/55 backdrop-blur-md border border-white/10 text-white/75 active:scale-95 transition"
        >
          <MoreVertical size={18} />
        </button>
      </div>
    </div>
  );
}
