import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Sun, Sunset, Moon } from "lucide-react";
import { dayPartLabel, dayPartAccentClass, dayPartToV1Time } from "../../utils/dayPart";

/**
 * [Story V2] 상단 중앙 인디케이터 — V1 ChatPage의 상단 라인(로비/설정/대화기록 버튼과 같은 위치)에
 * 노출되는 World/일차/장소 정보 표시 위젯.
 *
 * <p>V1과 시각 일관성 유지: 같은 backdrop-blur / border / shadow 패턴.
 *
 * <p>오프스크린 알림 토스트는 이 컴포넌트 *아래*에 슬롯으로 별도 컴포넌트 (StoryV2NotificationToast)
 * 가 렌더링된다 — 두 컴포넌트가 시각적으로 한 영역을 공유.
 *
 * @param {object}  props
 * @param {object}  props.room          — V2 ChatRoom 상태 (worldDisplayName, currentDay, currentDayPart, currentUserLocationDisplayName)
 */
export default function StoryV2TopIndicator({ room }) {
  if (!room) return null;

  const dayPartKR = dayPartLabel(room.currentDayPart);
  const accentClass = dayPartAccentClass(room.currentDayPart);
  const v1Time = dayPartToV1Time(room.currentDayPart);

  // 시간대별 아이콘 (V1 ChatPage의 lucide-react 아이콘 톤)
  const TimeIcon = v1Time === "DAY" ? Sun : v1Time === "SUNSET" ? Sunset : Moon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="absolute top-6 inset-x-0 z-40 flex justify-center pointer-events-none"
    >
      <div className="pointer-events-auto px-5 py-2.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 shadow-lg flex items-center gap-2.5 max-w-[80vw]">
        {/* World 이름 */}
        <span className="text-sm font-medium text-white/90 truncate max-w-[200px]">
          {room.worldDisplayName}
        </span>

        <span className="text-white/20 text-xs">·</span>

        {/* 일차 + 시간대 */}
        <div className="flex items-center gap-1.5">
          <TimeIcon size={12} className={accentClass} />
          <span className={`text-xs ${accentClass} tabular-nums`}>
            {room.currentDay}일차 · {dayPartKR}
          </span>
        </div>

        <span className="text-white/20 text-xs">·</span>

        {/* 현재 장소 */}
        <div className="flex items-center gap-1 min-w-0">
          <MapPin size={11} className="text-white/50 flex-shrink-0" />
          <span className="text-xs text-white/70 truncate max-w-[150px]">
            {room.currentUserLocationDisplayName}
          </span>
        </div>
      </div>
    </motion.div>
  );
}