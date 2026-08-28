import { useState, useEffect, useRef, useCallback } from "react";
import {
  requestNextBatch,
  notifyBatchConsumed,
  finalizeChapter,
  triggerPrefetch,
} from "../api/TheaterPlayApi";
import { fetchSceneBranch } from "../api/TheaterGamePlayApi";

/**
 * [Phase 5.5-Theater] Theater Scene 배치 흐름 관리 훅
 *
 * [생명주기]
 * 1. 마운트 → 첫 배치 요청 (roomInfo에서 batchId 확인)
 * 2. 씬 감상 중 70% 지점 도달 → prefetch 트리거
 * 3. 마지막 씬 완료 → onBatchConsumed → 다음 배치 로드
 * 4. Chapter 종료 시 → finalizeChapter → 리포트 콜백
 *
 * [Polish · P2 #1.2] Branch options prefetch
 *   currentBatch에 branchSignal이 있으면 마지막 씬 도달 전 백그라운드에서 분기
 *   옵션 LLM을 미리 호출해 둔다. 유저가 5~8개 씬을 읽는 동안(~30초+) 분기 LLM
 *   응답이 도착하므로, 마지막 씬 → 다음 클릭 시 즉시 모달이 떠 latency가 0에 가깝다.
 *   (기존엔 마지막 씬 → 다음 클릭 → fetchSceneBranch await → 모달이 ~3-8초 멈춰있음)
 *
 * [반환]
 *   currentBatch         : 현재 재생 중인 배치 (SceneBatch | null)
 *   currentSceneIndex    : 배치 내 재생 중인 씬 인덱스 (0-based)
 *   nextScene()          : 다음 씬으로 이동
 *   goToBatchScene(idx)  : 배치 내 특정 씬으로 점프 (되감기)
 *   loadingNext          : 다음 배치 로딩 중 여부
 *   chapterEnding        : Chapter 종료 처리 중 여부
 *   onChapterEndTriggered: Chapter 종료 콜백 (외부에서 리포트 모달 오픈)
 */
