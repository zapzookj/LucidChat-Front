/**
 * [2026-08-07 디오라마 이식] 과거 씬 리플레이 유틸 — V1 ChatPage / V2 ChatPageV2 공용.
 *
 * 히스토리 메시지(씬 단위 엔트리)를 무대 씬 객체로 역변환한다.
 * expandLogWithScenes / buildHistoryEntries가 만드는 cleanContent 포맷
 * ("*나레이션*\n대사", SYSTEM은 나레이션 원문 또는 *…* 포장)의 역함수.
 */

/** 리플레이 가능한 role — 유저 발화는 무대 씬이 아니므로 제외 */
const REPLAYABLE_ROLES = new Set(["ASSISTANT", "NPC", "SYSTEM"]);

export function isReplayableMessage(msg) {
  return !!msg && REPLAYABLE_ROLES.has(msg.role) && !!(msg.cleanContent || "").trim();
}

/** messages 배열에서 리플레이 가능한 인덱스 목록 (원본 순서 보존) */
export function pickReplayableIndices(messages) {
  const out = [];
  (messages || []).forEach((m, i) => {
    if (isReplayableMessage(m)) out.push(i);
  });
  return out;
}

const stripAsterisks = (s) => s.replace(/^\*+\s?/, "").replace(/\s?\*+$/, "").trim();

/**
 * 히스토리 메시지 → 무대 씬 객체(DialogueBox·CharacterDisplay 주입용).
 * `*...*` 단독 라인 = 나레이션, 나머지 = 대사(인라인 *…*는 DialogueBox가 자체 파싱하므로 보존).
 */
export function messageToScene(msg) {
  if (!msg) return null;
  const raw = msg.cleanContent || "";
  if (msg.role === "SYSTEM") {
    return {
      speaker: null,
      narration: stripAsterisks(raw),
      dialogue: "",
      emotion: msg.emotionTag || "NEUTRAL",
      outfit: msg.outfit ?? null,
      isEvent: true, // DialogueBox 보라 나레이션 UI
      __replay: true,
    };
  }
  const narrationLines = [];
  const dialogueLines = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (/^\*[^*]+\*$/.test(t)) narrationLines.push(stripAsterisks(t));
    else if (t) dialogueLines.push(line);
  }
  return {
    speaker: msg.speaker ?? null,
    narration: narrationLines.join(" "),
    dialogue: dialogueLines.join("\n"),
    emotion: msg.emotionTag || "NEUTRAL",
    // scenesJson 씬 컨텍스트(2026-08-07 백엔드 영속) — 레거시 로그는 null → 소비처가 현재값 폴백
    outfit: msg.outfit ?? null,
    isEvent: false,
    __replay: true,
  };
}
