import api from "./axios";

/**
 * [Phase 5.5-Theater] Theater 플레이 API 클라이언트
 *
 * 로비 API(TheaterLobbyApi.js)와 분리. 플레이 세션 동안 호출되는 엔드포인트 전담.
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Scene 배치
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 다음 배치 요청. **항상 1E가 과금된다.**
 *
 * [버그픽스 B-5.1] 종전 `prefetch` 인자를 제거했다. 그 플래그는 서버의 과금을 건너뛰면서도
 * 같은 배치 전문을 돌려줘서 극장 전체를 무과금 완주할 수 있는 통로였다(서버에서 제거됨).
 * 선행 생성이 필요하면 `prefetchNextBatch`(전용 엔드포인트, 202·본문 없음)를 쓸 것.
 * @param {number} roomId
 */
export async function requestNextBatch(roomId) {
  const res = await api.post(`/theater/rooms/${roomId}/next-batch`, {});
  return res.data;
}

/**
 * 배치 소비 완료 신호.
 * @returns {{ chapterEnd: boolean }}
 */
export async function notifyBatchConsumed(roomId, batchId) {
  const res = await api.post(
    `/theater/rooms/${roomId}/batch-consumed?batchId=${batchId}`
  );
  return res.data;
}

/**
 * Chapter 종료 처리 — 리포트 반환.
 */
export async function finalizeChapter(roomId) {
  const res = await api.post(`/theater/rooms/${roomId}/chapter-end`);
  return res.data;
}

/**
 * 비동기 prefetch 트리거.
 */
export async function triggerPrefetch(roomId) {
  try {
    await api.post(`/theater/rooms/${roomId}/prefetch`);
  } catch (e) {
    // prefetch 실패는 사일런트
    console.debug("[Theater] prefetch silently failed:", e?.message);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  재생 설정
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function updatePlaySettings(roomId, { autoPlayEnabled, playSpeed }) {
  await api.patch(`/theater/rooms/${roomId}/play-settings`, {
    autoPlayEnabled,
    playSpeed,
  });
}