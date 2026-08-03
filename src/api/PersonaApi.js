import api from "./axios";

/**
 * [2026-08-04 페르소나 풀 패키지] 페르소나 카드 API.
 * 카드 = {personaId, name, gender, personaText, charm, wit, boldness, intellect, empathy}
 * 방 생성 시 userPersonaId로 전달하면 본문·스탯·성별이 방에 스냅샷된다(카드 수정 소급 불변).
 */

export async function fetchPersonas() {
  const res = await api.get("/personas");
  return res.data;
}

export async function createPersona(payload) {
  const res = await api.post("/personas", payload);
  return res.data;
}

export async function updatePersona(personaId, payload) {
  const res = await api.patch(`/personas/${personaId}`, payload);
  return res.data;
}

export async function deletePersona(personaId) {
  await api.delete(`/personas/${personaId}`);
}

/**
 * 아키타입 갤러리 — 큐레이션 프리셋(접근성 핵심: 한 탭으로 롤플레이 시작).
 * 스탯은 0(무료 기본) — 분배는 구독 티어 게이트라 카드 저장 시 유저가 조정.
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
