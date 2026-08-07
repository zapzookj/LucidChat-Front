import { useState, useMemo, useCallback, useEffect } from "react";
import { pickReplayableIndices, isReplayableMessage, messageToScene } from "../utils/sceneReplay";

/**
 * [2026-08-07 디오라마 이식] 과거 씬 리플레이 훅 — 대화 기록 클릭 → 그 시점의 씬을 무대에 재현,
 * 앞/뒤 씬 이동 + '현재로 돌아가기' 복귀. V1 ChatPage / V2 ChatPageV2 공용.
 *
 * 원칙: 라이브 상태(currentScene/currentSpeaker/displayedEmotion/배경/BGM/씬 큐)를 절대
 * 건드리지 않는다 — 페이지가 렌더 지점에서만 3-way 병합한다. exit()는 인덱스 해제 한 줄이라
 * 스냅샷/롤백이 불필요하고, 라이브 진행은 뒤에서 그대로 이어진다(큐 자동재생만 페이지가 가드).
 *
 * @param {Array} messages 페이지 메시지 배열(씬 단위 엔트리)
 */
export default function useSceneReplay(messages) {
  // messages 배열 인덱스 | null = 라이브
  const [replayIndex, setReplayIndex] = useState(null);

  const replayables = useMemo(() => pickReplayableIndices(messages), [messages]);

  // 삭제·재로딩으로 대상 메시지가 사라지면 가장 가까운 씬으로 스냅, 전부 사라지면 이탈 (E11)
  useEffect(() => {
    if (replayIndex == null) return;
    if (replayables.length === 0) {
      setReplayIndex(null);
      return;
    }
    if (!isReplayableMessage(messages?.[replayIndex])) {
      const fallback = [...replayables].reverse().find((i) => i <= replayIndex) ?? replayables[0];
      setReplayIndex(fallback);
    }
  }, [messages, replayables, replayIndex]);

  const pos = replayIndex == null ? -1 : replayables.indexOf(replayIndex);
  const isReplaying = replayIndex != null && pos >= 0;

  const scene = useMemo(
    () => (isReplaying ? messageToScene(messages[replayIndex]) : null),
    [isReplaying, messages, replayIndex]
  );

  /**
   * 진입 — msgIndex가 USER 등 비대상이면 직후(없으면 직전) 씬으로 스냅.
   * @returns {boolean} 진입 성공 여부 (리플레이 가능한 씬이 하나도 없으면 false)
   */
  const enter = useCallback((msgIndex) => {
    if (replayables.length === 0) return false;
    const target = replayables.includes(msgIndex)
      ? msgIndex
      : replayables.find((i) => i > msgIndex)
        ?? [...replayables].reverse().find((i) => i < msgIndex)
        ?? null;
    if (target == null) return false;
    setReplayIndex(target);
    return true;
  }, [replayables]);

  const exit = useCallback(() => setReplayIndex(null), []);

  const canPrev = isReplaying && pos > 0;
  // 마지막 씬에서 next()는 '라이브 복귀'로 동작 — canNext는 셰브론·전송 가드용(마지막=false)
  const canNext = isReplaying && pos < replayables.length - 1;

  const prev = useCallback(() => {
    if (pos > 0) setReplayIndex(replayables[pos - 1]);
  }, [pos, replayables]);

  const next = useCallback(() => {
    if (pos < 0) return;
    if (pos < replayables.length - 1) setReplayIndex(replayables[pos + 1]);
    else setReplayIndex(null); // 끝을 넘어가면 라이브 복귀
  }, [pos, replayables]);

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
