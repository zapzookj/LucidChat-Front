import { motion } from "framer-motion";
import { X, MapPin } from "lucide-react";

/**
 * Story V2 캐릭터 패널 — 멀티 히로인 상태 / 스탯 / 위치 / 화자 강조 표시.
 *
 * <p>표시 위계 (시각 강조 우선순위):
 * <ol>
 *   <li>현재 화자 (currentSpeakerCharacterId 일치) — amber ring + "지금 화자" 뱃지</li>
 *   <li>같은 장소에 있음 (isHere) — amber border</li>
 *   <li>그 외 — 중성 회색 배경</li>
 * </ol>
 *
 * @param {object}   props
 * @param {object}   props.room                          — Story V2 방 상태
 * @param {number|null} props.currentSpeakerCharacterId  — 마지막 씬 화자의 characterId (없으면 null)
 * @param {function} props.onClose
 */
export default function StoryV2CharacterPanel({ room, currentSpeakerCharacterId, onClose }) {
  // presence 인덱스: O(1) 조회용
  const presenceByCharId = {};
  for (const p of (room.presences || [])) presenceByCharId[p.characterId] = p;

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
        className="bg-stone-900 rounded-lg max-w-2xl w-full max-h-[85vh] overflow-y-auto"
      >
        <div className="px-5 py-4 border-b border-stone-700 flex items-center justify-between">
          <h3 className="font-bold text-amber-200">히로인 상태</h3>
          <button onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {room.heroines?.map((h) => {
            const presence = presenceByCharId[h.characterId];
            const isHere = presence?.currentLocationKey === room.currentUserLocationKey;
            const isCurrentSpeaker = h.characterId === currentSpeakerCharacterId;
            return (
              <div
                key={h.characterId}
                className={`flex gap-4 p-3 rounded-lg transition-all ${
                  isCurrentSpeaker
                    ? "bg-amber-500/15 border border-amber-400/50 ring-1 ring-amber-400/30"
                    : isHere
                      ? "bg-amber-500/10 border border-amber-400/30"
                      : "bg-stone-800"
                }`}
              >
                {h.profileImageUrl && (
                  <img
                    src={h.profileImageUrl}
                    alt={h.name}
                    className={`w-16 h-16 rounded-full object-cover flex-shrink-0 ${
                      isCurrentSpeaker ? "ring-2 ring-amber-300" : ""
                    }`}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white flex items-center gap-2 flex-wrap">
                    {h.name}
                    {isCurrentSpeaker && (
                      <span className="text-[10px] bg-amber-300 text-black px-1.5 py-0.5 rounded font-bold">
                        지금 화자
                      </span>
                    )}
                    {isHere && !isCurrentSpeaker && (
                      <span className="text-[10px] bg-amber-500 text-black px-1.5 rounded">여기</span>
                    )}
                  </div>
                  <div className="text-xs text-stone-400 mt-1">
                    {h.dynamicRelationTag || "(관계 미정의)"} · BPM {h.currentBpm}
                  </div>
                  <div className="text-xs text-stone-500 mt-1">
                    호감도 {h.statAffection} · 친밀도 {h.statIntimacy} · 신뢰 {h.statTrust}
                  </div>
                  {!isHere && presence && (
                    <div className="text-xs text-stone-500 mt-1.5 flex items-center gap-1">
                      <MapPin size={10} /> {presence.currentLocationDisplayName}
                    </div>
                  )}
                  {h.thoughtUnlocked && h.characterThought && (
                    <div className="text-xs italic text-purple-300 mt-2 line-clamp-2">
                      💭 {h.characterThought}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}