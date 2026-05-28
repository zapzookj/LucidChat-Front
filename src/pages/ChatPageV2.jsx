import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Settings, Send, MapPin, Clock, Forward,
  MessagesSquare, Bell, X, Users, History, RotateCcw,
} from "lucide-react";
import {
  fetchStoryV2RoomDetail,
  fetchUnreadNotifications,
  markNotificationRead,
  resetStoryV2,
} from "../api/StoryV2Api";
import { sendV2Message, sendV2Action } from "../api/useStoryV2Stream";
import { useAuth } from "../context/AuthContext";
import { sfx } from "../utils/sfx";
import { assetUrl } from "../utils/assetUrl";

/**
 * [Story V2] V2 디렉터 시점 World 탐험 채팅 페이지.
 *
 * <p>V1 ChatPage(3677줄)와 *완전히 별개* 운영. V1은 Sandbox 전용 유지.
 *
 * <p>[V2 핵심 UI 요소]
 * - 동적 배경 + 시간/장소 인디케이터 헤더
 * - 멀티 씬 (4~5) 순차 표시 — first_scene 즉시 + 나머지 final_result 후 순차
 * - 멀티 히로인 사이드 패널 — 화자 강조, 스탯 표시
 * - 4종 액션 바: 다음 씬 / 시간 넘기기 / 디렉터 옵션 / 장소 이동
 *   ※ 디렉터 옵션은 *LLM이 자율적으로 dialogue_options 제공 시*에만 노출
 * - 오프스크린 알림 토스트
 * - 장소 이동 모달
 *
 * <p>[씬 큐 패턴]
 * V1과 동일 — sceneQueue에 모든 씬을 push, 일정 간격으로 currentScene 갱신.
 * 마지막 씬까지 표시되면 입력 활성화.
 */
