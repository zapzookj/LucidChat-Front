import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Drama, Crown, Heart, Home } from "lucide-react";

// 기존 프로젝트 에셋 재활용
import BackgroundDisplay from "../components/BackgroundDisplay";
import CharacterDisplay from "../components/CharacterDisplay";
import AudioEngine from "../components/AudioEngine";

// Theater 전용 컴포넌트
import TheaterDialogueBox from "../components/theater/TheaterDialogueBox";
import TheaterCinematicLoader from "../components/theater/TheaterCinematicLoader";
import TheaterSceneHistoryPanel from "../components/theater/TheaterSceneHistoryPanel";
import TheaterChapterReportModal from "../components/theater/TheaterChapterReportModal";
import TheaterBranchModal from "../components/theater/TheaterBranchModal";

import { fetchTheaterRoom } from "../api/TheaterLobbyApi";
import { updatePlaySettings } from "../api/TheaterPlayApi";
import {
  fetchLocationBranch, fetchSceneBranch, confirmBranchChoice
} from "../api/TheaterGameplayApi";
import useTheaterStream from "../hooks/useTheaterStream";
import api from "../api/axios";

/**
 * [Phase 5.5-Theater-Polish] TheaterPlayPage v2 — 비주얼 노벨 완성판
 *
 * 해결된 이슈:
 *  #1 나레이션/대사 순차 출력 — TheaterDialogueBox의 useSequentialTypewriter
 *  #2 비주얼 노벨 에셋 — BackgroundDisplay/CharacterDisplay/AudioEngine 통합
 *  #3 클릭 영역 제한 — 배경 레이어에는 onClick 없음, '다음' 버튼에만 연결
 *  #5 로딩 레이턴시 마스킹 — TheaterCinematicLoader 풀스크린 오버레이
 *  #4 이전 버튼 / 대화 기록 — TheaterDialogueBox + TheaterSceneHistoryPanel
 *
 * 레이어 구조 (z-index 기준):
 *  0   : BackgroundDisplay (Scene의 location/time)
 *  0   : CharacterDisplay  (speakerType=HEROINE일 때만 emotion 반영)
 *  비시각: AudioEngine      (Scene의 bgmMode/location/time 반영)
 *  20  : 상단 HUD (Back, Progress, Heroine 상태)
 *  30  : TheaterDialogueBox (하단 텍스트 박스)
 *  60  : Loader / 분기 모달 / Chapter 리포트 / History 패널
 */

const AUTO_ADVANCE_MS = { SLOW: 6500, NORMAL: 4500, FAST: 2500 };

