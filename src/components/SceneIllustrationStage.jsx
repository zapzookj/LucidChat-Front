import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Loader2, ImageOff, EyeOff, Images } from "lucide-react";

/**
 * [docs/09 A-2 + A-3] 씬 일러 상주 무대 — V1 ChatPage + V2 ChatPageV2 공용(에픽 B).
 *
 * 렌더 정책 (회귀 제로):
 *   - 씬 트랙이 전혀 없는 방(hasAnyScene=false) → null. 기존 스탠딩 무대 그대로.
 *   - 완료 일러가 아직 없고 첫 씬 생성 중(active=false, generating=true)
 *     → 스탠딩 무대 유지 + 은은한 생성중 칩만 (pointer-events-none, 무대 클릭 불가침)
 *   - 완료 일러 존재(active=true) + visible=true → 랜드스케이프 일러가 무대를 채움 (DialogueBox z-20 뒤)
 *   - [Scene-Polish B] visible=false(자동 복귀/수동 숨김) → 스탠딩 무대 + 우상단 '씬 보기' 칩만.
 *     5에너지 과금 일러가 '사라진 게 아니라 보관 중'임이 체감되도록 칩에 보관 수를 명시.
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
    visible = true, show, hide, dismissReason,
  } = stage;

  // ── 생성중/실패 칩 (우상단 스택에 들어감 — 홀드 일러 위/첫 생성 중/숨김 중 공용) ──
  const statusChip = generating ? (
    <div className="flex items-center gap-2 rounded-full bg-black/55 backdrop-blur-md border border-white/10 px-3 py-1.5 text-[11px] text-amber-200/90 shadow-lg">
      <Loader2 size={12} className="animate-spin" />
      <span className="animate-pulse">씬 일러 생성 중…</span>
    </div>
  ) : failed ? (
    <div className="flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur-md border border-white/10 px-3 py-1.5 text-[11px] text-rose-300/90 shadow-lg">
      <ImageOff size={12} />
      <span>일러 생성 실패</span>
    </div>
  ) : null;

  // 우상단 오버레이 스택 위치 — 기존 생성중 칩 자리(top-[4.5rem])를 그대로 계승
  const topRightStack = "absolute top-[4.5rem] right-4 sm:right-6 z-10 flex flex-col items-end gap-2";

  // 완료 일러가 아직 하나도 없음 — 스탠딩 무대 유지, 칩만 얹는다 (클릭 불가침)
  if (!active) {
    return statusChip ? (
      <div className="absolute inset-0 pointer-events-none">
        <div className={topRightStack}>{statusChip}</div>
      </div>
    ) : null;
  }

  // ── [Scene-Polish B] 숨김 상태 — 스탠딩 무대로 복귀, '씬 보기' 칩만 가장자리에 ──
  if (!visible) {
    const autoDismissed = dismissReason === "EMOTION" || dismissReason === "LOCATION";
    // [Scene-Polish D] 재입장 K-윈도우 판정이 '지난 장면'으로 접은 경우 — 복귀보다 열람 뉘앙스의 카피
    const stale = dismissReason === "STALE";
    return (
      <div className="absolute inset-0 pointer-events-none">
        <div className={topRightStack}>
          <motion.button
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            onClick={show}
            aria-label="보관된 씬 일러 다시 보기"
            title="씬 일러는 사라지지 않아요 — 눌러서 무대로 불러오기"
            className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur-md
                       border border-sky-400/25 px-3 py-1.5 text-[11px] text-sky-200/90 shadow-lg
                       hover:bg-black/75 hover:border-sky-400/50 hover:text-sky-100 active:scale-95 transition"
          >
            <Images size={12} />
            <span>{stale ? "지난 장면 보기" : autoDismissed ? "장면 전환 — 씬 보기" : "씬 보기"}</span>
            <span className="rounded-full bg-sky-500/20 px-1.5 py-0.5 text-[10px] tabular-nums text-sky-200">
              {stale ? `${total}장` : `${total}장 보관`}
            </span>
          </motion.button>
          {statusChip}
        </div>
      </div>
    );
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

      {/* ── [Scene-Polish B] 우상단: 숨기기 토글(눈) + 생성중/실패 칩 스택 ── */}
      <div className={topRightStack}>
        <button
          onClick={hide}
          aria-label="씬 일러 숨기기"
          title="스탠딩 무대로 돌아가기 — 씬은 보관되고 '씬 보기'로 언제든 복귀"
          className="flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur-md border border-white/10
                     px-3 py-1.5 text-[11px] text-white/75 shadow-lg
                     hover:bg-black/75 hover:text-white active:scale-95 transition"
        >
          <EyeOff size={12} />
          <span>숨기기</span>
        </button>
        {statusChip}
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
    </div>
  );
}
