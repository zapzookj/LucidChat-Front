import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Pencil, Trash2, UserRound, Sparkles } from "lucide-react";
import {
  fetchPersonas, createPersona, updatePersona, deletePersona, PERSONA_ARCHETYPES,
} from "../../api/PersonaApi";
import { sfx } from "../../utils/sfx";

/**
 * [2026-08-04 페르소나 풀 패키지] 페르소나 카드 관리 오버레이 — 갤러리 + 빌더.
 *
 * 구성: ① 내 카드 갤러리(수정/삭제) ② 빌더 — 아키타입 갤러리(1탭 시작) → 이름·성별·본문 →
 * 5축 스탯 분배(구독 티어 게이트 — 초과 시 서버 402 message 노출).
 * 카드는 방 생성 시 스냅샷 복사 — 수정해도 진행 중 방은 불변(안내 문구 포함).
 *
 * Props: open, onClose, onSelect(persona)|null — onSelect가 있으면 '선택 모드'(CreateFlow 등)
 */
const STAT_FIELDS = [
  ["charm", "매력"], ["wit", "재치"], ["boldness", "대담"], ["intellect", "지성"], ["empathy", "공감"],
];

const EMPTY_FORM = {
  name: "", gender: "MALE", personaText: "",
  charm: 0, wit: 0, boldness: 0, intellect: 0, empathy: 0,
};

