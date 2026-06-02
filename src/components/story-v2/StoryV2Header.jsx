import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Clock, MapPin,
  Sparkles, Moon, Volume2, VolumeX, Sun, Sunset,
  Users, Bell, RotateCcw,
} from "lucide-react";
import { dayPartLabel, dayPartAccentClass } from "../../utils/dayPart";

/**
 * Story V2 헤더 — V1보다 풍부한 정보 표시 + 4 진입점 (일러스트 / 시크릿 / 오디오 / 패널).
 *
 * <p>좌측: 뒤로 + World 이름 + 시간대(아이콘+한글+톤컬러) + 현재 장소
 * <p>우측: 일러스트 ✨ / 시크릿 모드 🌙 / 오디오 메뉴 🔊 / 히로인 패널 / 알림 🔔 / 초기화
 *
 * @param {object}  props
 * @param {object}  props.room                — Story V2 방 상태
 * @param {string}  props.v1Time              — "DAY" | "SUNSET" | "NIGHT" (아이콘 선택용)
 * @param {number}  props.notificationCount
 * @param {boolean} props.isMuted
 * @param {boolean} props.showAudioMenu
 * @param {number}  props.bgmVolume           — 0.0 ~ 1.0
 * @param {boolean} props.secretModeActive
 * @param {boolean} props.canIllustrate       — energy >= 10 AND heroines.length > 0
 * @param {function} props.onBack
 * @param {function} props.onShowNotifications
 * @param {function} props.onShowCharacters
 * @param {function} props.onShowReset
 * @param {function} props.onIllustrate
 * @param {function} props.onToggleSecret
 * @param {function} props.onToggleMute
 * @param {function} props.onToggleAudioMenu
 * @param {function} props.onVolumeChange     — (volume: number) => void
 */
export default function StoryV2Header({
  room, v1Time, notificationCount,
  isMuted, showAudioMenu, bgmVolume, secretModeActive, canIllustrate,
  onBack, onShowNotifications, onShowCharacters, onShowReset,
  onIllustrate, onToggleSecret, onToggleMute, onToggleAudioMenu, onVolumeChange,
}) {
  const dayPartKR = dayPartLabel(room.currentDayPart);
  const accentClass = dayPartAccentClass(room.currentDayPart);

  // 시간대별 아이콘
  const TimeIcon = v1Time === "DAY" ? Sun : v1Time === "SUNSET" ? Sunset : Moon;

  return (
    <header className="fixed top-0 inset-x-0 z-30 px-4 sm:px-6 py-3 bg-gradient-to-b from-black/70 to-transparent backdrop-blur-sm">
      <div className="flex items-center justify-between max-w-5xl mx-auto">
        {/* ── 좌측: 뒤로 + World/시간/장소 ── */}
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={onBack} className="p-1.5 hover:bg-white/10 rounded transition flex-shrink-0">
            <ArrowLeft size={20} />
          </button>
          <div className="ml-1 min-w-0">
            <div className="text-sm font-medium truncate">{room.worldDisplayName}</div>
            <div className="text-xs text-stone-400 flex items-center gap-1.5 truncate">
              <TimeIcon size={11} className={accentClass} />
              <span className={accentClass}>{room.currentDay}일차 · {dayPartKR}</span>
              <span className="mx-1">·</span>
              <MapPin size={11} />
              <span className="truncate">{room.currentUserLocationDisplayName}</span>
            </div>
          </div>
        </div>

        {/* ── 우측: 액션 버튼들 ── */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* 일러스트 생성 */}
          <button
            onClick={onIllustrate}
            disabled={!canIllustrate}
            className={`p-2 rounded transition ${
              canIllustrate
                ? "hover:bg-white/10 text-purple-300"
                : "text-white/20 cursor-not-allowed"
            }`}
            aria-label="일러스트 생성"
            title={canIllustrate ? "현재 순간을 일러스트로" : "에너지 부족"}
          >
            <Sparkles size={18} />
          </button>

          {/* 시크릿 모드 토글 */}
          <button
            onClick={onToggleSecret}
            className={`p-2 rounded transition ${
              secretModeActive
                ? "bg-purple-500/20 text-purple-300"
                : "hover:bg-white/10 text-white/60"
            }`}
            aria-label="시크릿 모드"
            title={secretModeActive ? "시크릿 모드 활성화됨" : "시크릿 모드"}
          >
            <Moon size={18} />
          </button>

          {/* 오디오 메뉴 — 음소거 토글 + 볼륨 슬라이더 */}
          <div className="relative">
            <button
              onClick={onToggleAudioMenu}
              className="p-2 hover:bg-white/10 rounded transition"
              aria-label="오디오 설정"
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <AnimatePresence>
              {showAudioMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-11 z-50 w-48 bg-stone-900/95 backdrop-blur border border-white/10 rounded-lg shadow-xl p-3"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      onClick={onToggleMute}
                      className="p-1 hover:bg-white/10 rounded"
                    >
                      {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                    <span className="text-xs text-white/70">
                      {isMuted ? "음소거" : "음악"}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={bgmVolume}
                    onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                    disabled={isMuted}
                    className="w-full h-1 accent-amber-400 disabled:opacity-30"
                    aria-label="볼륨"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 히로인 패널 */}
          <button
            onClick={onShowCharacters}
            className="p-2 hover:bg-white/10 rounded transition"
            aria-label="히로인 패널"
          >
            <Users size={18} />
          </button>

          {/* 알림 */}
          <button
            onClick={onShowNotifications}
            className="relative p-2 hover:bg-white/10 rounded transition"
            aria-label="알림"
          >
            <Bell size={18} />
            {notificationCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-400 rounded-full" />
            )}
          </button>

          {/* 초기화 */}
          <button
            onClick={onShowReset}
            className="p-2 hover:bg-white/10 rounded transition"
            aria-label="초기화"
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}