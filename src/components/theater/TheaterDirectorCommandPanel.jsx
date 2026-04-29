import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Megaphone, Sparkles, Send, AlertTriangle, Check,
  Wind, Music, Users, Box, Loader2, History, Zap, ChevronRight
} from "lucide-react";
import {
  fetchDirectorNotes,
  triggerDirectorCommand,
} from "../../api/TheaterFinalityApi";

/**
 * [Phase 5.5 UX Polish · R3] TheaterDirectorCommandPanel
 *
 * 감독 명령어 패널 — 다음 1배치에 환경 이벤트를 주입하는 디렉터 권능.
 *
 * UX 원칙:
 *  - 좌측 패널(slide-in from left) — Diary는 우측이라 시각적 대칭
 *  - 입력 폼이 메인, 기록은 보조 (스크롤 가능)
 *  - 검증 실패 시 거부 사유를 따뜻하게 안내 — 유저 학습 자료
 *  - 좋은 예시 / 차단되는 입력 가이드 항상 표시
 *  - 발동 후 검증 단계를 시각화 (Step 1/3 → 2/3 → 3/3)
 *  - 시각: violet+amber 그라디언트 (감독 정체성)
 *
 * 검증 결과 분류:
 *  - ALLOWED_*  : 환경/NPC/음향/사물 — 통과
 *  - REJECTED_* : 캐릭터 직접 조작 / 호감도 / 페르소나 / 인젝션 — 거부
 *
 * Props:
 *  roomId    : Long
 *  visible   : bool
 *  onClose   : () => void
 *  energy    : number  — 현재 에너지 (1 미만이면 발동 불가)
 *  onSpent   : () => void  — 명령어 발동 시 1 차감 알림 (PlayPage가 에너지 갱신)
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  분류 메타 (정적 매핑 — Tailwind purge 호환)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const VERDICT_META = {
  ALLOWED_ENVIRONMENT: { label: "환경",     Icon: Wind,  badge: "bg-emerald-500/15 border-emerald-400/30 text-emerald-200" },
  ALLOWED_NPC:         { label: "등장",     Icon: Users, badge: "bg-cyan-500/15 border-cyan-400/30 text-cyan-200" },
  ALLOWED_SOUND:       { label: "음향",     Icon: Music, badge: "bg-violet-500/15 border-violet-400/30 text-violet-200" },
  ALLOWED_PROP:        { label: "사물",     Icon: Box,   badge: "bg-amber-500/15 border-amber-400/30 text-amber-200" },
  ALLOWED_OTHER:       { label: "기타",     Icon: Sparkles, badge: "bg-white/8 border-white/15 text-white/75" },
  REJECTED_HEROINE_DIRECT: { label: "거부 · 캐릭터 조작",   Icon: AlertTriangle, badge: "bg-rose-500/12 border-rose-400/25 text-rose-200" },
  REJECTED_AFFECTION:      { label: "거부 · 관계 조작",     Icon: AlertTriangle, badge: "bg-rose-500/12 border-rose-400/25 text-rose-200" },
  REJECTED_PERSONA:        { label: "거부 · 성격 변경",     Icon: AlertTriangle, badge: "bg-rose-500/12 border-rose-400/25 text-rose-200" },
  REJECTED_AVATAR:         { label: "거부 · 주인공 조작",   Icon: AlertTriangle, badge: "bg-rose-500/12 border-rose-400/25 text-rose-200" },
  REJECTED_INJECTION:      { label: "거부 · 인젝션 시도",   Icon: AlertTriangle, badge: "bg-rose-500/12 border-rose-400/25 text-rose-200" },
  REJECTED_CONTENT:        { label: "거부 · 콘텐츠 정책",   Icon: AlertTriangle, badge: "bg-rose-500/12 border-rose-400/25 text-rose-200" },
  REJECTED_UNCLEAR:        { label: "거부 · 의도 불분명",   Icon: AlertTriangle, badge: "bg-rose-500/12 border-rose-400/25 text-rose-200" },
};
const FALLBACK_VERDICT = {
  label: "기록", Icon: Megaphone, badge: "bg-white/8 border-white/15 text-white/70",
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  좋은/나쁜 예시
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const GOOD_EXAMPLES = [
  "갑자기 비가 내리기 시작한다",
  "어디선가 피아노 소리가 들려온다",
  "검은 고양이가 발걸음을 멈춘다",
  "누군가의 휴대폰이 울린다",
  "노을이 길게 드리운다",
];
const BAD_EXAMPLES = [
  { text: "그녀가 갑자기 고백한다", reason: "캐릭터의 직접 행동" },
  { text: "호감도가 100이 된다", reason: "관계 조작" },
  { text: "내성적인 그녀가 활발해진다", reason: "성격 변경" },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  시간 포맷
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const formatRel = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const dy = Math.floor(h / 24);
  return `${dy}일 전`;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  메인 컴포넌트
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function TheaterDirectorCommandPanel({
  roomId, visible, onClose, energy = 0, onSpent,
}) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verifyStep, setVerifyStep] = useState(0); // 0=idle, 1=safety, 2=classify, 3=ready
  const [lastResult, setLastResult] = useState(null); // { accepted, verdict, userMessage }
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  // ─── 기록 로드 ───
  const loadHistory = useCallback(async () => {
    if (!roomId) return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const data = await fetchDirectorNotes(roomId);
      // 명령어 노트만 필터 (commandType 또는 validationVerdict 가 있는 것)
      const commands = (Array.isArray(data) ? data : [])
        .filter((n) => n.commandType || n.validationVerdict)
        .sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        });
      setHistory(commands);
    } catch (e) {
      console.error("[Director] history fetch failed:", e);
      setHistoryError("기록을 불러오지 못했습니다.");
    } finally {
      setHistoryLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    if (visible) {
      loadHistory();
      setLastResult(null);
      setText("");
    }
  }, [visible, loadHistory]);

  // ─── ESC 닫기 ───
  useEffect(() => {
    if (!visible) return;
    const handler = (e) => {
      if (e.key === "Escape" && !submitting) onClose?.();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [visible, submitting, onClose]);

  // ─── 통계 ───
  const stats = useMemo(() => {
    const total = history.length;
    const accepted = history.filter((n) => n.commandType).length;
    return { total, accepted };
  }, [history]);

  // ─── 검증 시퀀스 시각화 (300ms씩 진행) ───
  const runVerifySequence = async () => {
    setVerifyStep(1);
    await new Promise((r) => setTimeout(r, 350));
    setVerifyStep(2);
    await new Promise((r) => setTimeout(r, 350));
    setVerifyStep(3);
  };

  // ─── 발동 ───
  const submitDisabled =
    submitting || !text.trim() || text.trim().length > 300 || energy < 1;

  const handleSubmit = async () => {
    if (submitDisabled) return;
    setSubmitting(true);
    setLastResult(null);
    setVerifyStep(0);

    // 시각화 시퀀스와 실제 API를 병렬로
    const visualizer = runVerifySequence();
    let result;
    try {
      [result] = await Promise.all([
        triggerDirectorCommand(roomId, text.trim()),
        visualizer,
      ]);
    } catch (e) {
      console.error("[Director] command failed:", e);
      const message = e?.response?.data?.message || "명령어 발동에 실패했습니다.";
      setLastResult({ accepted: false, verdict: "REJECTED_UNCLEAR", userMessage: message });
      setSubmitting(false);
      setVerifyStep(0);
      return;
    }

    setLastResult(result);
    if (result.accepted) {
      setText("");
      onSpent?.();
    }
    // 기록 새로고침
    loadHistory();
    setSubmitting(false);
    setVerifyStep(0);
  };

  if (!visible) return null;

  const charCount = text.length;
  const charLimit = 300;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* dim 배경 */}
      <motion.div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={() => !submitting && onClose?.()}
      />

      {/* 좌측 슬라이드 패널 */}
      <motion.div
        className="relative w-full max-w-md h-full bg-slate-900/95 backdrop-blur-xl border-r border-white/10 overflow-hidden flex flex-col"
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        exit={{ x: "-100%" }}
        transition={{ type: "spring", stiffness: 280, damping: 30 }}
      >
        {/* ═══ 헤더 ═══ */}
        <div className="relative flex items-center justify-between px-6 py-5 border-b border-white/5 flex-shrink-0">
          {/* 헤더 글로우 */}
          <div
            className="absolute inset-0 pointer-events-none opacity-40"
            style={{
              background:
                "radial-gradient(circle at 20% 50%, rgba(167,139,250,0.15), transparent 60%)",
            }}
          />
          <div className="relative">
            <div className="flex items-center gap-2">
              <Megaphone size={16} className="text-violet-300" />
              <h2 className="text-lg font-bold text-white tracking-wide">감독 명령어</h2>
            </div>
            <p className="text-xs text-white/30 mt-0.5">Director Commands · 환경에 손길을 더하다</p>
          </div>
          <button
            onClick={() => !submitting && onClose?.()}
            disabled={submitting}
            aria-label="닫기"
            className="relative w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-white/45 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30"
          >
            <X size={16} />
          </button>
        </div>

        {/* ═══ 본문 ═══ */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* ── 입력 영역 ── */}
          <div className="px-6 pt-5 pb-4 border-b border-white/5">
            <p className="text-xs text-white/55 leading-relaxed mb-3">
              다음 배치에 <span className="text-emerald-200 font-semibold">환경적 이벤트</span>를 추가합니다.
              <br />
              캐릭터의 직접 행동이나 감정은 조작할 수 없습니다.
            </p>

            <div className="relative">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="이 순간, 무대에 무엇을 더할까?"
                rows={3}
                maxLength={charLimit}
                disabled={submitting}
                className="w-full bg-white/[0.04] border border-white/10 focus:border-violet-300/55 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/25 leading-relaxed resize-none focus:outline-none transition-colors disabled:opacity-50"
              />
              <div className="flex items-center justify-between mt-1.5 text-[11px]">
                <span className="text-white/30">
                  {energy < 1 ? (
                    <span className="text-amber-300">에너지 부족</span>
                  ) : (
                    <>최대 {charLimit}자 · 한 배치당 1회</>
                  )}
                </span>
                <span
                  className={`font-mono tabular-nums ${
                    charCount > charLimit - 30 ? "text-amber-300" : "text-white/40"
                  }`}
                >
                  {charCount} / {charLimit}
                </span>
              </div>
            </div>

            {/* 발동 버튼 */}
            <motion.button
              onClick={handleSubmit}
              disabled={submitDisabled}
              whileTap={!submitDisabled ? { scale: 0.97 } : {}}
              whileHover={!submitDisabled ? { scale: 1.015 } : {}}
              className={`mt-3 w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                submitDisabled
                  ? "bg-white/8 text-white/30 cursor-not-allowed"
                  : "bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-500 text-white shadow-lg shadow-violet-500/25 hover:from-violet-400 hover:via-fuchsia-400 hover:to-amber-400"
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  검증 중...
                </>
              ) : (
                <>
                  <Zap size={14} />
                  <span>1 에너지로 발동</span>
                  <Send size={12} />
                </>
              )}
            </motion.button>

            {/* 검증 시퀀스 시각화 */}
            <AnimatePresence>
              {submitting && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 overflow-hidden"
                >
                  <div className="space-y-1.5 px-1">
                    {[
                      { step: 1, label: "안전 검증" },
                      { step: 2, label: "명령어 분류" },
                      { step: 3, label: "무대에 배치" },
                    ].map(({ step, label }) => {
                      const done = verifyStep > step;
                      const active = verifyStep === step;
                      return (
                        <div
                          key={step}
                          className="flex items-center gap-2 text-[11px]"
                        >
                          <span className="font-mono text-white/30 w-10">[{step}/3]</span>
                          <span
                            className={
                              done
                                ? "text-emerald-200/85"
                                : active
                                ? "text-violet-200"
                                : "text-white/25"
                            }
                          >
                            {label}
                          </span>
                          <span className="ml-auto">
                            {done ? (
                              <Check size={10} className="text-emerald-300" />
                            ) : active ? (
                              <Loader2 size={10} className="animate-spin text-violet-300" />
                            ) : (
                              <span className="text-white/20">…</span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 결과 표시 */}
            <AnimatePresence>
              {lastResult && !submitting && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`mt-3 p-3 rounded-xl border ${
                    lastResult.accepted
                      ? "bg-emerald-500/10 border-emerald-400/30"
                      : "bg-rose-500/10 border-rose-400/30"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {lastResult.accepted ? (
                      <Check size={14} className="text-emerald-300 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle size={14} className="text-rose-300 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p
                        className={`text-xs font-bold ${
                          lastResult.accepted ? "text-emerald-100" : "text-rose-100"
                        }`}
                      >
                        {lastResult.accepted
                          ? "다음 배치에 반영됩니다"
                          : "이 명령어는 사용할 수 없습니다"}
                      </p>
                      {lastResult.userMessage && (
                        <p className="text-[11px] text-white/65 leading-relaxed mt-1">
                          {lastResult.userMessage}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── 가이드 영역 ── */}
          <div className="px-6 py-4 border-b border-white/5">
            <h3 className="text-[11px] uppercase tracking-widest text-white/45 font-bold mb-2.5">
              💡 좋은 명령어 예시
            </h3>
            <div className="space-y-1.5 mb-4">
              {GOOD_EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => !submitting && setText(ex)}
                  disabled={submitting}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg bg-emerald-500/[0.04] border border-emerald-400/15 text-[12px] text-emerald-100/85 hover:bg-emerald-500/10 hover:border-emerald-400/30 transition-colors disabled:opacity-50"
                >
                  · {ex}
                </button>
              ))}
            </div>

            <h3 className="text-[11px] uppercase tracking-widest text-white/45 font-bold mb-2.5">
              ⚠️ 차단되는 입력
            </h3>
            <div className="space-y-1">
              {BAD_EXAMPLES.map((ex, i) => (
                <div
                  key={i}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-500/[0.04] border border-rose-400/12 text-[11px]"
                >
                  <span className="text-rose-200/65">"{ex.text}"</span>
                  <span className="text-white/30 ml-2">— {ex.reason}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── 기록 영역 ── */}
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <History size={12} className="text-white/45" />
                <h3 className="text-[11px] uppercase tracking-widest text-white/45 font-bold">
                  이전 명령어 기록
                </h3>
              </div>
              {stats.total > 0 && (
                <span className="text-[10px] text-white/35 font-mono tabular-nums">
                  {stats.accepted} / {stats.total}
                </span>
              )}
            </div>

            {historyLoading && (
              <div className="flex justify-center py-6">
                <Loader2 size={16} className="animate-spin text-violet-300/50" />
              </div>
            )}

            {historyError && !historyLoading && (
              <p className="text-rose-300/80 text-xs text-center py-4">{historyError}</p>
            )}

            {!historyLoading && !historyError && history.length === 0 && (
              <p className="text-white/30 text-xs text-center py-6">
                아직 발동한 명령어가 없습니다
              </p>
            )}

            {!historyLoading && !historyError && history.length > 0 && (
              <div className="space-y-2">
                {history.map((cmd) => (
                  <CommandHistoryCard key={cmd.id} cmd={cmd} />
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  기록 카드
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function CommandHistoryCard({ cmd }) {
  const verdict = cmd.validationVerdict || "ALLOWED_OTHER";
  const meta = VERDICT_META[verdict] || FALLBACK_VERDICT;
  const Icon = meta.Icon;
  const accepted = (verdict || "").startsWith("ALLOWED_");
  const used = cmd.wasUsed === true;

  const actChapterLabel =
    cmd.actNumber && cmd.chapterNumber
      ? `Act ${cmd.actNumber} · Ch ${cmd.chapterNumber}`
      : null;

  return (
    <div
      className={`relative rounded-xl border bg-white/[0.025] overflow-hidden transition-colors duration-200 hover:bg-white/[0.04] ${
        accepted ? "border-violet-400/15" : "border-rose-400/15"
      }`}
    >
      {/* 좌측 액센트 라인 */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-[2px] ${
          accepted ? "bg-violet-400/55" : "bg-rose-400/45"
        }`}
      />

      <div className="p-3 pl-3.5">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-bold flex-shrink-0 ${meta.badge}`}
            >
              <Icon size={9} />
              <span>{meta.label}</span>
            </span>
            {actChapterLabel && (
              <span className="text-[10px] text-white/35 font-medium truncate">
                {actChapterLabel}
              </span>
            )}
            {used && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/12 border border-amber-300/20 text-[9px] text-amber-200 font-bold">
                <Check size={8} /> 사용됨
              </span>
            )}
          </div>
          <span className="text-[10px] text-white/30 flex-shrink-0">
            {formatRel(cmd.createdAt)}
          </span>
        </div>

        <p className="text-[12.5px] text-white/85 leading-relaxed break-words">
          "{cmd.content}"
        </p>
      </div>
    </div>
  );
}