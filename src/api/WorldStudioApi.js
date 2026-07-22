import api from "./axios";

/**
 * [World Builder v1] UGC 세계관(월드) 생성 스튜디오 API
 *
 * 네이밍 규칙은 StudioApi를 따른다:
 *  - fetch*: GET 조회
 *  - create*: POST 생성
 *  - update*: PATCH 부분 수정
 *  - 모든 함수는 AxiosResponse.data를 반환 (에러는 상위로 throw)
 *
 * WorldCreationJobView:
 *   { jobId, status, currentStepHint,
 *     draft: { name, intro, lore, moodTags:[..],
 *              locations:[{locationKey, displayName, description}] },
 *     thumbnail: { status, url, versions:[url..], selectedIndex } | null,
 *     locationAssets: { KEY: { status, url, versions, selectedIndex } },
 *     energySpent, rerollCost, maxLocations, failReason, ugcWorldId, expiresAt }
 *
 *   status: CONCEPT_PROCESSING → EDIT_WAIT → ILLUSTRATING → REVIEW_WAIT
 *         → BINDING → READY | FAILED | EXPIRED
 *   asset status: GENERATING | READY | FAILED
 *     - GENERATING 중에도 url은 직전 선택본을 유지한다 (스피너 오버레이용)
 *     - versions: 완성본 누적 리스트 — 무료로 골라잡기(select) 가능
 *
 * UgcWorldView:
 *   { worldId, name, intro, lore, moodTags:[..], thumbnailUrl,
 *     reviewStatus(NONE|APPROVED|REJECTED), createdAt,
 *     locations:[{locationKey, displayName, description, backgroundUrl,
 *                 status: "READY"|"GENERATING"|"FAILED"}] | null }
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  공식 세계관 상수 (셀렉터 공용)
//  — 표시명은 백엔드 WorldId displayName과 일치해야 한다
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const OFFICIAL_WORLDS = [
  { id: "MEDIEVAL_FANTASY", name: "중세 판타지" },
  { id: "ORIENTAL_FANTASY", name: "동양 판타지" },
  { id: "MODERN_KOREA", name: "현대 한국" },
  { id: "FANTASY_ACADEMY", name: "판타지 아카데미" },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  생성 잡
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 마지막 세계관 생성 잡 ID 로컬 키.
 * 종결(READY/FAILED/EXPIRED)된 잡은 mine.activeJob에서 빠지므로,
 * 이탈 중 종결된 잡의 완성/실패 뷰(환불 안내 포함)를 재진입 시 1회 복원하는 데 쓴다.
 *   - 기록: WorldCreateFlow — 잡 시작/재개 시
 *   - 소비: StudioWorldPage 부트 — activeJob 없을 때 1회 조회
 *   - 제거: 종결 뷰 표시 후 플로우 닫힘 시 / 잡 정리(포기·재시작) 시 / 조회 실패 시
 */
export const LAST_WORLD_JOB_KEY = "lucid.lastWorldJobId";

/**
 * 세계관 생성 시작 (에너지 10 차감).
 * @param {{name?: string, moodHint?: string, concept: string}} payload
 *   name/moodHint는 falsy면 null 전송 (AI가 채운다)
 * @returns {Promise<{jobId: string}>} 202 Accepted
 *   400: 이미 진행 중인 잡 / 잔액 부족 / 모더레이션 차단 — message를 그대로 노출
 */
export async function createUgcWorld({ name, moodHint, concept }) {
  const res = await api.post("/ugc/worlds", {
    name: name?.trim() ? name.trim() : null,
    moodHint: moodHint?.trim() ? moodHint.trim() : null,
    concept,
  });
  return res.data;
}

/** @returns {Promise<WorldCreationJobView>} — 2.5s 폴링 대상 */
export async function fetchWorldCreationJob(jobId) {
  const res = await api.get(`/ugc/worlds/jobs/${encodeURIComponent(jobId)}`);
  return res.data;
}

/**
 * 설정 초안 부분 수정 — {name?, intro?, lore?, moodTags?, locations?}
 *   - null/미전송 = 유지
 *   - locations는 "전체 교체" — [{locationKey?, displayName, description}]
 *     기존 장소는 locationKey를 유지해서 보내야 프롬프트가 승계된다.
 *     신규 장소는 locationKey를 생략.
 *   - locations 수정은 EDIT_WAIT에서만, 텍스트는 REVIEW_WAIT에도 가능
 */
export async function updateWorldDraft(jobId, draft) {
  const res = await api.patch(
    `/ugc/worlds/jobs/${encodeURIComponent(jobId)}/draft`,
    draft
  );
  return res.data;
}

