import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Play, Pause, BookOpen, SkipForward, Heart, Megaphone
} from "lucide-react";
import { sanitizeScene } from "../../utils/dialogueSanitizer";
import { sfx } from "../../utils/sfx";

/**
 * [Phase 5.5-Theater-Polish] Theater 전용 하단 Dialogue 박스
 *
 * 이슈 #1 해결: narration → inner_narration → [user_dialogue] → [heroine_dialogue] 순차 출력
 * 이슈 #2 해결: 기존 Dialogue 모드 하단 박스 스타일 계승
 * 이슈 #3 해결: 핸들러는 버튼에만 연결 (박스 자체는 클릭 안 먹음)
 *
 * [Polish · P1 #2] dialogue / narration 화자 prefix 방어적 sanitize.
 *   백엔드는 이제 정확히 정리하지만 과거 history(MongoDB)에 prefix가 묻은 데이터가
 *   남아있을 수 있다. 표시 시점에 한 번 더 닦아낸다.
 *
 * ────────────────────────────────────────────────────────────
 *
 * Props:
 *   scene                 : 현재 씬 객체 { narration, protagonistInner, heroineInner, innerNarration(legacy), dialogue, speakerType, speakerName, emotion, sceneType }
 *   speakerName           : 대사 화자 표시 이름
 *   avatarName            : 주인공(유저 아바타) 이름
 *   heroineNames          : [Polish · P1 #2] 세션 내 모든 히로인 이름 배열 — sanitizer 화이트리스트에 사용
 *   playSpeed             : "SLOW" | "NORMAL" | "FAST"
 *   onSpeedChange         : (speed) => void
 *   autoPlayEnabled       : bool
 *   onToggleAutoPlay      : () => void
 *   onPrevScene           : () => void     — 이전 씬 (같은 배치 내에서만)
 *   onNextScene           : () => void     — 다음 씬
 *   canGoPrev             : bool
 *   canGoNext             : bool
 *   loadingNext           : bool
 *   onOpenHistory         : () => void     — 대화 기록 패널 오픈
 *   sceneIndexInBatch     : number
 *   sceneCountInBatch     : number
 *   leadHeroineAffection  : number | null  — 리드 히로인 호감도 (HUD 표시용)
 */

// 타자기 속도
const TYPING_SPEED = { SLOW: 55, NORMAL: 35, FAST: 20 };

// 파트별 대기 시간 (자동재생 시)
const AUTO_ADVANCE_MS = { SLOW: 6500, NORMAL: 4500, FAST: 2500 };

/**
 * 순차 타자기 — 여러 파트를 순서대로 렌더
 *
 * parts: [{ key, text, kind, skipIfEmpty }]
 *   - kind: "narration" | "inner" | "dialogue_user" | "dialogue_heroine"
 *
 * 반환: {
 *   displayedMap: { [key]: string },  // 현재까지 표시된 텍스트
 *   allDone: boolean,
 *   skipAll: () => void,
 * }
 */
