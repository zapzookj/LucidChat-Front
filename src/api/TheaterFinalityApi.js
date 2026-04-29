import api from "./axios";

/**
 * [Phase 5.5-Theater] 엔딩 / 세이브 / 노트 API
 */

// ━━━ 엔딩 ━━━

export async function triggerTheaterEnding(roomId) {
  const res = await api.post(`/theater/rooms/${roomId}/ending`);
  return res.data;
}

// ━━━ 세이브 / 로드 ━━━

export async function fetchSaveSlots(roomId) {
  const res = await api.get(`/theater/rooms/${roomId}/saves`);
  return res.data;
}

export async function saveSlot(roomId, { slotNumber, label }) {
  const res = await api.post(`/theater/rooms/${roomId}/saves`, { slotNumber, label });
  return res.data;
}

export async function loadSlot(roomId, slotNumber) {
  const res = await api.post(`/theater/rooms/${roomId}/saves/${slotNumber}/load`);
  return res.data;
}

// ━━━ 노트 ━━━

export async function fetchDirectorNotes(roomId) {
  const res = await api.get(`/theater/rooms/${roomId}/notes`);
  return res.data;
}

export async function createDirectorNote(roomId, content) {
  const res = await api.post(`/theater/rooms/${roomId}/notes`, { content });
  return res.data;
}

export async function updateDirectorNote(roomId, noteId, content) {
  const res = await api.patch(`/theater/rooms/${roomId}/notes/${noteId}`, { content });
  return res.data;
}

export async function deleteDirectorNote(roomId, noteId) {
  await api.delete(`/theater/rooms/${roomId}/notes/${noteId}`);
}

// ━━━ [Phase 5.5 UX Polish · R3] 감독 명령어 ━━━

/**
 * 감독 명령어 발동.
 *
 * 응답 구조 (200):
 *   { accepted: boolean, verdict: string, userMessage: string, note: {...} }
 *
 * - accepted=true:  검증 통과, 다음 1배치에 환경 이벤트 주입
 * - accepted=false: 거부됨, userMessage를 UI에 노출 (유저 학습 자료)
 *
 * 검증 외 오류(권한/길이초과 등)는 4xx로 던져짐 → axios가 throw.
 *
 * @param {number} roomId
 * @param {string} content      명령어 텍스트 (≤ 300자)
 * @param {object} [options]
 * @param {boolean} [options.overwriteActive=true]  활성 명령어 덮어쓰기 동의 여부
 * @returns {Promise<{accepted, verdict, userMessage, note}>}
 */
export async function triggerDirectorCommand(roomId, content, options = {}) {
  const { overwriteActive = true } = options;
  const res = await api.post(
    `/theater/rooms/${roomId}/director-commands`,
    { content, overwriteActive }
  );
  return res.data;
}