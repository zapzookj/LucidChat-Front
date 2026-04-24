import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import api from "../../api/axios";

/**
 * [Phase 5.5-Theater-Polish] 대화 기록 패널
 *
 * 이슈 #4 해결: 한 번 지나간 씬을 다시 읽을 수 있는 뷰.
 *
 * Props:
 *   roomId
 *   visible
 *   onClose
 *   currentAct      : 현재 진행 중인 Act (기본 선택)
 *   currentChapter  : 현재 진행 중인 Chapter
 *   avatarName
 */

export default function TheaterSceneHistoryPanel({
  roomId,
  visible,
  onClose,
  currentAct = 1,
  currentChapter = 1,
  avatarName = "주인공",
}) {
  const [selectedAct, setSelectedAct] = useState(currentAct);
  const [selectedChapter, setSelectedChapter] = useState(currentChapter);
  const [scenes, setScenes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 선택된 Act/Chapter 변경 시 데이터 로드
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(
          `/theater/rooms/${roomId}/scene-history/chapter/${selectedAct}/${selectedChapter}`
        );
        if (alive) setScenes(res.data || []);
      } catch (e) {
        if (alive) {
          console.error("[Theater] history load failed:", e);
          setError("기록을 불러오지 못했습니다.");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [visible, roomId, selectedAct, selectedChapter]);

  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 16 }}
        className="relative w-full max-w-3xl max-h-[85vh] bg-slate-900/95 rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-indigo-300" />
            <div>
              <div className="text-[10px] uppercase tracking-widest text-white/40">
                Scene History
              </div>
              <h2 className="text-base font-bold text-white">대화 기록</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/50"
          >
            <X size={16} />
          </button>
        </div>

        {/* Act / Chapter 셀렉터 */}
        <div className="px-5 py-3 border-b border-white/5 bg-black/30">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/40 font-bold">Act</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((act) => (
                  <button
                    key={act}
                    onClick={() => {
                      setSelectedAct(act);
                      setSelectedChapter(1);
                    }}
                    disabled={act > currentAct}
                    className={`px-3 py-1 rounded-full text-xs font-bold border transition ${
                      selectedAct === act
                        ? "bg-indigo-500/20 border-indigo-400/60 text-indigo-100"
                        : act > currentAct
                        ? "bg-white/[0.02] border-white/5 text-white/20 cursor-not-allowed"
                        : "bg-white/[0.04] border-white/10 text-white/60 hover:bg-white/[0.08]"
                    }`}
                  >
                    {act}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-white/40 font-bold">Chapter</span>
              <div className="flex gap-1 flex-wrap">
                {Array.from({ length: selectedAct === currentAct ? currentChapter : 8 }, (_, i) => i + 1)
                  .slice(0, 8)
                  .map((ch) => (
                    <button
                      key={ch}
                      onClick={() => setSelectedChapter(ch)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold border transition ${
                        selectedChapter === ch
                          ? "bg-purple-500/20 border-purple-400/60 text-purple-100"
                          : "bg-white/[0.04] border-white/10 text-white/60 hover:bg-white/[0.08]"
                      }`}
                    >
                      {ch}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* 씬 리스트 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading && (
            <div className="flex justify-center py-12">
              <motion.div
                className="w-8 h-8 border-2 border-white/20 border-t-white/70 rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
              />
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-red-300 text-sm">{error}</div>
          )}

          {!loading && !error && scenes.length === 0 && (
            <div className="text-center py-12 text-white/30 text-sm">
              이 Chapter에 기록된 씬이 없습니다.
            </div>
          )}

          {!loading && !error && scenes.map((s, i) => (
            <SceneHistoryCard key={s.id || i} scene={s} avatarName={avatarName} />
          ))}
        </div>

        {/* 푸터 */}
        <div className="px-5 py-3 border-t border-white/5 bg-black/30 text-center">
          <div className="text-[10px] text-white/40">
            Act {selectedAct} · Chapter {selectedChapter} · {scenes.length}개 씬
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  씬 기록 카드
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function SceneHistoryCard({ scene, avatarName }) {
  const [expanded, setExpanded] = useState(false);

  const isAvatar = scene.speakerType === "AVATAR";
  const isHeroine = scene.speakerType === "HEROINE";

  const hasInner = !!scene.innerNarration;
  const hasDialogue = !!scene.dialogue;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-white/[0.03] border border-white/5 p-4 hover:border-white/15 transition"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-mono text-white/30">
            #{scene.sceneSeqInChapter + 1}
          </span>
          {scene.location && (
            <span className="text-[10px] text-indigo-300/60 bg-indigo-500/10 rounded-full px-2 py-0.5 border border-indigo-400/20">
              {scene.location}
            </span>
          )}
          {scene.timeOfDay && (
            <span className="text-[10px] text-amber-300/60 bg-amber-500/10 rounded-full px-2 py-0.5 border border-amber-400/20">
              {scene.timeOfDay}
            </span>
          )}
          {scene.emotion && scene.emotion !== "NEUTRAL" && (
            <span className="text-[10px] text-rose-300/60 bg-rose-500/10 rounded-full px-2 py-0.5 border border-rose-400/20">
              {scene.emotion}
            </span>
          )}
        </div>
        {(hasInner || scene.narration?.length > 200) && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-white/40 hover:text-white/70 p-0.5"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      {/* 나레이션 */}
      {scene.narration && (
        <div
          className={`text-white/80 text-sm leading-relaxed mb-2 ${
            !expanded && scene.narration.length > 200 ? "line-clamp-3" : ""
          }`}
          style={{ fontFamily: "'Noto Serif KR', serif" }}
        >
          {scene.narration}
        </div>
      )}

      {/* 속마음 (expanded일 때만) */}
      {hasInner && expanded && (
        <div className="pl-3 border-l-2 border-purple-400/40 my-2">
          <div className="text-purple-200/80 text-xs italic leading-relaxed">
            <span className="text-purple-400/60">「</span>
            {scene.innerNarration}
            <span className="text-purple-400/60">」</span>
          </div>
        </div>
      )}

      {/* 대사 */}
      {hasDialogue && (
        <div className={`mt-2 ${isAvatar ? "flex justify-end" : ""}`}>
          {isAvatar ? (
            <div className="inline-block px-3 py-1.5 rounded-xl rounded-tr-sm bg-cyan-500/10 border border-cyan-400/25 max-w-[85%]">
              <div className="text-cyan-200/90 text-[10px] font-bold mb-0.5">
                {avatarName}
              </div>
              <div className="text-white text-sm leading-relaxed">
                {scene.dialogue}
              </div>
            </div>
          ) : (
            <div className="inline-block px-3 py-1.5 rounded-xl rounded-tl-sm bg-amber-500/10 border border-amber-400/25 max-w-[85%]">
              <div className="text-amber-200/90 text-[10px] font-bold mb-0.5">
                {scene.speakerName || "?"}
              </div>
              <div className="text-white text-sm leading-relaxed">
                "{scene.dialogue}"
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}