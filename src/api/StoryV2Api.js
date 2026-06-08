import api from "./axios";

/**
 * [Story V2] V2 디렉터 시점 World 탐험 API 클라이언트.
 *
 * 네이밍 규칙 (TheaterLobbyApi.js 패턴 차용):
 *  - fetch*: GET 조회
 *  - create*: POST 생성
 *  - update*: PUT/PATCH 갱신
 *  - mark*:   상태 마킹 (POST, 부수효과)
 *  - reset*:  초기화
 *
 * 백엔드: StoryV2Controller (/api/v2/story/...) + LobbyController (/api/v1/lobby/worlds)
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  로비 — World 카드 리스트 (LobbyController)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 전체 World 목록 조회 (로비 카드 그리드용).
 * 각 World는 {worldId, displayName, tagline, description, heroImageUrl, thumbnailUrl,
 *           moodKeywords, secretAllowed, heroineCount, hasExistingRoom, existingRoomId}.
 */
export async function fetchWorlds() {
  const res = await api.get("/lobby/worlds");
  return res.data;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CreateFlow — World 진입
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * CreateFlow 진입 시 단일 호출로 받는 통합 데이터:
 * - world: WorldCardResponse
 * - availableHeroines: WorldHeroineCardResponse[]
 * - personaPresets: PersonaPresetResponse[]
 * - startLocations: WorldLocationResponse[]
 * - hasFreePersonaUnlock: boolean
 */
export async function fetchCreateContext(worldId) {
  const res = await api.get(`/v2/story/worlds/${encodeURIComponent(worldId)}/create-context`);
  return res.data;
}

/**
 * V2 방 생성 (또는 overwrite=true 시 기존 방 reset).
 *
 * payload: {
 *   worldId: string,            // 예: "MEDIEVAL_FANTASY"
 *   heroineIds: number[],       // 1~3명
 *   startLocationKey: string,   // optional, 미제공 시 World 기본값
 *   personaText: string,        // optional, 자유 페르소나 (BM 필요)
 *   selectedPersonaPresetKey: string,  // optional, 사전 정의 선택 시
 *   overwriteExisting: boolean  // 기존 방 reset 동의
 * }
 *
 * 응답: {roomId, worldId, isNew, wasOverwritten}
 *
 * 기존 방이 있고 overwriteExisting=false면 백엔드가 409 Conflict 응답 →
 * UI는 confirm 모달 후 overwriteExisting=true로 재호출.
 */
export async function createStoryV2Room(payload) {
  const res = await api.post("/v2/story/rooms", payload);
  return res.data;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  방 진입 / 초기화
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * V2 방 상세 정보 — ChatPage 진입 시 초기 로드.
 *
 * 응답: StoryRoomV2DetailResponse {
 *   roomId, worldId, worldDisplayName, userPersona,
 *   currentUserLocationKey, currentUserLocationDisplayName,
 *   currentDay, currentDayPart, currentBgmMode,
 *   currentDynamicLocationName, currentDynamicBgUrl,
 *   topicConcluded, secretModeActive,
 *   endingReached, endingType, endingTitle, endingEligible,
 *   heroines: [HeroineStateResponse],   // 히로인별 스탯
 *   presences: [CharacterPresenceResponse],  // 캐릭터 위치
 *   unreadNotificationCount
 * }
 */
export async function fetchStoryV2RoomDetail(roomId) {
  const res = await api.get(`/v2/story/rooms/${roomId}`);
  return res.data;
}

/**
 * 스토리 초기화 — 페르소나 보존 옵션.
 *
 * payload: {
 *   includePersona: boolean,
 *   startLocationKey: string  // optional
 * }
 */
export async function resetStoryV2(roomId, payload) {
  await api.post(`/v2/story/rooms/${roomId}/reset`, payload);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  알림
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 미확인 알림 조회 (UI 토스트 노출용).
 * 가장 최근 알림이 배열 앞.
 */
export async function fetchUnreadNotifications(roomId) {
  const res = await api.get(`/v2/story/rooms/${roomId}/notifications`);
  return res.data;
}

/** 알림 읽음 마킹 — 토스트를 유저가 닫았을 때. */
export async function markNotificationRead(roomId, notificationId) {
  await api.post(`/v2/story/rooms/${roomId}/notifications/${notificationId}/read`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  헬퍼 — SSE 메시지 전송 URL 구성
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * V2 메시지/액션 SSE 엔드포인트 경로. useStoryV2Stream 훅이 fetch+SSE 수립 시 사용.
 *
 * 4종 액션 UI는 모두 본 엔드포인트로 통합:
 *   - 일반 채팅:        {message: "...", actionType: null}
 *   - 장소 이동:        {actionType: "MOVE", actionPayload: {toLocationKey: "GARDEN"}}
 *   - 시간 넘기기:      {actionType: "TIME_ADVANCE"}
 *   - 다음 씬:          {actionType: "NEXT_SCENE"}
 */
export function getStoryV2StreamUrl(roomId) {
  return `/v2/story/rooms/${roomId}/messages/stream`;
}

/** [E-3 C-1] 오프닝 SSE 엔드포인트 경로 — 방 첫 진입 시 디렉터가 도입 장면을 자동 생성. */
export function getStoryV2OpeningStreamUrl(roomId) {
  return `/v2/story/rooms/${roomId}/opening/stream`;
}