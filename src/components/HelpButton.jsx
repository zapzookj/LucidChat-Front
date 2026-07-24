import { useState, useEffect, useCallback } from "react";
import { LifeBuoy } from "lucide-react";
import { sfx } from "../utils/sfx";
import { fetchUnreadCount } from "../api/SupportApi";
import SupportPanel from "./SupportPanel";

/**
 * 상단바 상시 도움말 버튼 (Phase 6).
 *
 * 공유 레이아웃이 없으므로 각 페이지 상단바에 배치한다. 미읽음 알림(티켓 답변 등) 배지를
 * 폴링으로 표시하고, 클릭 시 SupportPanel(도움말·문의)을 연다.
 *
 * @param {string} [className] 페이지별 버튼 스타일(미지정 시 로비 상단바 기본 스타일).
 * @param {number} [iconSize]
 */
export default function HelpButton({ className = "", iconSize = 14 }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const poll = useCallback(async () => {
    try {
      setUnread(await fetchUnreadCount());
    } catch {
      /* 비로그인/네트워크 오류는 무시 */
    }
  }, []);

  useEffect(() => {
    poll();
    const t = setInterval(poll, 60000);
    return () => clearInterval(t);
  }, [poll]);

  const base =
    "relative w-8 h-8 flex items-center justify-center rounded-full bg-black/20 backdrop-blur-md border border-white/10 text-white/50 hover:text-white hover:bg-black/40 transition-colors duration-200";

  return (
    <>
      <button
        onClick={() => { sfx.click(); setOpen(true); }}
        onMouseEnter={() => sfx.hover()}
        className={className || base}
        aria-label="도움말 및 문의"
      >
        <LifeBuoy size={iconSize} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-bold leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      <SupportPanel
        open={open}
        onClose={() => { setOpen(false); poll(); }}
        onSeen={poll}
        initialTab={unread > 0 ? "notify" : "qna"}
      />
    </>
  );
}
