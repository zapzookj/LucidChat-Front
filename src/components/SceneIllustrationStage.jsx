import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Loader2, ImageOff } from "lucide-react";

/**
 * [docs/09 A-2 + A-3] 씬 일러 상주 무대 — V1 ChatPage(SANDBOX) 전용.
 *
 * 렌더 정책 (회귀 제로):
 *   - 씬 트랙이 전혀 없는 방(hasAnyScene=false) → null. 기존 스탠딩 무대 그대로.
 *   - 완료 일러가 아직 없고 첫 씬 생성 중(active=false, generating=true)
 *     → 스탠딩 무대 유지 + 은은한 생성중 칩만 (pointer-events-none, 무대 클릭 불가침)
 *   - 완료 일러 존재(active=true) → 랜드스케이프 일러가 무대를 채움 (DialogueBox z-20 뒤)
 *
 * 배치 계약: ChatPage의 스탠딩 무대 래퍼(z-0) 내부, CharacterDisplay 뒤 ·
 *   InnerThoughtBubble 앞에 렌더 — 스탠딩만 덮고 속마음 버블/HUD/DialogueBox는 그대로 동작.
 *
 * @param {object} props.stage    useSceneIllustrations 훅 반환값
 * @param {boolean} props.portrait 모바일 세로 — 랜드스케이프(1344×768) 일러를 레터박스(object-contain)로
 */
export default function SceneIllustrationStage({ stage, portrait = false }) {
  if (!stage || !stage.hasAnyScene) return null;

  const {
    active, imageUrl, index, total,
    canPrev, canNext, goPrev, goNext, goLatest,
    isViewingPast, generating, failed,
  } = stage;

  // ── 생성중/실패 칩 (홀드 일러 위 또는 첫 생성 중 스탠딩 무대 위) ──
  const statusChip = generating ? (
    <div className="absolute top-[4.5rem] right-4 sm:right-6 z-10 flex items-center gap-2 rounded-full bg-black/55 backdrop-blur-md border border-white/10 px-3 py-1.5 text-[11px] text-amber-200/90 shadow-lg">
      <Loader2 size={12} className="animate-spin" />
      <span className="animate-pulse">씬 일러 생성 중…</span>
    </div>
  ) : failed ? (
    <div className="absolute top-[4.5rem] right-4 sm:right-6 z-10 flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur-md border border-white/10 px-3 py-1.5 text-[11px] text-rose-300/90 shadow-lg">
      <ImageOff size={12} />
      <span>일러 생성 실패</span>
    </div>
  ) : null;

  // 완료 일러가 아직 하나도 없음 — 스탠딩 무대 유지, 칩만 얹는다 (클릭 불가침)
  if (!active) {
    return statusChip ? (
      <div className="absolute inset-0 pointer-events-none">{statusChip}</div>
    ) : null;
  }

  return (
    <div className="absolute inset-0 bg-gray-950 overflow-hidden select-none">
      {/* ── 씬 일러 본체 — 교체 시 시네마틱 크로스페이드 ── */}
      <AnimatePresence initial={false}>
        <motion.img
          key={imageUrl}
          src={imageUrl}
          alt="씬 일러스트"
          draggable={false}
          initial={{ opacity: 0, scale: 1.03 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className={`absolute inset-0 w-full h-full ${portrait ? "object-contain" : "object-cover"}`}
        />
      </AnimatePresence>

      {/* 하단 그라데이션 — DialogueBox(z-20) 가독성, 기존 다크·시네마틱 톤 */}
      <div className="absolute inset-x-0 bottom-0 h-2/5 pointer-events-none bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
      {/* 상단 미세 그라데이션 — HUD 가독성 */}
      <div className="absolute inset-x-0 top-0 h-24 pointer-events-none bg-gradient-to-b from-black/45 to-transparent" />

      {/* ── [A-2] 턴 인디케이터 + 과거 열람 복귀 ── */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
        <div className={`rounded-full backdrop-blur-md border px-3 py-1 text-[11px] tabular-nums tracking-widest shadow-lg transition-colors ${
          isViewingPast
            ? "bg-amber-500/15 border-amber-400/40 text-amber-200"
            : "bg-black/55 border-white/10 text-white/85"
        }`}>
          {index + 1} / {total}
        </div>
        <AnimatePresence>
          {isViewingPast && (
            <motion.button
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              onClick={goLatest}
              className="rounded-full bg-amber-500/90 text-gray-950 px-3 py-1 text-[11px] font-bold shadow-lg hover:bg-amber-400 transition-colors"
            >
              최신 씬으로 →
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ── [A-2] 전/후 씬 셰브론 (완료본 2장 이상일 때) ── */}
      {total > 1 && (
        <>
          <button
            onClick={goPrev}
            disabled={!canPrev}
            aria-label="이전 씬"
            className={`absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 grid place-items-center rounded-full bg-black/45 backdrop-blur-md border border-white/10 text-white/80 transition ${
              canPrev ? "hover:bg-black/70 hover:text-white active:scale-95" : "opacity-25 pointer-events-none"
            }`}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={goNext}
            disabled={!canNext}
            aria-label="다음 씬"
            className={`absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 grid place-items-center rounded-full bg-black/45 backdrop-blur-md border border-white/10 text-white/80 transition ${
              canNext ? "hover:bg-black/70 hover:text-white active:scale-95" : "opacity-25 pointer-events-none"
            }`}
          >
            <ChevronRight size={20} />
          </button>
        </>
      )}

      {/* 생성중/실패 칩 — 직전 완료 일러 홀드 위에 은은하게 */}
      {statusChip}
    </div>
  );
}
