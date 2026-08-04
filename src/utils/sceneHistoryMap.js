/**
 * [Scene-Polish C] 히스토리 메시지 ↔ 씬 일러 매핑 — V1 ChatPage + V2 ChatPageV2 공용.
 *
 * 백엔드 계약:
 *  - GET /chat/rooms/{roomId}/logs 의 각 로그에 `ordinal`(방 내 절대 서수, 1-based, 오래된 순)
 *  - GET /illustrations/scenes 의 SceneView.turnIndex 가 같은 서수 공간의 매핑 키
 *
 * 프론트 현실:
 *  - 로그 복원(초기 GET/무한스크롤)으로 온 메시지는 ordinal 보유 (expandLogWithScenes가 전파)
 *  - 라이브 SSE로 append된 메시지는 ordinal 미보유 → 이 구간의 씬은 목록 마지막에 트레일링 배치
 *    (새로고침하면 로그 복원 경로로 정확한 위치에 재배치된다)
 */

/**
 * @param {Array<object>} messages 히스토리 메시지 배열 (msg.ordinal 있으면 사용)
 * @param {Array<object>} scenes   displayable(COMPLETED, imageUrl 보유) 씬 배열
 * @returns {{
 *   markersByMessageIndex: Map<number, object[]>,  // 메시지 인덱스 → 그 직후에 렌더할 씬들
 *   ordinalByMessageIndex: Array<number|null>,     // 메시지 인덱스 → 행 클릭 점프용 유효 서수
 * }}
 */
export function buildSceneHistoryIndex(messages, scenes) {
  const markersByMessageIndex = new Map();
  const ordinalByMessageIndex = new Array(messages?.length || 0).fill(null);
  if (!Array.isArray(messages) || messages.length === 0 || !Array.isArray(scenes) || scenes.length === 0) {
    return { markersByMessageIndex, ordinalByMessageIndex };
  }

  // turnIndex 오름차순 (없는 씬은 맨 뒤 — 트레일링 배치)
  const sorted = scenes
    .filter((s) => s && s.imageUrl)
    .sort((a, b) => {
      const ta = a.turnIndex ?? Number.POSITIVE_INFINITY;
      const tb = b.turnIndex ?? Number.POSITIVE_INFINITY;
      return ta - tb || (a.id ?? 0) - (b.id ?? 0);
    });

  let cursor = 0;       // sorted 소비 포인터
  let lastOrdinal = null;

  messages.forEach((msg, i) => {
    if (msg && msg.ordinal != null) lastOrdinal = msg.ordinal;
    ordinalByMessageIndex[i] = lastOrdinal;

    if (msg && msg.ordinal != null) {
      const bucket = [];
      while (
        cursor < sorted.length &&
        sorted[cursor].turnIndex != null &&
        sorted[cursor].turnIndex <= msg.ordinal
      ) {
        bucket.push(sorted[cursor]);
        cursor += 1;
      }
      if (bucket.length > 0) markersByMessageIndex.set(i, bucket);
    }
  });

  // 남은 씬(라이브 세션 생성분 / turnIndex 미보유) → 마지막 메시지 뒤에 트레일링
  if (cursor < sorted.length) {
    const lastIdx = messages.length - 1;
    const prev = markersByMessageIndex.get(lastIdx) || [];
    markersByMessageIndex.set(lastIdx, [...prev, ...sorted.slice(cursor)]);
  }

  return { markersByMessageIndex, ordinalByMessageIndex };
}