export default function TheaterPlayPage() {
  const { roomId } = useParams();
  const numericRoomId = Number(roomId);
  const navigate = useNavigate();

  // ─── 방 정보 + 세션 상태 ───
  const [roomInfo, setRoomInfo] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [bgmMuted, setBgmMuted] = useState(false);

  // ─── 플레이 설정 ───
  const [playSpeed, setPlaySpeed] = useState("NORMAL");
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true);

  // ─── 씬 재생 상태 ───
  const [typingDone, setTypingDone] = useState(false);
  const autoAdvanceTimerRef = useRef(null);

  // ─── 모달 상태 ───
  const [chapterReport, setChapterReport] = useState(null);
  const [branchModalData, setBranchModalData] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [locationBranchRequested, setLocationBranchRequested] = useState(false);

  // ─── 이전 씬 네비게이션 (배치 밖으로 나갈 때 사용) ───
  const [historicalScenes, setHistoricalScenes] = useState([]); // recent API 결과
  const [historyViewIndex, setHistoryViewIndex] = useState(null); // null = 현재 라이브

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  1. 방 정보 로드
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const info = await fetchTheaterRoom(numericRoomId);
        if (!alive) return;
        setRoomInfo(info);
        if (info.playSettings) {
          setPlaySpeed(info.playSettings.playSpeed || "NORMAL");
          setAutoPlayEnabled(info.playSettings.autoPlayEnabled ?? true);
        }
      } catch (e) {
        if (alive) setLoadError(e?.response?.data?.message || "방 정보를 불러오지 못했습니다.");
      }
    })();
    return () => { alive = false; };
  }, [numericRoomId]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  2. 스트림 훅
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const {
    currentBatch, currentSceneIndex, currentScene,
    loadingNext, chapterEnding,
    nextScene, goToBatchScene, resumeAfterChapter, reloadBatch,
  } = useTheaterStream({
    roomId: numericRoomId,
    autoStart: !!roomInfo && !roomInfo.endingReached && !roomInfo.progress?.inIntermission,
    onChapterEnd: (report) => setChapterReport(report),
    onBranchReady: async (branchSignal) => {
      try {
        const options = await fetchSceneBranch(
          numericRoomId, branchSignal.level, branchSignal.contextSummary
        );
        setBranchModalData({ options, isLocation: false });
      } catch (e) {
        console.error("[Theater] branch fetch failed:", e);
      }
    },
    onError: (e) => console.error("[Theater] Stream error:", e),
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  3. 장소 선택 분기 자동 트리거 (멀티 히로인 + Chapter 초입)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  useEffect(() => {
    if (!roomInfo || !currentBatch) return;
    if (locationBranchRequested) return;
    if (roomInfo.heroines?.length < 2) return;
    const progress = roomInfo.progress;
    if (!progress || progress.currentAct > 3) return;
    if (currentBatch.batchId !== 0 || currentSceneIndex !== 0) return;

    (async () => {
      try {
        setLocationBranchRequested(true);
        const options = await fetchLocationBranch(numericRoomId);
        setBranchModalData({ options, isLocation: true });
      } catch (e) {
        console.debug("[Theater] location branch skipped:", e?.message);
      }
    })();
  }, [roomInfo, currentBatch, currentSceneIndex, locationBranchRequested, numericRoomId]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  4. 씬 인덱스 변경 시 타이핑 상태 리셋
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  useEffect(() => {
    setTypingDone(false);
    // 히스토리 뷰를 라이브로 복귀
    if (historyViewIndex !== null) setHistoryViewIndex(null);
  }, [currentSceneIndex, currentBatch?.batchId]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  5. 자동 재생
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  useEffect(() => {
    if (!autoPlayEnabled || !typingDone) return;
    if (loadingNext || chapterEnding) return;
    if (chapterReport || branchModalData || historyOpen) return;
    if (historyViewIndex !== null) return; // 이전 보기 중엔 자동 진행 안 함

    const delay = AUTO_ADVANCE_MS[playSpeed] || AUTO_ADVANCE_MS.NORMAL;
    autoAdvanceTimerRef.current = setTimeout(() => {
      nextScene();
    }, delay);
    return () => {
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    };
  }, [
    typingDone, autoPlayEnabled, playSpeed, loadingNext,
    chapterEnding, chapterReport, branchModalData, historyOpen,
    historyViewIndex, nextScene
  ]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  6. 재생 설정 업데이트
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const handleSpeedChange = useCallback(async (s) => {
    setPlaySpeed(s);
    try { await updatePlaySettings(numericRoomId, { autoPlayEnabled, playSpeed: s }); } catch {}
  }, [numericRoomId, autoPlayEnabled]);

  const handleToggleAutoPlay = useCallback(async () => {
    const next = !autoPlayEnabled;
    setAutoPlayEnabled(next);
    try { await updatePlaySettings(numericRoomId, { autoPlayEnabled: next, playSpeed }); } catch {}
  }, [autoPlayEnabled, playSpeed, numericRoomId]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  7. 이전 / 다음 씬 네비게이션
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const handlePrevScene = useCallback(async () => {
    // Case 1: 현재 배치 내에서 이전 씬 이동
    if (historyViewIndex !== null) {
      // 이미 history 뷰 중
      if (historyViewIndex > 0) {
        setHistoryViewIndex(historyViewIndex - 1);
      }
      return;
    }

    if (currentSceneIndex > 0) {
      goToBatchScene(currentSceneIndex - 1);
      return;
    }

    // Case 2: 배치의 첫 씬 → 이전 배치 씬 로드
    try {
      const recent = await api.get(
        `/theater/rooms/${numericRoomId}/scene-history/recent?count=20`
      );
      const list = recent.data || [];
      // 현재 배치보다 이전 씬만 필터 (현재 배치의 첫 씬 이전)
      const beforeCurrent = list.filter(s =>
        s.batchId < (currentBatch?.batchId || 0) ||
        (s.batchId === (currentBatch?.batchId || 0) && s.sceneIndexInBatch < currentSceneIndex)
      );
      if (beforeCurrent.length > 0) {
        setHistoricalScenes(beforeCurrent);
        setHistoryViewIndex(beforeCurrent.length - 1);
      }
    } catch (e) {
      console.debug("[Theater] no previous scenes");
    }
  }, [currentSceneIndex, currentBatch, historyViewIndex, numericRoomId, goToBatchScene]);

  const handleNextScene = useCallback(() => {
    // 이전 보기 중이면 한 칸씩 복귀
    if (historyViewIndex !== null) {
      if (historyViewIndex < historicalScenes.length - 1) {
        setHistoryViewIndex(historyViewIndex + 1);
      } else {
        // 라이브로 복귀
        setHistoryViewIndex(null);
      }
      return;
    }
    nextScene();
  }, [historyViewIndex, historicalScenes.length, nextScene]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  8. 분기 확정
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const handleBranchConfirm = useCallback(async (chosenIndex) => {
    if (!branchModalData) return;
    try {
      await confirmBranchChoice(numericRoomId, {
        level: branchModalData.options.branchLevel,
        chosenIndex,
        branchToken: branchModalData.options.branchToken || null,
        optionsSnapshot: branchModalData.options.options,
      });
      setBranchModalData(null);
      reloadBatch();
    } catch (e) {
      console.error("[Theater] Branch confirm failed:", e);
    }
  }, [branchModalData, numericRoomId, reloadBatch]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  9. Chapter 종료 닫기
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const handleChapterReportClose = useCallback(() => {
    const report = chapterReport;
    setChapterReport(null);
    setLocationBranchRequested(false);
    if (report?.leadsToIntermission) {
      navigate(`/theater/${numericRoomId}/intermission`);
      return;
    }
    resumeAfterChapter();
  }, [chapterReport, resumeAfterChapter, navigate, numericRoomId]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  10. 표시할 씬 결정 — 현재 라이브 vs 이전 보기
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const displayedScene = useMemo(() => {
    if (historyViewIndex !== null && historicalScenes[historyViewIndex]) {
      const h = historicalScenes[historyViewIndex];
      return {
        narration: h.narration,
        innerNarration: h.innerNarration,
        dialogue: h.dialogue,
        speakerType: h.speakerType,
        speakerName: h.speakerName,
        emotion: h.emotion,
        location: h.location,
        time: h.timeOfDay,
        outfit: h.outfit,
        bgmMode: h.bgmMode,
        heroineId: h.heroineId,
      };
    }
    return currentScene;
  }, [historyViewIndex, historicalScenes, currentScene]);

  // 현재 화자 히로인 정보 결정
  const activeHeroine = useMemo(() => {
    if (!roomInfo || !displayedScene) return null;
    // 1. displayedScene의 heroineId 우선
    if (displayedScene.heroineId) {
      return roomInfo.heroines?.find(h => h.characterId === displayedScene.heroineId);
    }
    // 2. currentBatch의 speaker
    if (currentBatch?.speakerHeroineId) {
      return roomInfo.heroines?.find(h => h.characterId === currentBatch.speakerHeroineId);
    }
    // 3. 리드 히로인 (최상위 호감도)
    return roomInfo.heroines?.[0] || null;
  }, [roomInfo, displayedScene, currentBatch]);

  const leadHeroine = useMemo(() => {
    if (!roomInfo?.heroines?.length) return null;
    return [...roomInfo.heroines].sort(
      (a, b) => (b.affection ?? 0) - (a.affection ?? 0)
    )[0];
  }, [roomInfo]);

  // 히로인이 말하고 있을 때만 CharacterDisplay 활성화
  const isHeroineSpeaking = displayedScene?.speakerType === "HEROINE"
    || (displayedScene?.speakerName && roomInfo?.heroines?.some(h => h.name === displayedScene.speakerName));

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  로딩 / 에러 처리
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center px-4">
        <p className="text-red-300 mb-4">{loadError}</p>
        <button
          onClick={() => navigate("/lobby")}
          className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"
        >
          <Home size={14} className="inline mr-1" /> 로비로
        </button>
      </div>
    );
  }

  if (!roomInfo) {
    return <TheaterCinematicLoader visible message="극장 준비 중…" variant="reel" />;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  렌더
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  return (
    <div
      className="relative min-h-screen w-full bg-slate-950 overflow-hidden select-none"
      // ⚠️ 최상위 div에 onClick 두지 않음 (이슈 #3 해결)
    >
      {/* ═══ 1. 배경 ═══ */}
      <BackgroundDisplay
        location={displayedScene?.location || "ENTRANCE"}
        time={displayedScene?.time || "NIGHT"}
        characterSlug={activeHeroine?.characterSlug || leadHeroine?.characterSlug || "airi"}
        dynamicBackgroundUrl={null}
      />

      {/* ═══ 2. 오디오 엔진 ═══ */}
      <AudioEngine
        bgmMode={displayedScene?.bgmMode || "DAILY"}
        location={displayedScene?.location || "ENTRANCE"}
        time={displayedScene?.time || "NIGHT"}
        masterVolume={0.4}
        isMuted={bgmMuted}
        characterSlug={activeHeroine?.characterSlug || leadHeroine?.characterSlug || "airi"}
      />

      {/* ═══ 3. 캐릭터 (히로인 대사 시에만 활성) ═══ */}
      <div className="absolute inset-0 z-0">
        {activeHeroine && (
          <CharacterDisplay
            key={activeHeroine.characterSlug}
            emotion={isHeroineSpeaking ? (displayedScene?.emotion || "NEUTRAL") : "NEUTRAL"}
            outfit={displayedScene?.outfit || activeHeroine.defaultOutfit || "MAID"}
            characterSlug={activeHeroine.characterSlug}
            defaultOutfit={activeHeroine.defaultOutfit}
            npcSpeaker={null}
            isNpcActive={false}
          />
        )}
      </div>

      {/* ═══ 4. 상단 HUD ═══ */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4 flex items-start justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={(e) => { e.stopPropagation(); navigate("/lobby"); }}
            className="p-2 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white/70 hover:text-white"
          >
            <ArrowLeft size={14} />
          </button>
          <div className="bg-black/50 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/10">
            <div className="flex items-center gap-2 text-xs">
              <Drama size={11} className="text-indigo-300" />
              <span className="text-white/80 font-bold">{roomInfo.worldDisplayName}</span>
              <span className="text-white/30">·</span>
              <span className="text-white/50">
                Act {roomInfo.progress?.currentAct} / Ch {roomInfo.progress?.currentChapter}
              </span>
              {historyViewIndex !== null && (
                <>
                  <span className="text-white/30">·</span>
                  <span className="text-amber-300/80 text-[10px] uppercase tracking-wider">
                    이전 보기
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 히로인 멀티 HUD (멀티만 표시) */}
        {roomInfo.heroines?.length > 1 && (
          <div className="flex flex-col gap-1.5 pointer-events-auto">
            {roomInfo.heroines.map((h) => {
              const isActive = h.characterId === (activeHeroine?.characterId);
              return (
                <motion.div
                  key={h.characterId}
                  animate={{ scale: isActive ? 1.03 : 1 }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-md border ${
                    isActive
                      ? "bg-rose-500/20 border-rose-400/50"
                      : "bg-black/40 border-white/10"
                  }`}
                >
                  <div
                    className="w-5 h-5 rounded-full bg-cover bg-center"
                    style={{
                      backgroundImage: h.thumbnailUrl ? `url(${h.thumbnailUrl})` : "none",
                      backgroundColor: "#4c1d95",
                    }}
                  />
                  <span className={`text-[10px] font-bold ${isActive ? "text-rose-100" : "text-white/60"}`}>
                    {h.name}
                  </span>
                  <Heart size={8} className={isActive ? "text-rose-300" : "text-white/40"} fill="currentColor" />
                  <span className={`text-[9px] ${isActive ? "text-rose-200" : "text-white/50"}`}>
                    {h.affection}
                  </span>
                  {h.confirmedMain && <Crown size={9} className="text-amber-300" />}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ 5. 하단 Dialogue Box ═══ */}
      <AnimatePresence mode="wait">
        {displayedScene && (
          <motion.div
            key={`${currentBatch?.batchId || 0}-${currentSceneIndex}-${historyViewIndex ?? "live"}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.3 }}
          >
            <TheaterDialogueBox
              scene={displayedScene}
              avatarName={roomInfo.avatarName || "주인공"}
              playSpeed={playSpeed}
              onSpeedChange={handleSpeedChange}
              autoPlayEnabled={autoPlayEnabled}
              onToggleAutoPlay={handleToggleAutoPlay}
              onPrevScene={handlePrevScene}
              onNextScene={handleNextScene}
              canGoPrev={
                (historyViewIndex !== null && historyViewIndex > 0) ||
                (historyViewIndex === null && currentSceneIndex > 0) ||
                (historyViewIndex === null && currentSceneIndex === 0 && (currentBatch?.batchId || 0) > 0)
              }
              canGoNext={!loadingNext && !chapterEnding}
              loadingNext={loadingNext || chapterEnding}
              onOpenHistory={() => setHistoryOpen(true)}
              sceneIndexInBatch={currentSceneIndex}
              sceneCountInBatch={currentBatch?.scenes?.length || 1}
              leadHeroineName={leadHeroine?.name}
              leadHeroineAffection={leadHeroine?.affection}
              onTypingDone={() => setTypingDone(true)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ 6. 로딩 오버레이 (이슈 #5) ═══ */}
      <AnimatePresence>
        {(loadingNext || chapterEnding) && !displayedScene && (
          <TheaterCinematicLoader
            visible
            message={chapterEnding ? "Chapter를 마무리하는 중…" : "다음 장면을 그리는 중…"}
            variant="reel"
          />
        )}
      </AnimatePresence>

      {/* 배치 전환 중 미니 로더 (씬은 이미 보이고 있지만 다음 배치 로딩) */}
      <AnimatePresence>
        {loadingNext && displayedScene && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute top-20 left-1/2 -translate-x-1/2 z-[55] flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-full border border-white/10"
          >
            <motion.div
              className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
            />
            <span className="text-[10px] text-white/70 tracking-wide">다음 장면 준비 중…</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ 7. 모달들 ═══ */}
      <AnimatePresence>
        {branchModalData && (
          <TheaterBranchModal
            branchOptions={branchModalData.options}
            onConfirm={handleBranchConfirm}
            onCancel={null}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {chapterReport && (
          <TheaterChapterReportModal
            report={chapterReport}
            onClose={handleChapterReportClose}
            currentAct={roomInfo.progress?.currentAct}
            actTotalChapters={roomInfo.progress?.actTotalChapters || 5}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {historyOpen && (
          <TheaterSceneHistoryPanel
            roomId={numericRoomId}
            visible={historyOpen}
            onClose={() => setHistoryOpen(false)}
            currentAct={roomInfo.progress?.currentAct || 1}
            currentChapter={roomInfo.progress?.currentChapter || 1}
            avatarName={roomInfo.avatarName || "주인공"}
          />
        )}
      </AnimatePresence>
    </div>
  );
}