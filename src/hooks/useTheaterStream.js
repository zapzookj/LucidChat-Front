import { useState, useEffect, useRef, useCallback } from "react";
import {
  requestNextBatch,
  notifyBatchConsumed,
  finalizeChapter,
  triggerPrefetch,
} from "../api/TheaterPlayApi";

/**
 * [Phase 5.5-Theater] Theater Scene 배치 흐름 관리 훅
 *
 * [생명주기]
 * 1. 마운트 → 첫 배치 요청 (roomInfo에서 batchId 확인)
 * 2. 씬 감상 중 70% 지점 도달 → prefetch 트리거
 * 3. 마지막 씬 완료 → onBatchConsumed → 다음 배치 로드
 * 4. Chapter 종료 시 → finalizeChapter → 리포트 콜백
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

  // ─── 배치 로드 ───
  const loadNextBatch = useCallback(async () => {
    if (!roomId) return;
    setLoadingNext(true);
    prefetchFiredRef.current = false;
    try {
      const batch = await requestNextBatch(roomId, false);
      setCurrentBatch(batch);
      setCurrentSceneIndex(0);
    } catch (e) {
      console.error("[Theater] Failed to load batch:", e);
      if (onError) onError(e);
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
        onBranchReady(currentBatch.branchSignal);
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