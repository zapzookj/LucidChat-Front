import { motion } from "framer-motion";
import { Play, Sparkles, Star, Users, Clock, MapPin } from "lucide-react";
import { playSfx } from "../../utils/sfx";

/**
 * [Chunk D] Story V2 방 카드 — 기억의 끈 패널 (Continue) 전용.
 *
 * V1 DialogueRoomCard와 시각적으로 차별화:
 *   - 캐릭터 단일 썸네일 X → World 썸네일 + 멀티 히로인 표지
 *   - 스탯 바 X → "X일차 진행 중" / 히로인 수 표시
 *   - 톤: amber (V2의 디렉터/판타지 색조)
 *
 * V2 방 데이터는 LobbyService.toV2StoryRoomSummary에서 매핑된 RoomSummaryResponse:
 *   - characterId === null
 *   - characterName  → World 이름 (또는 worldDisplayName 백엔드 확장 시)
 *   - characterThumbnailUrl → World 썸네일
 *   - chatMode === "STORY"
 *   - dynamicRelationTag === "이야기 진행 중" (백엔드 기본값)
 *   - currentDay (백엔드 확장으로 추가, V1 호출 시 0)
 *   - heroineCount (백엔드 확장으로 추가, V1 호출 시 0)
 *
 * @param {object}   props
 * @param {object}   props.room      — V2 RoomSummaryResponse
 * @param {function} props.onSelect  — (roomId: number) => void
 */
export default function StoryV2RoomCard({ room, onSelect }) {
  // 백엔드 확장 필드 — 미존재 시 안전 폴백
  const currentDay = room.currentDay ?? 0;
  const heroineCount = room.heroineCount ?? 0;

  const worldName = room.characterName || "(unknown world)";
  const worldThumb = room.characterThumbnailUrl;

  // 엔딩 상태 시각화 (V1과 동일 톤)
  const endingBadge = room.endingReached
    ? (room.endingType === "HAPPY" ? "text-amber-400" : "text-rose-400")
    : null;

  return (
    <motion.div
      onClick={() => {
        playSfx(`/sounds/sfx_button_click.wav`, 0.3);
        onSelect(room.roomId);
      }}
      onMouseEnter={() => playSfx(`/sounds/sfx_button_hover.ogg`, 0.12)}
      whileHover={{ scale: 1.01, transition: { type: "spring", stiffness: 400, damping: 25 } }}
      whileTap={{ scale: 0.99 }}
      className="relative group p-4 rounded-xl border border-amber-400/15 bg-gradient-to-br from-amber-500/5 via-white/[0.02] to-purple-500/5 hover:from-amber-500/10 hover:to-purple-500/10 hover:border-amber-400/30 cursor-pointer transition-colors duration-200 overflow-hidden"
    >
      {/* V2 식별 sparkle accent — 우상단 미세 마크 */}
      <div className="absolute top-2 right-2 opacity-60 group-hover:opacity-100 transition">
        <Sparkles size={10} className="text-amber-300" />
      </div>

      <div className="flex items-start gap-3.5">
        {/* World 썸네일 — 사각형 (V1 캐릭터 원형과 시각 구분) */}
        <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-amber-400/20 flex-shrink-0 bg-slate-800">
          {worldThumb ? (
            <img src={worldThumb} alt={worldName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-amber-300/30">
              <Sparkles size={22} />
            </div>
          )}
          {room.endingReached && (
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 flex items-center justify-center rounded-full bg-slate-900 border border-white/20">
              <Star size={8} className={endingBadge} fill="currentColor" />
            </div>
          )}
        </div>

        {/* 본문 */}
        <div className="flex-1 min-w-0">
          {/* World 이름 + V2 뱃지 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-amber-100 text-sm truncate max-w-[180px]">
              {worldName}
            </span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border bg-amber-400/15 text-amber-300 border-amber-400/30">
              스토리 · V2
            </span>
          </div>

          {/* 진행 정보: 일차 + 히로인 수 */}
          <div className="flex items-center gap-3 mt-2 text-xs text-amber-200/70">
            {currentDay > 0 && (
              <span className="flex items-center gap-1">
                <Clock size={11} />
                <span className="tabular-nums">{currentDay}</span>일차
              </span>
            )}
            {heroineCount > 0 && (
              <>
                <span className="text-white/15">·</span>
                <span className="flex items-center gap-1">
                  <Users size={11} />
                  <span className="tabular-nums">{heroineCount}</span>명
                </span>
              </>
            )}
            {/* 백엔드 확장 전: currentDay/heroineCount 미노출 시 fallback */}
            {currentDay === 0 && heroineCount === 0 && (
              <span className="italic text-amber-200/50">{room.dynamicRelationTag || "진행 중"}</span>
            )}
          </div>

          {/* 마지막 활동 시간 + 엔딩 표시 */}
          <div className="flex items-center gap-2 mt-1.5">
            <MapPin size={10} className="text-amber-300/40" />
            <span className="text-[11px] text-white/30 truncate">
              {formatRelativeTime(room.lastActiveAt)}
            </span>
            {room.endingReached && (
              <span className="text-[10px] text-amber-200/60 ml-auto italic">
                {room.endingTitle ||
                  (room.endingType === "HAPPY" ? "결말 도달" : "이야기 종결")}
              </span>
            )}
          </div>
        </div>

        {/* 진입 아이콘 */}
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-400/10 group-hover:bg-amber-400/20 transition-colors duration-200 mt-1">
          <Play size={12} className="text-amber-300/70 group-hover:text-amber-200 transition-colors duration-200 ml-0.5" />
        </div>
      </div>
    </motion.div>
  );
}

// ── 시간 포맷 helper (V1 LobbyPage와 동일 로직 — 일관성 유지) ──
function formatRelativeTime(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}