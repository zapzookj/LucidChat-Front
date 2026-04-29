import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Plus, Pencil, Trash2, BookMarked, Sparkles, Drama,
  Coffee, GitBranch, Crown, MessageSquare, Heart
} from "lucide-react";
import {
  fetchDirectorNotes,
  createDirectorNote,
  updateDirectorNote,
  deleteDirectorNote,
} from "../../api/TheaterFinalityApi";

/**
 * [Phase 5.5-Theater · Phase III] TheaterDirectorNotePanel
 *
 * 감독 노트 — 세션 동안 자동/수동으로 쌓인 메모를 한눈에 보여주는 패널.
 * 백엔드 API + Service는 이미 구현되어 있었으나 UI가 없어서 dead-code였음.
 *
 * 노트 타입(서버):
 *   - MANUAL:        유저가 직접 작성. 수정/삭제 가능
 *   - AUTO_MOMENT:   호감도 역전, 스탯 급변 등 자동 캡처
 *   - BRANCH_TAKEN:  분기 선택 시 자동 기록
 *   - INTERMISSION:  인터미션 결과 자동 기록
 *   - CHAPTER_END:   Chapter 종료 시 자동 기록
 *   - INTERVENTION:  난입(개입) 시 자동 기록
 *
 * UX 원칙:
 *   - 시간 역순(최신 위) 정렬 — 백엔드는 ASC라 클라이언트에서 reverse
 *   - 자동 노트는 "회상"의 톤 (이미지+사실), 수동 노트는 "감독의 메모" 톤 (편집 가능)
 *   - 자동 노트도 Act/Chapter 메타로 그룹핑 가능하게 시각적 구분
 *   - 빈 상태에선 "아직 메모가 없습니다 — 첫 메모를 남겨보세요" 격려
 *
 * Props:
 *   roomId   : Long
 *   visible  : bool
 *   onClose  : () => void
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  노트 타입 메타 (정적 매핑 — Tailwind purge 호환)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const NOTE_TYPE_META = {
  MANUAL: {
    label: "감독의 메모",
    Icon: Pencil,
    accent: "text-amber-200",
    accentBg: "bg-amber-500/15",
    accentBorder: "border-amber-400/30",
    description: "당신이 직접 남긴 기록",
    editable: true,
  },
  AUTO_MOMENT: {
    label: "결정적 순간",
    Icon: Sparkles,
    accent: "text-rose-200",
    accentBg: "bg-rose-500/15",
    accentBorder: "border-rose-400/30",
    description: "호감도가 크게 움직인 장면",
    editable: false,
  },
  BRANCH_TAKEN: {
    label: "분기 선택",
    Icon: GitBranch,
    accent: "text-violet-200",
    accentBg: "bg-violet-500/15",
    accentBorder: "border-violet-400/30",
    description: "당신이 만든 갈림길",
    editable: false,
  },
  INTERMISSION: {
    label: "막간의 시간",
    Icon: Coffee,
    accent: "text-emerald-200",
    accentBg: "bg-emerald-500/15",
    accentBorder: "border-emerald-400/30",
    description: "주인공이 성장한 시간",
    editable: false,
  },
  CHAPTER_END: {
    label: "Chapter 종료",
    Icon: Crown,
    accent: "text-indigo-200",
    accentBg: "bg-indigo-500/15",
    accentBorder: "border-indigo-400/30",
    description: "한 막의 끝",
    editable: false,
  },
  INTERVENTION: {
    label: "감독의 개입",
    Icon: MessageSquare,
    accent: "text-cyan-200",
    accentBg: "bg-cyan-500/15",
    accentBorder: "border-cyan-400/30",
    description: "당신이 직접 무대에 올랐을 때",
    editable: false,
  },
};

const FALLBACK_META = {
  label: "기록",
  Icon: BookMarked,
  accent: "text-white/70",
  accentBg: "bg-white/8",
  accentBorder: "border-white/15",
  description: "",
  editable: false,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  시간 포맷
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const formatNoteTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const dy = Math.floor(h / 24);
  if (dy < 7) return `${dy}일 전`;
  return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  메인
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function TheaterDirectorNotePanel({ roomId, visible, onClose }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 작성/편집 모드
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerText, setComposerText] = useState("");
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // ─── 로드 ───
  const loadNotes = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDirectorNotes(roomId);
      setNotes(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("[Theater] Notes fetch failed:", e);
      setError("메모를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    if (visible) loadNotes();
  }, [visible, loadNotes]);

  // ESC 닫기
  useEffect(() => {
    if (!visible) return;
    const handler = (e) => {
      if (e.key === "Escape") {
        if (composerOpen) closeComposer();
        else onClose?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, composerOpen]);

  // ─── 시간 역순 정렬 ───
  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
  }, [notes]);

  // ─── 컴포저 ───
  const openComposerNew = () => {
    setEditingNoteId(null);
    setComposerText("");
    setComposerOpen(true);
  };
  const openComposerEdit = (note) => {
    setEditingNoteId(note.id);
    setComposerText(note.content || "");
    setComposerOpen(true);
  };
  const closeComposer = () => {
    setComposerOpen(false);
    setComposerText("");
    setEditingNoteId(null);
  };

  const handleSubmit = async () => {
    const trimmed = composerText.trim();
    if (!trimmed) return;
    if (trimmed.length > 1000) return;
    setSubmitting(true);
    try {
      if (editingNoteId) {
        const updated = await updateDirectorNote(roomId, editingNoteId, trimmed);
        setNotes((prev) => prev.map((n) => (n.id === editingNoteId ? updated : n)));
      } else {
        const created = await createDirectorNote(roomId, trimmed);
        setNotes((prev) => [...prev, created]);
      }
      closeComposer();
    } catch (e) {
      console.error("[Theater] Note save failed:", e);
      alert(e?.response?.data?.message || "저장에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (note) => {
    const ok = window.confirm("이 메모를 삭제하시겠습니까?");
    if (!ok) return;
    try {
      await deleteDirectorNote(roomId, note.id);
      setNotes((prev) => prev.filter((n) => n.id !== note.id));
    } catch (e) {
      console.error("[Theater] Note delete failed:", e);
      alert(e?.response?.data?.message || "삭제에 실패했습니다.");
    }
  };

  if (!visible) return null;

  // ─── 컴포저 입력 검증 ───
  const composerLength = composerText.trim().length;
  const composerValid = composerLength > 0 && composerLength <= 1000;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex justify-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        className="relative w-full max-w-md h-full bg-slate-900/95 backdrop-blur-xl border-l border-white/10 overflow-hidden flex flex-col"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 280, damping: 30 }}
      >
        {/* ═══ 헤더 ═══ */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <BookMarked size={16} className="text-violet-300" />
              <h2 className="text-lg font-bold text-white tracking-wide">감독의 메모</h2>
            </div>
            <p className="text-xs text-white/30 mt-0.5">Director Notes · 이 극의 기록</p>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-white/45 hover:text-white hover:bg-white/10 transition-colors duration-200"
          >
            <X size={16} />
          </button>
        </div>

        {/* ═══ 본문 ═══ */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4">
          {loading && (
            <div className="flex justify-center py-16">
              <motion.div
                className="w-8 h-8 border-2 border-violet-400/40 border-t-violet-400 rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
            </div>
          )}

          {error && !loading && (
            <div className="text-center py-16">
              <p className="text-rose-300 text-sm mb-3">{error}</p>
              <button
                onClick={loadNotes}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 text-xs hover:bg-white/10 transition-colors"
              >
                다시 시도
              </button>
            </div>
          )}

          {!loading && !error && sortedNotes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-violet-500/10 border border-violet-400/20 flex items-center justify-center mb-3">
                <BookMarked size={26} className="text-violet-300/60" />
              </div>
              <p className="text-sm text-white/55 mb-1">아직 메모가 없습니다</p>
              <p className="text-xs text-white/30 mb-5 leading-relaxed">
                인상 깊은 순간이 자동으로 기록되고,<br />
                당신의 메모도 여기 함께 남습니다
              </p>
              <button
                onClick={openComposerNew}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-200 hover:bg-amber-500/30 transition-colors text-xs font-bold"
              >
                <Plus size={12} />
                첫 메모 남기기
              </button>
            </div>
          )}

          {!loading && !error && sortedNotes.length > 0 && (
            <div className="space-y-3">
              {sortedNotes.map((note, idx) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  index={idx}
                  onEdit={openComposerEdit}
                  onDelete={handleDelete}
                />
              ))}
              <div className="h-2" />
            </div>
          )}
        </div>

        {/* ═══ 하단 작성 버튼 ═══ */}
        {!loading && !error && (
          <div className="flex-shrink-0 border-t border-white/5 p-4 bg-slate-900/50 backdrop-blur-md">
            <button
              onClick={openComposerNew}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/85 to-orange-500/85 hover:from-amber-400 hover:to-orange-400 text-white text-sm font-bold shadow-lg shadow-amber-500/20 transition-colors"
            >
              <Plus size={14} />
              새 메모 작성
            </button>
          </div>
        )}

        {/* ═══ 컴포저 모달 ═══ */}
        <AnimatePresence>
          {composerOpen && (
            <motion.div
              className="absolute inset-0 z-10 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-full max-w-sm bg-slate-900 border border-amber-400/25 rounded-2xl shadow-2xl shadow-amber-500/10 overflow-hidden"
                initial={{ scale: 0.92, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.92, y: 20 }}
                transition={{ type: "spring", stiffness: 320, damping: 28 }}
              >
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    {editingNoteId ? (
                      <Pencil size={14} className="text-amber-300" />
                    ) : (
                      <Plus size={14} className="text-amber-300" />
                    )}
                    <h3 className="text-sm font-bold text-white tracking-wide">
                      {editingNoteId ? "메모 수정" : "새 메모"}
                    </h3>
                  </div>
                  <button
                    onClick={closeComposer}
                    aria-label="닫기"
                    className="w-7 h-7 flex items-center justify-center rounded-full text-white/45 hover:text-white hover:bg-white/8 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="p-5">
                  <textarea
                    autoFocus
                    value={composerText}
                    onChange={(e) => setComposerText(e.target.value)}
                    placeholder="이 순간을 기억하기 위해..."
                    rows={6}
                    maxLength={1000}
                    className="w-full bg-white/[0.04] border border-white/10 focus:border-amber-400/50 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/25 leading-relaxed resize-none focus:outline-none transition-colors"
                  />
                  <div className="flex items-center justify-between mt-2 text-[11px]">
                    <span className="text-white/30">최대 1,000자</span>
                    <span
                      className={`font-mono tabular-nums ${
                        composerLength > 950 ? "text-amber-300" : "text-white/40"
                      }`}
                    >
                      {composerLength} / 1000
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-white/5 bg-black/20">
                  <button
                    onClick={closeComposer}
                    disabled={submitting}
                    className="px-4 py-1.5 rounded-lg text-xs text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    취소
                  </button>
                  <motion.button
                    onClick={handleSubmit}
                    disabled={!composerValid || submitting}
                    whileTap={composerValid && !submitting ? { scale: 0.96 } : {}}
                    whileHover={composerValid && !submitting ? { scale: 1.02 } : {}}
                    className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      composerValid && !submitting
                        ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/25"
                        : "bg-white/8 text-white/30 cursor-not-allowed"
                    }`}
                  >
                    {submitting ? (
                      <>
                        <motion.div
                          className="w-3 h-3 border-[1.5px] border-white/40 border-t-white rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                        />
                        저장 중
                      </>
                    ) : editingNoteId ? (
                      "수정"
                    ) : (
                      "남기기"
                    )}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  노트 카드
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function NoteCard({ note, index, onEdit, onDelete }) {
  const meta = NOTE_TYPE_META[note.noteType] || FALLBACK_META;
  const Icon = meta.Icon;
  const editable = meta.editable;

  // Act/Chapter 메타 라벨
  const actChapterLabel =
    note.actNumber && note.chapterNumber
      ? `Act ${note.actNumber} · Ch ${note.chapterNumber}`
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 * Math.min(index, 8) }}
      className={`relative rounded-xl border bg-white/[0.025] hover:bg-white/[0.05] transition-colors duration-200 overflow-hidden ${meta.accentBorder}`}
    >
      {/* 좌측 액센트 라인 */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-[2px] ${meta.accentBg.replace("bg-", "bg-").replace("/15", "/60")}`}
      />

      <div className="p-3.5 pl-4">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <div
              className={`w-5 h-5 rounded-full ${meta.accentBg} border ${meta.accentBorder} flex items-center justify-center flex-shrink-0`}
            >
              <Icon size={10} className={meta.accent} />
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-widest ${meta.accent}`}>
              {meta.label}
            </span>
            {actChapterLabel && (
              <>
                <span className="text-white/15 text-[10px]">·</span>
                <span className="text-[10px] text-white/40 font-medium">{actChapterLabel}</span>
              </>
            )}
          </div>
          <span className="text-[10px] text-white/30 flex-shrink-0">
            {formatNoteTime(note.createdAt)}
          </span>
        </div>

        {/* 본문 */}
        <p className="text-[13px] text-white/85 leading-relaxed whitespace-pre-wrap break-words">
          {note.content}
        </p>

        {/* 관련 히로인 */}
        {note.relatedHeroineName && (
          <div className="mt-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-400/20">
            <Heart size={9} className="text-rose-300" fill="currentColor" />
            <span className="text-[10px] text-rose-200 font-medium">
              {note.relatedHeroineName}
            </span>
          </div>
        )}

        {/* 관련 일러스트 (자동 노트가 일러스트 캡처를 동반할 때) */}
        {note.relatedIllustrationUrl && (
          <div className="mt-2.5 rounded-lg overflow-hidden border border-white/10">
            <img
              src={note.relatedIllustrationUrl}
              alt=""
              className="w-full h-auto max-h-48 object-cover"
              loading="lazy"
            />
          </div>
        )}

        {/* 액션 버튼 — MANUAL만 */}
        {editable && (
          <div className="flex items-center justify-end gap-1 mt-2.5 -mr-1 -mb-1">
            <button
              onClick={() => onEdit(note)}
              aria-label="메모 수정"
              className="w-7 h-7 flex items-center justify-center rounded-full text-white/35 hover:text-amber-200 hover:bg-amber-500/10 transition-colors"
            >
              <Pencil size={11} />
            </button>
            <button
              onClick={() => onDelete(note)}
              aria-label="메모 삭제"
              className="w-7 h-7 flex items-center justify-center rounded-full text-white/35 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
            >
              <Trash2 size={11} />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}