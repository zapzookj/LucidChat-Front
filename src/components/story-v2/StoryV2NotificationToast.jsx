import { motion, AnimatePresence } from "framer-motion";
import { Mail } from "lucide-react";

/**
 * [Story V2] 오프스크린 알림 토스트 — 다른 히로인이 보낸 메시지(현재 장소에 없을 때)를
 * 상단 중앙 인디케이터 *아래* 슬롯에 노출.
 *
 * <p>V1 ChatPage의 우상단 toast(showToast) 시스템과 *충돌하지 않는* 별도 레이어.
 * <p>V1 toast: 우상단 fixed top-10 — 게임 시스템 메시지 (에너지 부족 등)
 * <p>V2 알림: 상단 중앙 top-20 — 히로인 메시지 (서사 알림)
 *
 * <p>클릭 시 markRead 콜백 호출 — 사라짐. 최신 3개만 노출 (오래된 것은 알림 패널에서 확인).
 *
 * @param {object}   props
 * @param {Array}    props.notifications  — [{ notificationId, fromCharacterName, content, ... }]
 * @param {function} props.onClick        — (notification) => void
 */
export default function StoryV2NotificationToast({ notifications, onClick }) {
  const recent = (notifications || []).slice(0, 3);

  if (recent.length === 0) return null;

  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 max-w-xs w-full px-4 pointer-events-none">
      <AnimatePresence>
        {recent.map((n) => (
          <motion.button
            key={n.notificationId}
            onClick={() => onClick(n)}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-auto group w-full px-4 py-2.5 rounded-xl bg-amber-500/15 backdrop-blur-md border border-amber-400/30 hover:bg-amber-500/25 hover:border-amber-400/50 transition text-left shadow-lg"
          >
            <div className="flex items-center gap-2 mb-0.5">
              <Mail size={11} className="text-amber-300" />
              <span className="text-[10px] text-amber-300 font-medium uppercase tracking-wider">
                {n.fromCharacterName}
              </span>
            </div>
            <p className="text-xs text-white/85 line-clamp-2 leading-snug">
              {n.content}
            </p>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}