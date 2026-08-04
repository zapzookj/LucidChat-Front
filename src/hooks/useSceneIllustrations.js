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
 *   6. [Scene-Polish B] 수명주기: visible + show/hide/toggle + autoDismiss(감정 변화·장소 전환)
 *      — 완료 씬 영구 상주 폐지. 숨김은 '보관'이며 새 완료 씬 등록/수동 요청/토글로 복귀.
 *   7. [Scene-Polish C] goToTurn(ordinal) — 히스토리 클릭 → 로그 서수와 가장 가까운 씬으로 점프.
 *
 * @param {string} roomId
 */
const POLL_INTERVAL = 2000;
const MAX_POLL_TICKS = 450; // 2초 × 450 = 15분 안전 상한
const TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED", "SKIPPED"]);

// [Scene-Polish B · 종원 확정] 미세 감정 전이 무시쌍 — *상호* 전이는 자동 복귀를 트리거하지 않는다.
// 튜닝 포인트: 오탐(사소한 표정 변화로 씬이 접힘)이 보고되면 여기에 쌍을 추가.
export const MINOR_EMOTION_TRANSITIONS = [
  ["NEUTRAL", "RELAX"],
];
function isMinorEmotionShift(from, to) {
  return MINOR_EMOTION_TRANSITIONS.some(
    ([a, b]) => (from === a && to === b) || (from === b && to === a)
  );
}

