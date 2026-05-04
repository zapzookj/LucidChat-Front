/**
 * [Phase 5.5 Polish · P1 #2] Dialogue prefix sanitizer (frontend mirror)
 *
 * 이미 MongoDB에 저장된 과거 씬을 history로 표시할 때 prefix가 묻어있을 수 있다.
 * 신규 생성은 백엔드(DialogueSanitizer.java)에서 깨끗이 정리되지만,
 * 마이그레이션이 없는 한 과거 데이터는 그대로다. 표시 시점에 한 번 더 닦아낸다.
 *
 * 정책은 백엔드와 동일:
 *  - 알려진 화자 화이트리스트 매칭만 제거
 *  - 따옴표로 시작하는 인용은 보존
 *  - 콜론 변종(:, ：, ﹕, ꞉) 모두 매칭
 */

const COLON_CLASS = /[:：﹕꞉]/;
const QUOTE_LEADERS = ['"', "'", '\u201C', '\u201D', '\u2018', '\u2019', '\u300C', '\u300E'];

/**
 * @param {string} dialogue 원본 텍스트
 * @param {string[]} knownNames 화자 이름 화이트리스트 (아바타 + 히로인들)
 * @returns {string} prefix가 제거된 텍스트
 */
export function stripSpeakerPrefix(dialogue, knownNames) {
  if (!dialogue || typeof dialogue !== "string") return dialogue;

  const trimmed = dialogue.replace(/^\s+/, "");
  if (!trimmed) return dialogue;

  if (QUOTE_LEADERS.includes(trimmed[0])) return dialogue;

  const names = (knownNames || [])
    .filter((n) => typeof n === "string" && n.trim().length > 0)
    .map((n) => n.trim());
  if (names.length === 0) return dialogue;

  // 긴 이름부터 — 부분 일치 회피
  names.sort((a, b) => b.length - a.length);

  let current = dialogue;
  for (let i = 0; i < 3; i++) {
    const stripped = stripOnce(current, names);
    if (stripped === current) return current;
    current = stripped;
  }
  return current;
}

function stripOnce(text, names) {
  const leading = text.replace(/^\s+/, "");
  if (!leading) return text;

  for (const name of names) {
    if (!leading.startsWith(name)) continue;
    const after = leading.slice(name.length);
    // <whitespace*><colon><whitespace*>
    const m = after.match(/^\s*[:：﹕꞉]\s*/);
    if (m) {
      return after.slice(m[0].length);
    }
  }
  return text;
}

/** 편의 헬퍼 — 한 객체의 narration / dialogue를 한 번에 sanitize. 원본을 mutate하지 않고 새 객체 반환. */
export function sanitizeScene(scene, knownNames) {
  if (!scene) return scene;
  const dialogue = stripSpeakerPrefix(scene.dialogue, knownNames);
  const narration = stripSpeakerPrefix(scene.narration, knownNames);
  if (dialogue === scene.dialogue && narration === scene.narration) return scene;
  return { ...scene, dialogue, narration };
}