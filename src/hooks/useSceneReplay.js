import { useState, useMemo, useCallback, useEffect } from "react";
import { pickReplayableIndices, messageToScene } from "../utils/sceneReplay";

/**
 * [2026-08-07 디오라마 이식] 과거 씬 리플레이 훅 — 대화 기록 클릭 → 그 시점의 씬을 무대에 재현,
 * 앞/뒤 씬 이동 + '현재로 돌아가기' 복귀. V1 ChatPage / V2 ChatPageV2 공용.
 *
 * 원칙: 라이브 상태(currentScene/currentSpeaker/displayedEmotion/배경/BGM/씬 큐)를 절대
 * 건드리지 않는다 — 페이지가 렌더 지점에서만 3-way 병합한다. exit()는 대상 해제 한 줄이라
 * 스냅샷/롤백이 불필요하고, 라이브 진행은 뒤에서 그대로 이어진다(큐 자동재생만 페이지가 가드).
 *
 * [리뷰픽스] 대상은 배열 인덱스가 아니라 *메시지 객체 identity*로 추적한다 — 무한스크롤
 * prepend·씬 삭제로 인덱스가 밀려도 열람 중인 씬이 소리 없이 바뀌지 않는다(prepend/삭제는
 * 기존 엔트리 객체를 보존하므로 indexOf 재해석이 안정적). 대상이 배열에서 사라지면
 * (방 재초기화·해당 로그 삭제) 라이브로 복귀한다.
 *
 * @param {Array} messages 페이지 메시지 배열(씬 단위 엔트리)
 */
export default function useSceneReplay(messages) {
  // 리플레이 대상 메시지 객체 | null = 라이브
  const [target, setTarget] = useState(null);

  const replayables = useMemo(() => pickReplayableIndices(messages), [messages]);

  // 대상의 현재 인덱스 — prepend/삭제로 위치가 밀려도 identity로 재해석
  const replayIndex = useMemo(
    () => (target == null ? -1 : (messages || []).indexOf(target)),
    [messages, target]
  );

  // 대상 소실(방 재초기화·해당 로그 삭제) → 라이브 복귀 (E11)
  useEffect(() => {
    if (target != null && replayIndex === -1) setTarget(null);
  }, [target, replayIndex]);

  const pos = replayIndex >= 0 ? replayables.indexOf(replayIndex) : -1;
  const isReplaying = pos >= 0;

  const scene = useMemo(
    () => (isReplaying ? messageToScene(target) : null),
    [isReplaying, target]
  );

  /**
   * 진입 — msgIndex가 USER 등 비대상이면 직후(없으면 직전) 씬으로 스냅.
   * @returns {boolean} 진입 성공 여부 (리플레이 가능한 씬이 하나도 없으면 false)
   */
  const enter = useCallback((msgIndex) => {
    if (replayables.length === 0) return false;
    const idx = replayables.includes(msgIndex)
      ? msgIndex
      : replayables.find((i) => i > msgIndex)
        ?? [...replayables].reverse().find((i) => i < msgIndex)
        ?? null;
    if (idx == null) return false;
    setTarget(messages[idx]);
    return true;
  }, [replayables, messages]);

  const exit = useCallback(() => setTarget(null), []);

  const canPrev = isReplaying && pos > 0;
  // 마지막 씬에서 next()는 '라이브 복귀'로 동작 — canNext는 셰브론·전송 가드용(마지막=false)
  const canNext = isReplaying && pos < replayables.length - 1;

  const prev = useCallback(() => {
    if (pos > 0) setTarget(messages[replayables[pos - 1]]);
  }, [pos, replayables, messages]);

  const next = useCallback(() => {
    if (pos < 0) return;
    if (pos < replayables.length - 1) setTarget(messages[replayables[pos + 1]]);
    else setTarget(null); // 끝을 넘어가면 라이브 복귀
  }, [pos, replayables, messages]);

  return {
    isReplaying,
    /** 리플레이 중인 씬 객체(무대·대사창 주입용) | null */
    scene,
    /** "n / total" 인디케이터용 위치 */
    position: { n: pos + 1, total: replayables.length },
    enter,
    exit,
    prev,
    next,
    canPrev,
    canNext,
  };
}
