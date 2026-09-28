import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { X, MapPin } from "lucide-react";
import useOverlayFocus from "../mobile/useOverlayFocus";
import "../../styles/aurora-chat.css";

/**
 * Story V2 장소 이동 모달 — 시드된 WorldLocation 목록에서 선택.
 *
 * <p>[TODO Phase 7+] 정적 location 풀을 별도 API로 캐싱.
 *   현재는 fetchCreateContext를 재사용 — 다소 무거우나 작동.
 *
 * <p>[향후 확장 (BM 피벗 결정 #1)] hybrid 모델에서 LLM이 발견한 emergent location도
 *   목록에 함께 노출 가능. 현재는 시드 + LLM 추가 등록된 행 통합 노출 (백엔드 시드 정책에 따름).
 *
 * @param {object}   props
 * @param {string}   props.currentLocationKey
 * @param {number}   props.worldId
 * @param {function} props.onClose
 * @param {function} props.onMove                — (locationKey: string) => void
 */
export default function StoryV2LocationMoveModal({ currentLocationKey, worldId, onClose, onMove }) {
  const panelRef = useRef(null);
  useOverlayFocus(true, panelRef, onClose);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import("../../api/StoryV2Api")
      .then(({ fetchCreateContext }) => fetchCreateContext(worldId))
      .then((ctx) => setLocations(ctx.startLocations || []))
      .catch((e) => console.warn("[V2-Chat] locations load failed", e))
      .finally(() => setLoading(false));
  }, [worldId]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-lobby-bg/75 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="장소 이동"
        onClick={(e) => e.stopPropagation()}
        className="aurora-story-surface max-w-md w-full max-h-[80dvh] overflow-y-auto overscroll-contain custom-scrollbar"
      >
        <div className="px-5 py-4 border-b border-stone-700 flex items-center justify-between">
          <h3 className="font-bold text-amber-200 flex items-center gap-2">
            <MapPin size={18} /> 어디로 이동할까요?
          </h3>
          <button onClick={onClose} className="aurora-icon-close -mr-2" aria-label="장소 이동 닫기">
            <X size={20} />
          </button>
        </div>
        <div className="p-4 space-y-2">
          {loading && <p role="status" className="text-lobby-tx1 text-center py-6">이동할 장소를 살펴보고 있어요…</p>}
          {!loading && locations.length === 0 && <p className="text-sm leading-relaxed text-lobby-tx1 text-center py-6">표시할 장소를 찾지 못했어요.<br />잠시 후 다시 열어 주세요.</p>}
          {locations.map((l) => {
            const isCurrent = l.locationKey === currentLocationKey;
            return (
              <button
                key={l.locationKey}
                disabled={isCurrent}
                onClick={() => onMove(l.locationKey)}
                className="aurora-story-option block w-full text-left disabled:cursor-default"
              >
                <div className="font-medium text-white flex items-center justify-between">
                  {l.displayName}
                  {isCurrent && <span className="text-xs text-amber-300">(현재)</span>}
                </div>
                {l.description && (
                  <div className="text-xs text-lobby-tx2 mt-1">{l.description}</div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
