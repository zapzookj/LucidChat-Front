import { useState, useEffect, useCallback } from "react";
import { fetchWorldCreationJob } from "../api/WorldStudioApi";

/**
 * [World Builder v1] UGC 세계관 생성 잡 폴링 훅 — useUgcCreationJob의 월드 버전.
 *
 * 동작:
 *   - jobId가 있으면 2.5초 간격으로 GET /ugc/worlds/jobs/{jobId} 폴링
 *   - document.hidden(백그라운드 탭)이면 해당 틱은 건너뛰고, 탭 복귀 시 즉시 1회 동기화
 *   - terminal 상태(READY/FAILED/EXPIRED)에 도달하면 폴링 중단
 *   - jobId가 null이면 아무것도 하지 않음 (job=null)
 *
 * @param {string|null} jobId
 * @returns {{ job: object|null, loading: boolean, error: string|null, refresh: () => Promise<object|null> }}
 *   refresh: 액션(리롤/선택/확정 등) 직후 즉시 상태를 당겨오고 싶을 때 호출
 */
const POLL_INTERVAL = 2500;
const TERMINAL_STATUSES = new Set(["READY", "FAILED", "EXPIRED"]);

export default function useUgcWorldJob(jobId) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(Boolean(jobId));
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!jobId) return null;
    try {
      const data = await fetchWorldCreationJob(jobId);
      setJob(data);
      setError(null);
      return data;
    } catch (e) {
      setError(e?.response?.data?.message || "작업 상태를 불러오지 못했습니다.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setLoading(false);
      setError(null);
      return undefined;
    }

    let alive = true;
    let terminal = false;
    setLoading(true);
    setJob(null);
    setError(null);

    const tick = async () => {
      if (!alive || terminal) return;
      // 백그라운드 탭에서는 폴링 중단 — 복귀 시 visibilitychange가 즉시 당겨온다
      if (document.hidden) return;
      try {
        const data = await fetchWorldCreationJob(jobId);
        if (!alive) return;
        setJob(data);
        setError(null);
        if (TERMINAL_STATUSES.has(data?.status)) {
          terminal = true;
          clearInterval(timer);
        }
      } catch (e) {
        if (!alive) return;
        // 폴링 실패는 다음 틱에서 재시도 — 에러만 노출
        setError(e?.response?.data?.message || "작업 상태를 불러오지 못했습니다.");
      } finally {
        if (alive) setLoading(false);
      }
    };

    const timer = setInterval(tick, POLL_INTERVAL);
    const onVisibility = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    tick(); // 즉시 1회

    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [jobId]);

  return { job, loading, error, refresh };
}
