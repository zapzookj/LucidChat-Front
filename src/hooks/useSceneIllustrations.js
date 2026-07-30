import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import api from "../api/axios";

/**
 * [docs/09 A-2 + A-3] 실시간 씬 일러(랜드스케이프) 훅 — V1 ChatPage + V2 ChatPageV2 공용.
 * [2026-07-31 에픽 B] 수동 요청(request) 추가 — V2는 SSE 씬 수신이 없어 이것이 유일한 생성 경로.
 *
 * 책임 (ChatPage 접점 최소화를 위해 전부 이 훅에 캡슐화):
 *   1. 방 입장 시 목록 1회 로드: GET /illustrations/scenes?roomId= (id 오름차순)
 *      — 404/오류/빈 배열이면 기능 전체 비활성(기존 무대 그대로, 회귀 제로)
 *   2. SSE final_result의 sceneIllustration 수신: register(illust)
 *      — 새 턴 도착 시 과거 씬 열람 중이어도 최신 씬으로 복귀
 *   3. 단건 폴링: GET /illustrations/scenes/{id}?roomId= 2초 간격
 *      — 탭 hidden이면 틱 스킵, 복귀 시 즉시 1회 동기화 (useUgcCreationJob 패턴)
 *      — COMPLETED/FAILED/SKIPPED 도달 시 중단, 최대 15분 안전 상한(콜드스타트 12분 + 여유)
 *   4. 홀드체인: 현재 턴 완료본 → 직전 완료본 → (하나도 없으면) active=false → 기존 스탠딩 무대
 *   5. 씬 네비게이션: 완료본(imageUrl 보유) 기준 앞/뒤 이동 + "n / total" 인디케이터
 *
 * @param {string} roomId
 */
const POLL_INTERVAL = 2000;
const MAX_POLL_TICKS = 450; // 2초 × 450 = 15분 안전 상한
const TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED", "SKIPPED"]);

