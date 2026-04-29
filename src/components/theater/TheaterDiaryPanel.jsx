import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, BookOpen, Sparkles, GitBranch, MapPin, Coffee, Heart,
  Loader2, ChevronDown, ChevronRight, RefreshCw,
} from "lucide-react";
import { fetchDirectorNotes } from "../../api/TheaterFinalityApi";

/**
 * [Phase 5.5 UX Polish · R3] TheaterDiaryPanel
 *
 * 이야기 다이어리 — 자동 캡처된 결정적 순간들의 사진첩.
 *
 * 표시 대상 (자동 노트만):
 *   - AUTO_MOMENT  : 호감도 급변 / 스탯 급변 등 결정적 순간
 *   - BRANCH_TAKEN : 분기 선택 직후 자동 기록
 *   - INTERMISSION : Act 사이의 인터미션 시점
 *   - CHAPTER_END  : Chapter 종료 회고
 *   - INTERVENTION : 난입 발생 기록
 *
 * 제외:
 *   - MANUAL: 유저 입력은 "감독 명령어" 패널의 기록에서 봄 (역할 분리)
 *
 * UX:
 *   - 우측 슬라이드 패널 (감독 명령어가 좌측이라 시각적 대칭)
 *   - Act/Chapter 그룹핑 + collapse 가능
 *   - 현재 진행 중인 Act/Chapter는 자동 펼침
 *   - 시간 역순 (최신이 위) — 다이어리는 거꾸로 펼쳐 보는 게 자연스러움
 *   - 각 노트 카드에 noteType 배지 + 일러스트 (있으면)
 *   - [R6] currentBatch 변경 시 자동 새로고침 + 수동 새로고침 버튼
 *     (일러스트가 폴링 완료 후 채워지므로 시간차 반영)
 *
 * Props:
 *   roomId        : Long
 *   visible       : bool
 *   onClose       : () => void
 *   currentAct    : number  (자동 펼침 결정용 + invalidation 트리거)
 *   currentChapter: number
 *   currentBatchId: number  ([R6] 변경 시 자동 새로고침)
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  노트 타입 메타 (자동 노트만)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const NOTE_TYPE_META = {
  AUTO_MOMENT: {
    label: "결정적 순간",
    Icon: Sparkles,
    accent: "bg-amber-400",
    badge: "bg-amber-500/15 border-amber-400/30 text-amber-200",
  },
  BRANCH_TAKEN: {
    label: "선택의 갈림길",
    Icon: GitBranch,
    accent: "bg-violet-400",
    badge: "bg-violet-500/15 border-violet-400/30 text-violet-200",
  },
  INTERMISSION: {
    label: "막간",
    Icon: Coffee,
    accent: "bg-cyan-400",
    badge: "bg-cyan-500/15 border-cyan-400/30 text-cyan-200",
  },
  CHAPTER_END: {
    label: "한 막의 끝",
    Icon: MapPin,
    accent: "bg-emerald-400",
    badge: "bg-emerald-500/15 border-emerald-400/30 text-emerald-200",
  },
  INTERVENTION: {
    label: "난입",
    Icon: Heart,
    accent: "bg-rose-400",
    badge: "bg-rose-500/15 border-rose-400/30 text-rose-200",
  },
};
const FALLBACK_META = {
  label: "기록",
  Icon: BookOpen,
  accent: "bg-white/40",
  badge: "bg-white/8 border-white/15 text-white/70",
};

const SHOWN_TYPES = new Set(Object.keys(NOTE_TYPE_META));

// 시간 포맷
const formatTime = (iso) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  메인 컴포넌트
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function TheaterDiaryPanel({
  roomId, visible, onClose, currentAct = 1, currentChapter = 1,
  currentBatchId = 0,
}) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedActs, setExpandedActs] = useState(new Set());

  // ─── 노트 로드 ───
  const load = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDirectorNotes(roomId);
      const filtered = (Array.isArray(data) ? data : []).filter(
        (n) => SHOWN_TYPES.has(n.noteType)
      );
      setNotes(filtered);
    } catch (e) {
      console.error("[Diary] fetch failed:", e);
      setError("다이어리를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    if (visible) {
      load();
    }
  }, [visible, load]);

  // [Phase 5.5 UX Polish · R6] 새 배치 도착 시 자동 새로고침 — 일러스트 폴링이
  // 백그라운드에서 끝나면 노트의 relatedIllustrationUrl이 채워지므로 그 결과 반영.
  // visible 일 때만 호출 (불필요한 fetch 방지).
  useEffect(() => {
    if (visible && currentBatchId > 0) {
      // 약간의 지연 — 배치 도착 직후엔 아직 일러스트 폴링이 진행 중이므로
      // 4초 후 한 번 더 새로고침해 신선한 URL 가져옴
      const t = setTimeout(() => { load(); }, 4000);
      return () => clearTimeout(t);
    }
  }, [visible, currentBatchId, load]);

  // ─── ESC 닫기 ───
  useEffect(() => {
    if (!visible) return;
    const handler = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [visible, onClose]);

  // ─── Act/Chapter 그룹핑 ───
  const grouped = useMemo(() => {
    const map = new Map(); // act → Map(chapter → notes[])
    for (const n of notes) {
      const a = n.actNumber ?? 0;
      const c = n.chapterNumber ?? 0;
      if (!map.has(a)) map.set(a, new Map());
      const chMap = map.get(a);
      if (!chMap.has(c)) chMap.set(c, []);
      chMap.get(c).push(n);
    }
    // Act 내림차순 (현재가 위), 각 Act 안의 Chapter도 내림차순
    const sorted = [...map.entries()].sort((a, b) => b[0] - a[0]);
    return sorted.map(([act, chMap]) => ({
      act,
      chapters: [...chMap.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([chapter, items]) => ({
          chapter,
          notes: items
            .slice()
            .sort((a, b) => {
              const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return tb - ta;
            }),
        })),
    }));
  }, [notes]);

  // 현재 Act 자동 펼침
  useEffect(() => {
    if (grouped.length > 0) {
      setExpandedActs((prev) => {
        const next = new Set(prev);
        next.add(currentAct);
        // 처음 로드 시 비어있다면 가장 위 Act도 펼침
        if (next.size === 0 && grouped[0]) next.add(grouped[0].act);
        return next;
      });
    }
  }, [grouped.length, currentAct]); // eslint-disable-line

  const toggleAct = (act) =>
    setExpandedActs((prev) => {
      const next = new Set(prev);
      next.has(act) ? next.delete(act) : next.add(act);
      return next;
    });

  if (!visible) return null;

  const totalNotes = notes.length;

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
        <div className="relative flex items-center justify-between px-6 py-5 border-b border-white/5 flex-shrink-0">
          <div
            className="absolute inset-0 pointer-events-none opacity-40"
            style={{
              background:
                "radial-gradient(circle at 80% 50%, rgba(34,211,238,0.15), transparent 60%)",
            }}
          />
          <div className="relative">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-cyan-300" />
              <h2 className="text-lg font-bold text-white tracking-wide">이야기 다이어리</h2>
            </div>
            <p className="text-xs text-white/30 mt-0.5">
              Story Diary · {totalNotes > 0 ? `${totalNotes}개의 순간` : "축적되는 순간들"}
            </p>
          </div>
          <div className="relative flex items-center gap-1.5">
            <button
              onClick={load}
              disabled={loading}
              aria-label="새로고침"
              title="새로고침"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-white/45 hover:text-cyan-200 hover:bg-white/10 transition-colors disabled:opacity-30"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={onClose}
              aria-label="닫기"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-white/45 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ═══ 본문 ═══ */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading && (
            <div className="flex justify-center py-12">
              <Loader2 size={20} className="animate-spin text-cyan-300/50" />
            </div>
          )}

          {error && !loading && (
            <p className="text-rose-300/80 text-sm text-center py-12">{error}</p>
          )}

          {!loading && !error && grouped.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <BookOpen size={32} className="text-white/15 mb-3" />
              <p className="text-white/40 text-sm">
                아직 기록된 순간이 없습니다
              </p>
              <p className="text-white/25 text-xs mt-1.5 leading-relaxed max-w-[260px]">
                극이 진행되면서 결정적 순간들이 자동으로 이곳에 쌓여갑니다
              </p>
            </div>
          )}

          {!loading && !error && grouped.length > 0 && (
            <div className="px-4 py-4 space-y-3">
              {grouped.map(({ act, chapters }) => {
                const isExpanded = expandedActs.has(act);
                const isCurrent = act === currentAct;
                const totalInAct = chapters.reduce(
                  (s, ch) => s + ch.notes.length,
                  0
                );
                return (
                  <div
                    key={act}
                    className={`rounded-xl border overflow-hidden transition-colors ${
                      isCurrent
                        ? "bg-cyan-500/[0.04] border-cyan-400/20"
                        : "bg-white/[0.02] border-white/8"
                    }`}
                  >
                    {/* Act 헤더 */}
                    <button
                      onClick={() => toggleAct(act)}
                      className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-white/[0.03] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown size={14} className="text-white/45" />
                        ) : (
                          <ChevronRight size={14} className="text-white/45" />
                        )}
                        <span
                          className={`text-sm font-bold tracking-wide ${
                            isCurrent ? "text-cyan-100" : "text-white/85"
                          }`}
                        >
                          Act {act}
                        </span>
                        {isCurrent && (
                          <span className="px-1.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-[9px] text-cyan-200 font-bold uppercase tracking-wider">
                            진행 중
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-white/40 font-mono tabular-nums">
                        {totalInAct}
                      </span>
                    </button>

                    {/* Chapter들 */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 pb-3 pt-1 space-y-2">
                            {chapters.map(({ chapter, notes: items }) => {
                              const isCurrentCh =
                                act === currentAct && chapter === currentChapter;
                              return (
                                <div key={chapter}>
                                  <div className="flex items-center gap-1.5 mb-1.5 pl-1">
                                    <span
                                      className={`text-[11px] font-bold uppercase tracking-widest ${
                                        isCurrentCh
                                          ? "text-cyan-200/85"
                                          : "text-white/35"
                                      }`}
                                    >
                                      Chapter {chapter}
                                    </span>
                                  </div>
                                  <div className="space-y-1.5 ml-1">
                                    {items.map((n) => (
                                      <DiaryEntryCard key={n.id} note={n} />
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  다이어리 엔트리 카드
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function DiaryEntryCard({ note }) {
  const meta = NOTE_TYPE_META[note.noteType] || FALLBACK_META;
  const Icon = meta.Icon;
  const time = formatTime(note.createdAt);
  const hasIllustration = !!note.relatedIllustrationUrl;

  return (
    <div className="relative rounded-lg bg-white/[0.025] border border-white/8 hover:bg-white/[0.04] transition-colors overflow-hidden">
      {/* 좌측 액센트 라인 */}
      <div className={`absolute left-0 top-0 bottom-0 w-[2px] ${meta.accent}`} />

      <div className="p-2.5 pl-3">
        {/* 헤더 라인 */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-bold ${meta.badge}`}
          >
            <Icon size={9} />
            <span>{meta.label}</span>
          </span>
          {time && (
            <span className="text-[10px] text-white/30 font-mono tabular-nums">{time}</span>
          )}
        </div>

        {/* 일러스트 (있을 때만) */}
        {hasIllustration && (
          <div
            className="my-1.5 aspect-[16/10] rounded-md bg-cover bg-center bg-slate-800 border border-white/5"
            style={{ backgroundImage: `url(${note.relatedIllustrationUrl})` }}
          />
        )}

        {/* 본문 */}
        <p className="text-[12.5px] text-white/85 leading-relaxed break-words">
          {note.content}
        </p>
      </div>
    </div>
  );
}