export default function useTheaterStream({
  roomId,
  autoStart = true,
  onChapterEnd,
  onBranchReady,
  onError,
}) {
  const [currentBatch, setCurrentBatch] = useState(null);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [loadingNext, setLoadingNext] = useState(false);
  const [chapterEnding, setChapterEnding] = useState(false);

  const prefetchFiredRef = useRef(false);
  const initializedRef = useRef(false);

  // [Polish · P2 #1.2] 분기 옵션 prefetch 보관소.
  //   shape: { batchId, level, promise } — Promise를 들고 있으므로 요청 중이어도 안전.
  //   nextScene의 마지막 씬 처리 시 이 promise를 await하면 이미 끝났거나(즉시 resolve)
  //   거의 끝나가는 상태로 거의 마스킹됨.
  const prefetchedBranchRef = useRef(null);

  // ─── 배치 로드 ───
  const loadNextBatch = useCallback(async () => {
    if (!roomId) return;
    setLoadingNext(true);
    prefetchFiredRef.current = false;
    try {
      const batch = await requestNextBatch(roomId);   // [B-5.1] prefetch 인자 제거 — 항상 과금
      setCurrentBatch(batch);
      setCurrentSceneIndex(0);
    } catch (e) {
      // [Polish · P1 #7] LOCATION choice 선행 가드.
      //   백엔드가 멀티 히로인 + 새 Chapter 시작 시점에서 LOCATION_CHOICE_REQUIRED를
      //   던지면 batch를 시도하지 않는다. autoStart 가드와 별도로 race condition
      //   방어 (autoStart 시점에 roomInfo가 stale이거나, 분기 직후 첫 batch 로드 등).
      //   에러를 onError로 전파하지 않고 silent로 처리 — 프론트는 위에서 LOCATION 모달을
      //   별도 트리거하므로 사용자에게 보이는 에러는 없다.
      const msg = e?.response?.data?.message || e?.message;
      if (msg && msg.includes("LOCATION_CHOICE_REQUIRED")) {
        console.debug("[Theater] batch deferred — awaiting location choice");
      } else {
        console.error("[Theater] Failed to load batch:", e);
        if (onError) onError(e);
      }
    } finally {
      setLoadingNext(false);
    }
  }, [roomId, onError]);

  // ─── 초기 배치 로드 ───
  useEffect(() => {
    if (!autoStart || initializedRef.current || !roomId) return;
    initializedRef.current = true;
    loadNextBatch();
  }, [autoStart, roomId, loadNextBatch]);

  // ─── [Polish · P2 #1.2] Branch options prefetch ───
  //   currentBatch가 set되고 branchSignal이 있으면 즉시 백그라운드에서 분기 옵션 LLM 호출.
  //   결과 promise를 ref에 저장하고, 마지막 씬 도달 시 이 promise를 await하여 latency 마스킹.
  //   chapterEndAfter면 분기가 아니므로 skip.
  useEffect(() => {
    if (!currentBatch) {
      prefetchedBranchRef.current = null;
      return;
    }
    if (!currentBatch.branchSignal || currentBatch.chapterEndAfter) {
      prefetchedBranchRef.current = null;
      return;
    }

    // 같은 배치라면 재요청 안 함
    const existing = prefetchedBranchRef.current;
    if (existing && existing.batchId === currentBatch.batchId) return;

    const sig = currentBatch.branchSignal;
    const promise = fetchSceneBranch(roomId, sig.level, sig.contextSummary)
      .catch((err) => {
        // 실패는 silent — 마지막 씬 도달 시 fallback으로 다시 시도하도록 ref clear
        console.debug("[Theater] branch prefetch failed:", err?.message);
        prefetchedBranchRef.current = null;
        return null;
      });

    prefetchedBranchRef.current = {
      batchId: currentBatch.batchId,
      level: sig.level,
      promise,
    };
  }, [currentBatch, roomId]);

  // ─── 씬 이동 ───
  const nextScene = useCallback(async () => {
    if (!currentBatch) return;

    const total = currentBatch.scenes?.length || 0;
    const isLast = currentSceneIndex >= total - 1;

    if (!isLast) {
      setCurrentSceneIndex((i) => i + 1);

      // 70% 지점 도달 시 prefetch 트리거 (1회)
      const nextIdx = currentSceneIndex + 1;
      if (!prefetchFiredRef.current && nextIdx / total >= 0.7 && !currentBatch.chapterEndAfter) {
        prefetchFiredRef.current = true;
        triggerPrefetch(roomId);
      }
      return;
    }

    // 마지막 씬 이후 → 배치 소비 완료 처리
    try {
      const { chapterEnd } = await notifyBatchConsumed(roomId, currentBatch.batchId);

      // 분기 시그널이 있으면 분기 UI 콜백
      if (currentBatch.branchSignal && onBranchReady) {
        // [Polish · P2 #1.2] prefetch된 옵션을 콜백으로 함께 전달.
        //   호출자(TheaterPlayPage)는 이 promise를 await해서 옵션을 즉시 표시 가능.
        //   prefetch가 실패했거나 ref가 비어있으면 fallback으로 onBranchReady 호출자가
        //   직접 fetchSceneBranch를 호출하도록 (기존 동작과 동일).
        const ref = prefetchedBranchRef.current;
        const prefetched =
          ref && ref.batchId === currentBatch.batchId ? ref.promise : null;
        onBranchReady(currentBatch.branchSignal, prefetched);
        return;
      }

      if (chapterEnd || currentBatch.chapterEndAfter) {
        setChapterEnding(true);
        const report = await finalizeChapter(roomId);
        setChapterEnding(false);
        if (onChapterEnd) onChapterEnd(report);
        return;
      }

      // 일반 흐름: 다음 배치
      await loadNextBatch();
    } catch (e) {
      // [B-5.2 · 적대적 리뷰 P2] 소비가 UNPAID_BATCH로 거부되면 **자기 치유**한다.
      //   서버가 '이 배치는 아직 정상 취득(/next-batch)되지 않았다'고 판정한 경우인데,
      //   여기서 console.error만 남기면 화면이 마지막 씬에 고정된 채 **무증상 정지**가 된다
      //   (자기 치유에 해당하는 loadNextBatch는 위 try 안쪽이라 도달하지 못한다).
      //   loadNextBatch()가 그 배치를 정상 과금 취득하므로 대개 1홉이면 복구된다.
      //   ⚠ 재시도는 **1회만** — 실패가 계속되면 LLM·DB를 반복해서 때린다.
      const code = e?.errorCode || e?.response?.data?.errorCode;
      if (code === "UNPAID_BATCH") {
        console.warn("[Theater] Unpaid batch — self-healing via loadNextBatch");
        try {
          await loadNextBatch();
          return;
        } catch (healErr) {
          console.error("[Theater] Self-heal failed:", healErr);
          if (onError) onError(healErr);
          return;
        }
      }
      console.error("[Theater] Batch transition failed:", e);
      if (onError) onError(e);
    }
  }, [
    currentBatch, currentSceneIndex, roomId,
    loadNextBatch, onChapterEnd, onBranchReady, onError
  ]);

  // ─── 배치 내 특정 씬으로 점프 (되감기용) ───
  const goToBatchScene = useCallback((idx) => {
    if (!currentBatch) return;
    const total = currentBatch.scenes?.length || 0;
    setCurrentSceneIndex(Math.max(0, Math.min(idx, total - 1)));
  }, [currentBatch]);

  // ─── 외부에서 Chapter 리포트 닫은 후 다음 배치 로드 트리거 ───
  const resumeAfterChapter = useCallback(() => {
    loadNextBatch();
  }, [loadNextBatch]);

  // ─── 외부에서 강제 리로드 (분기 선택 후 등) ───
  const reloadBatch = useCallback(() => {
    loadNextBatch();
  }, [loadNextBatch]);

  return {
    currentBatch,
    currentSceneIndex,
    currentScene: currentBatch?.scenes?.[currentSceneIndex] ?? null,
    isBatchLastScene: currentBatch
      ? currentSceneIndex >= (currentBatch.scenes?.length || 0) - 1
      : false,
    loadingNext,
    chapterEnding,
    nextScene,
    goToBatchScene,
    resumeAfterChapter,
    reloadBatch,
  };
}