function useSequentialTypewriter(parts, speedMs) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [displayed, setDisplayed] = useState({});
  const [allDone, setAllDone] = useState(false);
  const skipFlagRef = useRef(false);

  // 파트 목록이 바뀌면 초기화
  const partsKey = useMemo(
    () => parts.map((p) => `${p.key}:${(p.text || "").length}`).join("|"),
    [parts]
  );

  useEffect(() => {
    setActiveIdx(0);
    setDisplayed({});
    setAllDone(false);
    skipFlagRef.current = false;
  }, [partsKey]);

  useEffect(() => {
    if (activeIdx >= parts.length) {
      setAllDone(true);
      return;
    }
    const current = parts[activeIdx];
    if (!current || !current.text) {
      // 빈 파트는 스킵
      setActiveIdx((i) => i + 1);
      return;
    }
    if (skipFlagRef.current) {
      // skip 모드면 즉시 완료
      setDisplayed((d) => ({ ...d, [current.key]: current.text }));
      setActiveIdx((i) => i + 1);
      return;
    }

    let i = 0;
    const interval = setInterval(() => {
      if (skipFlagRef.current) {
        setDisplayed((d) => ({ ...d, [current.key]: current.text }));
        clearInterval(interval);
        setActiveIdx((idx) => idx + 1);
        return;
      }
      i++;
      if (i % 5 === 0) sfx.typewriter();
      setDisplayed((d) => ({ ...d, [current.key]: current.text.slice(0, i) }));
      if (i >= current.text.length) {
        clearInterval(interval);
        setActiveIdx((idx) => idx + 1);
      }
    }, speedMs);

    return () => clearInterval(interval);
  }, [activeIdx, parts, speedMs]);

  const skipAll = () => {
    skipFlagRef.current = true;
    const full = {};
    parts.forEach((p) => { if (p.text) full[p.key] = p.text; });
    setDisplayed(full);
    setActiveIdx(parts.length);
    setAllDone(true);
  };

  return { displayed, allDone, skipAll, activeIdx };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  메인 컴포넌트
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function TheaterDialogueBox({
  scene: rawScene,
  avatarName,
  heroineNames,
  playSpeed = "NORMAL",
  onSpeedChange,
  autoPlayEnabled = true,
  onToggleAutoPlay,
  onPrevScene,
  onNextScene,
  canGoPrev = false,
  canGoNext = true,
  loadingNext = false,
  onOpenHistory,
  sceneIndexInBatch = 0,
  sceneCountInBatch = 1,
  leadHeroineName,
  leadHeroineAffection,
  onTypingDone,
  // [Polish · P2 #1] inline 분기 모달이 떠있을 때 본체를 흐리고 비활성화.
  //   기존: inline 분기 카드와 DialogueBox 텍스트가 겹쳐 보임 → 시각 위계 혼란.
  //   Fix: 분기 활성 시 본체를 blur + opacity↓ + scale↓ + pointer-events 차단.
  branchInlineActive = false,
  // [Polish · P2 #5] 감독 명령 버튼을 DialogueBox로 이전.
  onOpenCommand,
  commandPulseActive = false,
}) {
  const speed = TYPING_SPEED[playSpeed] || TYPING_SPEED.NORMAL;

  // [Polish · P1 #2] 표시 직전 dialogue/narration prefix 방어 sanitize.
  //   stale MongoDB 데이터를 history로 다시 조회할 때를 위한 안전망.
  const knownNames = useMemo(() => {
    const list = [];
    if (avatarName) list.push(avatarName);
    if (Array.isArray(heroineNames)) list.push(...heroineNames);
    return list;
  }, [avatarName, heroineNames]);

  const scene = useMemo(
    () => sanitizeScene(rawScene, knownNames),
    [rawScene, knownNames]
  );

  // ─── 씬을 순차 파트로 분해 ───
  const parts = useMemo(() => {
    if (!scene) return [];

    const speakerType = scene.speakerType || null;
    // speakerType이 서버에서 안 올 때는 speakerName으로 추론
    const isAvatarSpeaking =
      speakerType === "AVATAR" ||
      (!speakerType && scene.speakerName && scene.speakerName === avatarName);
    const isHeroineSpeaking =
      speakerType === "HEROINE" ||
      (!speakerType && scene.speakerName && scene.speakerName !== avatarName);

    const result = [];

    // 1. 나레이션
    if (scene.narration) {
      result.push({ key: "narration", text: scene.narration, kind: "narration" });
    }
    // 2. 주인공 속마음 (protagonist_inner 우선, 구버전 inner_narration fallback)
    //    [Phase 5.5 UX Polish · R1] 화자 분리 — 히로인 속내(heroine_inner)는 UI 미노출.
    const protagonistInner = scene.protagonistInner ?? scene.innerNarration;
    if (protagonistInner) {
      result.push({ key: "inner", text: protagonistInner, kind: "inner" });
    }
    // 3-a. 유저(아바타) 대사 (있을 때만)
    if (scene.dialogue && isAvatarSpeaking) {
      result.push({ key: "dialogue_user", text: scene.dialogue, kind: "dialogue_user" });
    }
    // 3-b. 히로인 대사 (있을 때만)
    if (scene.dialogue && isHeroineSpeaking) {
      result.push({ key: "dialogue_heroine", text: scene.dialogue, kind: "dialogue_heroine" });
    }

    return result;
  }, [scene, avatarName]);

  const { displayed, allDone, skipAll } = useSequentialTypewriter(parts, speed);

  useEffect(() => {
    if (allDone && onTypingDone) onTypingDone();
  }, [allDone, onTypingDone]);

  // ─── 씬별 화자 이름 계산 ───
  const speakerType = scene?.speakerType || null;
  const isAvatarSpeaking =
    speakerType === "AVATAR" ||
    (!speakerType && scene?.speakerName && scene?.speakerName === avatarName);
  const isHeroineSpeaking =
    speakerType === "HEROINE" ||
    (!speakerType && scene?.speakerName && scene?.speakerName !== avatarName);

  const dialogueSpeakerName = isAvatarSpeaking
    ? avatarName || "주인공"
    : scene?.speakerName || "";

  // ─── 현재 렌더 중인 파트 표시용 ───
  const narrationText = displayed.narration || "";
  const innerText = displayed.inner || "";
  const userDialogue = displayed.dialogue_user || "";
  const heroineDialogue = displayed.dialogue_heroine || "";

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-30 p-4 md:p-6 pointer-events-none"
      onClick={(e) => e.stopPropagation()}
    >
      {/* [Polish · P2 #1] inline 분기 활성 시 본체 흐림 */}
      <motion.div
        className="max-w-5xl mx-auto pointer-events-auto"
        animate={{
          opacity: branchInlineActive ? 0.18 : 1,
          filter: branchInlineActive ? "blur(3px)" : "blur(0px)",
          scale: branchInlineActive ? 0.97 : 1,
          y: branchInlineActive ? 8 : 0,
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        style={{
          // 분기 활성 시 본체에 click 안 먹게 — 버튼이 inline 모달 뒤로 안 묻혀도 보호
          pointerEvents: branchInlineActive ? "none" : "auto",
        }}
      >
        {/* ═══ 컨트롤 바 (박스 위) ═══ */}
        <TopControls
          playSpeed={playSpeed}
          onSpeedChange={onSpeedChange}
          autoPlayEnabled={autoPlayEnabled}
          onToggleAutoPlay={onToggleAutoPlay}
          onOpenHistory={onOpenHistory}
          sceneIndexInBatch={sceneIndexInBatch}
          sceneCountInBatch={sceneCountInBatch}
          leadHeroineName={leadHeroineName}
          leadHeroineAffection={leadHeroineAffection}
        />

        {/* ═══ 메인 다이얼로그 박스 ═══ */}
        <div
          className="relative rounded-2xl bg-black/75 backdrop-blur-md border border-white/10 shadow-2xl"
          style={{
            minHeight: "200px",
            maxHeight: "40vh",
          }}
        >
          <div className="p-5 md:p-6 overflow-y-auto max-h-[38vh] space-y-3">
            {/* 나레이션 */}
            {scene?.narration && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-white/90 text-[15px] md:text-base leading-relaxed"
                style={{ fontFamily: "'Noto Serif KR', serif" }}
              >
                {narrationText}
                {narrationText.length < (scene.narration?.length || 0) && (
                  <TypingCursor color="rgba(255,255,255,0.6)" />
                )}
              </motion.div>
            )}

            {/* 속마음 — Theater 시그니처 (violet 좌측 라인)
                [Phase 5.5 UX Polish · R1] protagonistInner 우선, innerNarration fallback */}
            {(scene?.protagonistInner ?? scene?.innerNarration) && narrationText.length >= (scene.narration?.length || 0) && (
              <motion.div
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                className="relative pl-4 py-2"
              >
                {/* 그라디언트 좌측 라인 */}
                <div
                  className="absolute left-0 top-1 bottom-1 w-[2px] rounded-full"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(167,139,250,0) 0%, rgba(167,139,250,0.7) 30%, rgba(167,139,250,0.7) 70%, rgba(167,139,250,0) 100%)",
                  }}
                />
                <div
                  className="text-violet-200/90 text-sm italic leading-relaxed"
                  style={{ fontFamily: "'Noto Serif KR', serif" }}
                >
                  <span className="text-violet-300/55 mr-1">「</span>
                  {innerText}
                  <span className="text-violet-300/55 ml-1">」</span>
                  {innerText.length < ((scene.protagonistInner ?? scene.innerNarration)?.length || 0) && (
                    <TypingCursor color="rgba(196,181,253,0.65)" />
                  )}
                </div>
              </motion.div>
            )}

            {/* 대사 */}
            {scene?.dialogue && (
              <DialogueLine
                isAvatarSpeaking={isAvatarSpeaking}
                isHeroineSpeaking={isHeroineSpeaking}
                speakerName={dialogueSpeakerName}
                text={isAvatarSpeaking ? userDialogue : heroineDialogue}
                fullText={scene.dialogue}
              />
            )}
          </div>

          {/* ═══ 하단 네비게이션 바 ═══ */}
          <BottomNav
            onPrev={onPrevScene}
            onNext={allDone ? onNextScene : skipAll}
            canGoPrev={canGoPrev}
            canGoNext={canGoNext}
            loadingNext={loadingNext}
            allDone={allDone}
            onOpenCommand={onOpenCommand}
            commandPulseActive={commandPulseActive}
          />
        </div>
      </motion.div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  대사 라인 (유저 vs 히로인 스타일 분리)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const DialogueLine = ({ isAvatarSpeaking, isHeroineSpeaking, speakerName, text, fullText }) => {
  if (!text && !fullText) return null;

  const typing = (text?.length || 0) < (fullText?.length || 0);

  if (isAvatarSpeaking) {
    // 유저(아바타) 대사 — 우측 정렬 / 파란 계열
    return (
      <motion.div
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex flex-col items-end pt-2 border-t border-white/10"
      >
        <div className="text-cyan-200/90 text-xs font-bold mb-1 tracking-wider">
          {speakerName}
        </div>
        <div
          className="max-w-[85%] px-4 py-2 rounded-2xl rounded-tr-sm bg-cyan-500/15 border border-cyan-400/30 text-white text-base md:text-lg leading-relaxed"
          style={{ fontFamily: "'Noto Sans KR', sans-serif" }}
        >
          {text}
          {typing && <TypingCursor color="rgba(165,243,252,0.7)" />}
        </div>
      </motion.div>
    );
  }

  if (isHeroineSpeaking) {
    // 히로인 대사 — 좌측 정렬 / 앰버 계열 (Dialogue 모드 스타일)
    return (
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex flex-col items-start pt-2 border-t border-white/10"
      >
        <div className="text-amber-200/90 text-xs font-bold mb-1 tracking-wider">
          {speakerName}
        </div>
        <div
          className="max-w-[85%] px-4 py-2 rounded-2xl rounded-tl-sm bg-amber-500/10 border border-amber-400/30 text-white text-base md:text-lg leading-relaxed"
          style={{ fontFamily: "'Noto Sans KR', sans-serif" }}
        >
          <span className="text-amber-200/70 mr-1">"</span>
          {text}
          <span className="text-amber-200/70 ml-1">"</span>
          {typing && <TypingCursor color="rgba(253,230,138,0.7)" />}
        </div>
      </motion.div>
    );
  }

  return null;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  상단 컨트롤 바
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
//  [Phase III · A-2] 폴리싱:
//   ─ 모든 버튼/배지를 같은 pill family로 (기본: bg-black/55 border-white/10)
//   ─ 활성 상태만 mode-theater(violet) 또는 emerald 토큰 적용
//   ─ 씬 진행도 + 리드 히로인을 단일 좌석 진행 인디케이터로 통합:
//      "[●●●○○] · 💕 서태리 42"
//
const TopControls = ({
  playSpeed, onSpeedChange, autoPlayEnabled, onToggleAutoPlay,
  onOpenHistory, sceneIndexInBatch, sceneCountInBatch,
  leadHeroineName, leadHeroineAffection,
}) => {
  // 진행도 도트
  const total = Math.max(1, sceneCountInBatch || 1);
  const current = Math.max(0, Math.min(total - 1, sceneIndexInBatch || 0));

  return (
    <div
      className="flex items-center justify-between gap-2 mb-2 px-1 pointer-events-auto"
      onClick={(e) => e.stopPropagation()}
    >
      {/* ─── 좌측: 컨트롤 ─── */}
      <div className="flex items-center gap-1.5">
        {/* 속도 — segmented control */}
        <div className="flex items-center gap-0.5 bg-black/55 backdrop-blur-md rounded-full p-0.5 border border-white/10">
          {["SLOW", "NORMAL", "FAST"].map((s) => (
            <button
              key={s}
              onClick={(e) => { e.stopPropagation(); onSpeedChange?.(s); }}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide transition-all ${
                playSpeed === s
                  ? "bg-violet-500/30 text-violet-50 shadow-[inset_0_0_0_1px_rgba(167,139,250,0.4)]"
                  : "text-white/45 hover:text-white/75"
              }`}
            >
              {s === "SLOW" ? "느림" : s === "NORMAL" ? "보통" : "빠름"}
            </button>
          ))}
        </div>

        {/* 자동/수동 — 같은 pill family */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleAutoPlay?.(); }}
          aria-label={autoPlayEnabled ? "자동 재생 끄기" : "자동 재생 켜기"}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold backdrop-blur-md border transition-colors duration-200 ${
            autoPlayEnabled
              ? "bg-emerald-500/22 border-emerald-300/40 text-emerald-100"
              : "bg-black/55 border-white/10 text-white/55 hover:text-white/80"
          }`}
        >
          {autoPlayEnabled
            ? <Play size={9} fill="currentColor" />
            : <Pause size={9} fill="currentColor" />}
          <span>{autoPlayEnabled ? "자동" : "수동"}</span>
        </button>

        {/* 대화 기록 — 통일된 톤 */}
        <button
          onClick={(e) => { e.stopPropagation(); onOpenHistory?.(); }}
          aria-label="대화 기록 열기"
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-black/55 backdrop-blur-md border border-white/10 text-white/55 hover:text-white/85 hover:border-violet-300/30 transition-colors duration-200"
        >
          <BookOpen size={9} />
          <span>기록</span>
        </button>
      </div>

      {/* ─── 우측: 진행도 도트 + 리드 히로인 (통합 인디케이터) ─── */}
      <div className="flex items-center gap-2.5">
        {/* 씬 진행 — 도트로 시각화. 텍스트 fallback은 sr-only */}
        <div
          className="flex items-center gap-1 bg-black/55 backdrop-blur-md rounded-full px-2.5 py-1 border border-white/10"
          aria-label={`씬 ${current + 1} / ${total}`}
        >
          {Array.from({ length: total }).map((_, i) => {
            let cls = "rounded-full transition-all duration-300";
            if (i < current) cls += " w-1 h-1 bg-violet-300/85";
            else if (i === current) cls += " w-1.5 h-1.5 bg-violet-200 shadow-[0_0_5px_rgba(199,210,254,0.7)]";
            else cls += " w-1 h-1 bg-white/15";
            return <span key={i} className={cls} />;
          })}
          <span className="ml-1 text-[10px] text-white/55 font-mono tabular-nums">
            {current + 1}<span className="text-white/25">/{total}</span>
          </span>
        </div>

        {/* 리드 히로인 HUD */}
        {leadHeroineName && typeof leadHeroineAffection === "number" && (
          <div className="flex items-center gap-1.5 bg-black/55 backdrop-blur-md rounded-full px-2.5 py-1 border border-white/10">
            <Heart size={9} className="text-rose-300" fill="currentColor" />
            <span className="text-[10px] text-white/85 font-bold tracking-wide truncate max-w-[80px]">
              {leadHeroineName}
            </span>
            <span className="text-[10px] text-rose-200/85 tabular-nums">
              {leadHeroineAffection}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  하단 네비게이션 바
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
//  [Phase III · A-2] 폴리싱:
//   ─ 다음 버튼: mode-theater 그라디언트 (indigo → violet → purple)
//   ─ 이전 버튼: 같은 pill family로 톤 통일
//   ─ allDone === false 일 때 "건너뛰기" — 버튼 자체가 약한 톤으로 가벼운 인상
//
//  [Polish · P2 #5] 감독 명령 버튼을 가운데 영역으로 통합:
//   ─ 라벨 + 아이콘으로 발견율 ↑ (기존 우상단 32px 아이콘은 거의 보이지 않았음)
//   ─ 마지막 씬 도달 시 펄스 애니메이션으로 "지금이 골든 타임" 안내
//   ─ onOpenCommand가 없으면 렌더 안 함 — STORY/SANDBOX 등 다른 환경 호환
//
const BottomNav = ({
  onPrev, onNext, canGoPrev, canGoNext, loadingNext, allDone,
  onOpenCommand, commandPulseActive,
}) => (
  <div
    className="flex items-center justify-between px-4 py-2.5 border-t border-white/5"
    onClick={(e) => e.stopPropagation()}
  >
    <button
      onClick={(e) => { e.stopPropagation(); if (canGoPrev) { sfx.pageTurn(); onPrev?.(); } }}
      disabled={!canGoPrev || loadingNext}
      aria-label="이전 씬"
      className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs transition-colors duration-200 ${
        canGoPrev && !loadingNext
          ? "text-white/65 hover:text-white hover:bg-white/5"
          : "text-white/20 cursor-not-allowed"
      }`}
    >
      <ChevronLeft size={14} /> 이전
    </button>

    {/* [Polish · P2 #5] 가운데 — 감독 명령 버튼 (있으면) */}
    {onOpenCommand && (
      <motion.button
        onClick={(e) => { e.stopPropagation(); onOpenCommand(); }}
        whileTap={{ scale: 0.96 }}
        whileHover={{ scale: 1.02 }}
        animate={
          commandPulseActive
            ? {
                boxShadow: [
                  "0 0 0px rgba(251,191,36,0)",
                  "0 0 20px rgba(251,191,36,0.55)",
                  "0 0 0px rgba(251,191,36,0)",
                ],
              }
            : { boxShadow: "0 0 0px rgba(0,0,0,0)" }
        }
        transition={{
          duration: 1.8,
          repeat: commandPulseActive ? Infinity : 0,
          ease: "easeInOut",
        }}
        aria-label="감독 명령"
        title="감독 명령 (다음 배치에 환경 이벤트 추가)"
        className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors duration-200 ${
          commandPulseActive
            ? "bg-amber-500/15 border-amber-300/45 text-amber-200 hover:bg-amber-500/20"
            : "bg-white/[0.04] border-white/15 text-white/75 hover:text-amber-200 hover:border-amber-300/40 hover:bg-amber-500/8"
        }`}
      >
        <Megaphone size={13} />
        <span className="tracking-wide">감독 명령</span>
        {commandPulseActive && (
          <motion.span
            className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-300"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          />
        )}
      </motion.button>
    )}

    <motion.button
      onClick={(e) => { e.stopPropagation(); if (allDone) sfx.pageTurn(); onNext?.(); }}
      disabled={!canGoNext || loadingNext}
      whileTap={canGoNext && !loadingNext ? { scale: 0.96 } : {}}
      whileHover={canGoNext && !loadingNext && allDone
        ? { scale: 1.02, transition: { type: "spring", stiffness: 400, damping: 20 } }
        : {}}
      aria-label={allDone ? "다음 씬" : "타이핑 건너뛰기"}
      className={`flex items-center gap-2 px-5 py-2 rounded-full font-bold text-sm shadow-lg transition-all duration-200 ${
        canGoNext && !loadingNext
          ? allDone
            // 다음으로 진행 — mode-theater 그라디언트 (시그니처 액션)
            ? "bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 hover:from-indigo-400 hover:via-violet-400 hover:to-purple-400 text-white shadow-violet-500/25"
            // 타이핑 건너뛰기 — 약한 톤 (액션이 가볍다는 시각 신호)
            : "bg-white/10 hover:bg-white/15 text-white/85 border border-white/15"
          : "bg-white/5 text-white/25 cursor-not-allowed"
      }`}
    >
      {loadingNext ? (
        <>준비 중<LoadingDots /></>
      ) : allDone ? (
        <>다음 <ChevronRight size={14} /></>
      ) : (
        <>건너뛰기 <SkipForward size={13} /></>
      )}
    </motion.button>
  </div>
);

const LoadingDots = () => (
  <span className="flex gap-0.5 ml-1">
    {[0, 1, 2].map((i) => (
      <motion.span
        key={i}
        className="inline-block w-0.5 h-0.5 rounded-full bg-white/70"
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 1, delay: i * 0.15, repeat: Infinity }}
      />
    ))}
  </span>
);

const TypingCursor = ({ color }) => (
  <motion.span
    className="inline-block w-[2px] h-4 ml-0.5 align-middle"
    style={{ backgroundColor: color || "rgba(255,255,255,0.6)" }}
    animate={{ opacity: [1, 0, 1] }}
    transition={{ duration: 0.8, repeat: Infinity }}
  />
);