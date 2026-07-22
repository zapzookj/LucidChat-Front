import api from "./axios";

/**
 * [Profile v1] 캐릭터 프로필 조회 API
 *
 * 네이밍 규칙은 StudioApi를 따른다:
 *  - fetch*: GET 조회
 *  - 모든 함수는 AxiosResponse.data를 반환 (에러는 상위로 throw)
 *
 * CharacterProfileView(응답):
 *   { characterId, name, slug, age, role, tagline, moodTags:[..],
 *     worldType: "OFFICIAL"|"UGC"|null, worldName,
 *     appearance, clothing, height, likes, dislikes, hobby,
 *     introTeaser, greetingExcerpt, defaultImageUrl, thumbnailUrl,
 *     ugc: boolean, creatorNickname }
 *
 *   - 신상 4종(height/likes/dislikes/hobby)과 introTeaser/greetingExcerpt는
 *     nullable — UI에서 "기록 없음" 회색 처리
 *   - 404 = 비공개/숨김 캐릭터 — 호출부에서 방어 (정상 목록에서는 발생하지 않음)
 */
export async function fetchCharacterProfile(characterId) {
  const res = await api.get(`/lobby/characters/${characterId}/profile`);
  return res.data;
}
