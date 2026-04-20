import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, Download, Zap, Clock, BookOpen } from "lucide-react";
import { fetchSaveSlots, saveSlot, loadSlot } from "../../api/TheaterFinalityApi";

/**
 * [Phase 5.5-Theater] 세이브/로드 패널 — 모달 형태
 *
 * Props:
 *   roomId
 *   onClose
 *   mode: "save" | "load"
 *   onLoaded(slot): 로드 성공 시 콜백 (페이지가 리로드 등 처리)
 */
export default function TheaterSaveLoadPanel({ roomId, onClose, mode = "save", onLoaded }) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingSlot, setWorkingSlot] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await fetchSaveSlots(roomId);
        if (alive) setSlots(data || []);
      } catch (e) {
        console.error("[Theater] Save list failed:", e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [roomId]);

  const handleSave = async (slotNumber) => {
    setWorkingSlot(slotNumber);
    try {
      await saveSlot(roomId, { slotNumber, label: null });
      const fresh = await fetchSaveSlots(roomId);
      setSlots(fresh);
    } catch (e) {
      console.error("[Theater] Save failed:", e);
    } finally {
      setWorkingSlot(null);
    }
  };

  const handleLoad = async (slotNumber) => {
    if (!window.confirm("현재 진행을 덮어쓰고 이 슬롯으로 로드하시겠습니까?")) return;
    setWorkingSlot(slotNumber);
    try {
      const result = await loadSlot(roomId, slotNumber);
      if (onLoaded) onLoaded(result);
      onClose();
    } catch (e) {
      console.error("[Theater] Load failed:", e);
    } finally {
      setWorkingSlot(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="relative w-full max-w-xl max-h-[80vh] bg-slate-900 border border-white/10 rounded-3xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {mode === "save" ? (
              <Save size={18} className="text-indigo-300" />
            ) : (
              <Download size={18} className="text-amber-300" />
            )}
            <div>
              <div className="text-xs uppercase tracking-widest text-white/40">
                {mode === "save" ? "Save" : "Load"}
              </div>
              <h2 className="text-lg font-bold text-white">
                {mode === "save" ? "이야기 저장" : "이야기 불러오기"}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-white/50"
          >
            <X size={16} />
          </button>
        </div>

        {/* 슬롯 리스트 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading && (
            <div className="flex justify-center py-12">
              <motion.div
                className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
            </div>
          )}

          {!loading && slots.map((slot) => (
            <SlotCard
              key={slot.slotNumber}
              slot={slot}
              mode={mode}
              working={workingSlot === slot.slotNumber}
              onSave={() => handleSave(slot.slotNumber)}
              onLoad={() => handleLoad(slot.slotNumber)}
            />
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ━━━ 슬롯 카드 ━━━

function SlotCard({ slot, mode, working, onSave, onLoad }) {
  const isQuick = slot.slotNumber === 0;
  const disabled =
    (mode === "save" && isQuick) ||  // Quick 슬롯은 수동 저장 불가
    working;

  const action = mode === "save" ? onSave : onLoad;
  const canAction = mode === "save" ? !isQuick : !slot.empty;

  return (
    <motion.div
      whileHover={!disabled && canAction ? { scale: 1.01 } : {}}
      whileTap={!disabled && canAction ? { scale: 0.99 } : {}}
      onClick={!disabled && canAction ? action : null}
      className={`relative rounded-2xl p-4 border transition-all ${
        slot.empty
          ? "bg-white/[0.02] border-white/10"
          : isQuick
          ? "bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-400/30"
          : "bg-white/[0.04] border-white/10"
      } ${
        disabled ? "opacity-40 cursor-not-allowed" : canAction ? "cursor-pointer hover:border-white/30" : "opacity-60"
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
            {isQuick ? "Quick" : `Slot ${slot.slotNumber}`}
          </span>
          {isQuick && <Zap size={10} className="text-amber-300" />}
        </div>
        {!slot.empty && (
          <div className="text-[10px] text-white/40 flex items-center gap-1">
            <Clock size={9} />
            {slot.savedAt && new Date(slot.savedAt).toLocaleString("ko-KR", {
              month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
            })}
          </div>
        )}
      </div>

      {slot.empty ? (
        <div className="text-white/30 text-sm text-center py-4">
          {mode === "save" ? "빈 슬롯 — 저장하려면 탭하세요" : "저장된 데이터 없음"}
        </div>
      ) : (
        <>
          <div className="font-bold text-white">{slot.label}</div>
          <div className="flex items-center gap-2 mt-1 text-xs text-white/50">
            <BookOpen size={10} />
            <span>Act {slot.actNumber} · Chapter {slot.chapterNumber}</span>
          </div>
          {slot.previewText && (
            <div className="text-xs text-white/40 mt-2 italic line-clamp-1">
              {slot.previewText}
            </div>
          )}
        </>
      )}

      {working && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-2xl">
          <motion.div
            className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
          />
        </div>
      )}
    </motion.div>
  );
}