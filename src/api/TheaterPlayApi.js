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
 * 다음 배치 요청.
 * @param {number} roomId
 * @param {boolean} prefetch - true면 에너지 차감 없이 선행 생성만
 */
export async function requestNextBatch(roomId, prefetch = false) {
  const res = await api.post(`/theater/rooms/${roomId}/next-batch`, { prefetch });
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