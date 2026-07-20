import { Play, Pause } from "lucide-react";
import BottomSheet from "../../mobile/BottomSheet";

/**
 * [Phase B · 단계1] Theater 모바일 재생 설정 시트.
 *
 * 박스 상단 컨트롤의 속도 세그먼트 + 자동/수동을 접어 노출.
 * (자동/수동은 박스 slim row 에도 one-tap 으로 남겨둠 — 최다 사용.)
 * 기존 페이지 핸들러(onSpeedChange / onToggleAutoPlay) 를 그대로 호출.
 */
const SPEEDS = [
  ["SLOW", "느림"],
  ["NORMAL", "보통"],
  ["FAST", "빠름"],
];

export default function TheaterPlaybackSheet({
  open,
  onClose,
  playSpeed,
  onSpeedChange,
  autoPlayEnabled,
  onToggleAutoPlay,
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="재생 설정" zIndex={70}>
      <div className="space-y-5">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-white/40 mb-2">진행 속도</div>
          <div className="flex gap-2">
            {SPEEDS.map(([key, label]) => (
              <button
                key={key}
                onClick={() => onSpeedChange?.(key)}
                className={`flex-1 min-h-[48px] rounded-2xl border text-sm font-bold transition-all ${
                  playSpeed === key
                    ? "bg-violet-500/25 border-violet-300/45 text-violet-50"
                    : "bg-white/[0.03] border-white/10 text-white/55 hover:text-white/75"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-widest text-white/40 mb-2">자동 진행</div>
          <button
            onClick={() => onToggleAutoPlay?.()}
            className={`w-full min-h-[48px] flex items-center justify-center gap-2 rounded-2xl border text-sm font-bold transition-all ${
              autoPlayEnabled
                ? "bg-emerald-500/20 border-emerald-300/40 text-emerald-100"
                : "bg-white/[0.03] border-white/10 text-white/60 hover:text-white/80"
            }`}
          >
            {autoPlayEnabled ? (
              <Play size={15} fill="currentColor" />
            ) : (
              <Pause size={15} fill="currentColor" />
            )}
            {autoPlayEnabled ? "자동 재생 켜짐" : "수동 진행"}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
