import { Gem, Music, VolumeX, Settings, MessageSquare } from "lucide-react";
import BottomSheet from "../../mobile/BottomSheet";
import HelpButton from "../../HelpButton";

/**
 * [Phase B · 단계2] STORY V2 모바일 오버플로 메뉴 시트.
 *
 * 데스크톱 상단우측 6-pill 클러스터(상점/부스트/BGM/설정/지난대화/도움말)를
 * 375px 밀도 붕괴 없이 하나의 바텀시트로 접는다.
 *   - 부스트는 설정 드로어(모바일 full-width)의 기존 BoostToggle 인스턴스로 접근 → 중복 배제.
 *   - 각 항목은 기존 페이지 상태/핸들러만 호출(로직 불변).
 */
const Row = ({ icon, label, onClick, colorClass = "text-white/75", rightSlot }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 px-4 min-h-[52px] rounded-2xl bg-white/[0.04] border border-white/8 hover:bg-white/[0.08] active:scale-[0.99] transition text-left"
  >
    <span className={`flex-shrink-0 ${colorClass}`}>{icon}</span>
    <span className="flex-1 text-[15px] text-white/85 font-medium">{label}</span>
    {rightSlot}
  </button>
);

export default function StoryV2MobileMenuSheet({
  open,
  onClose,
  isBgmPlaying,
  onToggleBgm,
  onOpenStore,
  onOpenSettings,
  onOpenHistory,
  secretModeActive = false,
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="메뉴" zIndex={70}>
      <div className="space-y-2">
        <Row
          icon={<Gem size={18} />}
          label="루시드 부띠끄"
          colorClass="text-amber-300"
          onClick={() => {
            onClose?.();
            onOpenStore?.("energy");
          }}
        />
        <Row
          icon={isBgmPlaying ? <Music size={18} /> : <VolumeX size={18} />}
          label={isBgmPlaying ? "BGM 켜짐" : "BGM 꺼짐"}
          colorClass={isBgmPlaying ? "text-pink-300" : "text-white/50"}
          onClick={() => onToggleBgm?.()}
        />
        <Row
          icon={<Settings size={18} />}
          label="설정"
          colorClass="text-indigo-300"
          onClick={() => {
            onClose?.();
            onOpenSettings?.();
          }}
          rightSlot={
            secretModeActive ? (
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
            ) : null
          }
        />
        <Row
          icon={<MessageSquare size={18} />}
          label="지난 대화"
          onClick={() => {
            onClose?.();
            onOpenHistory?.();
          }}
        />
        {/* 도움말·문의 — HelpButton 이 자체 SupportPanel 을 연다(로직 불변) */}
        <div className="flex items-center gap-3 px-4 min-h-[52px] rounded-2xl bg-white/[0.04] border border-white/8">
          <HelpButton
            className="relative inline-flex items-center justify-center h-9 w-9 rounded-full bg-black/40 border border-white/15 text-white/80"
            iconSize={16}
          />
          <span className="text-[15px] text-white/85 font-medium">도움말 · 문의</span>
        </div>
      </div>
    </BottomSheet>
  );
}
