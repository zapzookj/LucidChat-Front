import { useState, useEffect, useCallback } from "react";
// eslint-disable-next-line no-unused-vars -- motion은 <motion.div> JSX 멤버로 사용(jsx-uses-vars 미설정 오탐)
import { motion, AnimatePresence } from "framer-motion";
import { X, UserRound, Sparkles, Save, FolderDown, Trash2 } from "lucide-react";
import {
  fetchProfile, updateProfile, fetchPersonaCards, saveProfileAsCard,
  loadPersonaCard, deletePersona, PERSONA_ARCHETYPES, LENS_FIELDS, LENS_AXIS_MAX, LENS_TOTAL_MAX,
} from "../../api/PersonaApi";
import { sfx } from "../../utils/sfx";
import { ErrorState } from "../../pages/lobby/lobbyUi";

/**
 * [블록 B 페르소나] 내 프로필 + 저장 카드(세이브 슬롯) 관리.
 *
 * 개념 역전: 항상 존재하는 단일 활성 프로필(이름/나이/성별/소개/렌즈 5축)이 1차 개념.
 * 카드는 프로필의 스냅샷 — "현재 프로필을 카드로 저장" / "불러오기" / "삭제"가 전부다
 * (슬롯: 서버 계약 {cards, slotLimit, slotUsed} — 무료 3/구독 10).
 * 방 생성은 서버가 현재 프로필을 자동 스냅샷 — 진행 중 방은 프로필 수정의 영향을 받지 않는다.
 *
 * 렌즈 5축 = "캐릭터가 나를 어떻게 인식하는가"(매력/친근함/듬직함/카리스마/신비),
 * 축당 0~10·총점 25 — 다 높게는 불가능(재배분의 긴장이 빌드 선택).
 *
 * Props:
 *   embedded — true면 보관함 인탭 렌더(open/onClose 무시, 사운드 금지 — 로비 규약)
 *   open/onClose — 모달 모드('시작 전 프로필 편집' 등)
 *   focusAge — true면 나이 필드 강조(시크릿 나이 게이트 딥링크)
 *   onProfileChange(profile) — 저장/로드로 프로필이 갱신될 때 통지
 */
const EMPTY_LENS = { allure: 0, friendliness: 0, trust: 0, charisma: 0, mystique: 0 };

const toDraft = (p) => ({
  name: p?.name ?? "",
  age: p?.age ?? "",
  gender: p?.gender ?? "MALE",
  personaText: p?.personaText ?? "",
  ...EMPTY_LENS,
  ...LENS_FIELDS.reduce((acc, [k]) => ({ ...acc, [k]: Number(p?.[k]) || 0 }), {}),
});

