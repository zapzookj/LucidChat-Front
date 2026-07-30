import api from "./axios";

/**
 * [Phase 5.5-Theater] Theater 로비 API
 *
 * 네이밍 규칙:
 *  - fetch*: GET 조회
 *  - create*: POST 생성
 *  - update*: PATCH 부분 수정
 *  - 모든 함수는 AxiosResponse.data를 반환 (에러는 상위로 throw)
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  세계관
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function fetchWorlds() {
  const res = await api.get("/theater/lobby/worlds");
  return res.data;
}

/**
 * [에픽 A] 내가 극장을 열 수 있는 UGC 월드 카드 목록.
 * id는 "UGCW_{id}" 문자열 — createSession에 그대로 통용(opaque 취급).
 * 백엔드 게이트(ugc.modes.theater-enabled) off면 빈 배열 → 섹션 미노출.
 */
export async function fetchUgcTheaterWorlds() {
  try {
    const res = await api.get("/theater/lobby/ugc-worlds");
    return Array.isArray(res.data) ? res.data : [];
  } catch {
    return []; // 실패는 무해 — 공식 목록만 노출
  }
}

export async function fetchWorld(worldId) {
  const res = await api.get(`/theater/lobby/worlds/${encodeURIComponent(worldId)}`);
  return res.data;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Theater 세션
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function fetchMyTheaterSessions() {
  const res = await api.get("/theater/lobby/sessions");
  return res.data;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  [Phase 5.5 UX Polish · R4] 활성 / 아카이브 / Resume
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 활성 Theater 세션 1개만 — 로비 메인 카드용.
 * 빈 배열이면 새 극 시작 CTA를 메인에 표시.
 */
export async function fetchActiveTheaterSessions() {
  const res = await api.get("/theater/lobby/sessions/active");
  return res.data;
}

/**
 * 아카이브 세션 (ARCHIVED + ENDED). 최근 변경순.
 */
export async function fetchArchivedTheaterSessions() {
  const res = await api.get("/theater/lobby/sessions/archive");
  return res.data;
}

/**
 * 아카이브된 극을 다시 활성화. ARCHIVED만 가능, ENDED는 BadRequest.
 * 다른 활성극이 있으면 자동으로 ARCHIVED로 전환됨.
 *
 * @param {number} roomId
 * @returns {Promise<TheaterRoomInfo>} resume된 방의 정보
 */
export async function resumeArchivedSession(roomId) {
  const res = await api.post(`/theater/lobby/sessions/${roomId}/resume`);
  return res.data;
}

/**
 * 활성극을 명시적으로 아카이브 (잠시 멈추기).
 * 활성극이 없으면 no-op.
 */
export async function archiveActiveSession() {
  await api.post(`/theater/lobby/sessions/active/archive`);
}

/**
 * Theater 세션 생성
 * @param {object} payload
 *   {
 *     worldId: "MODERN_KOREA",
 *     heroineIds: [3, 4],
 *     avatarName: "강건우",
 *     avatarProfile: { ... },
 *     personaText: "...",
 *     initialStats: { ... } | null,
 *     overwriteActive: true | false  // [R4] 기존 활성극 덮어쓰기 동의
 *   }
 *
 * 응답:
 *   - 200 + TheaterRoomInfo: 정상 생성
 *   - 409 Conflict: 활성극 충돌. UI에서 confirm 후 overwriteActive=true로 재호출.
 */
export async function createTheaterSession(payload) {
  const res = await api.post("/theater/lobby/sessions", payload);
  return res.data;
}

export async function fetchTheaterRoom(roomId) {
  const res = await api.get(`/theater/rooms/${roomId}`);
  return res.data;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  아바타 & 스탯
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function updateAvatar(roomId, { avatarName, profile, personaText }) {
  await api.patch(`/theater/rooms/${roomId}/avatar`, {
    avatarName, profile, personaText,
  });
}

export async function rerollStats(roomId, newDistribution) {
  await api.post(`/theater/rooms/${roomId}/reroll`, { newDistribution });
}