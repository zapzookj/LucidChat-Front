import { motion, AnimatePresence } from "framer-motion";
import { Check, Clapperboard, Loader2, Zap } from "lucide-react";

/**
 * [2026-07-31 에픽 B] 씬 일러 수동 요청 FAB — 유저 트리거 전용(종원 확정).
 *
 * 버튼 클릭 → POST /illustrations/scenes/request (5에너지, 실패 자동 환불) →
 * 씬 디렉터(전용 LLM)가 대화 맥락으로 스펙 작성 → 렌더 → SceneIllustrationStage 상주 표시.
 * 요청/생성 중에는 비활성(방당 동시 1렌더 — 서버 인플라이트 가드의 프론트 짝).
 * [2026-08-07 씬당 1회] 현재 턴에서 이미 그렸으면 '그려진 장면' 비활성 표시 —
 * 말없이 사라지는 대신 상태를 설명(과금 기능의 소실은 버그로 오인됨).
 *
 * @param {object}   props.stage       useSceneIllustrations 훅 반환값
 * @param {boolean}  props.visible     페이지 상태(엔딩 연출 등)에 따른 노출 제어
 * @param {function} props.onRequested 요청 성공 콜백 — 페이지의 에너지 표시 차감용
 */
export default function SceneRequestButton({ stage, visible = true, onRequested }) {
  // [리뷰픽스] 기능 off(백엔드 플래그 기본 false)면 미노출 — 죽은 버튼 방지.
  // 비용 표기는 훅의 availability(서버 단일 소스) — 하드코딩 5 드리프트 제거.
  if (!stage || !stage.featureEnabled) return null;
  const { request, requesting, requestError, generating, energyCost, alreadyDrawn } = stage;
  const busy = requesting || generating;
  // 이번 장면 소비 완료(생성 중 아님) — 새 대화 턴까지 재요청 잠금
  const drawn = !busy && !!alreadyDrawn;
  const locked = busy || drawn;

  const handleClick = async () => {
    if (locked) return;
    const result = await request();
    if (result.ok) onRequested?.(energyCost);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed bottom-[11rem] right-4 z-40 flex flex-col items-end gap-2"
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 200 }}
        >
          {/* 실패/안내 토스트 — 훅이 4초 뒤 자동 소거 */}
          <AnimatePresence>
            {requestError && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="max-w-[240px] rounded-xl bg-black/70 backdrop-blur-md border border-white/10 px-3 py-2 text-[11px] text-rose-200/90 shadow-lg"
              >
                {requestError}
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={handleClick}
            disabled={locked}
            aria-label="씬 일러스트 생성"
            className={`px-4 py-3 rounded-2xl backdrop-blur-sm flex items-center gap-2 text-sm font-medium
                        border shadow-lg transition-all ${
              locked
                ? "bg-gray-800/80 border-white/10 text-white/40 cursor-not-allowed"
                : "bg-gradient-to-r from-sky-600/90 to-indigo-600/90 border-sky-400/30 text-white shadow-sky-500/30 hover:from-sky-500/90 hover:to-indigo-500/90"
            }`}
          >
            {busy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : drawn ? (
              <Check size={16} className="text-emerald-300/70" />
            ) : (
              <Clapperboard size={16} />
            )}
            {busy ? "씬 그리는 중…" : drawn ? "그려진 장면이에요" : "이 장면 그리기"}
            {!locked && (
              <span className="flex items-center gap-0.5 rounded-full bg-black/25 px-1.5 py-0.5 text-[10px] text-amber-200">
                <Zap size={10} />
                {energyCost}
              </span>
            )}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
