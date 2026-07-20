import { Heart, Crown } from "lucide-react";
import BottomSheet from "../../mobile/BottomSheet";

/**
 * [Phase B · 단계1] Theater 모바일 호감도 시트.
 *
 * 데스크톱 우측 멀티히로인 roster(HUD 밀도 #1 offender) + 박스의 lead-heroine HUD 를
 * 하나의 바텀시트로 통합. 읽기 전용 표시 — 상태/로직 없음.
 */
export default function TheaterAffinitySheet({
  open,
  onClose,
  heroines = [],
  activeHeroineId,
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="히로인 · 호감도" zIndex={70}>
      <div className="space-y-2">
        {heroines.map((h) => {
          const isActive = h.characterId === activeHeroineId;
          return (
            <div
              key={h.characterId}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl border transition-colors ${
                isActive
                  ? "bg-violet-500/15 border-violet-300/40"
                  : "bg-white/[0.03] border-white/8"
              }`}
            >
              <div
                className={`w-11 h-11 rounded-full bg-cover bg-center flex-shrink-0 ${
                  isActive ? "ring-2 ring-violet-200/60" : "opacity-70"
                }`}
                style={{
                  backgroundImage: h.thumbnailUrl ? `url(${h.thumbnailUrl})` : "none",
                  backgroundColor: "#4c1d95",
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[15px] font-bold truncate ${
                      isActive ? "text-violet-50" : "text-white/85"
                    }`}
                  >
                    {h.name}
                  </span>
                  {h.confirmedMain && (
                    <Crown size={13} className="text-amber-300 flex-shrink-0" />
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Heart
                  size={14}
                  className={isActive ? "text-rose-300" : "text-white/45"}
                  fill="currentColor"
                />
                <span
                  className={`text-sm tabular-nums ${
                    isActive ? "text-rose-100" : "text-white/60"
                  }`}
                >
                  {h.affection}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </BottomSheet>
  );
}
