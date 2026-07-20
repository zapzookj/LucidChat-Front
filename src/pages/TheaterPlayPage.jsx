import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Drama, Crown, Heart, Home, BookOpen, Save } from "lucide-react";

// 기존 프로젝트 에셋 재활용
import BackgroundDisplay from "../components/BackgroundDisplay";
import CharacterDisplay from "../components/CharacterDisplay";
import HelpButton from "../components/HelpButton";
import AudioEngine from "../components/AudioEngine";

// Theater 전용 컴포넌트
import TheaterDialogueBox from "../components/theater/TheaterDialogueBox";
import TheaterCinematicLoader from "../components/theater/TheaterCinematicLoader";
import TheaterSceneHistoryPanel from "../components/theater/TheaterSceneHistoryPanel";
import TheaterChapterReportModal from "../components/theater/TheaterChapterReportModal";
import TheaterBranchModal from "../components/theater/TheaterBranchModal";
// [Phase 5.5 UX Polish · R3] 감독 명령어 + 이야기 다이어리로 두 패널 분리
import TheaterDirectorCommandPanel from "../components/theater/TheaterDirectorCommandPanel";
import TheaterDiaryPanel from "../components/theater/TheaterDiaryPanel";
import TheaterSaveLoadPanel from "../components/theater/TheaterSaveLoadPanel";

// [Phase B · 단계1] 모바일 세로 레이아웃 (additive)
import useDeviceProfile from "../hooks/useDeviceProfile";
import TheaterMobileTopBar from "../components/theater/mobile/TheaterMobileTopBar";
import TheaterMenuSheet from "../components/theater/mobile/TheaterMenuSheet";
import TheaterAffinitySheet from "../components/theater/mobile/TheaterAffinitySheet";
import TheaterPlaybackSheet from "../components/theater/mobile/TheaterPlaybackSheet";

import { fetchTheaterRoom } from "../api/TheaterLobbyApi";
import { updatePlaySettings } from "../api/TheaterPlayApi";
import {
  fetchLocationBranch, fetchSceneBranch, confirmBranchChoice
} from "../api/TheaterGamePlayApi";
import useTheaterStream from "../hooks/useTheaterStream";
import api from "../api/axios";
import { sfx } from "../utils/sfx";

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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  [Phase III · A-1] Act 진행 도트
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Chapter 진행을 도트로 시각화 (● ● ◉ ○ ○ — 완료/현재/남음).
//  텍스트만 있는 "Ch 3"보다 호흡감이 즉각 전달된다.
//
const ActProgressDots = ({ currentChapter, totalChapters }) => {
  const total = Math.max(1, totalChapters || 5);
  const current = Math.max(1, Math.min(total, currentChapter || 1));
  return (
    <div className="flex items-center gap-1 ml-0.5" aria-label={`Chapter ${current} / ${total}`}>
      {Array.from({ length: total }).map((_, i) => {
        const idx = i + 1;
        let cls = "w-1 h-1 rounded-full transition-all duration-300";
        if (idx < current) cls += " bg-violet-300/85";
        else if (idx === current) cls += " bg-violet-200 w-1.5 h-1.5 shadow-[0_0_6px_rgba(199,210,254,0.7)]";
        else cls += " bg-white/15";
        return <span key={i} className={cls} />;
      })}
    </div>
  );
};

