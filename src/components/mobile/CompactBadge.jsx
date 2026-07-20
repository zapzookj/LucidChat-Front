import { sfx } from "../../utils/sfx";

/**
 * [Phase B · 단계0] CompactBadge — 아이콘+값 컴팩트 배지(탭 확장 트리거).
 *
 * SupportPanel StatusChip / StoryV2 "지금 화자" chip 스타일을 코드화.
 * HUD compact strip(BPM/Energy/Boost) 및 T3 접힘 트리거에 재사용.
 *
 * - onClick 이 있으면 <button>(≥44px 터치 타깃, click sfx) / 없으면 <div>(정적 배지).
 * - 색은 호스트 화면 방언에 맞추도록 className 으로 오버라이드(기본 중립 화이트).
 *
 * Props:
 *   icon?       : lucide 아이콘 컴포넌트
 *   iconNode?   : 커스텀 아이콘 노드(icon 대신)
 *   value?      : 우측 숫자/값(tabular-nums)
 *   children?   : 라벨
 *   active?     : 활성 강조
 *   onClick?    : 있으면 인터랙티브
 *   ariaLabel?, title?, className?
 */
export default function CompactBadge({
  icon: Icon,
  iconNode,
  value,
  children,
  active = false,
  onClick,
  ariaLabel,
  title,
  className = "",
}) {
  const interactive = typeof onClick === "function";
  const sizeCls = interactive ? "min-h-[44px] px-3" : "min-h-[30px] px-2.5";
  const toneCls = active
    ? "bg-white/15 border-white/25 text-white"
    : "bg-white/[0.06] border-white/10 text-white/75";
  const interactiveCls = interactive
    ? "hover:bg-white/[0.12] active:scale-[0.97] transition-[transform,background-color]"
    : "";

  const inner = (
    <>
      {Icon ? <Icon size={15} className="flex-shrink-0" /> : iconNode || null}
      {children != null && <span className="leading-none">{children}</span>}
      {value != null && <span className="leading-none tabular-nums">{value}</span>}
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        onClick={() => {
          sfx.click();
          onClick();
        }}
        aria-label={ariaLabel}
        title={title}
        className={`inline-flex items-center gap-1.5 rounded-full border text-sm font-medium tracking-tight ${sizeCls} ${toneCls} ${interactiveCls} ${className}`}
      >
        {inner}
      </button>
    );
  }

  return (
    <div
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border text-sm font-medium tracking-tight ${sizeCls} ${toneCls} ${className}`}
    >
      {inner}
    </div>
  );
}
