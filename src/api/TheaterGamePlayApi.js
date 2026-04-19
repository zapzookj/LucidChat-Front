import api from "./axios";

/**
 * [Phase 5.5-Theater] 분기 & 인터미션 API 클라이언트
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  분기
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function fetchLocationBranch(roomId) {
  const res = await api.post(`/theater/rooms/${roomId}/branches/location`);
  return res.data;
}

export async function fetchSceneBranch(roomId, level, contextSummary) {
  const res = await api.post(`/theater/rooms/${roomId}/branches/scene`, {
    level,
    contextSummary,
  });
  return res.data;
}

export async function confirmBranchChoice(roomId, { level, chosenIndex, branchToken, optionsSnapshot }) {
  await api.post(`/theater/rooms/${roomId}/branches/choose`, {
    level,
    chosenIndex,
    branchToken,
    optionsSnapshot,
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  인터미션
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function fetchIntermissionView(roomId) {
  const res = await api.get(`/theater/rooms/${roomId}/intermission`);
  return res.data;
}

export async function performIntermissionActivity(roomId, { activityId, useExtraEnergy }) {
  const res = await api.post(`/theater/rooms/${roomId}/intermission/perform`, {
    activityId,
    useExtraEnergy,
  });
  return res.data;
}

export async function finishIntermission(roomId) {
  await api.post(`/theater/rooms/${roomId}/intermission/finish`);
}