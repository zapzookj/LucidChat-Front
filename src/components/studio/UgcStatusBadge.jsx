import { Lock, Clock, Globe, Moon } from "lucide-react";

/**
 * [Studio v1] UGC 캐릭터 상태 뱃지
 *
 *   visibility:
 *     PRIVATE        → 비공개 (slate)
 *     PENDING_PUBLIC → 심사 중 (amber)
 *     PUBLIC         → 공개 (teal)
 *   secretReviewStatus === "APPROVED" 이면 Secret 승인 rose 미니 아이콘 병기
 */
const VISIBILITY_META = {
  PRIVATE: {
    label: "비공개",
    cls: "bg-slate-500/15 text-slate-300 border-slate-400/30",
    Icon: Lock,
  },
  PENDING_PUBLIC: {
    label: "심사 중",
    cls: "bg-amber-400/15 text-amber-300 border-amber-400/30",
    Icon: Clock,
  },
  PUBLIC: {
    label: "공개",
    cls: "bg-teal-400/15 text-teal-300 border-teal-400/30",
    Icon: Globe,
  },
};

export default function UgcStatusBadge({ visibility, secretReviewStatus, className = "" }) {
  const meta = VISIBILITY_META[visibility] || VISIBILITY_META.PRIVATE;
  const { Icon } = meta;

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span
        className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${meta.cls}`}
      >
        <Icon size={9} />
        {meta.label}
      </span>
      {secretReviewStatus === "APPROVED" && (
        <span
          className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-500/20 border border-rose-400/40"
          title="Secret 승인됨"
        >
          <Moon size={8} className="text-rose-300" />
        </span>
      )}
    </span>
  );
}
