import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ImagePlus, Check, ChevronDown, Zap, RefreshCw, AlertTriangle } from "lucide-react";
import useOverlayFocus from "../mobile/useOverlayFocus";
import {
  OUTFITS, BODY, BUST, EMPTY_ADJUSTMENTS, toAdjustState, summarizeAdjustments, adjustmentsPayload,
} from "../../utils/referenceAdjustments";

/**
 * [그림 방식 · aichat docs/56 §10] 레퍼런스 빌더 UI 조각 — 확정 목업 v2(mockups/reference-builder) 구현.
 *
 * ConceptStep(그림 모드)과 GachaStep(비교·고치기·다시 뽑기)이 공유한다. 조정값 계약은 서버
 * ReferencePrompts.sanitize와 같다: outfit keep|maid|uniform|suit|casual|custom(outfitText),
 * body keep|slim|curvy, bust keep|small|large, extra(60자). 키는 원화·스탠딩 구도상 보이지 않아 받지 않는다.
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** 단일 선택 라디오 그룹 — 화살표 키로 이동(roving tabindex) */
function RadioRow({ label, options, value, onChange, cols = "grid-cols-3" }) {
  const refs = useRef([]);
  const onKeyDown = (e, i) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + options.length) % options.length;
    onChange(options[next][0]);
    refs.current[next]?.focus();
  };
  return (
    <div className={`grid ${cols} gap-1.5`} role="radiogroup" aria-label={label}>
      {options.map(([v, l], i) => (
        <button
          key={v}
          ref={(el) => { refs.current[i] = el; }}
          type="button"
          role="radio"
          aria-checked={value === v}
          tabIndex={value === v ? 0 : -1}
          onClick={() => onChange(v)}
          onKeyDown={(e) => onKeyDown(e, i)}
          className={`min-h-11 px-2 py-2 rounded-lg text-[13px] font-medium border transition ${
            value === v
              ? "bg-lobby-accent/15 border-lobby-accent/50 text-lobby-accent"
              : "bg-white/[0.04] border-white/10 text-lobby-tx1 hover:bg-white/[0.07]"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

/** 복장·체형·가슴·기타 요청 — 컨셉 스텝 패널과 고치기/다시 뽑기 모달 공용 */
export function AdjustFields({ value, onChange, idPrefix }) {
  const set = (k) => (v) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-4">
      <div>
        <div className="text-[13px] font-semibold text-lobby-tx1 mb-1.5">복장</div>
        <RadioRow label="복장" options={OUTFITS} value={value.outfit} onChange={set("outfit")} cols="grid-cols-2 min-[420px]:grid-cols-3" />
        {value.outfit === "custom" && (
          <input
            type="text"
            value={value.outfitText}
            maxLength={40}
            aria-label="원하는 복장"
            placeholder="예) 검은 후드티와 청바지"
            onChange={(e) => set("outfitText")(e.target.value)}
            className="mt-2 w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-lobby-tx2 focus:border-lobby-accent/60 outline-none"
          />
        )}
        {value.outfit === "custom" && !value.outfitText?.trim() && (
          <p className="mt-1.5 text-xs text-lobby-accent/85">원하는 복장을 적어주세요. 비워두면 복장은 그대로예요.</p>
        )}
        {value.outfit !== "keep" && (
          <p className="mt-1.5 text-xs text-lobby-tx2">얼굴·헤어·눈 색처럼 눈에 띄는 특징은 그대로 두고 옷만 바꿔요.</p>
        )}
      </div>
      <div className="space-y-2">
        {[["체형", "body", BODY], ["가슴", "bust", BUST]].map(([l, k, o]) => (
          <div key={k} className="grid grid-cols-[44px_1fr] items-center gap-3">
            <div className="text-[13px] font-semibold text-lobby-tx1">{l}</div>
            <RadioRow label={l} options={o} value={value[k]} onChange={set(k)} />
          </div>
        ))}
      </div>
      <div>
        <label htmlFor={`${idPrefix}-extra`} className="text-[13px] font-semibold text-lobby-tx1 mb-1.5 block">
          기타 요청 <span className="font-normal text-lobby-tx2">(선택)</span>
        </label>
        <input
          id={`${idPrefix}-extra`}
          type="text"
          value={value.extra}
          maxLength={60}
          placeholder="예) 머리를 단발로, 안경 추가, 잘못 알아본 특징 바로잡기"
          onChange={(e) => set("extra")(e.target.value)}
          className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-lobby-tx2 focus:border-lobby-accent/60 outline-none"
        />
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** "외형을 어떻게 정할까요?" — 글/그림 선택. 그림 카드에 대가(장면 일러 미지원)를 바로 적는다 */
export function AppearanceModeSelect({ mode, onChange }) {
  const refs = useRef([]);
  const options = [
    ["text", "글로 설명하기", "떠오르는 모습을 적어요", null],
    ["image", "그림으로 보여주기", "내 캐릭터 그림을 올려요", "장면 일러스트 미지원"],
  ];
  return (
    <div className="mb-3">
      <div id="appearance-mode-label" className="text-[13px] font-semibold text-lobby-tx1 mb-1.5">외형을 어떻게 정할까요?</div>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="appearance-mode-label">
        {options.map(([v, title, desc, cost], i) => (
          <button
            key={v}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={mode === v}
            tabIndex={mode === v ? 0 : -1}
            onClick={() => onChange(v)}
            onKeyDown={(e) => {
              if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
              e.preventDefault();
              const next = options[1 - i][0];
              onChange(next);
              refs.current[1 - i]?.focus();
            }}
            className={`text-left min-h-11 px-3.5 py-3 rounded-xl border transition ${
              mode === v ? "bg-lobby-accent/[0.12] border-lobby-accent/55" : "bg-white/[0.04] border-white/10 hover:bg-white/[0.07]"
            }`}
          >
            <span className={`flex items-center gap-1.5 text-sm font-semibold ${mode === v ? "text-lobby-accent" : "text-lobby-tx0"}`}>
              {title}
              {v === "image" && (
                <span className="text-lb-badge font-bold px-1.5 py-px rounded-full bg-lobby-teal/15 text-lobby-teal border border-lobby-teal/30">NEW</span>
              )}
            </span>
            <span className="block mt-0.5 text-xs text-lobby-tx2">{desc}</span>
            {cost && <span className="block mt-1 text-xs text-amber-200/80">{cost}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

/** 그림 방식에서 달라지는 점 — 모바일은 접어서 시작(세로 길이 절약), 데스크톱은 펼침 */
export function ReferenceNotice({ defaultOpen }) {
  return (
    <details className="mb-4 rounded-xl border border-white/[0.08] bg-black/15 px-4 py-2.5" open={defaultOpen}>
      <summary className="min-h-11 flex items-center text-xs text-lobby-tx1 font-medium cursor-pointer">그림으로 만들 때 달라지는 점</summary>
      <ul className="mt-1.5 mb-1 space-y-1.5 text-xs text-lobby-tx2 leading-relaxed">
        <li>· 대화 중 장면 일러스트는 만들 수 없어요. 표정 일러스트는 똑같이 만들어져요.</li>
        <li>· 손에 든 무기·소품은 스탠딩과 표정 일러스트에서 빠져요.</li>
        <li>· 노출이 많은 복장은 일부 표정 일러스트가 안 나올 수 있어요. 그럴 땐 복장을 바꿔보세요.</li>
        <li>· 다른 작품의 캐릭터는 공개 캐릭터로 등록하기 어려울 수 있어요. 나만 보는 캐릭터로는 쓸 수 있어요.</li>
        <li>· 올린 그림은 원화를 그리는 데만 쓰고, 다른 유저에게는 보이지 않아요.</li>
      </ul>
    </details>
  );
}

/**
 * 업로드 카드 — state: {status: "empty"|"checking"|"ready"|"error", previewUrl?, view?, error?, retryable?}
 * onPick(file): 파일 선택(드롭 포함). onClear(): 지우기.
 */
export function ReferenceUploadCard({ state, onPick, onClear, onRetry, narrow }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const pick = () => inputRef.current?.click();
  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/png,image/jpeg,image/webp"
      className="sr-only"
      tabIndex={-1}
      aria-hidden="true"
      onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPick(f); }}
    />
  );

  if (state.status === "empty") {
    return (
      <>
        {fileInput}
        <button
          type="button"
          onClick={pick}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) onPick(f); }}
          className={`w-full rounded-2xl border border-dashed transition px-5 py-8 flex flex-col items-center text-center ${
            dragOver ? "border-lobby-accent bg-lobby-accent/[0.06]" : "border-lobby-accent/35 hover:border-lobby-accent/70 hover:bg-lobby-accent/[0.04]"
          }`}
          style={{ background: dragOver ? undefined : "repeating-linear-gradient(135deg, #ffffff04 0 10px, transparent 10px 20px)" }}
        >
          <span className="w-12 h-12 rounded-full bg-lobby-accent/[0.12] border border-lobby-accent/30 flex items-center justify-center text-lobby-accent mb-3" aria-hidden="true">
            <ImagePlus size={20} />
          </span>
          <span className="text-[15px] font-semibold text-white">캐릭터 그림 올리기</span>
          <span className="mt-1 text-xs text-lobby-tx1">{narrow ? "눌러서 앨범에서 고르세요" : "끌어다 놓거나 눌러서 고르세요"}</span>
          <span className="mt-3 text-xs text-lobby-tx2 leading-relaxed">
            얼굴과 옷차림이 잘 보이는 한 명의 전신·반신 그림<br />PNG · JPG · WebP, 10MB 이하
          </span>
        </button>
      </>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-2xl border border-rose-400/30 bg-rose-500/[0.06] p-3 sm:p-4 flex gap-3 items-start" role="alert">
        {fileInput}
        {state.previewUrl ? (
          <img src={state.previewUrl} alt="올리려던 그림" className="w-16 aspect-[3/4] object-cover object-top rounded-lg opacity-50 grayscale flex-shrink-0" />
        ) : (
          <div className="w-16 aspect-[3/4] rounded-lg bg-black/30 flex items-center justify-center text-rose-300 flex-shrink-0" aria-hidden="true">
            <AlertTriangle size={18} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-rose-100">{state.title || "이 그림은 쓸 수 없어요"}</p>
          <p className="mt-1 text-xs text-rose-100/80 leading-relaxed">{state.error} 에너지는 쓰이지 않았어요.</p>
          <button type="button" onClick={state.retryable && onRetry ? onRetry : pick} className="mt-3 min-h-11 px-4 rounded-xl bg-white/[0.06] border border-white/10 text-sm text-lobby-tx0 hover:bg-white/10">
            {state.retryable ? "다시 올리기" : "다른 그림 고르기"}
          </button>
        </div>
      </div>
    );
  }

  const checking = state.status === "checking";
  const features = state.view?.features || [];
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4 flex gap-3 sm:gap-4">
      {fileInput}
      <div className="relative w-24 sm:w-32 aspect-[3/4] rounded-xl overflow-hidden bg-black/30 flex-shrink-0">
        {state.previewUrl && (
          <img src={state.previewUrl} alt="올린 캐릭터 그림" className={`w-full h-full object-cover object-top ${checking ? "opacity-60" : ""}`} />
        )}
        {checking && <div className="absolute inset-0 animate-pulse bg-lobby-accent/10" />}
      </div>
      <div className="flex-1 min-w-0 flex flex-col" aria-live="polite">
        <div className="flex items-center gap-2">
          {checking ? (
            <>
              <span className="w-4 h-4 border-2 border-lobby-accent/30 border-t-lobby-accent rounded-full animate-spin" aria-hidden="true" />
              <span className="text-sm font-semibold text-lobby-accent">그림을 살펴보는 중…</span>
            </>
          ) : (
            <>
              <span className="w-5 h-5 rounded-full bg-lobby-easy/20 text-lobby-easy flex items-center justify-center" aria-hidden="true"><Check size={12} /></span>
              <span className="text-sm font-semibold text-white">그림 확인 완료</span>
            </>
          )}
        </div>
        {checking ? (
          <p className="mt-2 text-xs text-lobby-tx1 leading-relaxed">보통 몇 초면 끝나요. 그동안 아래 내용을 먼저 채워도 돼요.</p>
        ) : features.length > 0 ? (
          <>
            <p className="mt-2 text-xs text-lobby-tx2">그림에서 찾은 특징</p>
            <p className="mt-0.5 text-[13px] text-lobby-tx0 leading-relaxed">{features.join(" · ")}</p>
          </>
        ) : null}
        {state.pickError && !checking && (
          <p className="mt-2 text-xs text-rose-200" role="alert">{state.pickError} 지금 그림은 그대로 둘게요.</p>
        )}
        <div className="mt-auto pt-3 flex gap-1">
          <button type="button" onClick={pick} disabled={checking} className="min-h-11 px-3 rounded-xl bg-white/[0.05] border border-white/10 text-xs text-lobby-tx0 hover:bg-white/10 disabled:opacity-50">
            다른 그림으로
          </button>
          <button type="button" onClick={onClear} disabled={checking} className="min-h-11 px-3 rounded-xl text-xs text-lobby-tx2 hover:text-white disabled:opacity-50">
            지우기
          </button>
        </div>
      </div>
    </div>
  );
}

/** "원하는 대로 바꾸기" 접이식 패널 — 그림이 없으면 inert(키보드 포함 비활성) */
export function AdjustPanel({ enabled, value, onChange }) {
  const [open, setOpen] = useState(false);
  const summary = summarizeAdjustments(value);
  const shown = open && enabled;
  return (
    <div className={`mb-6 rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden ${enabled ? "" : "opacity-45"}`} inert={!enabled}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={shown}
        className="w-full min-h-12 flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
      >
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-lobby-tx1">
          원하는 대로 바꾸기 <span className="font-normal text-lobby-tx2">(선택)</span>
          {summary.length > 0 && (
            <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-lobby-accent/15 text-lobby-accent border border-lobby-accent/30">{summary.length}</span>
          )}
        </span>
        <motion.span animate={{ rotate: shown ? 180 : 0 }} transition={{ duration: 0.25 }} aria-hidden="true">
          <ChevronDown size={14} className="text-lobby-tx2" />
        </motion.span>
      </button>
      {!enabled ? (
        <p className="px-4 pb-3 -mt-1 text-xs text-lobby-tx2">그림을 올리면 복장·체형을 바꿀 수 있어요.</p>
      ) : shown ? (
        <div className="px-4 pb-4 pt-1"><AdjustFields value={value} onChange={onChange} idPrefix="concept-adjust" /></div>
      ) : (
        <p className={`px-4 pb-3 -mt-1 text-xs ${summary.length ? "text-lobby-accent/90" : "text-lobby-tx2"}`}>
          {summary.length ? summary.join(" · ") : "복장·체형을 바꾸거나, 잘못 알아본 특징을 바로잡을 수 있어요."}
        </p>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 고치기 / 다시 뽑기 모달.
 *   mode "fix": 초안은 빈 조정에서 시작(1회용 — 잡 조정값을 바꾸지 않는다), 변경 1개 이상 필수.
 *   mode "reroll": 초안은 현재 조정값에서 시작, 확정 시 이후 다시 뽑기에도 이어진다.
 * openKey: 열 때마다 바뀌는 값(호출측이 부여) — 본문을 재마운트해 초안을 새로 시작한다(effect 안 setState 회피).
 */
export function ReferenceAdjustModal({ open, openKey, ...props }) {
  return (
    <AnimatePresence>
      {open && <ReferenceAdjustModalBody key={openKey} {...props} />}
    </AnimatePresence>
  );
}

function ReferenceAdjustModalBody({ mode, base, initial, cost, energy, error, busy, onConfirm, onCancel }) {
  const panelRef = useRef(null);
  const [draft, setDraft] = useState(() => (mode === "fix" ? EMPTY_ADJUSTMENTS : toAdjustState(initial)));
  useOverlayFocus(true, panelRef, busy ? undefined : onCancel);
  const fix = mode === "fix";
  const noChange = fix && summarizeAdjustments(draft).length === 0;
  const lackEnergy = Number.isFinite(energy) && Number.isFinite(cost) && energy < cost;
  const blocked = noChange || lackEnergy;
  const emptyCustom = draft.outfit === "custom" && !draft.outfitText?.trim();
  const why = lackEnergy
    ? `에너지가 ${cost}E 필요해요 (지금 ${energy}E)`
    : noChange ? (emptyCustom ? "원하는 복장을 적어주세요" : "바꿀 내용을 하나 이상 골라주세요") : "";

  return (
        <motion.div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={busy ? undefined : onCancel} />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ref-adjust-title"
            tabIndex={-1}
            className="relative z-10 w-full sm:max-w-lg max-h-[88dvh] overflow-y-auto custom-scrollbar rounded-t-[24px] sm:rounded-[24px] p-5 sm:p-6 border border-lobby-accent/25"
            style={{ background: "linear-gradient(145deg, rgba(42,50,74,0.98), rgba(28,39,58,0.98))", boxShadow: "0 30px 60px rgba(0,0,0,0.6)" }}
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
          >
            <h3 id="ref-adjust-title" className="font-bold text-lobby-accent mb-1">{fix ? "이 그림 고치기" : "올린 그림에서 다시 뽑기"}</h3>
            <p className="text-[13px] text-lobby-tx1 mb-4 leading-relaxed">
              {fix
                ? "구도와 자세는 그대로 두고, 고른 부분만 다시 그려요. 고친 그림은 새 후보로 추가돼요."
                : "올린 그림을 바탕으로 원화 2장을 새로 그려요. 지금까지 나온 원화도 그대로 남아요."}
            </p>
            {fix && base && (
              <div className="flex gap-3 items-center mb-4">
                <img src={base.url} alt="" className="w-16 h-16 rounded-xl object-cover border border-white/10" draggable={false} />
                <span className="text-xs text-lobby-tx2">고칠 그림 · 원화 {base.index + 1}</span>
              </div>
            )}
            <AdjustFields value={draft} onChange={setDraft} idPrefix={fix ? "fix-adjust" : "reroll-adjust"} />
            {!fix && <p className="mt-3 text-xs text-lobby-tx2">여기서 바꾼 설정은 이후 다시 뽑기에도 이어져요.</p>}
            {error && (
              <p className="mt-3 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-400/25 text-xs text-rose-200 leading-relaxed whitespace-pre-line" role="alert">{error}</p>
            )}
            <p id="ref-adjust-why" className="mt-3 min-h-4 text-xs text-lobby-accent/85">{why}</p>
            <div className="flex gap-3 mt-3">
              <button type="button" disabled={busy} onClick={onCancel} className="flex-1 min-h-11 py-2.5 rounded-xl bg-white/5 text-lobby-tx1 hover:bg-white/10 text-sm disabled:opacity-50">
                취소
              </button>
              <button
                type="button"
                disabled={busy || blocked}
                aria-describedby={blocked ? "ref-adjust-why" : undefined}
                onClick={() => onConfirm(fix ? adjustmentsPayload(draft) : (adjustmentsPayload(draft) ?? { ...EMPTY_ADJUSTMENTS }))}
                className={`flex-1 min-h-11 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 ${
                  busy || blocked ? "bg-white/5 text-lobby-tx2 cursor-not-allowed" : "aurora-secondary-primary"
                }`}
              >
                {fix ? "고쳐서 그리기" : (<><RefreshCw size={13} />다시 뽑기</>)}
                <span className="inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full bg-black/25"><Zap size={10} />+{cost}E</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
  );
}

/** 올린 그림 ↔ 원화 나란히 비교 */
export function ReferenceCompareModal({ open, referenceUrl, shot, onClose }) {
  const panelRef = useRef(null);
  useOverlayFocus(open, panelRef, onClose);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[125] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
          <div ref={panelRef} role="dialog" aria-modal="true" aria-label="올린 그림과 원화 비교" tabIndex={-1} className="relative z-10 w-full max-w-3xl">
            <div className="grid grid-cols-2 gap-2">
              <figure>
                <img src={referenceUrl} alt="올린 그림" className="w-full max-h-[70dvh] object-contain rounded-xl bg-black/40" draggable={false} />
                <figcaption className="mt-1 text-xs text-lobby-tx1 text-center">올린 그림</figcaption>
              </figure>
              <figure>
                {shot ? (
                  <img src={shot.url} alt={`원화 ${shot.index + 1}`} className="w-full max-h-[70dvh] object-contain rounded-xl bg-black/40" draggable={false} />
                ) : (
                  <div className="w-full aspect-square rounded-xl bg-black/40" />
                )}
                <figcaption className="mt-1 text-xs text-lobby-tx1 text-center">{shot ? `원화 ${shot.index + 1}` : "원화"}</figcaption>
              </figure>
            </div>
            <button type="button" onClick={onClose} className="mt-3 mx-auto block min-h-11 px-6 rounded-xl bg-white/10 text-sm text-lobby-tx0 hover:bg-white/15">닫기</button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
