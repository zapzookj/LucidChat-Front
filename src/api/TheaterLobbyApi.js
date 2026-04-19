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

/**
 * Theater 세션 생성
 * @param {object} payload
 *   {
 *     worldId: "MODERN_KOREA",
 *     heroineIds: [3, 4],
 *     avatarName: "강건우",
 *     avatarProfile: { gender, ageRange, physique, appearance, role, personalityTags, relationStart, backstory },
 *     personaText: "...",
 *     initialStats: { charm, wit, boldness, intellect, empathy }  // optional
 *   }
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