export default function useSceneIllustrations(roomId) {
  // { id, turnIndex, status, imageUrl } — 항상 id 오름차순 유지
  const [scenes, setScenes] = useState([]);
  // null = 최신 추적 모드, number = displayable 배열 기준 열람 인덱스
  const [viewIndex, setViewIndex] = useState(null);
  // [Scene-Polish B] 씬 일러 표시 여부 — false여도 씬은 '보관'(scenes 유지), 스탠딩 무대로 복귀
  const [visible, setVisible] = useState(true);
  // 마지막 숨김 사유: "MANUAL" | "EMOTION" | "LOCATION" | null — 칩 마이크로카피용
  const [dismissReason, setDismissReason] = useState(null);
  // { timer, sceneId, ticks, tick } — 단일 폴링 타깃(가장 최근 비종결 씬)
  const pollRef = useRef(null);

  // ── [Scene-Polish B] 감정 추적 refs ──
  // lastEmotionsRef: 화자 키 → 마지막으로 통보받은 감정 태그 (항상 최신 유지)
  // shownEmotionsRef: 씬이 *표시된 시점*의 스냅샷 — 이후 다른 태그로 바뀌면 autoDismiss
  const lastEmotionsRef = useRef(new Map());
  const shownEmotionsRef = useRef(null);
  // 안정 콜백(notifyEmotion 등)에서 최신 상태 참조용
  const visibleRef = useRef(true);
  visibleRef.current = visible;
  const totalDisplayableRef = useRef(0);

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
    // [Scene-Polish B] 방 전환 — 수명주기 상태 리셋 (복원 씬은 기존처럼 기본 표시)
    setVisible(true);
    setDismissReason(null);
    lastEmotionsRef.current = new Map();
    shownEmotionsRef.current = null;
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
  // [리뷰픽스] 동일 프레임 이중 클릭 가드 — 상태(requesting)는 배칭으로 늦어 ref로 즉시 차단
  const requestingRef = useRef(false);
  // [리뷰픽스] 연속 실패 시 이전 소거 타이머가 후속 에러를 조기 소거하던 문제 — 타이머 관리
  const errorTimerRef = useRef(null);
  // [리뷰픽스] 방 전환 가드 — 인플라이트 응답이 이전 방 씬을 새 방 상태에 오염시키지 않게
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;

  // [리뷰픽스] 기능 가용성 — FAB 노출 게이트 + 표기 비용의 단일 소스(하드코딩 5 드리프트 제거).
  // 기능 off(기본값)면 featureEnabled=false → 버튼 미노출(죽은 버튼 방지).
  const [availability, setAvailability] = useState({ featureEnabled: false, energyCost: 5 });
  useEffect(() => {
    let alive = true;
    api.get("/illustrations/scenes/availability")
      .then((res) => {
        if (!alive) return;
        setAvailability({
          featureEnabled: !!res.data?.enabled,
          energyCost: Number.isFinite(res.data?.energyCost) ? res.data.energyCost : 5,
        });
      })
      .catch(() => { /* 미배포/오류 — 비노출 유지 */ });
    return () => { alive = false; };
  }, []);

  const request = useCallback(async () => {
    if (requestingRef.current) return { ok: false };
    requestingRef.current = true;
    const requestedRoomId = roomId;
    setRequesting(true);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setRequestError(null);
    try {
      const res = await api.post("/illustrations/scenes/request", { roomId: Number(requestedRoomId) });
      if (roomIdRef.current !== requestedRoomId) return { ok: false }; // 방 전환됨 — 결과 폐기
      register(res.data); // upsert + 최신 복귀 + 폴링 시작
      // [Scene-Polish B] 수동 요청 = 명시적 의사 — 숨김 상태였어도 무대 복귀 (홀드 일러 + 생성중 칩)
      setVisible(true);
      setDismissReason(null);
      return { ok: true };
    } catch (e) {
      if (roomIdRef.current !== requestedRoomId) return { ok: false };
      const status = e?.response?.status;
      let msg = e?.response?.data?.message || "씬 일러 요청에 실패했어요.";
      if (status === 409) {
        msg = e?.response?.data?.message || "이미 씬 일러를 생성하고 있어요.";
        // 서버에 진행 중 렌더 존재(다른 탭/재입장 직후 등) — 목록 재동기화로 폴링 복구
        try {
          const listRes = await api.get("/illustrations/scenes", { params: { roomId: requestedRoomId } });
          if (roomIdRef.current === requestedRoomId && Array.isArray(listRes.data)) {
            listRes.data.forEach(upsert);
            const last = listRes.data[listRes.data.length - 1];
            if (last && !TERMINAL_STATUSES.has(last.status)) startPolling(last.id);
          }
        } catch {
          /* 무해 — 재입장 시 복원 */
        }
      }
      setRequestError(msg);
      errorTimerRef.current = setTimeout(() => setRequestError(null), 4000);
      return { ok: false, error: msg };
    } finally {
      requestingRef.current = false;
      setRequesting(false);
    }
  }, [roomId, register, upsert, startPolling]);

  // 언마운트 시 에러 소거 타이머 정리
  useEffect(() => () => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
  }, []);

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

  // ═══════════ [Scene-Polish B] 씬 일러 수명주기 ═══════════
  totalDisplayableRef.current = total;

  /** 자동 복귀(스탠딩 무대로) — 표시 중 + 완료 씬 존재 시에만 동작 (안정 콜백) */
  const autoDismiss = useCallback((reason) => {
    if (!visibleRef.current) return;
    if (totalDisplayableRef.current <= 0) return;
    setVisible(false);
    setDismissReason(reason || "AUTO");
  }, []);

  const show = useCallback(() => {
    setVisible(true);
    setDismissReason(null);
  }, []);

  const hide = useCallback(() => {
    setVisible(false);
    setDismissReason("MANUAL");
  }, []);

  const toggle = useCallback(() => {
    setVisible((v) => {
      setDismissReason(v ? "MANUAL" : null);
      return !v;
    });
  }, []);

  /**
   * 감정 변화 신호 — 페이지의 감정/스프라이트 갱신 지점에서 호출.
   * 씬이 표시된 시점의 감정 스냅샷과 *다른 태그*로 바뀌면 autoDismiss("EMOTION").
   * NEUTRAL↔RELAX 상호 전이는 미세 변화로 무시(MINOR_EMOTION_TRANSITIONS).
   * V2 멀티 히로인: speakerKey별 독립 추적 — 아무 히로인이든 변화 시 복귀.
   */
  const notifyEmotion = useCallback((speakerKey, emotionTag) => {
    if (!emotionTag) return;
    const key = (speakerKey && String(speakerKey).trim()) || "__MAIN__";
    const tag = String(emotionTag).trim().toUpperCase();
    if (!tag) return;
    lastEmotionsRef.current.set(key, tag);
    if (!visibleRef.current) return;
    const baseline = shownEmotionsRef.current;
    if (!baseline) return; // 아직 씬 미표시 — 비교 기준 없음
    if (!baseline.has(key)) {
      // 씬 표시 중 처음 등장한 화자 — 기준만 기록 (첫 등장을 '변화'로 오인하지 않음)
      baseline.set(key, tag);
      return;
    }
    const from = baseline.get(key);
    if (from === tag || isMinorEmotionShift(from, tag)) return;
    autoDismiss("EMOTION");
  }, [autoDismiss]);

  /** 장소 전환 신호 — 페이지의 장소 전환 핸들러에서 호출 */
  const notifyLocationChange = useCallback(() => {
    autoDismiss("LOCATION");
  }, [autoDismiss]);

  // 씬이 표시되거나 표시 씬이 바뀌면 그 시점의 감정을 기준선으로 스냅샷
  useEffect(() => {
    if (visible && current?.id != null) {
      shownEmotionsRef.current = new Map(lastEmotionsRef.current);
    }
  }, [visible, current?.id]);

  // 새 완료 씬 등록(SSE 폴링 완료·백필·타 탭 복구 포함) → 자동 표시 복귀
  const prevTotalRef = useRef(0);
  useEffect(() => {
    if (total > prevTotalRef.current) {
      setVisible(true);
      setDismissReason(null);
    }
    prevTotalRef.current = total;
  }, [total]);

  // ═══════════ [Scene-Polish C] 히스토리 → 씬 점프 ═══════════
  /**
   * 로그 서수(ordinal)와 가장 가까운 씬으로 점프:
   * turnIndex ≤ ordinal 인 최대 씬 → 없으면 turnIndex ≥ ordinal 인 최소 씬 → 없으면 최신.
   * 점프 시 visible=true 복귀.
   */
  const goToTurn = useCallback((ordinal) => {
    const list = displayable;
    if (list.length === 0) return;
    const target = Number.isFinite(ordinal) || ordinal === Number.POSITIVE_INFINITY ? ordinal : Number.POSITIVE_INFINITY;
    let found = -1;
    for (let i = 0; i < list.length; i++) {
      const t = list[i].turnIndex;
      if (t != null && t <= target) found = i;
    }
    if (found === -1) {
      found = list.findIndex((s) => s.turnIndex != null && s.turnIndex >= target);
    }
    if (found === -1) found = list.length - 1;
    // 최신 씬이면 추적 모드(null) — 기존 viewIndex 계약과 정합
    setViewIndex(found >= list.length - 1 ? null : found);
    setVisible(true);
    setDismissReason(null);
  }, [displayable]);

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
    /** [Scene-Polish B] 씬 일러 표시 여부 — false면 스탠딩 무대 + '씬 보기' 칩 */
    visible,
    show,
    hide,
    toggle,
    autoDismiss,
    /** 마지막 숨김 사유 — "MANUAL" | "EMOTION" | "LOCATION" | null */
    dismissReason,
    /** 감정 변화 신호 (화자 키, 감정 태그) — 페이지 감정 갱신 지점에서 호출 */
    notifyEmotion,
    /** 장소 전환 신호 — 페이지 장소 전환 핸들러에서 호출 */
    notifyLocationChange,
    /** [Scene-Polish C] 로그 ordinal 기준 씬 점프 (visible 복귀 포함) */
    goToTurn,
    /** [Scene-Polish C] 히스토리 마커용 완료 씬 목록 {id, turnIndex, imageUrl} */
    historyScenes: displayable,
    /** 마지막 씬이 PENDING/GENERATING — 직전 일러 홀드 위 스피너용 */
    generating,
    /** 마지막 씬이 FAILED */
    failed,
    register,
    /** [에픽 B] 수동 요청 — 성공 시 {ok:true}, 실패 시 {ok:false, error} */
    request,
    requesting,
    requestError,
    /** [리뷰픽스] 기능 가용성 — false면 FAB 미노출(백엔드 플래그 off/미배포) */
    featureEnabled: availability.featureEnabled,
    /** [리뷰픽스] 표기 비용 — 백엔드 illustration.scene.energy-cost의 단일 소스 */
    energyCost: availability.energyCost,
  };
}
