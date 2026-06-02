import { motion, AnimatePresence } from "framer-motion";
import { X, Heart, Mic } from "lucide-react";
import { sfx } from "../../utils/sfx";

/**
 * [Story V2] 히로인 셀렉터 — BiometricStatusPanel을 띄우기 *전* 단계.
 *
 * <p>V1에선 DialogueBox의 STATUS 버튼 → 즉시 BiometricStatusPanel(단일 캐릭터). V2는 멀티 히로인이라
 * 어떤 히로인의 상태를 볼지 *먼저 선택*해야 한다.
 *
 * <p>UX 흐름:
 * <pre>
 *   STATUS 버튼 클릭 → StoryV2HeroineSelector 노출 (히로인 카드 그리드)
 *   → 카드 클릭 → 해당 히로인의 BiometricStatusPanel 노출
 *   → BiometricStatusPanel 닫기 → 셀렉터로 돌아가지 않고 메인으로 (UX 단순화)
 * </pre>
 *
 * <p>크기·위치: BiometricStatusPanel과 동일 (좌측 슬라이드 패널, 모바일 풀스크린).
 * 시각 톤도 BiometricStatusPanel과 유사하게 — 어두운 배경 / 깊은 그라데이션.
 *
 * @param {object}   props
 * @param {boolean}  props.isOpen
 * @param {function} props.onClose
 * @param {Array}    props.heroines               — V2 ChatRoom.heroines (HeroineStateResponse)
 * @param {number|null} props.currentSpeakerCharacterId
 * @param {function} props.onSelect               — (heroine) => void; BiometricStatusPanel 전환
 */
export default function StoryV2HeroineSelector({
  isOpen, onClose, heroines, currentSpeakerCharacterId, onSelect,
}) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "-100%" }}
          animate={{ x: 0 }}
          exit={{ x: "-100%" }}
          transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
          className="fixed inset-y-0 left-0 w-full md:w-[420px] z-[60] shadow-2xl border-r border-white/10 flex flex-col"
          style={{
            background: "linear-gradient(135deg, rgba(15,10,30,0.97), rgba(28,15,45,0.95))",
            backdropFilter: "blur(24px)",
          }}
        >
          {/* Header */}
          <div className="flex justify-between items-center p-6 border-b border-white/10 bg-white/5">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Heart size={20} className="text-rose-400" />
              누구의 상태를 볼까요?
            </h2>
            <button
              onClick={() => { sfx.click(); onClose(); }}
              className="p-2 rounded-full hover:bg-white/10 transition"
            >
              <X size={22} className="text-white/70" />
            </button>
          </div>

          {/* 히로인 카드 리스트 */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
            {(heroines || []).map((h, i) => {
              const isCurrentSpeaker = h.characterId === currentSpeakerCharacterId;
              return (
                <motion.button
                  key={h.characterId}
                  onClick={() => { sfx.click(); onSelect(h); }}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`relative w-full p-4 rounded-xl border text-left transition ${
                    isCurrentSpeaker
                      ? "bg-rose-500/15 border-rose-400/50 ring-1 ring-rose-400/30"
                      : "bg-white/5 hover:bg-white/10 border-white/10"
                  }`}
                >
                  {/* 현재 화자 뱃지 */}
                  {isCurrentSpeaker && (
                    <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-rose-400 text-black text-[9px] font-bold flex items-center gap-0.5">
                      <Mic size={9} /> 화자
                    </span>
                  )}

                  <div className="flex items-center gap-4">
                    {/* 프로필 이미지 */}
                    <div
                      className={`w-16 h-16 rounded-full overflow-hidden flex-shrink-0 bg-white/10 ${
                        isCurrentSpeaker ? "ring-2 ring-rose-300" : ""
                      }`}
                    >
                      {h.profileImageUrl ? (
                        <img src={h.profileImageUrl} alt={h.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/30 text-2xl">
                          ?
                        </div>
                      )}
                    </div>

                    {/* 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white text-base truncate">{h.name}</div>
                      {h.dynamicRelationTag && (
                        <div className="text-xs text-rose-200/70 italic mt-0.5 truncate">
                          ─ {h.dynamicRelationTag} ─
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-white/50">
                        <span>호감 {h.statAffection}</span>
                        <span>·</span>
                        <span>친밀 {h.statIntimacy}</span>
                        <span>·</span>
                        <span className="text-rose-300/70 tabular-nums">♥ {h.currentBpm}</span>
                      </div>
                    </div>
                  </div>
                </motion.button>
              );
            })}

            {(!heroines || heroines.length === 0) && (
              <p className="text-center text-white/30 text-sm py-10">
                히로인 정보가 없습니다.
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}