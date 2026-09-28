import { motion, AnimatePresence } from "framer-motion";
import { useRef } from "react";
import { X, Heart, ChevronRight } from "lucide-react";
import { getHeroinePaletteByCharacterId } from "../../utils/characterColor";
import useOverlayFocus from "../mobile/useOverlayFocus";
import useDeviceProfile from "../../hooks/useDeviceProfile";
import "../../styles/aurora-chat.css";

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
 * @param {number|null} props.currentSpeakerCharacterId — [UX2] 화자 강조 제거로 미사용 (호출부 호환 위해 수신만)
 * @param {function} props.onSelect               — (heroine) => void; BiometricStatusPanel 전환
 */
export default function StoryV2HeroineSelector({
  isOpen, onClose, heroines, currentSpeakerCharacterId, onSelect,
}) {
  const panelRef = useRef(null);
  const { isMobile } = useDeviceProfile();
  useOverlayFocus(isOpen, panelRef, onClose, { trapFocus: isMobile });

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={panelRef}
          tabIndex={-1}
          initial={{ x: "-100%" }}
          animate={{ x: 0 }}
          exit={{ x: "-100%" }}
          transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
          role="dialog"
          aria-modal={isMobile || undefined}
          aria-label="캐릭터 관계 선택"
          className="aurora-drawer fixed inset-y-0 left-0 w-full md:w-[400px] z-[60] border-r flex flex-col"
        >
          {/* Header */}
          <div className="flex justify-between items-center p-6 border-b border-white/10 bg-white/5">
            <h2 className="text-lg font-semibold text-lobby-tx0 flex items-center gap-2">
              <Heart size={20} className="text-lobby-accent" />
              누구의 마음이 궁금한가요?
            </h2>
            <button
              onClick={onClose}
              aria-label="캐릭터 관계 닫기"
              className="aurora-icon-close -mr-2 transition"
            >
              <X size={22} className="text-white/70" />
            </button>
          </div>

          {/* 히로인 카드 리스트 */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 space-y-3 custom-scrollbar">
            {(heroines || []).map((h, i) => {
              // [UX2] 화자 강조 제거 + 시네마틱 카드 — 캐릭터 컬러 악센트 / 풀하이트 초상 / 호감 게이지
              const palette = getHeroinePaletteByCharacterId(h.characterId, heroines);
              const affection = Math.max(0, Math.min(100, h.statAffection ?? 0));
              return (
                <motion.button
                  key={h.characterId}
                  onClick={() => onSelect(h)}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.985 }}
                  className={`group relative w-full rounded-2xl border text-left overflow-hidden transition ${palette.bubble} hover:border-white/30`}
                >
                  <div className="flex items-stretch">
                    {/* 풀하이트 초상 — 우측으로 페이드되며 텍스트 영역과 융합 */}
                    <div className="relative w-24 self-stretch flex-shrink-0 overflow-hidden bg-gradient-to-br from-lobby-accent/25 to-lobby-teal/10">
                      {h.profileImageUrl ? (
                        <img
                          src={h.profileImageUrl}
                          alt={h.name}
                          className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-110"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-white/20 text-3xl">?</div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-black/60" />
                    </div>

                    {/* 정보 */}
                    <div className="flex-1 min-w-0 px-4 py-3.5 flex flex-col justify-center gap-1.5">
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span className={`font-bold text-lg text-white tracking-wide truncate`}>{h.name}</span>
                      </div>

                      {h.dynamicRelationTag && (
                        <span className={`self-start px-2 py-0.5 rounded-full border border-white/15 bg-black/25 text-xs italic ${palette.accent} truncate max-w-full`}>
                          {h.dynamicRelationTag}
                        </span>
                      )}

                      {/* 호감 게이지 */}
                      <div className="mt-0.5">
                        <div className="flex justify-between text-xs text-white/40 mb-1">
                          <span>호감 {affection}</span>
                          <span>친밀 {h.statIntimacy}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-black/40 overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full bg-gradient-to-r from-rose-500/70 to-rose-300`}
                            initial={{ width: 0 }}
                            animate={{ width: `${affection}%` }}
                            transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 + i * 0.05 }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* 진입 어포던스 */}
                    <div className="flex items-center pr-3 text-white/25 group-hover:text-white/60 transition">
                      <ChevronRight size={18} />
                    </div>
                  </div>
                </motion.button>
              );
            })}

            {(!heroines || heroines.length === 0) && (
              <p className="text-center text-lobby-tx1 text-sm leading-relaxed py-10">
                아직 만난 캐릭터가 없어요.<br />이야기가 시작되면 이곳에서 마음을 살펴보세요.
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