export default function PersonaManager({
  open = false, onClose, embedded = false, focusAge = false, onProfileChange = null,
}) {
  const [draft, setDraft] = useState(null);        // null=로딩 전 | 프로필 편집 드래프트
  const [cards, setCards] = useState([]);
  const [slotLimit, setSlotLimit] = useState(3);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [profile, cardList] = await Promise.all([fetchProfile(), fetchPersonaCards()]);
      setDraft(toDraft(profile));
      setCards(cardList.cards ?? []);
      setSlotLimit(cardList.slotLimit ?? 3);
    } catch {
      setDraft(null);
      setCards([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (embedded || open) { setError(null); setNotice(null); load(); }
  }, [embedded, open, load]);

  // 로비 인탭에서는 클릭 SFX 금지 (사운드 정책 — 호버/클릭 무음)
  const uiClick = (vol) => { if (!embedded) sfx.click(vol); };

  const totalPoints = draft
    ? LENS_FIELDS.reduce((s, [k]) => s + (Number(draft[k]) || 0), 0)
    : 0;
  const overBudget = totalPoints > LENS_TOTAL_MAX;

  const profilePayload = () => ({
    name: draft.name,
    age: draft.age === "" || draft.age === null ? null : Number(draft.age),
    gender: draft.gender,
    personaText: draft.personaText,
    ...LENS_FIELDS.reduce((acc, [k]) => ({ ...acc, [k]: Number(draft[k]) || 0 }), {}),
  });

  const handleSaveProfile = async () => {
    if (busy || !draft) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateProfile(profilePayload());
      setDraft(toDraft(updated));
      setNotice("프로필을 저장했어요.");
      onProfileChange?.(updated);
    } catch (e) {
      setError(e?.response?.data?.message || "저장에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  const handleSaveCard = async () => {
    if (busy || !draft) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      // 카드는 '서버에 저장된 프로필'의 스냅샷 — 편집 중 드래프트를 먼저 반영해 어긋남 방지
      const updated = await updateProfile(profilePayload());
      setDraft(toDraft(updated));
      onProfileChange?.(updated);
      await saveProfileAsCard();
      const cardList = await fetchPersonaCards();
      setCards(cardList.cards ?? []);
      setSlotLimit(cardList.slotLimit ?? 3);
      setNotice("현재 프로필을 카드로 저장했어요.");
    } catch (e) {
      setError(e?.response?.data?.message || "카드 저장에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  const handleLoadCard = async (personaId) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const profile = await loadPersonaCard(personaId);
      setDraft(toDraft(profile));
      setNotice("카드를 프로필로 불러왔어요.");
      onProfileChange?.(profile);
    } catch (e) {
      setError(e?.response?.data?.message || "불러오기에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (personaId) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await deletePersona(personaId);
      setCards((prev) => prev.filter((c) => c.personaId !== personaId));
    } catch (e) {
      setError(e?.response?.data?.message || "삭제에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  // ═══════════ 본문 (인탭/모달 공용) ═══════════
  const body = loading ? (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-white/[0.09] p-[18px] space-y-2.5">
          <div className="h-2.5 w-20 rounded bg-white/[0.07] animate-pulse" />
          <div className="h-3.5 rounded bg-white/[0.07] animate-pulse" />
        </div>
      ))}
    </div>
  ) : loadError || !draft ? (
    <ErrorState onRetry={load} />
  ) : (
    <div className="space-y-6">
      {/* ── 활성 프로필 편집 ── */}
      <div className="space-y-4">
        {/* 아키타입 — 소개 빠른 채우기 */}
        <div>
          <label className="text-[11px] text-white/50 mb-1.5 block flex items-center gap-1">
            <Sparkles size={11} className="text-amber-300" /> 아키타입으로 소개 채우기 (선택)
          </label>
          <div className="flex flex-wrap gap-1.5">
            {PERSONA_ARCHETYPES.map((a) => (
              <button key={a.key}
                onClick={() => { uiClick(0.2); setDraft((p) => ({ ...p, name: a.name, gender: a.gender, personaText: a.personaText })); }}
                className="text-[11px] px-2.5 py-1.5 rounded-full border border-white/15 bg-white/[0.04] text-white/60 hover:border-amber-400/40 hover:text-amber-200 transition">
                {a.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto_auto] gap-3">
          <div>
            <label className="text-[11px] text-white/50 mb-1 block">이름</label>
            <input value={draft.name} maxLength={30}
              onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-sky-400/60" />
          </div>
          <div>
            <label className={`text-[11px] mb-1 block ${focusAge ? "text-amber-300" : "text-white/50"}`}>나이</label>
            <input type="number" min={1} max={120} value={draft.age} placeholder="미설정"
              onChange={(e) => setDraft((p) => ({ ...p, age: e.target.value }))}
              className={`w-20 bg-white/[0.04] border rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-sky-400/60 ${
                focusAge ? "border-amber-400/60" : "border-white/10"
              }`} />
          </div>
          <div>
            <label className="text-[11px] text-white/50 mb-1 block">성별</label>
            <div className="flex gap-1.5">
              {[["MALE", "남성"], ["FEMALE", "여성"]].map(([v, l]) => (
                <button key={v} onClick={() => setDraft((p) => ({ ...p, gender: v }))}
                  className={`px-3 py-2.5 rounded-xl text-xs font-medium border transition ${
                    draft.gender === v
                      ? "bg-sky-500/15 border-sky-400/50 text-sky-200"
                      : "bg-white/[0.04] border-white/10 text-white/45"
                  }`}>{l}</button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="text-[11px] text-white/50 mb-1 block">소개</label>
          <textarea value={draft.personaText} rows={5} maxLength={1000}
            onChange={(e) => setDraft((p) => ({ ...p, personaText: e.target.value }))}
            placeholder="이 세계에서 당신은 어떤 사람인가요? 자유롭게 적어보세요."
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm leading-relaxed outline-none focus:border-sky-400/60 resize-none" />
        </div>

        {/* 렌즈 배분 */}
        <div>
          <label className="text-[11px] text-white/50 mb-1.5 block">
            인식 렌즈 <span className="text-white/30">— 캐릭터가 나를 어떻게 인식하는가</span>
            <span className={`ml-2 font-semibold ${overBudget ? "text-rose-300" : "text-white/45"}`}>
              배분 {totalPoints} / {LENS_TOTAL_MAX}
            </span>
          </label>
          <div className="grid grid-cols-5 gap-2">
            {LENS_FIELDS.map(([key, label, hint]) => (
              <div key={key} className="text-center">
                <div className="text-[10px] text-white/45 mb-0.5">{label}</div>
                <div className="text-[9px] text-white/25 mb-1">{hint}</div>
                <input type="number" min={0} max={LENS_AXIS_MAX} value={draft[key]}
                  onChange={(e) => setDraft((p) => ({ ...p, [key]: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-1 py-2 text-center text-white text-sm outline-none focus:border-sky-400/60" />
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-white/30">
            축당 0~{LENS_AXIS_MAX} · 낮음도 페널티가 아니라 다른 재미예요 (예: 카리스마 낮음 = 놀림받는 인기 포지션)
          </p>
        </div>

        <button disabled={busy || !draft.name.trim() || overBudget}
          onClick={handleSaveProfile}
          className="w-full py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white transition disabled:opacity-40">
          {busy ? "저장 중…" : "프로필 저장"}
        </button>
      </div>

      {/* ── 저장 카드 (세이브 슬롯) ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-white/50">저장 카드</span>
          <span className="text-[11px] text-white/35">슬롯 {cards.length} / {slotLimit}</span>
        </div>
        <div className="space-y-2">
          {cards.map((c) => (
            <div key={c.personaId}
              className="rounded-xl border border-white/[0.09] bg-white/[0.035] px-3.5 py-2.5 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-white truncate">{c.name}</div>
                <div className="text-[10px] text-white/40 truncate">
                  {c.gender === "FEMALE" ? "여성" : "남성"}
                  {c.age ? ` · ${c.age}세` : ""} · 렌즈 {LENS_FIELDS.reduce((s, [k]) => s + (Number(c[k]) || 0), 0)}p
                  {c.personaText ? ` · “${c.personaText}”` : ""}
                </div>
              </div>
              <button disabled={busy} onClick={() => { uiClick(0.2); handleLoadCard(c.personaId); }}
                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-sky-500/15 border border-sky-400/40 text-sky-200 hover:bg-sky-500/25 transition">
                <FolderDown size={12} /> 불러오기
              </button>
              <button disabled={busy} onClick={() => { uiClick(0.2); handleDelete(c.personaId); }}
                className="shrink-0 p-1.5 rounded-lg hover:bg-rose-500/15 text-white/50 hover:text-rose-300 transition">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <button disabled={busy} onClick={() => { uiClick(0.2); handleSaveCard(); }}
            className="w-full rounded-xl border border-dashed border-white/[0.12] py-3 flex items-center justify-center gap-1.5 text-[12px] text-white/45 hover:text-white/75 hover:border-white/[0.22] transition">
            <Save size={13} /> 현재 프로필을 카드로 저장
            <span className="text-[10px] text-white/30">({Math.max(0, slotLimit - cards.length)}칸 남음)</span>
          </button>
        </div>
        <p className="mt-3 text-[10px] text-white/30">
          프로필은 새로 시작하는 이야기부터 적용돼요 — 이미 진행 중인 이야기는 시작 시점 모습 그대로예요.
        </p>
      </div>
    </div>
  );

  // ═══════════ 인탭 모드 (보관함 '페르소나' 세그먼트) ═══════════
  if (embedded) {
    return (
      <div>
        {error && (
          <div className="mb-3 text-lb-meta text-rose-300 bg-rose-500/10 border border-rose-400/20 rounded-xl px-3.5 py-2.5">
            {error}
          </div>
        )}
        {notice && (
          <div className="mb-3 text-lb-meta text-emerald-300 bg-emerald-500/10 border border-emerald-400/20 rounded-xl px-3.5 py-2.5">
            {notice}
          </div>
        )}
        {body}
      </div>
    );
  }

  // ═══════════ 모달 모드 ('시작 전 프로필 편집'·시크릿 나이 수정 등) ═══════════
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
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <UserRound size={18} className="text-sky-300" /> 내 프로필
              </h2>
              <button onClick={() => { sfx.click(0.2); onClose(); }}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-white/60">
                <X size={18} />
              </button>
            </div>

            {error && <div className="mb-3 text-xs text-rose-300 bg-rose-500/10 border border-rose-400/20 rounded-lg px-3 py-2">{error}</div>}
            {notice && <div className="mb-3 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-400/20 rounded-lg px-3 py-2">{notice}</div>}

            {body}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