export default function TheaterPlayPage() {
  const { roomId } = useParams();
  const numericRoomId = Number(roomId);
  const navigate = useNavigate();

  // [Phase B · 단계1] 폼팩터 프로필 + 모바일 전용 시트 UI 상태
  // (순수 프리젠테이션 — 스트림/데이터/씬 로직에는 관여하지 않음)
  const { isMobile } = useDeviceProfile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [affinityOpen, setAffinityOpen] = useState(false);
  const [playbackOpen, setPlaybackOpen] = useState(false);

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
  // [Phase 5.5 UX Polish · R3] 감독 명령어 + 이야기 다이어리 (분리된 두 패널)
  // - commandOpen : 좌측 — 유저 입력 명령어 (다음 배치 환경 주입)
  // - diaryOpen   : 우측 — 자동 캡처 노트들 (사진첩)
  const [commandOpen, setCommandOpen] = useState(false);
  const [diaryOpen, setDiaryOpen] = useState(false);
  const [saveLoadOpen, setSaveLoadOpen] = useState(false);

  // [Polish · P2 #5] 다이어리/세이브 버튼 onboarding 라벨 노출.
  //   첫 진입 후 ~5초 간은 라벨이 자동으로 펼쳐져 있어 발견율↑.
  //   이후엔 hover로만 펼쳐짐.
  const [hudHintVisible, setHudHintVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setHudHintVisible(false), 5500);
    return () => clearTimeout(t);
  }, []);

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
    // [Polish · P1 #7] LOCATION choice 선행 시 batch 자동 진입 차단.
    //   기존 버그: 멀티 히로인 + 새 Chapter 진입 시 LOCATION 모달과 batch 0이 병렬 트리거 →
    //              유저 선택 후 invalidate → batch 0 재생성 → LLM 비용 2배.
    //   Fix: requiresLocationChoice가 true면 autoStart=false → batch 요청 보류.
    //        유저가 LOCATION 분기 확정하면 백엔드가 플래그를 false로 만들고,
    //        프론트가 roomInfo를 refetch하여 autoStart=true로 전환되며 batch 진입.
    autoStart: !!roomInfo
      && !roomInfo.endingReached
      && !roomInfo.progress?.inIntermission
      && !roomInfo.progress?.requiresLocationChoice,
    onChapterEnd: (report) => setChapterReport(report),
    onBranchReady: async (branchSignal, prefetchedPromise) => {
      // [Polish · P2 #1.2] prefetch된 분기 옵션 활용.
      //   useTheaterStream이 currentBatch 도착 시 백그라운드에서 fetchSceneBranch를
      //   미리 호출해 두므로, 마지막 씬 도달 시점엔 이미 응답이 와 있거나(거의) 도착 직전.
      //   유저는 마지막 씬 → 다음 클릭 즉시 분기 모달을 본다.
      //   prefetch 실패 / 누락 시 fallback으로 동기 호출.
      try {
        let options;
        if (prefetchedPromise) {
          options = await prefetchedPromise;
        }
        if (!options) {
          // fallback: prefetch가 실패했거나 도달 못 한 경우
          options = await fetchSceneBranch(
            numericRoomId, branchSignal.level, branchSignal.contextSummary
          );
        }
        setBranchModalData({ options, isLocation: false });
      } catch (e) {
        console.error("[Theater] branch fetch failed:", e);
      }
    },
    onError: (e) => console.error("[Theater] Stream error:", e),
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  3. 장소 선택 분기 자동 트리거 (멀티 히로인 + 새 Chapter 진입)
  //
  //  [Polish · P1 #7] 트리거 조건을 백엔드의 progress.requiresLocationChoice로 통일.
  //    기존엔 currentBatch가 set된 후 batchId/sceneIndex로 추정했는데, 이는
  //    "batch 먼저 생성 → 모달 트리거"를 의미해서 LLM 비용 2배 버그의 원인이었다.
  //    이제 batch는 모달 확정 후에만 생성되며, 모달 자체는 백엔드 플래그를 보고
  //    즉시 트리거. branchModalData가 이미 떠있거나 타 모달이 열린 상태면 skip.
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  useEffect(() => {
    if (!roomInfo) return;
    if (!roomInfo.progress?.requiresLocationChoice) return;
    if (locationBranchRequested) return;
    if (branchModalData) return;
    if (chapterReport) return;

    (async () => {
      try {
        setLocationBranchRequested(true);
        const options = await fetchLocationBranch(numericRoomId);
        setBranchModalData({ options, isLocation: true });
      } catch (e) {
        console.debug("[Theater] location branch skipped:", e?.message);
        // 트리거 실패 시 다음 useEffect 사이클에서 재시도 가능하도록 플래그 해제
        setLocationBranchRequested(false);
      }
    })();
  }, [roomInfo, locationBranchRequested, branchModalData, chapterReport, numericRoomId]);

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
    // [Phase 5.5 UX Polish · R3] 감독 명령어/다이어리 패널이 열린 동안에도 자동 진행 일시정지
    if (commandOpen || diaryOpen || saveLoadOpen) return;
    // [Phase B · 단계1] 모바일 시트(메뉴/호감도/재생 설정)가 열린 동안에도 일시정지
    if (mobileMenuOpen || affinityOpen || playbackOpen) return;
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
    commandOpen, diaryOpen, saveLoadOpen,
    mobileMenuOpen, affinityOpen, playbackOpen,
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
    const wasLocationChoice = branchModalData.options.branchLevel === "LOCATION";
    try {
      await confirmBranchChoice(numericRoomId, {
        level: branchModalData.options.branchLevel,
        chosenIndex,
        branchToken: branchModalData.options.branchToken || null,
        optionsSnapshot: branchModalData.options.options,
      });
      setBranchModalData(null);

      // [Polish · P1 #7] LOCATION 분기 확정 시 흐름:
      //   백엔드는 분기 컨텍스트 저장 + 캐시 invalidate 했지만 batch는 만들지 않았다.
      //   프론트는 roomInfo를 refetch해서 progress.requiresLocationChoice=false가 된
      //   상태를 받아야 한다. 그러면 useTheaterStream의 autoStart가 true로 전환되어
      //   첫 batch가 깨끗하게 LLM 1회 호출로 만들어진다.
      if (wasLocationChoice) {
        try {
          const fresh = await fetchTheaterRoom(numericRoomId);
          setRoomInfo(fresh);
          // locationBranchRequested 플래그도 리셋 — 다음 Chapter 진입 시 재트리거 가능
          setLocationBranchRequested(false);
        } catch (refetchErr) {
          console.error("[Theater] roomInfo refetch failed:", refetchErr);
          // refetch 실패해도 일단 reloadBatch로 fallback
          reloadBatch();
        }
      } else {
        // MINOR / MAJOR / CLIMAX 분기는 기존 흐름 유지 (batch 즉시 재로드)
        reloadBatch();
      }
    } catch (e) {
      console.error("[Theater] Branch confirm failed:", e);
    }
  }, [branchModalData, numericRoomId, reloadBatch]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  9. Chapter 종료 닫기
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const handleChapterReportClose = useCallback(async () => {
    const report = chapterReport;
    setChapterReport(null);
    setLocationBranchRequested(false);
    if (report?.leadsToIntermission) {
      navigate(`/theater/${numericRoomId}/intermission`);
      return;
    }

    // [Polish · P1 #7] Chapter 종료 후 새 Chapter 진입 시 멀티 히로인이면
    //   다시 LOCATION 분기를 받아야 한다. 백엔드는 completeChapter 후 batchId를 0으로
    //   리셋하므로 buildRoomInfo의 requiresLocationChoice 판단이 자동으로 true가 된다.
    //   프론트는 roomInfo를 refetch해야 그 플래그를 인지하고 batch 자동 호출을 보류.
    //   refetch 실패 시 fallback으로 기존 resumeAfterChapter 흐름 진행.
    try {
      const fresh = await fetchTheaterRoom(numericRoomId);
      setRoomInfo(fresh);
      // 새 roomInfo가 requiresLocationChoice=true면 useEffect가 자동으로 LOCATION 모달 트리거.
      // false면 useTheaterStream의 autoStart로 batch가 자동 진입 — 다만 이미 initializedRef가
      // true이므로 effect가 재실행되지 않을 수 있음. 명시적으로 reloadBatch로 트리거.
      if (!fresh?.progress?.requiresLocationChoice) {
        resumeAfterChapter();
      }
    } catch (refetchErr) {
      console.warn("[Theater] roomInfo refetch on chapter close failed:", refetchErr);
      resumeAfterChapter();
    }
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

  // [Phase 5.5 UX Polish · R3] 배치의 마지막 씬 도달 여부 — 감독 명령어 펄스 알림용.
  // 마지막 씬에 닿으면 다음 배치 LLM 호출 직전이므로, 명령어 발동의 골든 타임.
  // 라이브 시점 + typingDone + 모달/패널 닫혀있을 때만 강조 (산만함 방지).
  const isLastScene = useMemo(() => {
    if (historyViewIndex !== null) return false;
    const total = currentBatch?.scenes?.length || 0;
    if (total === 0) return false;
    return currentSceneIndex >= total - 1 && typingDone;
  }, [historyViewIndex, currentBatch, currentSceneIndex, typingDone]);
  // 펄스는 어떤 모달도 떠있지 않을 때만 (산만 회피)
  const showCommandPulse = useMemo(() => {
    return isLastScene
      && !chapterReport && !branchModalData && !historyOpen
      && !commandOpen && !diaryOpen && !saveLoadOpen
      && !chapterEnding && !loadingNext;
  }, [
    isLastScene, chapterReport, branchModalData, historyOpen,
    commandOpen, diaryOpen, saveLoadOpen, chapterEnding, loadingNext,
  ]);

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
          onClick={() => navigate("/")}
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
  //  [Polish-v2] DTO 필드를 안전하게 해결
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // avatar.name (중첩) 우선, 없으면 flat avatarName, 그것도 없으면 "주인공"
  const avatarName =
    roomInfo.avatar?.name ||
    roomInfo.avatarName ||
    "주인공";

  // Act 진행도용 — actTotalChapters가 백엔드에서 내려오면 사용, 없으면 5
  const actTotalChapters = roomInfo.progress?.actTotalChapters || 5;

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
            // [Fix-UGC-CDN] 히로인별 절대 URL이 오면 그 CDN 디렉터리로 조립 (없으면 기존 경로)
            defaultImageUrl={activeHeroine.defaultImageUrl}
            npcSpeaker={null}
            isNpcActive={false}
            portrait={isMobile}
          />
        )}
      </div>

      {/* ═══ 4. 상단 HUD ═══ */}
      {/*
        [Phase III · A-1] HUD 폴리싱:
        ─ 좌측 배지: 세계관/Act/Chapter + Act 진행 도트(● ● ○ ○ ○) — Theater의 4-Act 호흡 시각화
        ─ 우측: 멀티 히로인 카드 — 활성 시 pulse + violet glow, 비활성은 톤 다운
        ─ 모드 토큰(violet/indigo) 일관 적용

        [Phase B · 단계1] 데스크톱은 아래 HUD 그대로(byte-identical),
        모바일은 compact top bar + 시트로 접어 밀도 완화(additive).
      */}
      {isMobile ? (
        <TheaterMobileTopBar
          worldDisplayName={roomInfo.worldDisplayName}
          currentAct={roomInfo.progress?.currentAct}
          currentChapter={roomInfo.progress?.currentChapter || 1}
          actTotalChapters={actTotalChapters}
          historyViewIndex={historyViewIndex}
          heroineCount={roomInfo.heroines?.length || 0}
          onBack={() => navigate("/")}
          onOpenMenu={() => setMobileMenuOpen(true)}
          onOpenAffinity={() => setAffinityOpen(true)}
        />
      ) : (
      <div className="absolute top-0 left-0 right-0 z-20 p-4 flex items-start justify-between pointer-events-none">
        {/* ─── 좌측: 뒤로 버튼 + 세계관·Act 배지 ─── */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={(e) => { e.stopPropagation(); sfx.click(); navigate("/"); }}
            aria-label="로비로"
            className="p-2 rounded-full bg-black/55 backdrop-blur-md border border-white/10 text-white/70 hover:text-white hover:border-violet-300/30 hover:bg-black/70 transition-colors duration-200"
          >
            <ArrowLeft size={14} />
          </button>

          <div className="bg-black/55 backdrop-blur-md rounded-full pl-3 pr-3.5 py-1.5 border border-white/10 hover:border-violet-300/25 transition-colors">
            <div className="flex items-center gap-2 text-xs">
              <Drama size={11} className="text-violet-300/90" />
              <span className="text-white/85 font-bold tracking-wide">{roomInfo.worldDisplayName}</span>
              <span className="text-white/20">·</span>
              <span className="text-violet-200/85 font-semibold">
                Act {roomInfo.progress?.currentAct}
              </span>

              {/* [A-1] Act 진행 도트 — Chapter 진척 시각화 */}
              <ActProgressDots
                currentChapter={roomInfo.progress?.currentChapter || 1}
                totalChapters={actTotalChapters}
              />

              {historyViewIndex !== null && (
                <>
                  <span className="text-white/20">·</span>
                  <span className="text-amber-300/80 text-[10px] uppercase tracking-wider font-bold">
                    이전 보기
                  </span>
                </>
              )}
            </div>
          </div>

          {/*
            [Phase 5.5 UX Polish · R3] 이야기 다이어리 + 세이브/로드
            [Polish · P2 #5] 감독 명령은 DialogueBox 하단으로 이전 — 발견율↑
            - 📖 다이어리: 우측 슬라이드 패널 (자동 캡처 노트)
            - 💾 세이브/로드: 좌측 슬라이드 패널
            - 첫 5초 간 onboarding 라벨 자동 노출, 이후엔 hover로만 펼쳐짐
          */}
          <HudPillButton
            onClick={(e) => { e.stopPropagation(); sfx.wooshLight(); setDiaryOpen(true); }}
            aria-label="이야기 다이어리"
            title="이야기 다이어리"
            label="다이어리"
            hintVisible={hudHintVisible}
            colorClass="hover:text-cyan-200 hover:border-cyan-300/45"
            icon={<BookOpen size={14} />}
          />
          <HudPillButton
            onClick={(e) => { e.stopPropagation(); sfx.wooshLight(); setSaveLoadOpen(true); }}
            aria-label="세이브 / 로드"
            title="세이브 / 로드"
            label="저장 · 불러오기"
            hintVisible={hudHintVisible}
            colorClass="hover:text-violet-200 hover:border-violet-300/45"
            icon={<Save size={14} />}
          />
          {/* [Phase 6] 도움말 · 문의 */}
          <HelpButton className="pointer-events-auto relative inline-flex items-center justify-center h-9 w-9 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-white/80 hover:text-white transition-colors duration-200" iconSize={15} />
        </div>

        {/* ─── 우측: 멀티 히로인 HUD (멀티 세션만) ─── */}
        {roomInfo.heroines?.length > 1 && (
          <div className="flex flex-col gap-1.5 pointer-events-auto">
            {roomInfo.heroines.map((h) => {
              const isActive = h.characterId === (activeHeroine?.characterId);
              return (
                <motion.div
                  key={h.characterId}
                  // [A-1] 활성 히로인 — pulse 글로우
                  animate={
                    isActive
                      ? {
                          scale: [1, 1.04, 1],
                          boxShadow: [
                            "0 0 0px rgba(167,139,250,0)",
                            "0 0 18px rgba(167,139,250,0.45)",
                            "0 0 0px rgba(167,139,250,0)",
                          ],
                        }
                      : { scale: 1, boxShadow: "0 0 0px rgba(167,139,250,0)" }
                  }
                  transition={
                    isActive
                      ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
                      : { duration: 0.3 }
                  }
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-md border transition-colors duration-300 ${
                    isActive
                      ? "bg-violet-500/22 border-violet-300/50"
                      : "bg-black/45 border-white/10"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-cover bg-center transition-all ${
                      isActive ? "ring-1 ring-violet-200/60" : "opacity-60"
                    }`}
                    style={{
                      backgroundImage: h.thumbnailUrl ? `url(${h.thumbnailUrl})` : "none",
                      backgroundColor: "#4c1d95",
                    }}
                  />
                  <span
                    className={`text-[10px] font-bold tracking-wide ${
                      isActive ? "text-violet-50" : "text-white/55"
                    }`}
                  >
                    {h.name}
                  </span>
                  <Heart
                    size={8}
                    className={isActive ? "text-rose-300" : "text-white/35"}
                    fill="currentColor"
                  />
                  <span className={`text-[9px] tabular-nums ${isActive ? "text-rose-100" : "text-white/45"}`}>
                    {h.affection}
                  </span>
                  {h.confirmedMain && <Crown size={9} className="text-amber-300" />}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
      )}

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
              avatarName={avatarName}
              heroineNames={(roomInfo?.heroines || []).map((h) => h.name).filter(Boolean)}
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
              onOpenHistory={() => { sfx.wooshLight(); setHistoryOpen(true); }}
              sceneIndexInBatch={currentSceneIndex}
              sceneCountInBatch={currentBatch?.scenes?.length || 1}
              leadHeroineName={leadHeroine?.name}
              leadHeroineAffection={leadHeroine?.affection}
              onTypingDone={() => setTypingDone(true)}
              // [Polish · P2 #1] inline 분기(MINOR) 활성 시 본체를 흐려 시각 위계 분리
              branchInlineActive={
                !!branchModalData
                && branchModalData.options?.branchLevel === "MINOR"
              }
              // [Polish · P2 #5] 감독 명령 버튼을 DialogueBox로 위임
              onOpenCommand={() => { sfx.wooshLight(); setCommandOpen(true); }}
              commandPulseActive={showCommandPulse}
              // [Phase B · 단계1] 모바일: tap-advance 레이어 + slim 컨트롤 + 재생 설정 시트
              mobile={isMobile}
              onOpenPlayback={() => { sfx.wooshLight(); setPlaybackOpen(true); }}
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
            // [Phase 5.5 UX Polish · R2] MINOR는 인라인이면서 "나중에 결정" 허용 (가벼움)
            onCancel={
              branchModalData.options?.branchLevel === "MINOR"
                ? () => setBranchModalData(null)
                : null
            }
            // [Phase III · A-3] Stat-gated 진척도 바 + LOCATION 히로인 썸네일
            currentStats={
              roomInfo.avatar?.stats
                ? roomInfo.avatar.stats
                : null
            }
            heroines={(roomInfo.heroines || []).map((h) => ({
              characterId: h.characterId,
              name: h.name,
              slug: h.characterSlug,
              thumbnailUrl: h.thumbnailUrl,
              affection: h.affection,
            }))}
            // [Phase 5.5 UX Polish · R2] MINOR만 인라인 (DialogueBox 위 슬라이드업).
            // MAJOR / CLIMAX / LOCATION은 풀스크린 (의식성·무게감 유지)
            inline={branchModalData.options?.branchLevel === "MINOR"}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {chapterReport && (
          <TheaterChapterReportModal
            report={chapterReport}
            onClose={handleChapterReportClose}
            currentAct={roomInfo.progress?.currentAct}
            actTotalChapters={actTotalChapters}
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
            avatarName={avatarName}
          />
        )}
      </AnimatePresence>

      {/* [Phase 5.5 UX Polish · R3] 감독 명령어 패널 (좌측 슬라이드) */}
      <AnimatePresence>
        {commandOpen && (
          <TheaterDirectorCommandPanel
            roomId={numericRoomId}
            visible={commandOpen}
            onClose={() => setCommandOpen(false)}
            energy={roomInfo?.energy ?? 0}
            onSpent={() => {
              // 명령어 발동 시 에너지 1 차감 — 정확한 잔량은 다음 배치 응답에서 동기화.
              // 즉시 UI 반영을 위해 낙관적 업데이트.
              setRoomInfo((prev) => prev
                ? { ...prev, energy: Math.max(0, (prev.energy ?? 0) - 1) }
                : prev);
            }}
          />
        )}
      </AnimatePresence>

      {/* [Phase 5.5 UX Polish · R3] 이야기 다이어리 패널 (우측 슬라이드) */}
      <AnimatePresence>
        {diaryOpen && (
          <TheaterDiaryPanel
            roomId={numericRoomId}
            visible={diaryOpen}
            onClose={() => setDiaryOpen(false)}
            currentAct={currentBatch?.actNumber || 1}
            currentChapter={currentBatch?.chapterNumber || 1}
            currentBatchId={currentBatch?.batchId || 0}
          />
        )}
      </AnimatePresence>

      {/* [Phase III · 작업 2] 세이브 / 로드 패널 */}
      <AnimatePresence>
        {saveLoadOpen && (
          <TheaterSaveLoadPanel
            roomId={numericRoomId}
            onClose={() => setSaveLoadOpen(false)}
            initialMode="save"
            onLoaded={() => {
              setSaveLoadOpen(false);
              // 로드 후 페이지를 새로 불러와 state 동기화
              window.location.reload();
            }}
          />
        )}
      </AnimatePresence>

      {/* ═══ [Phase B · 단계1] 모바일 전용 시트 (메뉴/호감도/재생 설정) ═══
          모두 기존 페이지 상태·핸들러만 호출 — 새 로직 없음 */}
      {isMobile && (
        <>
          <TheaterMenuSheet
            open={mobileMenuOpen}
            onClose={() => setMobileMenuOpen(false)}
            onOpenDiary={() => { sfx.wooshLight(); setDiaryOpen(true); }}
            onOpenSaveLoad={() => { sfx.wooshLight(); setSaveLoadOpen(true); }}
            onOpenHistory={() => { sfx.wooshLight(); setHistoryOpen(true); }}
          />
          <TheaterAffinitySheet
            open={affinityOpen}
            onClose={() => setAffinityOpen(false)}
            heroines={roomInfo.heroines || []}
            activeHeroineId={activeHeroine?.characterId}
          />
          <TheaterPlaybackSheet
            open={playbackOpen}
            onClose={() => setPlaybackOpen(false)}
            playSpeed={playSpeed}
            onSpeedChange={handleSpeedChange}
            autoPlayEnabled={autoPlayEnabled}
            onToggleAutoPlay={handleToggleAutoPlay}
          />
        </>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  [Polish · P2 #5] HUD 알약 버튼
//
//  기존 32px 아이콘만 있는 버튼은 발견율이 매우 낮았다. 라벨 + 아이콘
//  expandable pill 패턴으로 가시성↑.
//   - 기본 상태: 아이콘만 (compact)
//   - hover 또는 hintVisible=true 시: 라벨이 부드럽게 펼쳐짐
//   - 첫 진입 후 ~5초간 hintVisible=true로 onboarding 효과
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const HudPillButton = ({
  onClick, "aria-label": ariaLabel, title, label, icon, hintVisible, colorClass = "",
}) => {
  const [hovered, setHovered] = useState(false);
  const expanded = hovered || hintVisible;
  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={ariaLabel}
      title={title}
      className={`inline-flex items-center gap-2 h-9 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-white/80 transition-colors duration-200 ${colorClass}`}
      animate={{ paddingLeft: expanded ? 12 : 9, paddingRight: expanded ? 14 : 9 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      whileTap={{ scale: 0.96 }}
    >
      <span className="flex-shrink-0">{icon}</span>
      <motion.span
        className="text-[11px] font-semibold tracking-wide whitespace-nowrap overflow-hidden"
        animate={{
          maxWidth: expanded ? 160 : 0,
          opacity: expanded ? 1 : 0,
          marginLeft: expanded ? 0 : -4,
        }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        {label}
      </motion.span>
    </motion.button>
  );
};