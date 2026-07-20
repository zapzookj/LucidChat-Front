import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Feather, Check } from "lucide-react";
import { sfx } from "../../utils/sfx";

/**
 * [Studio v2] ProfileEditPanel — "설정 다듬기" 풀스크린 오버레이
 *
 * 생성 파이프라인의 로딩·대기 구간(GOLDEN_GENERATING 로딩, GACHA_WAIT,
 * BASE_PROCESSING, BASE_WAIT, EMOTIONS_PROCESSING, REVIEW_WAIT)에서 열려
 * AI가 쓴 설정 초안(CreationJobView.profile)을 유저가 직접 다듬는 패널.
 * 이미지 생성을 기다리는 시간을 "설정 손질" 시간으로 바꾸는 레이턴시 하이딩 UI다.
 *
 * [역할 분리]
 *   - 진행 중(잡 단계) 편집: 이 패널 → jobId 기반 PATCH /ugc/characters/{jobId}/profile
 *   - 완성 후 편집: CompleteStep/StudioPage의 인라인 수정 → characterId 기반 PATCH /texts
 *
 * 동작:
 *   - profile이 null(Stage0 미완료)이면 "AI가 초안을 쓰는 중이에요…" 잠금 상태
 *   - 열릴 때 profile 스냅샷으로 폼 시딩 — 이후 폴링으로 job이 갱신돼도 입력을 덮지 않는다
 *   - 명시적 "저장" → 변경된 필드만 PATCH(onSave) → 성공 토스트 + sfx.chime
 *   - 미저장 변경이 있는 채 닫으면 내부 confirm으로 한 번 되묻는다
 *
 * Props:
 *   open    : boolean
 *   profile : object|null — CreationJobView.profile (age는 수정 불가라 폼에서 제외)
 *   onSave  : (changedFields) => Promise<{ok: boolean, message?: string}>
 *   onClose : () => void
 */

const INPUT_FIELDS = [
  { key: "name", label: "이름", max: 20, placeholder: "캐릭터의 이름" },
  { key: "tagline", label: "태그라인", max: 60, placeholder: "한 줄 소개" },
  { key: "role", label: "역할", max: 60, placeholder: "예) 옥상에서 만나는 무뚝뚝한 선배" },
];

const BULLET_PLACEHOLDER = "- 항목 형태로 한 줄에 하나씩 적어주세요";

const TEXTAREA_FIELDS = [
  { key: "personality", label: "성격", rows: 3 },
  { key: "tone", label: "말투", rows: 3 },
  { key: "appearance", label: "외형 묘사", rows: 3 },
  { key: "clothing", label: "복장 묘사", rows: 3 },
  { key: "backstory", label: "과거사", rows: 4 },
  { key: "coreValues", label: "가치관", rows: 3, placeholder: BULLET_PLACEHOLDER },
  { key: "flaws", label: "약점", rows: 3, placeholder: BULLET_PLACEHOLDER },
  { key: "speechQuirks", label: "말버릇", rows: 2 },
  { key: "firstGreeting", label: "첫인사", rows: 3 },
  { key: "introNarration", label: "첫 만남 나레이션", rows: 4 },
];

const ALL_FIELDS = [...INPUT_FIELDS, ...TEXTAREA_FIELDS];

/** profile → 폼 스냅샷 (age 등 편집 불가 필드는 버린다) */
const snapshotOf = (profile) =>
  ALL_FIELDS.reduce((acc, f) => {
    acc[f.key] = profile?.[f.key] || "";
    return acc;
  }, {});

const fieldClass =
  "w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm leading-relaxed placeholder:text-white/25 focus:border-amber-400/60 outline-none";

