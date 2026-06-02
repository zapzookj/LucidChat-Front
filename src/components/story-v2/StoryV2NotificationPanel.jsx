import { motion } from "framer-motion";
import { X } from "lucide-react";

/**
 * Story V2 알림 패널 — 전체 알림 리스트 모달 (수동 열기).
 *
 * @param {object}   props
 * @param {Array}    props.notifications  — [{ notificationId, fromCharacterName, content, worldDay, worldDayPart }, ...]
 * @param {function} props.onClose
 * @param {function} props.onItemClick    — (notification) => void (markRead + close)
 */
export default function StoryV2NotificationPanel({ notifications, onClose, onItemClick }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-stone-900 rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto"
      >
        <div className="px-5 py-4 border-b border-stone-700 flex items-center justify-between">
          <h3 className="font-bold text-amber-200">알림 ({notifications.length})</h3>
          <button onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="p-4">
          {notifications.length === 0 ? (
            <p className="text-center text-stone-500 py-8">새 알림이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => (
                <button
                  key={n.notificationId}
                  onClick={() => {
                    onItemClick(n);
                    onClose();
                  }}
                  className="block w-full text-left p-3 bg-stone-800 hover:bg-stone-700 rounded transition"
                >
                  <div className="text-xs text-amber-300 mb-1">
                    {n.fromCharacterName} · {n.worldDay}일차 {n.worldDayPart}
                  </div>
                  <div className="text-sm">{n.content}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}