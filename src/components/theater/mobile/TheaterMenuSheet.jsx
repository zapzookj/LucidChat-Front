import { BookOpen, Save, History } from "lucide-react";
import BottomSheet from "../../mobile/BottomSheet";
import HelpButton from "../../HelpButton";

/**
 * [Phase B · 단계1] Theater 모바일 메뉴 시트.
 *
 * 데스크톱 상단 pill(다이어리/저장·불러오기/도움말)과 박스 컨트롤의 기록을
 * 하나의 바텀시트로 접는다. 각 항목은 기존 페이지 setter 를 그대로 호출(로직 불변).
 */
const Row = ({ icon, label, onClick, colorClass = "text-white/75" }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 px-4 min-h-[52px] rounded-2xl bg-white/[0.04] border border-white/8 hover:bg-white/[0.08] active:scale-[0.99] transition text-left"
  >
    <span className={`flex-shrink-0 ${colorClass}`}>{icon}</span>
    <span className="text-[15px] text-white/85 font-medium">{label}</span>
  </button>
);

export default function TheaterMenuSheet({
  open,
  onClose,
  onOpenDiary,
  onOpenSaveLoad,
  onOpenHistory,
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="메뉴" zIndex={70}>
      <div className="space-y-2">
        <Row
          icon={<BookOpen size={18} />}
          label="이야기 다이어리"
          colorClass="text-cyan-200"
          onClick={() => {
            onClose?.();
            onOpenDiary?.();
          }}
        />
        <Row
          icon={<Save size={18} />}
          label="저장 · 불러오기"
          colorClass="text-violet-200"
          onClick={() => {
            onClose?.();
            onOpenSaveLoad?.();
          }}
        />
        <Row
          icon={<History size={18} />}
          label="대화 기록"
          onClick={() => {
            onClose?.();
            onOpenHistory?.();
          }}
        />
        {/* 도움말·문의 — HelpButton 이 자체 SupportPanel(z-200) 을 연다(로직 불변) */}
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