export default function useSceneIllustrations(roomId) {
  // { id, turnIndex, status, imageUrl } — 항상 id 오름차순 유지
  const [scenes, setScenes] = useState([]);
  // null = 최신 추적 모드, number = displayable 배열 기준 열람 인덱스
  const [viewIndex, setViewIndex] = useState(null);
  // { timer, sceneId, ticks, tick } — 단일 폴링 타깃(가장 최근 비종결 씬)
  const pollRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current.timer);
      pollRef.current = null;
    }
  }, []);

  const upsert = useCallback((illust) => {
    if (!illust || illust.id == null) return;
    setScenes((prev) => {
      const idx = prev.findIndex((s) => s.id === illust.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...illust };
        return next;
      }
      return [...prev, illust].sort((a, b) => a.id - b.id);
    });
  }, []);

  const startPolling = useCallback((sceneId) => {
    stopPolling();
    const tick = async () => {
      const st = pollRef.current;
      if (!st || st.sceneId !== sceneId) return; // 폴링 타깃이 교체된 뒤의 잔여 틱 무시
      // 백그라운드 탭에서는 폴링 스킵 — 복귀 시 visibilitychange가 즉시 당겨온다
      if (document.hidden) return;
      st.ticks += 1;
      if (st.ticks > MAX_POLL_TICKS) {
        stopPolling();
        return;
      }
      try {
        const res = await api.get(`/illustrations/scenes/${sceneId}`, { params: { roomId } });
        upsert(res.data);
        if (TERMINAL_STATUSES.has(res.data?.status)) {
          stopPolling();
          // [리뷰픽스] 폴링 타깃 교체로 방치된 이전 비종결 씬 백필 — 종결 시점에 목록 1회 재동기화
          // (턴 N 생성 중 턴 N+1로 타깃이 넘어가면 N의 완료본이 세션 내에서 영구 누락되던 문제)
          try {
            const listRes = await api.get("/illustrations/scenes", { params: { roomId } });
            if (Array.isArray(listRes.data)) listRes.data.forEach(upsert);
          } catch {
            /* 백필 실패는 무해 — 재입장 시 복원 */
          }
        }
      } catch {
        /* 폴링 실패는 다음 틱에서 재시도 */
      }
    };
    pollRef.current = { timer: setInterval(tick, POLL_INTERVAL), sceneId, ticks: 0, tick };
    tick(); // 즉시 1회
  }, [roomId, upsert, stopPolling]);

  // 탭 복귀 시 즉시 동기화 (진행 중 폴링이 있을 때만)
  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden) pollRef.current?.tick?.();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // 방 입장 시 씬 히스토리 1회 복원
  useEffect(() => {
    if (!roomId) return undefined;
    let alive = true;
    setScenes([]);
    setViewIndex(null);
    (async () => {
      try {
        const res = await api.get("/illustrations/scenes", { params: { roomId } });
        if (!alive) return;
        const list = (Array.isArray(res.data) ? res.data : [])
          .filter((s) => s && s.id != null)
          .sort((a, b) => a.id - b.id);
        setScenes(list);
        // 재입장 시 마지막 씬이 아직 생성 중이면 폴링 재개
        const last = list[list.length - 1];
        if (last && !TERMINAL_STATUSES.has(last.status)) startPolling(last.id);
      } catch {
        // 백엔드 플래그 off / 미배포 / 오류 — 기능 전체 비활성 (기존 동작 보존)
        if (alive) setScenes([]);
      }
    })();
    return () => {
      alive = false;
      stopPolling();
    };
  }, [roomId, startPolling, stopPolling]);

  /**
   * final_result의 sceneIllustration 등록.
   * null/undefined면 no-op — 호출부(ChatPage)에 분기 로직을 두지 않기 위한 계약.
   */
  const register = useCallback((illust) => {
    if (!illust || illust.id == null) return;
    upsert(illust);
    setViewIndex(null); // 새 턴 도착 — 과거 씬 열람 중이어도 최신으로 복귀
    if (!TERMINAL_STATUSES.has(illust.status)) startPolling(illust.id);
  }, [upsert, startPolling]);

  // ── [2026-07-31 에픽 B] 유저 수동 요청 — POST /illustrations/scenes/request ──
  // 백엔드: 5에너지 차감 → 씬 디렉터(전용 LLM) 스펙 작성 → 렌더 제출, 실패 시 자동 환불.
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState(null);

  const request = useCallback(async () => {
    if (requesting) return { ok: false };
    setRequesting(true);
    setRequestError(null);
    try {
      const res = await api.post("/illustrations/scenes/request", { roomId: Number(roomId) });
      register(res.data); // upsert + 최신 복귀 + 폴링 시작
      return { ok: true };
    } catch (e) {
      const status = e?.response?.status;
      let msg = e?.response?.data?.message || "씬 일러 요청에 실패했어요.";
      if (status === 409) {
        msg = "이미 씬 일러를 생성하고 있어요.";
        // 서버에 진행 중 렌더 존재(다른 탭/재입장 직후 등) — 목록 재동기화로 폴링 복구
        try {
          const listRes = await api.get("/illustrations/scenes", { params: { roomId } });
          if (Array.isArray(listRes.data)) {
            listRes.data.forEach(upsert);
            const last = listRes.data[listRes.data.length - 1];
            if (last && !TERMINAL_STATUSES.has(last.status)) startPolling(last.id);
          }
        } catch {
          /* 무해 — 재입장 시 복원 */
        }
      }
      setRequestError(msg);
      setTimeout(() => setRequestError(null), 4000);
      return { ok: false, error: msg };
    } finally {
      setRequesting(false);
    }
  }, [roomId, requesting, register, upsert, startPolling]);

  // ── 파생 상태 ──
  const displayable = useMemo(() => scenes.filter((s) => !!s.imageUrl), [scenes]);
  const total = displayable.length;
  const latestIndex = total - 1;
  // 최신 추적(null)이면 마지막 완료본, 열람 중이면 해당 인덱스(축소 방어 clamp)
  const effectiveIndex = viewIndex == null ? latestIndex : Math.min(viewIndex, latestIndex);
  const current = effectiveIndex >= 0 ? displayable[effectiveIndex] : null;

  const lastScene = scenes.length > 0 ? scenes[scenes.length - 1] : null;
  const generating = !!lastScene && (lastScene.status === "PENDING" || lastScene.status === "GENERATING");
  const failed = !!lastScene && lastScene.status === "FAILED";
  const isViewingPast = viewIndex != null && effectiveIndex < latestIndex;

  const canPrev = effectiveIndex > 0;
  const canNext = effectiveIndex >= 0 && effectiveIndex < latestIndex;

  const goPrev = useCallback(() => {
    setViewIndex((v) => {
      const cur = v == null ? latestIndex : Math.min(v, latestIndex);
      return cur > 0 ? cur - 1 : cur;
    });
  }, [latestIndex]);

  const goNext = useCallback(() => {
    setViewIndex((v) => {
      const cur = v == null ? latestIndex : Math.min(v, latestIndex);
      if (cur >= latestIndex) return v;
      const next = cur + 1;
      return next === latestIndex ? null : next; // 최신 도달 시 추적 모드 복귀
    });
  }, [latestIndex]);

  const goLatest = useCallback(() => setViewIndex(null), []);

  return {
    /** 완료 일러가 1장 이상 — 씬 일러가 주 비주얼로 상주 */
    active: total > 0,
    /** 씬 트랙 자체가 존재(생성 중 포함) — 첫 생성 중 인디케이터 노출용 */
    hasAnyScene: scenes.length > 0,
    /** 현재 표시할 일러 URL (홀드체인 적용: 최신 완료본 또는 열람 중 씬) */
    imageUrl: current?.imageUrl || null,
    /** 현재 표시 씬의 턴 번호 (있으면) */
    turnIndex: current?.turnIndex ?? null,
    /** 0-based 표시 인덱스 / 완료본 총 수 — "n / total" 인디케이터용 */
    index: effectiveIndex,
    total,
    canPrev,
    canNext,
    goPrev,
    goNext,
    goLatest,
    isViewingPast,
    /** 마지막 씬이 PENDING/GENERATING — 직전 일러 홀드 위 스피너용 */
    generating,
    /** 마지막 씬이 FAILED */
    failed,
    register,
    /** [에픽 B] 수동 요청 — 성공 시 {ok:true}, 실패 시 {ok:false, error} */
    request,
    requesting,
    requestError,
  };
}
