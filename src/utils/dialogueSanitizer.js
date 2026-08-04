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

// ─────────────────────────────────────────────────────────────
// [Scene-Polish A] 인트로 나레이션 마지막 문장 추출 — V1/V2 공용
//
// 첫인사(ASSISTANT) 씬의 한 줄 나레이션을 하드코딩 narrationMap 대신
// 서버가 생성한 SYSTEM 인트로 나레이션(cleanContent)의 *마지막 문장*으로 재사용한다.
//  - 종결부호: 마침표/느낌표/물음표/말줄임(… 및 "...") + 뒤따르는 닫는 따옴표/괄호까지 한 문장으로 취급
//  - 개행: 마지막 비어있지 않은 줄에서만 문장을 찾는다
//  - 실속 없는 조각(따옴표만 남는 등)은 건너뛴다
// ─────────────────────────────────────────────────────────────

// 문장 조각: 비종결부 본문 + (종결부호 묶음 + 닫는 따옴표/괄호들)?
const SENTENCE_SEGMENT_RE = /[^.!?…]+(?:[.!?…]+[”"’'」』)\]]*)?/g;
// 글자/숫자(한글·한자·가나 포함)가 하나라도 있어야 "문장"으로 인정
const HAS_SUBSTANCE_RE = /[0-9A-Za-zㄱ-ㆎ가-힣一-鿿぀-ヿ]/;

/**
 * @param {string} text 나레이션 원문 (SYSTEM 로그 cleanContent)
 * @returns {string} 마지막 문장 (추출 실패 시 빈 문자열 — 호출부가 폴백 처리)
 */
export function extractLastSentence(text) {
  if (!text || typeof text !== "string") return "";
  const cleaned = text
    .replace(/^\s*\[NARRATION\]\s*/i, "") // [NARRATION] 태그 제거 (splitNarration와 동일 정책)
    .replace(/^\*+|\*+$/g, "")            // 감싼 asterisk 정규화
    .trim();
  if (!cleaned) return "";

  const lines = cleaned
    .split(/\n+/)
    .map((s) => s.trim())
    .filter((s) => HAS_SUBSTANCE_RE.test(s));
  if (lines.length === 0) return "";
  const lastLine = lines[lines.length - 1];

  const segments = (lastLine.match(SENTENCE_SEGMENT_RE) || [])
    .map((s) => s.trim())
    .filter((s) => HAS_SUBSTANCE_RE.test(s));
  return segments.length > 0 ? segments[segments.length - 1] : lastLine;
}

/**
 * [Scene-Polish A] 주격 조사 판별 (받침 유무 → 이/가) — V1 인라인 로직을 유틸로 승격, V2와 공유.
 * 한글이 아닌 마지막 글자(영문/숫자 등)는 "가" 폴백 (기존 V1 동작 보존).
 */
export function subjectJosa(name) {
  if (!name || typeof name !== "string" || name.length === 0) return "가";
  const lastCode = name.charCodeAt(name.length - 1);
  const isHangulSyllable = lastCode >= 0xac00 && lastCode <= 0xd7a3;
  return isHangulSyllable && (lastCode - 0xac00) % 28 !== 0 ? "이" : "가";
}