import { Clapperboard } from "lucide-react";

/**
 * [Scene-Polish C] 히스토리 모달 안의 씬 썸네일 마커 행 — V1/V2 공용.
 * 해당 turnIndex(로그 ordinal) 메시지 직후에 삽입되며, 클릭 시 무대의 그 씬으로 점프한다.
 *
 * @param {object}   props.scene  displayable 씬 {id, turnIndex, imageUrl}
 * @param {function} props.onJump 클릭 핸들러 (페이지가 goToTurn + 모달 닫기 수행)
 */
export default function SceneHistoryMarker({ scene, onJump }) {
  if (!scene?.imageUrl) return null;
  return (
    <div className="flex justify-center my-4">
      <button
        onClick={onJump}
        aria-label="이 장면의 씬 일러 보기"
        className="group flex items-center gap-3 rounded-xl bg-black/40 border border-sky-500/20
                   hover:border-sky-400/50 hover:bg-black/60 p-1.5 pr-4 transition shadow-lg text-left"
      >
        <img
          src={scene.imageUrl}
          alt="씬 일러 썸네일"
          loading="lazy"
          draggable={false}
          className="w-20 h-12 object-cover rounded-lg border border-white/10"
        />
        <div>
          <p className="text-[11px] text-sky-300/90 font-medium flex items-center gap-1.5">
            <Clapperboard size={11} className="shrink-0" />
            이 장면의 씬 일러
          </p>
          <p className="text-[10px] text-white/35 group-hover:text-white/60 transition">
            눌러서 무대에서 다시 보기
          </p>
        </div>
      </button>
    </div>
  );
}
