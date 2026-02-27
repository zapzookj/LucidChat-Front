import { useEffect, useRef, useCallback } from "react";
import api from "../api/axios";

// ═══════════════════════════════════════════════════════════════
//  [Phase 4.4] useInvisibleMan — 투명인간 이스터에그 클라이언트 감지
//
//  유저가 10분 이상 아무 입력 없이 화면을 켜두면 트리거.
//  프론트에서 직접 감지하므로 LLM 프롬프트 부담 없음.
//
//  사용법 (ChatPage.jsx):
//    useInvisibleMan({
//      enabled: !isTyping && !showEndingCredits && introStep === 'none',
//      onTrigger: (achievement) => { ... },
//    });
// ═══════════════════════════════════════════════════════════════

const IDLE_THRESHOLD_MS = 10 * 60 * 1000; // 10분

/**
 * @param {Object} options
 * @param {boolean} options.enabled - 감지 활성화 여부
 * @param {string} options.characterName - 캐릭터 이름 (동적 나레이션용)
 * @param {function} options.onTrigger - 트리거 시 콜백 (achievement 정보 전달)
 */
export default function useInvisibleMan({ enabled = true, characterName = "캐릭터", onTrigger }) {
  const timerRef = useRef(null);
  const triggeredRef = useRef(false);
  const characterNameRef = useRef(characterName);

  // characterName 변경 시 ref 동기화
  useEffect(() => {
    characterNameRef.current = characterName;
  }, [characterName]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!enabled || triggeredRef.current) return;

    timerRef.current = setTimeout(async () => {
      if (triggeredRef.current) return;
      triggeredRef.current = true;

      const name = characterNameRef.current;
      console.log("👁️ [INVISIBLE_MAN] 10분 방치 감지 — 이스터에그 트리거");

      try {
        // 서버에 업적 해금 요청
        const roomId = localStorage.getItem("roomId");
        const res = await api.post(`/achievements/rooms/${roomId}/unlock`, { code: "INVISIBLE_MAN" });
        
        if (res.data) {
          onTrigger?.({
            trigger: "INVISIBLE_MAN",
            achievement: res.data,
            // [Phase 5] 캐릭터 이름 동적 참조
            scene: {
              narration: `${name}가 가까이 조용히 다가온다. 그 눈동자가 당신을 빤히 올려다본다.`,
              dialogue: "...주무시나..? 속눈썹 되게 기네..",
              emotion: "RELAX",
            },
          });
        }
      } catch (err) {
        console.error("INVISIBLE_MAN unlock failed:", err);
        // 서버 실패해도 연출은 보여줌
        onTrigger?.({
          trigger: "INVISIBLE_MAN",
          achievement: null,
          scene: {
            narration: `${name}가 화면 가까이 조용히 다가온다. 그 눈동자가 당신을 빤히 올려다본다.`,
            dialogue: "...주무시나..? 속눈썹 되게 기네..",
            emotion: "RELAX",
          },
        });
      }
    }, IDLE_THRESHOLD_MS);
  }, [enabled, onTrigger]);

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    // 유저 활동 이벤트 감지 → 타이머 리셋
    const activityEvents = ["mousedown", "keydown", "touchstart", "scroll"];
    
    const handleActivity = () => resetTimer();

    activityEvents.forEach(evt => {
      document.addEventListener(evt, handleActivity, { passive: true });
    });

    // 초기 타이머 시작
    resetTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      activityEvents.forEach(evt => {
        document.removeEventListener(evt, handleActivity);
      });
    };
  }, [enabled, resetTimer]);

  // 페이지 재접속 시 리셋
  useEffect(() => {
    triggeredRef.current = false;
  }, []);
}