import api from "./axios";

/**
 * [Studio v1] UGC 캐릭터 생성 스튜디오 API
 *
 * 네이밍 규칙은 TheaterLobbyApi를 따른다:
 *  - fetch*: GET 조회
 *  - create*: POST 생성
 *  - request*: 신청 계열 POST
 *  - update*: PATCH 부분 수정
 *  - 모든 함수는 AxiosResponse.data를 반환 (에러는 상위로 throw)
 *
 * CreationJobView:
 *   { jobId, status, currentStepHint, goldenShots:[{index,url}], baseStandingUrl,
 *     baseCandidates:[{index,status,url}], profile,
 *     emotionAssets:{TAG:{status,thumbUrl}}, energySpent,
 *     rerollCosts:{goldenShot,baseStanding,emotion}, failReason, characterId, expiresAt }
 *
 *   status: CONCEPT_PROCESSING | GACHA_WAIT | BASE_PROCESSING | BASE_WAIT
 *         | EMOTIONS_PROCESSING | REVIEW_WAIT | POSTPROCESSING | BINDING
 *         | READY | FAILED | EXPIRED
 *   goldenShots: 리롤마다 +2장씩 누적 (2·4·6…) — GACHA_WAIT에서 1장 선택 = 원화·썸네일 확정.
 *     리롤 중(CONCEPT_PROCESSING·GOLDEN_GENERATING)에도 기존 goldenShots는 응답에 유지된다.
 *   baseCandidates: 동일하게 리롤마다 +2장씩 누적 — BASE_PROCESSING 중에도 기존 READY 후보 유지.
 *   baseCandidates[].status: DERIVING | REFINING | READY | FAILED (READY만 url 존재)
 *   profile: {name, tagline, age, role, personality, tone, appearance, clothing,
 *             backstory, coreValues, flaws, speechQuirks, firstGreeting, introNarration}
 *            — Stage0(컨셉 분석) 완료 전엔 null. 편집 가능한 설정 초안.
 *   emotionAssets[TAG].status: DERIVING | REFINING | READY | CUTTING | DONE | FAILED
 *   emotionAssets[TAG]: {status, thumbUrl, versions:[url…], selectedIndex}
 *     versions: 완성본 누적 리스트 (리롤할 때마다 추가), selectedIndex: 현재 선택된 버전.
 *     리롤/재시도 중에도 thumbUrl은 직전 선택본을 유지한다.
 *     리롤 소진 시 이전 완성본으로 자동 복귀 (FAILED는 완성본이 하나도 없던 컷에서만).
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  생성 잡
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 캐릭터 소환 시작 (에너지 20 차감).
 * @param {{name?: string, concept: string, appearance?: object|null,
 *          officialWorldId?: string|null, ugcWorldId?: number|null}} payload
 *   appearance: {hair, eyes, body, outfit, accessories, extra} — 전부 선택 문자열
 *   필드(외형 구조화 힌트). 비어 있으면 필드 자체를 생략한다.
 *   [World Builder] officialWorldId(WorldId enum name) | ugcWorldId(숫자) —
 *   세계관 연결 선택 필드. 동시 지정 400, 둘 다 생략 = '나중에 연결'.
 * @returns {Promise<{jobId: string}>} 202 Accepted
 *   400: 이미 진행 중인 잡 / 잔액 부족 / 모더레이션 차단 — message를 그대로 노출
 */
export async function createUgcCharacter({
  name, concept, appearance = null, officialWorldId = null, ugcWorldId = null, gender = null,
}) {
  const res = await api.post("/ugc/characters", {
    name: name?.trim() ? name.trim() : null,
    concept,
    ...(appearance ? { appearance } : {}),
    ...(officialWorldId ? { officialWorldId } : {}),
    ...(ugcWorldId ? { ugcWorldId } : {}),
    // [2026-08-04 남캐] FEMALE(기본)/MALE — MALE은 백엔드 게이트(male-builder-enabled) 필요
    ...(gender ? { gender } : {}),
  });
  return res.data;
}

export async function fetchCreationJob(jobId) {
  const res = await api.get(`/ugc/characters/${encodeURIComponent(jobId)}`);
  return res.data;
}

/** 황금샷(원화) 2장 중 1장 확정 (selectedIndex: 0..1) — 원화·썸네일 확정 */
export async function selectGoldenShot(jobId, selectedIndex) {
  const res = await api.post(
    `/ugc/characters/${encodeURIComponent(jobId)}/golden-shot`,
    { selectedIndex }
  );
  return res.data;
}

/**
 * 황금샷(원화) 2장 전체 리롤 (에너지 rerollCosts.goldenShot).
 * @param {string} jobId
 * @param {{hair?: string, eyes?: string, body?: string, outfit?: string,
 *          accessories?: string, extra?: string}|null} appearance
 *   외형 수정 힌트 — 전부 선택 문자열 필드. 값이 하나라도 있으면 서버가 외형 전용
 *   LLM 재구조화(페르소나·설정 보존, 외형 태그·씬·배경색만 교체) 후 새 프롬프트로
 *   리롤한다. 생략/null = 기존 외형 유지(순수 seed 리롤).
 *   [계약] 빈 객체·전부 빈 문자열이면 appearance 자체를 생략할 것 — 호출부에서
 *   빈 필드를 걸러 값 있는 필드만 담거나 null을 넘긴다.
 *   황금샷(GACHA_WAIT) 리롤 전용 — 스탠딩(BASE_WAIT) 리롤은 원화 고정이라 외형 수정 불가.
 */