/** EDIT_WAIT → ILLUSTRATING 전이 (장소 1~10개 필요) */
export async function startWorldIllustration(jobId) {
  const res = await api.post(
    `/ugc/worlds/jobs/${encodeURIComponent(jobId)}/illustrate`
  );
  return res.data;
}

/** 썸네일 리롤 (READY 컷 = 에너지 rerollCost / FAILED 컷 = 무료) */
export async function rerollWorldThumbnail(jobId) {
  const res = await api.post(
    `/ugc/worlds/jobs/${encodeURIComponent(jobId)}/thumbnail/reroll`
  );
  return res.data;
}

/** 썸네일 버전 선택 — 무과금 (versions 배열 인덱스) */
export async function selectWorldThumbnail(jobId, versionIndex) {
  const res = await api.post(
    `/ugc/worlds/jobs/${encodeURIComponent(jobId)}/thumbnail/select`,
    { versionIndex }
  );
  return res.data;
}

/** 장소 배경 리롤 (READY 컷 = 에너지 rerollCost / FAILED 컷 = 무료) */
export async function rerollWorldLocation(jobId, locationKey) {
  const res = await api.post(
    `/ugc/worlds/jobs/${encodeURIComponent(jobId)}/locations/${encodeURIComponent(locationKey)}/reroll`
  );
  return res.data;
}

/** 장소 배경 버전 선택 — 무과금 (versions 배열 인덱스) */
export async function selectWorldLocation(jobId, locationKey, versionIndex) {
  const res = await api.post(
    `/ugc/worlds/jobs/${encodeURIComponent(jobId)}/locations/${encodeURIComponent(locationKey)}/select`,
    { versionIndex }
  );
  return res.data;
}

/** 세계 확정 — 전 컷 READY 필요 → BINDING → READY */
export async function confirmWorldCreation(jobId) {
  const res = await api.post(
    `/ugc/worlds/jobs/${encodeURIComponent(jobId)}/confirm`
  );
  return res.data;
}

/** 중도 포기 (무환불) — FAILED 잡 정리는 서버가 전액 환불 처리 */
export async function abandonWorldCreationJob(jobId) {
  const res = await api.delete(`/ugc/worlds/jobs/${encodeURIComponent(jobId)}`);
  return res.data;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  내 세계관
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** @returns {Promise<{worlds: UgcWorldView[], activeJob: WorldCreationJobView|null}>} */
export async function fetchMyUgcWorlds() {
  const res = await api.get("/ugc/worlds/mine");
  return res.data;
}

/** @returns {Promise<UgcWorldView>} locations 포함 — 소유자 전용 */
export async function fetchUgcWorld(worldId) {
  const res = await api.get(`/ugc/worlds/${worldId}`);
  return res.data;
}

/**
 * 세계관 설정 부분 수정 — 무료.
 * @param {{name?: string, intro?: string, lore?: string, moodTags?: string[]}} payload
 *   미전송 필드 = 유지.
 * ⚠️ 저장 시 판정 이력(APPROVED/REJECTED)이 NONE으로 리셋된다 —
 *   호출부는 reviewStatus !== "NONE"일 때 confirm으로 재검수 경고를 띄울 것.
 */
export async function updateUgcWorld(worldId, payload) {
  const res = await api.patch(`/ugc/worlds/${worldId}`, payload);
  return res.data;
}

/**
 * 장소 추가 — 에너지 1 차감, 상한 20.
 * @param {{displayName: string, description: string}} payload description은 필수·300자 이하
 * @returns {Promise<{locationKey: string}>}
 *   400: 상한 초과 / 잔액 부족 — 서버 message 그대로 노출
 */
export async function addUgcWorldLocation(worldId, { displayName, description }) {
  const res = await api.post(`/ugc/worlds/${worldId}/locations`, {
    displayName,
    description,
  });
  return res.data;
}

/** 장소 배경 재생성 — 무료 (FAILED 또는 멈춘 GENERATING 복구) */
export async function retryUgcWorldLocation(worldId, locationKey) {
  const res = await api.post(
    `/ugc/worlds/${worldId}/locations/${encodeURIComponent(locationKey)}/retry`
  );
  return res.data;
}

/** 장소 삭제 — FAILED 상태만 가능, 에너지 1 환불 */
export async function deleteUgcWorldLocation(worldId, locationKey) {
  const res = await api.delete(
    `/ugc/worlds/${worldId}/locations/${encodeURIComponent(locationKey)}`
  );
  return res.data;
}