export default function PersonaManager({ open, onClose, onSelect = null }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);   // null=갤러리 | {personaId?...}=빌더
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCards(await fetchPersonas());
    } catch {
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) { setEditing(null); setError(null); load(); }
  }, [open, load]);

  const totalPoints = editing
    ? STAT_FIELDS.reduce((s, [k]) => s + (Number(editing[k]) || 0), 0)
    : 0;

  const handleSave = async () => {
    if (busy || !editing) return;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        name: editing.name, gender: editing.gender, personaText: editing.personaText,
        charm: Number(editing.charm) || 0, wit: Number(editing.wit) || 0,
        boldness: Number(editing.boldness) || 0, intellect: Number(editing.intellect) || 0,
        empathy: Number(editing.empathy) || 0,
      };
      if (editing.personaId) await updatePersona(editing.personaId, payload);
      else await createPersona(payload);
      sfx.chime();
      setEditing(null);
      load();
    } catch (e) {
      setError(e?.response?.data?.message || "저장에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (personaId) => {
    if (busy) return;
    setBusy(true);
    try {
      await deletePersona(personaId);
      load();
    } catch (e) {
      setError(e?.response?.data?.message || "삭제에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }}
            className="w-full max-w-2xl max-h-[85vh] overflow-y-auto custom-scrollbar bg-stone-950 border border-white/10 rounded-2xl p-5"
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <UserRound size={18} className="text-sky-300" />
                {editing ? (editing.personaId ? "카드 수정" : "새 페르소나 카드") : "내 페르소나"}
              </h2>
              <button onClick={() => { sfx.click(0.2); editing ? setEditing(null) : onClose(); }}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-white/60">
                <X size={18} />
              </button>
            </div>

            {error && <div className="mb-3 text-xs text-rose-300 bg-rose-500/10 border border-rose-400/20 rounded-lg px-3 py-2">{error}</div>}

            {/* ── 갤러리 ── */}
            {!editing && (
              <>
                {loading ? (
                  <div className="py-10 text-center text-white/40 text-sm">불러오는 중…</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {cards.map((c) => (
                      <div key={c.personaId}
                           className="rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:border-sky-400/30 transition">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-bold text-white truncate">{c.name}</div>
                            <div className="text-[10px] text-white/40 mt-0.5">
                              {c.gender === "FEMALE" ? "여성" : "남성"} · 스탯 {c.charm + c.wit + c.boldness + c.intellect + c.empathy}p
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => { sfx.click(0.2); setEditing({ ...c }); }}
                                    className="p-1.5 rounded-lg hover:bg-white/10 text-white/50"><Pencil size={13} /></button>
                            <button onClick={() => { sfx.click(0.2); handleDelete(c.personaId); }}
                                    className="p-1.5 rounded-lg hover:bg-rose-500/15 text-white/50 hover:text-rose-300"><Trash2 size={13} /></button>
                          </div>
                        </div>
                        <p className="text-xs text-white/55 mt-2 line-clamp-3">{c.personaText}</p>
                        {onSelect && (
                          <button
                            onClick={() => { sfx.click(); onSelect(c); }}
                            className="mt-3 w-full py-2 rounded-lg text-xs font-bold bg-sky-500/15 border border-sky-400/40 text-sky-200 hover:bg-sky-500/25 transition"
                          >
                            이 카드로 시작
                          </button>
                        )}
                      </div>
                    ))}
                    {/* 새 카드 */}
                    <button
                      onClick={() => { sfx.click(0.2); setEditing({ ...EMPTY_FORM }); }}
                      className="rounded-xl border border-dashed border-white/15 min-h-[120px] flex flex-col items-center justify-center gap-1.5 text-white/40 hover:text-white/70 hover:border-white/30 transition"
                    >
                      <Plus size={20} />
                      <span className="text-xs">새 카드 만들기</span>
                    </button>
                  </div>
                )}
                <p className="mt-4 text-[10px] text-white/30">
                  카드를 수정해도 이미 시작한 이야기에는 적용되지 않아요(시작 시점 스냅샷).
                </p>
              </>
            )}

            {/* ── 빌더 ── */}
            {editing && (
              <div className="space-y-4">
                {/* 아키타입 갤러리 — 신규일 때만 */}
                {!editing.personaId && (
                  <div>
                    <label className="text-[11px] text-white/50 mb-1.5 block flex items-center gap-1">
                      <Sparkles size={11} className="text-amber-300" /> 아키타입으로 시작 (선택)
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {PERSONA_ARCHETYPES.map((a) => (
                        <button key={a.key}
                          onClick={() => { sfx.click(0.2); setEditing((p) => ({ ...p, name: a.name, gender: a.gender, personaText: a.personaText })); }}
                          className="text-[11px] px-2.5 py-1.5 rounded-full border border-white/15 bg-white/[0.04] text-white/60 hover:border-amber-400/40 hover:text-amber-200 transition">
                          {a.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-[1fr_auto] gap-3">
                  <div>
                    <label className="text-[11px] text-white/50 mb-1 block">카드 이름</label>
                    <input value={editing.name} maxLength={30}
                      onChange={(e) => setEditing((p) => ({ ...p, name: e.target.value }))}
                      className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-sky-400/60" />
                  </div>
                  <div>
                    <label className="text-[11px] text-white/50 mb-1 block">성별</label>
                    <div className="flex gap-1.5">
                      {[["MALE", "남성"], ["FEMALE", "여성"]].map(([v, l]) => (
                        <button key={v} onClick={() => setEditing((p) => ({ ...p, gender: v }))}
                          className={`px-3 py-2.5 rounded-xl text-xs font-medium border transition ${
                            editing.gender === v
                              ? "bg-sky-500/15 border-sky-400/50 text-sky-200"
                              : "bg-white/[0.04] border-white/10 text-white/45"
                          }`}>{l}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-white/50 mb-1 block">페르소나 본문</label>
                  <textarea value={editing.personaText} rows={5} maxLength={1000}
                    onChange={(e) => setEditing((p) => ({ ...p, personaText: e.target.value }))}
                    placeholder="당신은 이 세계에서 어떤 사람인가요? 자기인식대로 적어보세요 — 현실(스탯)과 어긋나도 좋습니다. 그 간극이 이야기가 됩니다."
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm leading-relaxed outline-none focus:border-sky-400/60 resize-none" />
                </div>

                {/* 스탯 분배 */}
                <div>
                  <label className="text-[11px] text-white/50 mb-1.5 block">
                    스탯 분배 <span className="text-white/30">(자기인식이 아닌 객관 현실 — 배분 {totalPoints}p, 한도는 구독 등급 기준)</span>
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {STAT_FIELDS.map(([key, label]) => (
                      <div key={key} className="text-center">
                        <div className="text-[10px] text-white/45 mb-1">{label}</div>
                        <input type="number" min={0} max={100} value={editing[key]}
                          onChange={(e) => setEditing((p) => ({ ...p, [key]: e.target.value }))}
                          className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-1 py-2 text-center text-white text-sm outline-none focus:border-sky-400/60" />
                      </div>
                    ))}
                  </div>
                </div>

                <button disabled={busy || !editing.name.trim() || !editing.personaText.trim()}
                  onClick={handleSave}
                  className="w-full py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white transition disabled:opacity-40">
                  {busy ? "저장 중…" : "카드 저장"}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