export async function rerollGoldenShots(jobId, appearance = null) {
  const res = await api.post(
    `/ugc/characters/${encodeURIComponent(jobId)}/golden-shot`,
    { reroll: true, ...(appearance ? { appearance } : {}) }
  );
  return res.data;
}

/** 스탠딩 후보 2장 중 1장 확정 (selectedIndex: 0..1) — 베이스 스탠딩 확정 */
export async function selectBaseStanding(jobId, selectedIndex) {
  const res = await api.post(
    `/ugc/characters/${encodeURIComponent(jobId)}/base-standing`,
    { selectedIndex }
  );
  return res.data;
}

/** 스탠딩 후보 배치 재파생 (에너지 rerollCosts.baseStanding) */
export async function rerollBaseStandings(jobId) {
  const res = await api.post(
    `/ugc/characters/${encodeURIComponent(jobId)}/base-standing`,
    { reroll: true }
  );
  return res.data;
}

/**
 * 감정 컷 개별 리롤.
 *   READY 컷: 에너지 2 / FAILED 컷: 무료 재시도
 * @param {string} emotionTag EmotionTag 대문자 (ex. "JOY")
 */
export async function rerollEmotionCut(jobId, emotionTag) {
  const res = await api.post(
    `/ugc/characters/${encodeURIComponent(jobId)}/emotions/${encodeURIComponent(emotionTag)}/reroll`
  );
  return res.data;
}

/**
 * 감정 컷 버전 선택 — 무과금, REVIEW_WAIT 전용.
 * versions(완성본 누적 리스트) 중 하나를 현재 컷으로 선택/되돌린다.
 * @param {string} emotionTag EmotionTag 대문자 (ex. "JOY")
 * @param {number} versionIndex versions 배열 인덱스
 */
export async function selectEmotionVersion(jobId, emotionTag, versionIndex) {
  const res = await api.post(
    `/ugc/characters/${encodeURIComponent(jobId)}/emotions/${encodeURIComponent(emotionTag)}/select`,
    { versionIndex }
  );
  return res.data;
}

/** 검수 완료 확정 — 15컷 전부 READY여야 성공 */
export async function confirmCreation(jobId) {
  const res = await api.post(`/ugc/characters/${encodeURIComponent(jobId)}/confirm`);
  return res.data;
}

/** 중도 포기 (무환불) */
export async function abandonCreationJob(jobId) {
  const res = await api.delete(`/ugc/characters/${encodeURIComponent(jobId)}`);
  return res.data;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  내 캐릭터 / 탐색
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** @returns {Promise<{characters: UgcCharacterView[], activeJob: CreationJobView|null}>} */
export async function fetchMyUgcCharacters() {
  const res = await api.get("/ugc/characters/mine");
  return res.data;
}

/** @returns {Promise<{items: Array, nextCursor: string|null}>} */
export async function fetchExploreCharacters(cursor = null, limit = 20) {
  const res = await api.get("/ugc/characters/explore", {
    params: { cursor: cursor || undefined, limit },
  });
  return res.data;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  공개 / Secret / 텍스트 수정
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** 공개 신청 또는 신청 취소 (cancel=true) */
export async function requestPublish(characterId, cancel = false) {
  const res = await api.post(
    `/ugc/characters/${characterId}/publish-request`,
    cancel ? { cancel: true } : {}
  );
  return res.data;
}

export async function requestSecret(characterId) {
  const res = await api.post(`/ugc/characters/${characterId}/secret-request`);
  return res.data;
}

/** 텍스트 부분 수정 — {name?, tagline?, personality?, tone?, firstGreeting?} */
export async function updateUgcTexts(characterId, texts) {
  const res = await api.patch(`/ugc/characters/${characterId}/texts`, texts);
  return res.data;
}

/**
 * [World Builder] 캐릭터 세계관 사후 연결/변경/해제 — 무료.
 * @param {number|string} characterId
 * @param {{officialWorldId?: string|null, ugcWorldId?: number|null}} payload
 *   { officialWorldId } | { ugcWorldId } | 둘 다 null = 연결 해제.
 *   공개 캐릭터에는 APPROVED 월드만 연결 가능 — 400 message를 그대로 노출한다.
 */
export async function updateUgcCharacterWorld(characterId, payload) {
  const res = await api.patch(`/ugc/characters/${characterId}/world`, payload);
  return res.data;
}

/**
 * 진행 중 잡의 설정 초안(profile) 부분 수정 — jobId 기반.
 * profile 필드 중 임의 부분집합만 전송(미전송/null = 유지, age는 수정 불가).
 * Stage0 완료 이후 ~ REVIEW_WAIT까지 허용 (그 외 400).
 * 완성 후 텍스트 수정은 characterId 기반 updateUgcTexts가 담당 — 역할 분리.
 */
export async function updateUgcProfile(jobId, profile) {
  const res = await api.patch(
    `/ugc/characters/${encodeURIComponent(jobId)}/profile`,
    profile
  );
  return res.data;
}
