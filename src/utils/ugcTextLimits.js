/**
 * [aichat E-7.2] UGC 캐릭터 텍스트 길이 상한 — 서버 정본의 미러.
 *
 * 정본: aichat `service/ugc/UgcTextLimits.java` (Character 컬럼 길이에서 유도).
 * 서버는 초과 시 **절삭이 아니라 400 거부**다(종원 확정 D-19) — 유저가 쓴 문장 끝을
 * 조용히 자르면 편집 의도가 소실되기 때문이다. 그래서 UI가 미리 막지 않으면
 * "다 쓰고 저장을 눌렀더니 거부"가 된다.
 *
 * ⚠ 세 편집 화면(StudioPage 설정 수정 · StudioCreateFlow 완성 단계 · ProfileEditPanel)이
 * 같은 상한을 쓴다. 값을 여기 한 곳에만 두는 이유가 그것이다 — 복제하면 갈린다.
 *
 * ⚠ 서버 값을 바꾸면 여기도 바꿔야 한다. 반대로 **여기 값을 서버보다 크게 잡으면 안 된다**
 * (그러면 400이 다시 살아난다). 더 엄격한 UI 정책값은 허용된다 —
 * 실제로 name/tagline/role은 화면마다 서버 상한(50/100/100)보다 좁게 잡혀 있다.
 */
export const UGC_TEXT_MAX = {
  /** Character.name varchar(50) */
  name: 50,
  /** Character.tagline varchar(100) */
  tagline: 100,
  /** Character.role varchar(100) */
  role: 100,
  /** Character.tone varchar(300) — 세 화면에서 실제로 걸리는 유일한 상한 */
  tone: 300,
};

export const TONE_MAX = UGC_TEXT_MAX.tone;
