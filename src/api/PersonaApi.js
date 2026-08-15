import api from "./axios";

/**
 * [블록 B 페르소나] 활성 프로필 + 저장 카드(세이브 슬롯) API.
 *
 * 개념 역전: "카드 라이브러리에서 골라 쓰기" → "항상 존재하는 단일 활성 프로필 + 카드=저장 슬롯".
 * 프로필 = {personaId, name, age, gender, personaText, allure, friendliness, trust, charisma, mystique}
 * 방 생성은 서버가 현재 프로필을 자동 스냅샷한다(피커·userPersonaId 전달 불필요, 소급 불변).
 * 렌즈 5축: 축당 0~10, 총점 25(전 유저 공통·무료). 슬롯: 무료 3장/구독 10장(서버 계약).
 */

export async function fetchProfile() {
  const res = await api.get("/personas/profile");
  return res.data;
}

export async function updateProfile(payload) {
  const res = await api.patch("/personas/profile", payload);
  return res.data;
}

/** @returns {{cards: Array, slotLimit: number, slotUsed: number}} */
export async function fetchPersonaCards() {
  const res = await api.get("/personas");
  return res.data;
}

/** 현재 프로필을 카드로 저장 — 슬롯 초과 시 402(무료→구독 유도) / 400(구독 상한). */
export async function saveProfileAsCard() {
  const res = await api.post("/personas");
  return res.data;
}

/** 카드를 프로필로 로드(카드는 보존) — 갱신된 프로필 반환. */
export async function loadPersonaCard(personaId) {
  const res = await api.post(`/personas/${personaId}/load`);
  return res.data;
}

export async function deletePersona(personaId) {
  await api.delete(`/personas/${personaId}`);
}

/** 인식 렌즈 5축 — "캐릭터가 나를 어떻게 인식하는가" (키는 서버 계약과 동일). */
export const LENS_FIELDS = [
  ["allure", "매력", "끌린다"],
  ["friendliness", "친근함", "편하다"],
  ["trust", "신뢰감", "믿는다"],
  ["charisma", "카리스마", "어려워한다"],
  ["mystique", "신비", "궁금해한다"],
];

export const LENS_AXIS_MAX = 10;
export const LENS_TOTAL_MAX = 25;

/**
 * 아키타입 갤러리 — 소개(자유 서술) 빠른 채우기 템플릿(한 탭 시작).
 * 렌즈 배분은 건드리지 않는다(소개·이름·성별만 제안).
 */
export const PERSONA_ARCHETYPES = [
  {
    key: "REGRESSOR",
    name: "회귀자",
    gender: "MALE",
    personaText:
      "이 삶은 두 번째다. 한 번의 생을 끝까지 살고 처음으로 돌아왔다. 앞으로 일어날 일들을 알고 있지만, 그 사실은 아무에게도 말하지 않는다. 모든 상황에서 침착하고, 가끔 아직 일어나지 않은 일을 아는 듯한 말을 흘린다.",
  },
  {
    key: "HIDDEN_MASTER",
    name: "힘을 숨긴 고수",
    gender: "MALE",
    personaText:
      "실력을 철저히 숨기고 평범한 척 살아간다. 위기 상황에서도 일부러 서툰 척하지만, 아주 가끔 본실력의 편린이 새어 나온다. 자신의 정체가 드러나는 것을 극도로 경계한다.",
  },
  {
    key: "CHAEBOL",
    name: "재벌 3세",
    gender: "MALE",
    personaText:
      "거대 그룹의 후계자. 돈으로 안 되는 일이 없다고 믿지만, 진심으로 다가오는 사람을 만나본 적이 없다. 오만해 보이는 태도 밑에 외로움이 있다. 사소한 것에 돈 자랑이 배어 나온다.",
  },
  {
    key: "TOP_VISUAL",
    name: "세계관 최고 미남/미녀",
    gender: "MALE",
    personaText:
      "스스로를 이 세계 최고의 미모라 확신한다. 지나가면 모두가 돌아본다고 믿으며, 모든 호의를 자신의 외모 덕이라 해석한다. 그 확신은 그 무엇으로도 흔들리지 않는다.",
  },
  {
    key: "SUNSHINE",
    name: "인싸 분위기 메이커",
    gender: "MALE",
    personaText:
      "어디서든 분위기를 띄우는 사람. 처음 보는 사람에게도 스스럼없이 다가가고, 침묵을 견디지 못한다. 밝음 뒤에 진지한 이야기를 꺼내는 걸 어려워하는 면이 있다.",
  },
  {
    key: "LONER",
    name: "무뚝뚝한 아웃사이더",
    gender: "MALE",
    personaText:
      "말수가 적고 혼자가 편하다. 필요한 말만 하고, 감정 표현이 서툴다. 하지만 한번 곁을 내준 상대에게는 무심한 척 챙기는 스타일이다.",
  },
];