export default function ProfileEditPanel({ open, profile, onSave, onClose }) {
  const [form, setForm] = useState(null);        // null = 미시딩(잠금 상태)
  const baselineRef = useRef(null);              // 저장 성공 시점의 스냅샷
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [savedToast, setSavedToast] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState(false);
  const toastTimerRef = useRef(null);

  // 열릴 때(또는 열린 상태에서 초안이 도착할 때) 1회 시딩 — 폴링 갱신이 입력을 덮지 않도록
  useEffect(() => {
    if (!open) {
      setForm(null);
      baselineRef.current = null;
      setSaveError(null);
      setCloseConfirm(false);
      return;
    }
    if (form === null && profile) {
      const snap = snapshotOf(profile);
      baselineRef.current = snap;
      setForm({ ...snap });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, profile, form === null]);

  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  const dirtyKeys = form
    ? ALL_FIELDS.map((f) => f.key).filter(
        (k) => (form[k] ?? "") !== (baselineRef.current?.[k] ?? "")
      )
    : [];
  const dirty = dirtyKeys.length > 0;

  const handleRequestClose = useCallback(() => {
    if (busy) return;
    if (dirty) {
      sfx.click();
      setCloseConfirm(true);
      return;
    }
    sfx.click();
    onClose?.();
  }, [busy, dirty, onClose]);

  // ESC로 닫기 — 미저장 변경이 있으면 동일하게 confirm을 거친다
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => e.key === "Escape" && handleRequestClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, handleRequestClose]);

  const handleSave = async () => {
    if (!dirty || busy) {
      if (!dirty) sfx.locked();
      return;
    }
    sfx.click();
    setBusy(true);
    setSaveError(null);
    // 변경 필드만 전송 — 미전송 필드는 서버가 유지(null=유지 계약)
    const changed = dirtyKeys.reduce((acc, k) => {
      acc[k] = form[k];
      return acc;
    }, {});
    const result = await onSave(changed);
    setBusy(false);
    if (result?.ok) {
      baselineRef.current = { ...form };
      clearTimeout(toastTimerRef.current);
      setSavedToast(true);
      toastTimerRef.current = setTimeout(() => setSavedToast(false), 2500);
    } else {
      setSaveError(result?.message || "저장에 실패했습니다.");
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[110] flex flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* 배경 — 위저드 위를 덮는 앰버 톤 딤 */}
          <div
            className="absolute inset-0 backdrop-blur-md"
            style={{ background: "linear-gradient(160deg, rgba(20,12,4,0.96), rgba(12,8,4,0.97))" }}
            onClick={handleRequestClose}
          />

          <motion.div
            className="relative z-10 flex flex-col flex-1 min-h-0 w-full max-w-2xl mx-auto"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {/* 헤더 */}
            <div className="flex-shrink-0 flex items-center justify-between px-5 sm:px-8 pt-5 pb-3">
              <div className="flex items-center gap-2">
                <Feather size={16} className="text-amber-300" />
                <h3 className="text-base font-bold text-white tracking-wide">설정 다듬기</h3>
                {dirty && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-200 border border-amber-400/40">
                    미저장
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleRequestClose}
                aria-label="닫기"
                className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/15 text-white/50 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {form === null ? (
              /* ─── 잠금 상태 — Stage0(컨셉 분석) 완료 전 ─── */
              <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
                <motion.div
                  className="w-12 h-12 border-2 border-amber-400/30 border-t-amber-400 rounded-full mb-6"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
                <motion.p
                  className="text-sm text-amber-100/85 font-medium mb-2"
                  animate={{ opacity: [0.55, 1, 0.55] }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                >
                  AI가 초안을 쓰는 중이에요…
                </motion.p>
                <p className="text-xs text-white/35 leading-relaxed">
                  설정 초안이 완성되면 이곳에서 자유롭게 다듬을 수 있어요.
                </p>
              </div>
            ) : (
              <>
                {/* ─── 폼 본문 ─── */}
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-5 sm:px-8 pb-4">
                  <p className="text-xs text-white/45 leading-relaxed mb-5">
                    AI가 쓴 초안이에요. 이미지가 완성되는 동안 마음껏 고쳐도 좋아요 —
                    저장한 내용이 캐릭터의 설정이 됩니다.
                  </p>

                  <div className="space-y-4">
                    {INPUT_FIELDS.map((f) => (
                      <div key={f.key}>
                        <label className="text-[11px] text-white/50 mb-1 block">{f.label}</label>
                        <input
                          type="text"
                          value={form[f.key]}
                          maxLength={f.max}
                          placeholder={f.placeholder}
                          onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                          className={fieldClass}
                        />
                      </div>
                    ))}
                    {TEXTAREA_FIELDS.map((f) => (
                      <div key={f.key}>
                        <label className="text-[11px] text-white/50 mb-1 block">{f.label}</label>
                        <textarea
                          value={form[f.key]}
                          rows={f.rows}
                          placeholder={f.placeholder}
                          onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                          className={`${fieldClass} resize-none`}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* ─── 하단 저장 바 ─── */}
                <div className="flex-shrink-0 px-5 sm:px-8 pb-5 pt-3 border-t border-white/5">
                  {saveError && (
                    <div className="mb-3 px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-400/25 text-rose-200 text-xs">
                      {saveError}
                    </div>
                  )}
                  <motion.button
                    type="button"
                    disabled={!dirty || busy}
                    onClick={handleSave}
                    whileTap={{ scale: dirty && !busy ? 0.98 : 1 }}
                    className={`w-full py-3 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${
                      dirty && !busy
                        ? "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-amber-500/20"
                        : "bg-white/5 text-white/25 cursor-not-allowed"
                    }`}
                  >
                    <Check size={15} />
                    {busy ? "저장 중…" : dirty ? "저장" : "변경 사항이 없어요"}
                  </motion.button>
                </div>
              </>
            )}
          </motion.div>

          {/* ─── 저장 성공 토스트 ─── */}
          <AnimatePresence>
            {savedToast && (
              <motion.div
                className="absolute bottom-24 left-1/2 z-20 px-5 py-3 rounded-2xl backdrop-blur-xl border shadow-2xl text-sm font-medium bg-emerald-900/80 border-emerald-400/30 text-emerald-200 shadow-emerald-500/20"
                initial={{ x: "-50%", y: 20, opacity: 0, scale: 0.9 }}
                animate={{ x: "-50%", y: 0, opacity: 1, scale: 1 }}
                exit={{ x: "-50%", y: 20, opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
              >
                설정을 저장했어요.
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── 미저장 이탈 confirm (ConfirmModal과 같은 폼팩터, 패널 위 z) ─── */}
          <AnimatePresence>
            {closeConfirm && (
              <motion.div
                className="fixed inset-0 z-[140] flex items-center justify-center p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div
                  className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                  onClick={() => setCloseConfirm(false)}
                />
                <motion.div
                  className="relative z-10 w-full max-w-sm rounded-2xl p-6 border border-amber-400/25"
                  style={{
                    background: "linear-gradient(145deg, rgba(28,18,8,0.97), rgba(20,12,6,0.96))",
                    boxShadow: "0 30px 60px rgba(0,0,0,0.6)",
                  }}
                  initial={{ scale: 0.92, y: 16, opacity: 0 }}
                  animate={{ scale: 1, y: 0, opacity: 1 }}
                  exit={{ scale: 0.92, y: 16, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 28 }}
                >
                  <h3 className="font-bold text-amber-100 mb-2">저장하지 않고 닫을까요?</h3>
                  <p className="text-white/60 text-sm leading-relaxed mb-5">
                    저장하지 않은 변경 사항이 있어요. 닫으면 지금까지 고친 내용이 사라집니다.
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => { sfx.click(); setCloseConfirm(false); }}
                      className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 transition text-sm"
                    >
                      계속 다듬기
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        sfx.click();
                        setCloseConfirm(false);
                        onClose?.();
                      }}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-rose-600/80 hover:bg-rose-500/80 text-white transition"
                    >
                      저장 안 하고 닫기
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