export default function ChatPageV2() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();

  // ── 방 상태 ──
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── 씬 표시 ──
  const [sceneQueue, setSceneQueue] = useState([]);
  const [currentScene, setCurrentScene] = useState(null);
  const [displayedHistory, setDisplayedHistory] = useState([]); // 이전 응답들의 누적 (요약 표시용)
  const [isStreaming, setIsStreaming] = useState(false);

  // ── 알림 ──
  const [notifications, setNotifications] = useState([]);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);

  // ── 모달 ──
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showCharacterPanel, setShowCharacterPanel] = useState(false);

  // ── 입력 ──
  const [inputMessage, setInputMessage] = useState("");
  const [dialogueOptions, setDialogueOptions] = useState([]);  // LLM 자율 선택지

  // ── refs ──
  const abortControllerRef = useRef(null);
  const sceneTimerRef = useRef(null);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  초기 로드
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  useEffect(() => {
    setLoading(true);
    fetchStoryV2RoomDetail(roomId)
      .then((detail) => {
        setRoom(detail);
        if (detail.endingReached) {
          // 엔딩 도달 → 별도 처리 가능 (현재는 안내 후 로비 복귀)
          console.log("[V2-Chat] Ending reached:", detail.endingType);
        }
      })
      .catch((e) => {
        console.error("[V2-Chat] load failed", e);
        if (e.response?.status === 400) {
          setError("V2 STORY 방이 아닙니다. 잘못된 경로입니다.");
        } else if (e.response?.status === 404) {
          setError("방을 찾을 수 없습니다.");
        } else {
          setError("방 정보를 불러올 수 없습니다.");
        }
      })
      .finally(() => setLoading(false));

    // 알림 초기 로드
    void refreshNotifications();
  }, [roomId]);

  const refreshNotifications = useCallback(async () => {
    try {
      const list = await fetchUnreadNotifications(roomId);
      setNotifications(list);
    } catch (e) {
      console.warn("[V2-Chat] notification fetch failed", e);
    }
  }, [roomId]);

  // ── 씬 큐 → currentScene 순차 갱신 ──
  // [버그 fix] 기존 코드는 currentScene === null일 때만 큐를 시작했으나,
  //   first_scene으로 이미 currentScene이 설정된 상태에서 final_result가 오면
  //   if 분기로 진입 못해 큐가 영원히 처리되지 않음. 큐가 있으면 무조건 순차 처리한다.
  useEffect(() => {
    if (sceneQueue.length === 0) return;

    let idx = 0;
    let timer;
    const tick = () => {
      if (idx >= sceneQueue.length) {
        setIsStreaming(false);
        setSceneQueue([]);
        return;
      }
      setCurrentScene((prev) => {
        if (prev) setDisplayedHistory((h) => [...h, prev]);
        return sceneQueue[idx];
      });
      idx++;
      timer = setTimeout(tick, 2500);
    };
    timer = setTimeout(tick, 2500);
    sceneTimerRef.current = timer;
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [sceneQueue]);

  // unmount 시 stream abort
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (sceneTimerRef.current) clearTimeout(sceneTimerRef.current);
    };
  }, []);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  SSE 콜백
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const callbacks = {
    onFirstScene: (scene) => {
      // 첫 씬 즉시 표시 + 큐 초기화
      setCurrentScene((prev) => {
        if (prev) {
          setDisplayedHistory((h) => [...h, prev]);
        }
        return scene;
      });
    },
    onFinalResult: (result) => {
      // 모든 씬 + system_updates 처리
      const scenes = result.scenes || [];
      if (scenes.length > 1) {
        // 첫 씬은 이미 표시됨 → 나머지를 큐에 추가
        setSceneQueue(scenes.slice(1));
      } else {
        setIsStreaming(false);
      }
      // dialogue_options 노출
      // (final_result에 dialogue_options가 있을 수 있음 — V1 SendChatResponse에는 없는 V2 필드)
      if (result.dialogueOptions && result.dialogueOptions.length > 0) {
        setDialogueOptions(result.dialogueOptions);
      } else {
        setDialogueOptions([]);
      }
      // 방 상태 부분 갱신 (스탯/시간/위치 등)
      void fetchStoryV2RoomDetail(roomId).then(setRoom);
      // 알림 새로고침 (incoming_messages가 처리됐을 수 있음)
      void refreshNotifications();
      // 유저 에너지 갱신
      void refreshUser?.();
    },
    onError: (err) => {
      console.error("[V2-Chat] SSE error:", err);
      setIsStreaming(false);
      // 에너지 부족 등 안내
      if (err.errorCode === "INSUFFICIENT_ENERGY") {
        alert("에너지가 부족합니다.");
      } else if (err.errorCode === "CONTENT_BLOCKED") {
        alert("부적절한 내용으로 차단되었습니다.");
      } else {
        alert(err.message || "오류가 발생했습니다.");
      }
    },
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  메시지/액션 전송
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const sendMessage = async () => {
    if (!inputMessage.trim() || isStreaming) return;
    const msg = inputMessage.trim();
    setInputMessage("");
    setDialogueOptions([]);
    setIsStreaming(true);
    setSceneQueue([]);
    abortControllerRef.current = new AbortController();
    sfx.click();
    await sendV2Message(roomId, msg, callbacks, abortControllerRef.current);
  };

  const sendAction = async (actionType, payload) => {
    if (isStreaming) return;
    setDialogueOptions([]);
    setIsStreaming(true);
    setSceneQueue([]);
    abortControllerRef.current = new AbortController();
    sfx.click();
    await sendV2Action(roomId, actionType, payload, callbacks, abortControllerRef.current);
  };

  const handleLocationMove = (locationKey) => {
    setShowLocationModal(false);
    void sendAction("MOVE", { toLocationKey: locationKey });
  };

  const handleResetStory = async (includePersona) => {
    setShowResetModal(false);
    try {
      await resetStoryV2(roomId, { includePersona, startLocationKey: null });
      sfx.chime();
      // 방 상태 새로고침
      const detail = await fetchStoryV2RoomDetail(roomId);
      setRoom(detail);
      setCurrentScene(null);
      setSceneQueue([]);
      setDisplayedHistory([]);
      setDialogueOptions([]);
    } catch (e) {
      console.error("[V2-Chat] reset failed", e);
      alert("초기화에 실패했습니다.");
    }
  };

  const handleNotificationClick = async (notification) => {
    sfx.click();
    await markNotificationRead(roomId, notification.notificationId);
    setNotifications((prev) => prev.filter((n) => n.notificationId !== notification.notificationId));
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  렌더
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  if (loading) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white/60">로딩 중...</div>;
  }
  if (error || !room) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <p className="text-red-300">{error || "방을 불러올 수 없습니다."}</p>
        <button onClick={() => navigate("/")} className="px-4 py-2 bg-stone-700 text-white rounded">
          로비로
        </button>
      </div>
    );
  }

  // 동적 배경
  const bgUrl = room.currentDynamicBgUrl;

  return (
    <div className="relative min-h-screen w-full text-white overflow-hidden">
      {/* 배경 */}
      <div
        className="fixed inset-0 -z-10 bg-cover bg-center transition-opacity duration-1000"
        style={{
          backgroundImage: bgUrl ? `url(${bgUrl})` : "linear-gradient(180deg, #1a1a2e, #0d0d1f)",
        }}
      />
      <div className="fixed inset-0 -z-10 bg-black/40" />

      {/* 헤더 */}
      <Header
        room={room}
        notificationCount={notifications.length}
        onBack={() => navigate("/")}
        onShowNotifications={() => setShowNotificationPanel(true)}
        onShowCharacters={() => setShowCharacterPanel(true)}
        onShowReset={() => setShowResetModal(true)}
      />

      {/* 본문 영역 — 씬 표시 */}
      <main className="pt-20 pb-44 px-4 sm:px-8 max-w-4xl mx-auto">
        {/* 이전 씬들 (페이드 표시) */}
        {displayedHistory.slice(-3).map((s, i) => (
          <SceneCard key={`hist-${i}`} scene={s} faded />
        ))}
        {/* 현재 씬 */}
        {currentScene && <SceneCard scene={currentScene} />}
        {/* 입력 가이드 (씬 없을 때) */}
        {!currentScene && !isStreaming && (
          <div className="text-center text-stone-500 py-12">
            메시지를 입력하거나, 아래 액션을 사용해 흐름을 진행하세요.
          </div>
        )}
      </main>

      {/* 입력 + 액션 바 */}
      <BottomBar
        inputMessage={inputMessage}
        setInputMessage={setInputMessage}
        onSendMessage={sendMessage}
        onAction={sendAction}
        onMoveClick={() => setShowLocationModal(true)}
        isStreaming={isStreaming}
        dialogueOptions={dialogueOptions}
        onOptionClick={(opt) => {
          setInputMessage(opt);
          setDialogueOptions([]);
        }}
      />

      {/* 알림 토스트 (자동) */}
      <NotificationToastStack
        notifications={notifications}
        onClick={handleNotificationClick}
      />

      {/* 알림 패널 (수동 열기) */}
      <AnimatePresence>
        {showNotificationPanel && (
          <NotificationPanel
            notifications={notifications}
            onClose={() => setShowNotificationPanel(false)}
            onItemClick={handleNotificationClick}
          />
        )}
      </AnimatePresence>

      {/* 캐릭터 패널 */}
      <AnimatePresence>
        {showCharacterPanel && (
          <CharacterPanel
            room={room}
            onClose={() => setShowCharacterPanel(false)}
          />
        )}
      </AnimatePresence>

      {/* 장소 이동 모달 */}
      <AnimatePresence>
        {showLocationModal && (
          <LocationMoveModal
            currentLocationKey={room.currentUserLocationKey}
            worldId={room.worldId}
            onClose={() => setShowLocationModal(false)}
            onMove={handleLocationMove}
          />
        )}
      </AnimatePresence>

      {/* 초기화 모달 */}
      <AnimatePresence>
        {showResetModal && (
          <ResetModal
            onCancel={() => setShowResetModal(false)}
            onConfirm={handleResetStory}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Header
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function Header({ room, notificationCount, onBack, onShowNotifications, onShowCharacters, onShowReset }) {
  const dayPartKR = {
    MORNING: "아침", NOON: "정오", AFTERNOON: "오후", EVENING: "저녁", NIGHT: "밤",
  }[room.currentDayPart] || "?";

  return (
    <header className="fixed top-0 inset-x-0 z-30 px-4 sm:px-6 py-3 bg-gradient-to-b from-black/70 to-transparent backdrop-blur-sm">
      <div className="flex items-center justify-between max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-1.5 hover:bg-white/10 rounded transition">
            <ArrowLeft size={20} />
          </button>
          <div className="ml-1">
            <div className="text-sm font-medium">{room.worldDisplayName}</div>
            <div className="text-xs text-stone-400 flex items-center gap-1.5">
              <Clock size={11} /> {room.currentDay}일차 · {dayPartKR}
              <span className="mx-1">·</span>
              <MapPin size={11} /> {room.currentUserLocationDisplayName}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onShowCharacters}
            className="p-2 hover:bg-white/10 rounded transition"
            aria-label="히로인 패널"
          >
            <Users size={18} />
          </button>
          <button
            onClick={onShowNotifications}
            className="relative p-2 hover:bg-white/10 rounded transition"
            aria-label="알림"
          >
            <Bell size={18} />
            {notificationCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-400 rounded-full" />
            )}
          </button>
          <button
            onClick={onShowReset}
            className="p-2 hover:bg-white/10 rounded transition"
            aria-label="초기화"
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Scene Card (씬 표시)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function SceneCard({ scene, faded }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: faded ? 0.4 : 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`mb-5 ${faded ? "" : "scale-100"}`}
    >
      {/* 화자 */}
      {scene.speaker && (
        <div className="text-amber-300 text-sm font-medium mb-1">{scene.speaker}</div>
      )}
      {/* Narration */}
      {scene.narration && (
        <p className="text-stone-300 leading-relaxed whitespace-pre-wrap">{scene.narration}</p>
      )}
      {/* Dialogue */}
      {scene.dialogue && (
        <p className="text-white leading-relaxed mt-2 italic">"{scene.dialogue}"</p>
      )}
    </motion.div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  BottomBar — 입력 + 4 액션 + dialogue_options
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function BottomBar({
  inputMessage, setInputMessage, onSendMessage,
  onAction, onMoveClick, isStreaming,
  dialogueOptions, onOptionClick,
}) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-30 px-4 sm:px-6 pb-4 pt-3 bg-gradient-to-t from-black via-black/90 to-transparent">
      <div className="max-w-4xl mx-auto space-y-2">
        {/* dialogue_options (LLM 자율 — 노출 시) */}
        {dialogueOptions.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {dialogueOptions.map((opt, i) => (
              <button
                key={i}
                onClick={() => onOptionClick(opt)}
                disabled={isStreaming}
                className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-400/30 rounded text-sm disabled:opacity-40 transition"
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {/* 4 액션 버튼 */}
        <div className="flex gap-2 text-xs">
          <ActionButton onClick={() => onAction("NEXT_SCENE")} disabled={isStreaming}>
            <Forward size={14} /> 다음 씬
          </ActionButton>
          <ActionButton onClick={() => onAction("TIME_ADVANCE")} disabled={isStreaming}>
            <Clock size={14} /> 시간 진전
          </ActionButton>
          <ActionButton onClick={onMoveClick} disabled={isStreaming}>
            <MapPin size={14} /> 장소 이동
          </ActionButton>
        </div>

        {/* 입력 */}
        <div className="flex gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSendMessage();
              }
            }}
            disabled={isStreaming}
            placeholder={isStreaming ? "응답 중..." : "행동/대사 입력..."}
            className="flex-1 bg-stone-900/80 backdrop-blur border border-stone-700 rounded-full px-4 py-2.5 text-white placeholder:text-stone-500 focus:outline-none focus:border-amber-400 disabled:opacity-50"
          />
          <button
            onClick={onSendMessage}
            disabled={isStreaming || !inputMessage.trim()}
            className="p-2.5 bg-amber-500 hover:bg-amber-400 text-black rounded-full disabled:opacity-30 transition"
            aria-label="전송"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ActionButton({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1 px-3 py-1.5 bg-stone-800/80 hover:bg-stone-700 text-stone-300 rounded-full border border-stone-700 disabled:opacity-30 transition"
    >
      {children}
    </button>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Notification Toast Stack (자동 노출)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function NotificationToastStack({ notifications, onClick }) {
  // 최신 3개만 토스트
  const recent = notifications.slice(0, 3);
  return (
    <div className="fixed top-20 right-4 z-40 flex flex-col gap-2 max-w-xs">
      <AnimatePresence>
        {recent.map((n) => (
          <motion.button
            key={n.notificationId}
            onClick={() => onClick(n)}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className="bg-amber-500/20 backdrop-blur-sm border border-amber-400/40 rounded-lg p-3 text-left hover:bg-amber-500/30 transition"
          >
            <div className="text-xs text-amber-300 mb-1">📮 {n.fromCharacterName}</div>
            <div className="text-sm text-white line-clamp-2">{n.content}</div>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Notification Panel (수동 열기)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function NotificationPanel({ notifications, onClose, onItemClick }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-stone-900 rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto"
      >
        <div className="px-5 py-4 border-b border-stone-700 flex items-center justify-between">
          <h3 className="font-bold text-amber-200">알림 ({notifications.length})</h3>
          <button onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="p-4">
          {notifications.length === 0 ? (
            <p className="text-center text-stone-500 py-8">새 알림이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => (
                <button
                  key={n.notificationId}
                  onClick={() => {
                    onItemClick(n);
                    onClose();
                  }}
                  className="block w-full text-left p-3 bg-stone-800 hover:bg-stone-700 rounded transition"
                >
                  <div className="text-xs text-amber-300 mb-1">
                    {n.fromCharacterName} · {n.worldDay}일차 {n.worldDayPart}
                  </div>
                  <div className="text-sm">{n.content}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Character Panel (멀티 히로인 표시)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function CharacterPanel({ room, onClose }) {
  const presenceByCharId = {};
  for (const p of (room.presences || [])) presenceByCharId[p.characterId] = p;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-stone-900 rounded-lg max-w-2xl w-full max-h-[85vh] overflow-y-auto"
      >
        <div className="px-5 py-4 border-b border-stone-700 flex items-center justify-between">
          <h3 className="font-bold text-amber-200">히로인 상태</h3>
          <button onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {room.heroines?.map((h) => {
            const presence = presenceByCharId[h.characterId];
            const isHere = presence?.currentLocationKey === room.currentUserLocationKey;
            return (
              <div
                key={h.characterId}
                className={`flex gap-4 p-3 rounded-lg ${
                  isHere ? "bg-amber-500/10 border border-amber-400/30" : "bg-stone-800"
                }`}
              >
                {h.profileImageUrl && (
                  <img
                    src={h.profileImageUrl}
                    alt={h.name}
                    className="w-16 h-16 rounded-full object-cover flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white flex items-center gap-2">
                    {h.name}
                    {isHere && <span className="text-[10px] bg-amber-500 text-black px-1.5 rounded">여기</span>}
                  </div>
                  <div className="text-xs text-stone-400 mt-1">
                    {h.dynamicRelationTag || "(관계 미정의)"} · BPM {h.currentBpm}
                  </div>
                  <div className="text-xs text-stone-500 mt-1">
                    호감도 {h.statAffection} · 친밀도 {h.statIntimacy} · 신뢰 {h.statTrust}
                  </div>
                  {!isHere && presence && (
                    <div className="text-xs text-stone-500 mt-1.5 flex items-center gap-1">
                      <MapPin size={10} /> {presence.currentLocationDisplayName}
                    </div>
                  )}
                  {h.thoughtUnlocked && h.characterThought && (
                    <div className="text-xs italic text-purple-300 mt-2 line-clamp-2">
                      💭 {h.characterThought}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Location Move Modal
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function LocationMoveModal({ currentLocationKey, worldId, onClose, onMove }) {
  // [TODO Phase 7] 정적 location 풀을 별도 API로 캐싱.
  // 현재는 fetchCreateContext를 재사용 — 다소 무거우나 작동.
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import("../api/StoryV2Api")
      .then(({ fetchCreateContext }) => fetchCreateContext(worldId))
      .then((ctx) => setLocations(ctx.startLocations || []))
      .catch((e) => console.warn("[V2-Chat] locations load failed", e))
      .finally(() => setLoading(false));
  }, [worldId]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-stone-900 rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto"
      >
        <div className="px-5 py-4 border-b border-stone-700 flex items-center justify-between">
          <h3 className="font-bold text-amber-200 flex items-center gap-2">
            <MapPin size={18} /> 어디로 이동할까요?
          </h3>
          <button onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="p-4 space-y-2">
          {loading && <p className="text-stone-500 text-center py-4">로딩 중...</p>}
          {locations.map((l) => {
            const isCurrent = l.locationKey === currentLocationKey;
            return (
              <button
                key={l.locationKey}
                disabled={isCurrent}
                onClick={() => onMove(l.locationKey)}
                className={`block w-full text-left p-3 rounded transition ${
                  isCurrent
                    ? "bg-stone-700/50 opacity-50 cursor-default"
                    : "bg-stone-800 hover:bg-stone-700"
                }`}
              >
                <div className="font-medium text-white flex items-center justify-between">
                  {l.displayName}
                  {isCurrent && <span className="text-xs text-amber-300">(현재)</span>}
                </div>
                {l.description && (
                  <div className="text-xs text-stone-500 mt-1">{l.description}</div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Reset Modal — 페르소나 옵션
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ResetModal({ onCancel, onConfirm }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-stone-900 rounded-lg max-w-md w-full p-5"
      >
        <h3 className="font-bold text-amber-200 mb-3">스토리 초기화</h3>
        <p className="text-sm text-stone-400 mb-1">
          현재 진행 중인 스토리를 초기화합니다. 모든 누적 기억, 호감도, 시간 진행이 사라집니다.
        </p>
        <p className="text-sm text-stone-500 mb-5">페르소나 처리를 선택하세요:</p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onConfirm(false)}
            className="p-3 bg-stone-800 hover:bg-stone-700 rounded text-left transition"
          >
            <div className="font-medium text-white">스토리만 초기화</div>
            <div className="text-xs text-stone-400 mt-0.5">페르소나는 유지됩니다.</div>
          </button>
          <button
            onClick={() => onConfirm(true)}
            className="p-3 bg-stone-800 hover:bg-stone-700 rounded text-left transition"
          >
            <div className="font-medium text-white">스토리 + 페르소나 초기화</div>
            <div className="text-xs text-stone-400 mt-0.5">완전히 새로 시작합니다.</div>
          </button>
          <button
            onClick={onCancel}
            className="p-3 mt-2 text-stone-400 hover:bg-stone-800 rounded transition"
          >
            취소
          </button>
        </div>
      </div>
    </motion.div>
  );
}