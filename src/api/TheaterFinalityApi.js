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