import { Fragment, useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import CharacterDisplay from "../components/CharacterDisplay";
import HelpButton from "../components/HelpButton";
import DialogueBox from "../components/DialogueBox";
import BackgroundDisplay from "../components/BackgroundDisplay";
import AudioEngine from "../components/AudioEngine";
import EndingCredits from "../components/EndingCredits";
import useResourcePreloader from "../hooks/UseResourcePreloader";
import EasterEggEffects from "../components/EasterEggEffects";
import AchievementUnlockModal from "../components/AchievementUnlockModal";
import AchievementGallery from "../components/AchievementGallery";
import useInvisibleMan from "../hooks/useInvisibleMan";
import { motion, AnimatePresence } from "framer-motion";
import LucidStore from "../components/LucidStore";
import SecretModeFlow from "../components/SecretModeFlow";
import AdultVerificationModal from "../components/AdultVerificationModal";
import BoostToggle from "../components/BoostToggle";
import BiometricStatusPanel from "../components/BiometricStatusPanel";
import InnerThoughtBubble from "../components/InnerThoughtBubble";
import IllustrationModal from "../components/IllustrationModal";
import LocationTransition from "../components/LocationTransition";
// [2026-07-31 에픽 B] 씬 일러 — V2 배선(수동 요청 전용: V2 스트림은 씬 필드를 보내지 않는다)
import useSceneIllustrations from "../hooks/useSceneIllustrations";
import SceneIllustrationStage from "../components/SceneIllustrationStage";
import SceneRequestButton from "../components/SceneRequestButton";
// [Scene-Polish A] 인트로 나레이션 마지막 문장 재사용 + 주격 조사 유틸 (V1/V2 공유)
import { extractLastSentence, subjectJosa } from "../utils/dialogueSanitizer";
// [Scene-Polish C] 히스토리 클릭 → 씬 점프 (마커 행 + ordinal 매핑, V1/V2 공유)
import SceneHistoryMarker from "../components/SceneHistoryMarker";
import { buildSceneHistoryIndex } from "../utils/sceneHistoryMap";
// [2026-08-07 디오라마 이식] 과거 씬 리플레이 — 히스토리 행 클릭 → 그 시점 씬 무대 재현 (V1/V2 공용)
import useSceneReplay from "../hooks/useSceneReplay";
import SceneReplayOverlay from "../components/SceneReplayOverlay";
import PaymentModal from "../components/PaymentModal";
import IllustrationGalleryPage from "./IllustrationGalleryPage";
import {
  sendMessageStream,
  sendEventSelectStream,
  sendDirectorWatchStream,
  sendTimeSkipStream,
  peekDirectorDirective,
  consumeDirectorDirective,
  requestDirectorIntervention,
  sendDirectorBranchStream,
  sendDirectorTransitionStream,
  sendAutoDirectorResponse,
} from "../api/UseChatStream";
// ━━━ [Phase 7-V2 Pivot] V2 API + sub-components ━━━
import {
  fetchStoryV2RoomDetail,
  fetchUnreadNotifications,
  markNotificationRead,
  resetStoryV2,
} from "../api/StoryV2Api";
import { sendV2Message, sendV2Action, sendV2Opening } from "../api/UseStoryV2Stream";
import StoryV2TopIndicator from "../components/story-v2/StoryV2TopIndicator";
import StoryV2NotificationToast from "../components/story-v2/StoryV2NotificationToast";
import StoryV2HeroineSelector from "../components/story-v2/StoryV2HeroineSelector";
import StoryV2LocationMoveModal from "../components/story-v2/StoryV2LocationMoveModal";
import StoryV2ResetModal from "../components/story-v2/StoryV2ResetModal";
import StoryV2EndingCredits from "../components/story-v2/StoryV2EndingCredits";
// [Phase B · 단계2] 모바일 세로 (additive)
import useDeviceProfile from "../hooks/useDeviceProfile";
import StoryV2MobileMenuSheet from "../components/story-v2/mobile/StoryV2MobileMenuSheet";
import { getHeroinePaletteByCharacterId, USER_BUBBLE_PALETTE, SYSTEM_BUBBLE_PALETTE } from "../utils/characterColor";
import { dayPartToV1Time } from "../utils/dayPart";
// DirectorInterlude 제거 — 투명 디렉터 패턴으로 대체
import { useParams, useNavigate } from "react-router-dom";
import { 
  X, MessageSquare, Trash2, Settings, Music, VolumeX, 
  LogOut, User as UserIcon, Gamepad2, Save, Sparkles, Lock, Unlock,
  CheckCircle, AlertTriangle, Info, Zap, Play, SkipForward,
  Heart, Crown, MapPin, Shirt, Award, ChevronRight, ChevronLeft, Gem, Rocket, ShoppingBag,
  ThumbsUp, ThumbsDown, MoreHorizontal, Image, RotateCcw, Bell
} from "lucide-react";
import { assetUrl } from "../utils/assetUrl";
import { sfx } from "../utils/sfx";

// [UX#3] 화자 분류 단일 소스 — 라이브/히스토리/복원 모든 경로가 동일 규칙을 쓰도록.
//  시스템 = 화자 null/공백 OR "null"/"system"/"narrator"/"시스템"/"내레이터" 마커 문자열.
//  (LLM이 JSON null 대신 문자열 "null"을 내보내는 케이스까지 흡수 → NPC "null" 이름/실루엣 버그 차단)
const SYSTEM_SPEAKER_MARKERS = new Set(["null", "none", "system", "narrator", "시스템", "내레이터", "나레이터"]);
function isSystemSpeakerName(speaker) {
  if (speaker == null) return true;
  const s = String(speaker).trim();
  if (s === "") return true;
  return SYSTEM_SPEAKER_MARKERS.has(s.toLowerCase());
}

const ChatPage = () => {
  const { user, logout, refreshUser } = useAuth();
  const { roomId } = useParams();
  const navigate = useNavigate();

  // [Phase B · 단계2] 폼팩터 프로필 + 모바일 오버플로 메뉴 상태 (프리젠테이션 전용)
  const { isMobile } = useDeviceProfile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const [roomInfo, setRoomInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const initCalledRef = useRef(null); // [Phase 5 Fix] StrictMode 중복 init 방지 (roomId 기반)

  // [2026-08-07 디오라마 이식] 과거 씬 리플레이 — 라이브 상태는 불변, 렌더 지점 3-way 병합만
  const replay = useSceneReplay(messages);
  
  // [컷신 상태]
  const [sceneQueue, setSceneQueue] = useState([]);
  const [currentScene, setCurrentScene] = useState(null);
  const [displayedEmotion, setDisplayedEmotion] = useState("NEUTRAL");

  // [Issue #1+#2 Fix] 씬 활성 상태 추적 (setTimeout 내에서 stale closure 방지)
  const sceneActiveRef = useRef(false);
  
  // [Phase 4] 씬 디렉션 상태
  // [Phase 5] 초기값은 roomInfo 로드 후 캐릭터별 기본값으로 세팅
  const [currentLocation, setCurrentLocation] = useState(null);
  const [currentTime, setCurrentTime] = useState("NIGHT");
  const [currentOutfit, setCurrentOutfit] = useState(null);
  const [currentBgmMode, setCurrentBgmMode] = useState(null);
  
  // [상태 정보]
  const [affection, setAffection] = useState(0);
  const [energy, setEnergy] = useState(user?.energy || 100);

  // [2026-07-31 에픽 B] 씬 일러 — 목록/폴링/수동 요청 전부 훅에 캡슐화.
  // V2는 SSE로 씬을 받지 않으므로 register 미사용 — 수동 request()가 유일한 생성 경로.
  const sceneStage = useSceneIllustrations(roomId);
  // [Phase 5.5-Fix #1] 에너지 분리 추적
  const [freeEnergy, setFreeEnergy] = useState(user?.energy || 100);
  const [paidEnergy, setPaidEnergy] = useState(0);
  const [isTyping, setIsTyping] = useState(false);

  // 인트로 시퀀스 상태 ('none' | 'door' | 'greeting')
  const [introStep, setIntroStep] = useState('none');
  const [openingReady, setOpeningReady] = useState(false); // [UX] V2 오프닝 첫 씬 도착 여부 (인트로 영상 스킵 게이트)
  const [isLoading, setIsLoading] = useState(true); // 깜빡임 방지용
  
  // [UI 상태]
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isBgmPlaying, setIsBgmPlaying] = useState(false);

  // [Phase 4 Fix] 히스토리 무한 스크롤 상태
  const [historyPage, setHistoryPage] = useState(1);       // 다음 로드할 페이지 (page 0은 init에서 로드)
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const historyScrollRef = useRef(null);

  // [유저 설정 상태]
  const [userInfo, setUserInfo] = useState({ 
      nickname: "", 
      profileDescription: "", 
      isSecretMode: false 
  });
  const [roomPersona, setRoomPersona] = useState("");  // [Bug #3 Fix] 채팅방 전용 페르소나
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // [BGM Volume]
  const [bgmVolume, setBgmVolume] = useState(() => {
    const saved = localStorage.getItem("bgmVolume");
    const v = saved !== null ? Number(saved) : 0.5;
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5;
  });

  // [알림/모달 상태]
  const [toast, setToast] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);

  // 이벤트 선택지 모달 상태
  const [eventOptions, setEventOptions] = useState(null);

  // ━━━ [Phase 4.2] 관계 승급 이벤트 상태 ━━━
  const [promotionOverlay, setPromotionOverlay] = useState(null);   // null | 'STARTED' | 'SUCCESS' | 'FAILURE' | 'SUCCESS_PENDING' | 'FAILURE_PENDING'
  const [promotionProgress, setPromotionProgress] = useState(null); // IN_PROGRESS 배너용 { target, displayName, turnsRemaining, moodScore }
  const [promotionResult, setPromotionResult] = useState(null);     // 오버레이에 표시할 이벤트 데이터

  // ━━━ [Phase 4.3] 엔딩 이벤트 상태 ━━━
  const [endingTrigger, setEndingTrigger] = useState(null);       // { endingType: 'HAPPY' | 'BAD' }
  const [endingData, setEndingData] = useState(null);             // EndingResponse from backend
  const [showEndingCredits, setShowEndingCredits] = useState(false); // 엔딩 크레딧 표시 여부
  const [endingLoading, setEndingLoading] = useState(false);      // 엔딩 생성 로딩

  // ─── [Phase 4.4] 이스터에그 & 업적 상태 ───
  const [easterEggEffect, setEasterEggEffect] = useState(null);    // 현재 활성 시각 효과
  const [achievementModal, setAchievementModal] = useState(null);   // 업적 획득 모달 데이터
  const [showAchievements, setShowAchievements] = useState(false);  // 업적 갤러리 표시

  // ─── [Phase 5 BM] 상점, 시크릿 플로우, 부스트 ───
  const [showStore, setShowStore] = useState(false);
  const [storeInitialTab, setStoreInitialTab] = useState("energy");
  const [showSecretFlow, setShowSecretFlow] = useState(false);
  const [showAdultVerifyFromStore, setShowAdultVerifyFromStore] = useState(false);
  const [boostMode, setBoostMode] = useState(false);
  const [isSubscriber, setIsSubscriber] = useState(false);
  const [freeEnergyMax, setFreeEnergyMax] = useState(30);
  const [characters, setCharacters] = useState([]);

  // ━━━ [Phase 5.2] 싫어요 사유 모달 ━━━
  const [dislikeModal, setDislikeModal] = useState(null); // { logId } | null

  // ─── [Phase 5.5] 입체적 상태창 ───
  const [characterStats, setCharacterStats] = useState({
    intimacy: 0, affection: 0, dependency: 0, playfulness: 0, trust: 0,
    lust: 0, corruption: 0, obsession: 0,
  });
  const [currentBpm, setCurrentBpm] = useState(65);
  const [dynamicRelationTag, setDynamicRelationTag] = useState(null);
  const [characterThought, setCharacterThought] = useState(null);
  const [showStatusPanel, setShowStatusPanel] = useState(false);   // 상태창 오픈 상태
  const statusToggleRef = useRef(null); // [폴리싱 #8] STATUS 토글 버튼 — 패널 바깥 클릭 판정에서 제외 (깜빡임 방지)
  const [latestStatChanges, setLatestStatChanges] = useState(null); // 스탯 변화 팝업용

  // ─── [Phase 5.5-IT] 속마음 시스템 ───
  const [currentInnerThought, setCurrentInnerThought] = useState(null);  // 현재 턴의 속마음 텍스트 (해금 후)
  const [hasInnerThought, setHasInnerThought] = useState(false);          // 현재 턴에 속마음 존재 여부
  const [thoughtUnlocked, setThoughtUnlocked] = useState(false);          // 현재 턴 속마음 해금 여부
  const [currentAssistantLogId, setCurrentAssistantLogId] = useState(null); // 현재 턴 ASSISTANT logId
  const [isUnlockingThought, setIsUnlockingThought] = useState(false);    // 해금 API 로딩 중

  // ─── [Phase 5.5-EV] 이벤트 시스템 강화 ───
  const [topicConcluded, setTopicConcluded] = useState(false);      // 주제 종료 플래그
  const [eventStatus, setEventStatus] = useState(null);              // "ONGOING" | "RESOLVED" | null
  const [eventActive, setEventActive] = useState(false);             // 디렉터 모드 진행 중
  const [isObserverEvent, setIsObserverEvent] = useState(false);     // [Issue #3 Fix] 관찰자 모드 이벤트 여부

  // ─── [Phase 5.5-NPC] NPC 스피커 시스템 ───
  const [currentSpeaker, setCurrentSpeaker] = useState(null);    // 현재 씬의 화자 이름
  const [npcSpeaker, setNpcSpeaker] = useState(null);            // 활성 NPC 이름 (null이면 NPC 없음)

  // ─── [Phase 5.5-Fix] SSE 응답 대기 플래그 ───
  const [awaitingFinalResult, setAwaitingFinalResult] = useState(false);

  // [2026-08-07 씬당 1회 + 리플레이 E5] 새 턴 시작(유저 발화·액션·오프닝·V1 폴백 경로 포함) →
  // 씬 재요청 잠금 해제 + 리플레이 자동 이탈(라이브 우선). 단일 심 — 전송 지점 개별 배선 불요.
  // ※ 수용된 트레이드오프(리뷰 확정): '전송 시작' 시점 발제라 턴이 실패·롤백되면 서버 turnIndex
  //   불변인데 프론트만 잠금 해제된다 — 이 경우 클릭 시 409 안내 후 availability 재조회로 재잠금
  //   (무과금·자가치유). '새 로그 확정' 시점 해제는 init 복원과의 레이스가 더 위험해 채택하지 않음.
  useEffect(() => {
    if (isTyping || awaitingFinalResult) {
      sceneStage.notifyNewTurn();
      replay.exit();
    }
  }, [isTyping, awaitingFinalResult, sceneStage.notifyNewTurn, replay.exit]);

  // [Phase 5.5-Sep] 모드별 기능 플래그 (roomInfo 로드 후 갱신)
  const isStoryMode = roomInfo?.chatMode === "STORY";
  // [Q2-Fix] V1 디렉터/이벤트/속마음 자산의 SANDBOX 이관 — 백엔드 ChatModePolicy와 정렬.
  //   isStoryMode(STORY 전용)가 이관된 SANDBOX 기능까지 차단하던 게이트의 교체용.
  const directorEligible = roomInfo?.chatMode === "STORY" || roomInfo?.chatMode === "SANDBOX";

  //   // ─── [Phase 5.5-Illust] 실시간 일러스트 시스템 ───
  const [showIllustModal, setShowIllustModal] = useState(false);
  const [illustrationAvailable, setIllustrationAvailable] = useState(false);

  // ─── [Phase 5.5-Illust] 장소 전환 시스템 ───
  const [locationTransition, setLocationTransition] = useState(null);
  // { active: true, locationName: "해변", backgroundUrl: "...", cacheHash: "...", isGenerating: true }
  const [dynamicBackgroundUrl, setDynamicBackgroundUrl] = useState(null); // AI 생성 배경 S3 URL (enum 해상도 오버라이드)
  const [bgPreferDynamic, setBgPreferDynamic] = useState(false); // [정책:정적우선] 즉석(invented) 장소=동적우선, 시드 장소=정적우선

  // ─── [Phase 5.5-Illust] 일러스트 갤러리 ───
  const [showIllustGallery, setShowIllustGallery] = useState(false);

  // ─── [v3] 투명 디렉터 시스템 ───
  const [directorLoading, setDirectorLoading] = useState(false);          // 수동 디렉터 요청 로딩 중
  const [directorAutoProcessing, setDirectorAutoProcessing] = useState(false); // 자동 응답 처리 중
  const directorAutoCheckTimer = useRef(null);

  // [Phase6/Tier4 / H-26] SSE 호출용 AbortController. unmount/재호출 시 진행 중인 SSE를
  //   강제 중단해서 reader/네트워크 자원 누수를 차단. UseChatStream의 모든 SSE 함수는
  //   네 번째 인자로 abortController를 받는다 — 호출처에서 전달 시 fetch에 signal 연결.
  const sseAbortRef = useRef(null);
  useEffect(() => {
    return () => {
      try { sseAbortRef.current?.abort(); } catch { /* ignore */ }
    };
  }, []);

  // [UX Fix] 나레이션 → 유저 클릭 대기 → 다음 플로우 진행
  const pendingDirectorActionRef = useRef(null);

  // [UX Fix Bug 1] 나레이션 표시 중인지 추적 — 캐릭터 첫 씬 자동 덮어쓰기 방지
  const currentSceneRef = useRef(null);

  // [Bug Fix #3] scheduleDirectorAutoCheck의 stale closure 방지용 ref 미러
  const eventActiveRef = useRef(false);
  const awaitingFinalResultRef = useRef(false);
  const isTypingRef = useRef(false);
  // [E-3 C-1] 오프닝 1회 발사 가드 — 빈 방 진입 시 도입 장면 중복 생성 방지(새로고침/리렌더)
  const openingFiredRef = useRef(false);
  const directorAutoProcessingRef = useRef(false);

  const logsEndRef = useRef(null);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  [Phase 7-V2 Pivot] V2 전용 상태 — 멀티 히로인 / World / 알림 / 액션
  //  V1 state(roomInfo 단일 캐릭터)와 *공존* — V2는 v2Room을 1순위로 사용.
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const [v2Room, setV2Room] = useState(null);        // V2 ChatRoom 상세 (heroines 포함)
  const [isV2, setIsV2] = useState(false);            // V2 모드 식별 플래그
  const [notifications, setNotifications] = useState([]);   // 오프스크린 알림 (히로인 메시지)
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [dialogueOptions, setDialogueOptions] = useState([]); // LLM 자율 선택지
  // V2 modals
  const [showHeroineSelector, setShowHeroineSelector] = useState(false);
  const [showV2LocationModal, setShowV2LocationModal] = useState(false);
  const [showV2ResetModal, setShowV2ResetModal] = useState(false);
  // V2 PaymentModal in-place
  const [showPayment, setShowPayment] = useState(false);
  const [paymentInitialTab, setPaymentInitialTab] = useState("energy");
  // V2 멀티 히로인 엔딩 크레딧
  const [showV2EndingCredits, setShowV2EndingCredits] = useState(false);

  // V2 현재 화자 추론 — heroines를 lastSpokenAt DESC로 정렬한 첫 번째
  const currentSpeakerCharacterId = useMemo(() => {
    if (!v2Room?.heroines || v2Room.heroines.length === 0) return null;
    const withSpoken = v2Room.heroines.filter((h) => h.lastSpokenAt);
    if (withSpoken.length === 0) return v2Room.heroines[0].characterId;
    withSpoken.sort(
      (a, b) => new Date(b.lastSpokenAt).getTime() - new Date(a.lastSpokenAt).getTime()
    );
    return withSpoken[0].characterId;
  }, [v2Room?.heroines]);

  // V2 현재 화자 객체
  const currentSpeakerHeroine = useMemo(() => {
    if (!v2Room?.heroines || !currentSpeakerCharacterId) return null;
    return v2Room.heroines.find((h) => h.characterId === currentSpeakerCharacterId) || null;
  }, [v2Room?.heroines, currentSpeakerCharacterId]);

  // V2 → V1 호환 roomInfo 매핑 — V1 컴포넌트가 기대하는 단일 캐릭터 시점
  // CharacterDisplay / BiometricStatusPanel / Settings 등이 사용
  const v2DerivedRoomInfo = useMemo(() => {
    if (!isV2 || !v2Room || !currentSpeakerHeroine) return null;
    return {
      roomId: v2Room.roomId,
      characterId: currentSpeakerHeroine.characterId,
      characterName: currentSpeakerHeroine.name,
      characterSlug: currentSpeakerHeroine.slug || null,
      defaultOutfit: null,
      chatMode: "STORY",
      statusLevel: currentSpeakerHeroine.relationStatus || "STRANGER",
      secretModeActive: v2Room.secretModeActive,
      ttsEnabled: false,
    };
  }, [isV2, v2Room, currentSpeakerHeroine]);

  // [D-3] 현재 *씬* 화자 히로인의 slug — 멀티 히로인 응답에서 씬마다 초상 전환
  const v2SceneSpeakerSlug = useMemo(() => {
    if (!isV2 || !v2Room?.heroines || !currentSpeaker) return null;
    return v2Room.heroines.find((h) => h.name === currentSpeaker)?.slug || null;
  }, [isV2, v2Room?.heroines, currentSpeaker]);

  // [2026-08-06 UGC 스프라이트 CDN 픽스] 현재 씬 화자 히로인의 스탠딩 원본 URL — UGC 캐릭터는
  // 공식 CDN(d3578f)에 에셋이 없어 이 URL에서 assetDir을 유도해야 스프라이트가 뜬다(V1 동일 계약).
  const v2SceneSpeakerImageUrl = useMemo(() => {
    if (!isV2 || !v2Room?.heroines) return null;
    if (currentSpeaker) {
      const h = v2Room.heroines.find((x) => x.name === currentSpeaker);
      if (h?.defaultImageUrl) return h.defaultImageUrl;
    }
    return currentSpeakerHeroine?.defaultImageUrl || null;
  }, [isV2, v2Room?.heroines, currentSpeaker, currentSpeakerHeroine]);

  // [Bug-Sprite] 현재 *씬* 화자 히로인의 복장 — 캐릭터마다 default-outfit이 다름(airi=MAID, yeonhwa=HANBOK…).
  //  우선순위: 씬 명시 outfit > 현재 화자 히로인 기본 복장 > 첫 히로인(폴백 캐릭터) 기본 복장.
  //  → 멀티 히로인 응답에서 화자 전환 시 slug와 함께 복장도 전환되어 스프라이트 404 방지.
  const v2SceneSpeakerOutfit = useMemo(() => {
    if (!isV2 || !v2Room?.heroines) return null;
    if (currentScene?.outfit) return currentScene.outfit;
    if (currentSpeaker) {
      const h = v2Room.heroines.find((x) => x.name === currentSpeaker);
      if (h?.defaultOutfit) return h.defaultOutfit;
    }
    return null; // [Bug-Sprite] 화자 없음(시스템 씬) → 복장 없음 (스프라이트 미표시와 정합)
  }, [isV2, v2Room?.heroines, currentSpeaker, currentScene?.outfit]);

  // [2026-08-07 디오라마 이식] 리플레이 무대 뷰 — 라이브 state를 건드리지 않는 렌더 전용 파생.
  //  화자 해석은 라이브 씬 effect와 동일 정책: 히로인 씬=그 히로인의 감정/슬러그/복장,
  //  시스템·NPC 씬=스탠딩(감정·슬러그) 유지(E9/E10), NPC는 실루엣. 복장은 영속 outfit 우선.
  const replayView = useMemo(() => {
    if (!replay.isReplaying || !replay.scene) return null;
    const sc = replay.scene;
    const sys = !sc.speaker;
    if (isV2) {
      const heroine = !sys
        ? (v2Room?.heroines || []).find((x) => x.name === sc.speaker) || null
        : null;
      return {
        scene: sc,
        emotion: heroine ? sc.emotion : displayedEmotion,
        slug: heroine ? (heroine.slug || null) : v2SceneSpeakerSlug,
        imageUrl: heroine ? (heroine.defaultImageUrl || null) : v2SceneSpeakerImageUrl,
        outfit: sc.outfit || (heroine ? (heroine.defaultOutfit || null) : v2SceneSpeakerOutfit),
        npcSpeaker: !sys && !heroine ? sc.speaker : null,
      };
    }
    // V1 폴백 방 — 단일 캐릭터 기준
    const isNpc = !sys && sc.speaker !== roomInfo?.characterName;
    return {
      scene: sc,
      emotion: !sys && !isNpc ? sc.emotion : displayedEmotion,
      slug: roomInfo?.characterSlug || null,
      imageUrl: roomInfo?.defaultImageUrl || null,
      outfit: sc.outfit || currentOutfit,
      npcSpeaker: isNpc ? sc.speaker : null,
    };
  }, [replay.isReplaying, replay.scene, isV2, v2Room?.heroines, displayedEmotion,
      v2SceneSpeakerSlug, v2SceneSpeakerImageUrl, v2SceneSpeakerOutfit,
      roomInfo?.characterName, roomInfo?.characterSlug, roomInfo?.defaultImageUrl, currentOutfit]);

  // V2 일러스트용 히로인 매핑
  const v2IllustrationHeroines = useMemo(() => {
    if (!v2Room?.heroines) return [];
    return v2Room.heroines.map((h) => ({
      characterId: h.characterId,
      name: h.name,
      profileImageUrl: h.profileImageUrl,
      dynamicRelationTag: h.dynamicRelationTag,
      isCurrentSpeaker: h.characterId === currentSpeakerCharacterId,
    }));
  }, [v2Room?.heroines, currentSpeakerCharacterId]);

  // ================= Helper Functions =================
  const showToast = useCallback((message, type = "info") => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
      // [Phase 6 SFX]
      switch (type) {
        case "success": sfx.chime(); break;
        case "error":   sfx.thud();  break;
        case "warning": sfx.thud();  break;     // L5 통합
        case "info":    sfx.chime(0.2); break;  // 작게
        default: break;
      }
  }, []);

  const openConfirm = (message, onConfirm, type = 'danger') => {
      setConfirmModal({ message, onConfirm, type });
  };

  const closeConfirm = () => {
      setConfirmModal(null);
  };

  /**
   * [Phase 5.5-Director] 디렉터 인터루드 체크
   *
   * 유저가 메시지를 보내려 할 때 (입력창 포커스 또는 전송 직전) 호출.
   * 대기 중인 Directive가 있으면 인터루드 시퀀스를 발동.
   *
   * @returns {boolean} true면 인터루드 발동됨 (메시지 전송 보류)
   */
  /**
   * [v3] 투명 디렉터 — 유저 메시지를 차단하지 않음
   *
   * 이전: peek → directive 발견 → 메시지 전송 차단 → DirectorInterlude 오버레이
   * 현재: 자동 체크에서 투명하게 처리. 유저 메시지 전송 시에는 차단 없음.
   *       directive가 남아있으면 자동 소비하고 유저 메시지와 함께 처리.
   */
  const checkDirectorInterlude = useCallback(async () => {
    // [v3] 투명 디렉터: 유저 메시지를 절대 차단하지 않음
    // 비동기 자동 체크(scheduleDirectorAutoCheck)에서 투명하게 처리
    return false;
  }, []);

  /**
   * DirectorInterlude 컴포넌트에서 유저가 행동을 선택했을 때 호출.
   */
  /**
   * [v3] 투명 디렉터 자동 처리
   *
   * DirectorInterlude 오버레이 없이, directive를 유형별로 투명하게 처리.
   * INTERLUDE/TRANSITION/AWAY: 나레이션 인라인 삽입 → 캐릭터 자동 응답 SSE
   * BRANCH_CHOICE: 나레이션 삽입 → 3장 카드 팝업
   * BRANCH_SCENARIO: 3장 시나리오 카드 팝업 (수동 호출 시)
   */
  const handleTransparentDirective = useCallback(async (directive) => {
    if (!directive || directive.decision === "PASS") return;

    setDirectorAutoProcessing(true);

    try {
      // ── Directive 소비 + ChatRoom 적용 ──
      const consumed = await consumeDirectorDirective(roomId);
      if (!consumed) {
        console.warn("[Director] Directive already consumed/expired");
        setDirectorAutoProcessing(false);
        return;
      }

      const decision = consumed.decision;

      // ━━━ INTERLUDE: 나레이션 삽입 → 자동 응답 ━━━
      if (decision === "INTERLUDE" && consumed.interlude) {
        if (consumed.interlude.narration) {
          setMessages(prev => [...prev, {
            role: "SYSTEM", cleanContent: consumed.interlude.narration,
            isEvent: true, isDirectorNarration: true,
          }]);
          // 나레이션을 현재 씬으로도 표시
          const narrationScene = {
            dialogue: "", narration: consumed.interlude.narration,
            emotion: "NEUTRAL", isEvent: true,
          };
          setCurrentScene(narrationScene);
          currentSceneRef.current = narrationScene;
        }
        if (consumed.interlude.environment?.bgm) {
          setCurrentBgmMode(consumed.interlude.environment.bgm);
        }

        // [UX Fix] 유저 클릭 대기 → handleNextScene에서 실행
        pendingDirectorActionRef.current = { type: "AUTO_RESPOND", directiveType: "INTERLUDE" };
        setDirectorAutoProcessing(false);
        return;
      }

      // ━━━ BRANCH_CHOICE: 나레이션 → 3장 반응 카드 ━━━
      if (decision === "BRANCH" && consumed.branch) {
        const isChoice = consumed.branch.branch_mode === "CHOICE" || consumed.branch.branchMode === "CHOICE";

        if (isChoice && consumed.branch.situation) {
          // 상황 나레이션 먼저 인라인 삽입
          setMessages(prev => [...prev, {
            role: "SYSTEM", cleanContent: consumed.branch.situation,
            isEvent: true, isDirectorNarration: true,
          }]);
          const narrationScene = {
            dialogue: "", narration: consumed.branch.situation,
            emotion: "NEUTRAL", isEvent: true,
          };
          setCurrentScene(narrationScene);
          currentSceneRef.current = narrationScene;
        }

        // 3장 카드 팝업 표시 (기존 eventOptions UI 재활용)
        const options = (consumed.branch.options || []).map(opt => ({
          ...opt,
          type: opt.tone?.toUpperCase() || "NORMAL",
          detail: opt.detail,
          label: opt.label,
          energyCost: opt.energy_cost || opt.energyCost || 2,
        }));

        if (isChoice && consumed.branch.situation) {
          // [UX Fix] 나레이션 있으면 유저 클릭 대기 → 카드 표시
          pendingDirectorActionRef.current = { type: "SHOW_CARDS", options };
        } else {
          // 나레이션 없으면 즉시 카드 표시
          setEventOptions(options);
        }
        setDirectorAutoProcessing(false);
        return;
      }

      // ━━━ TRANSITION: 나레이션 → 전환 애니메이션 → 자동 응답 ━━━
      if (decision === "TRANSITION" && consumed.transition) {
        if (consumed.transition.narration) {
          setMessages(prev => [...prev, {
            role: "SYSTEM", cleanContent: consumed.transition.narration,
            isDirectorNarration: true,
          }]);
          const narrationScene = {
            dialogue: "", narration: consumed.transition.narration,
            emotion: "NEUTRAL", isEvent: true,
          };
          setCurrentScene(narrationScene);
          currentSceneRef.current = narrationScene;
        }

        // [UX Fix] 전환 애니메이션 + 자동 응답은 유저 클릭 후 실행
        const locName = consumed.transition.new_location_name || consumed.transition.newLocationName || null;
        pendingDirectorActionRef.current = {
          type: "AUTO_RESPOND", directiveType: "TRANSITION", locationName: locName,
        };
        setDirectorAutoProcessing(false);
        return;
      }

      // ━━━ AWAY: "한편..." 나레이션 → 자동 진행 ━━━
      if (decision === "AWAY" && consumed.away) {
        if (consumed.away.narration) {
          setMessages(prev => [...prev, {
            role: "SYSTEM", cleanContent: consumed.away.narration,
            isEvent: true, isDirectorNarration: true,
          }]);
          const narrationScene = {
            dialogue: "", narration: consumed.away.narration,
            emotion: "NEUTRAL", isEvent: true,
          };
          setCurrentScene(narrationScene);
          currentSceneRef.current = narrationScene;
        }
        if (consumed.away.environment?.bgm) {
          setCurrentBgmMode(consumed.away.environment.bgm);
        }

        setEventActive(true);
        setEventStatus("ONGOING");
        setIsObserverEvent(true);
        // [UX Fix] 유저 클릭 대기 → AWAY 자동 진행 시작
        pendingDirectorActionRef.current = { type: "AUTO_RESPOND", directiveType: "AWAY" };
        setDirectorAutoProcessing(false);
        return;
      }

      setDirectorAutoProcessing(false);
    } catch (err) {
      console.error("[Director] Transparent processing error:", err);
      setDirectorAutoProcessing(false);
    }
  }, [roomId]);

  /**
   * [v3] 디렉터 자동 응답 SSE 트리거
   *
   * INTERLUDE/TRANSITION/AWAY에서 나레이션 표시 후 호출.
   * 캐릭터가 상황에 자동으로 반응하는 응답을 생성.
   */
  const triggerAutoDirectorResponse = useCallback(async (directiveType, eventContext = null) => {
    // [Bug Fix B] setIsTyping(true) 제거 — 나레이션이 이미 표시 중일 때 타이핑 인디케이터가 덮어쓰는 문제 방지
    // 대신 awaitingFinalResult로 하단에 미세한 로딩 표시
    setAwaitingFinalResult(true);
    // [Fix] currentScene을 null로 설정하지 않음 — 나레이션 레이턴시 마스킹 보존

    const cost = 1;
    setEnergy(prev => Math.max(0, prev - cost));

    let firstSceneReceived = false;

    try {
      await sendAutoDirectorResponse(roomId, directiveType, eventContext, {
        onEventMeta: (meta) => {
          if (meta.eventStatus) {
            setEventStatus(meta.eventStatus);
            setEventActive(meta.eventStatus === "ONGOING");
          }
        },

        onFirstScene: (scene) => {
          firstSceneReceived = true;
          setIsTyping(false);
          setAwaitingFinalResult(false);
          const sceneData = {
            speaker: scene.speaker || null,
            narration: scene.narration, dialogue: scene.dialogue,
            emotion: scene.emotion || "NEUTRAL",
            location: scene.location, time: scene.time,
            outfit: scene.outfit, bgmMode: scene.bgmMode,
          };

          // [UX Fix Bug 1] 나레이션이 표시 중(isEvent=true)이면 큐로 추가
          // → 유저가 나레이션 읽고 클릭할 때 첫 캐릭터 씬 재생
          if (currentSceneRef.current?.isEvent) {
            setSceneQueue(prev => [...prev, sceneData]);
          } else {
            setCurrentScene(sceneData);
            if (scene.speaker && scene.speaker !== roomInfo?.characterName) {
              setNpcSpeaker(scene.speaker);
              setCurrentSpeaker(scene.speaker);
            } else {
              setCurrentSpeaker(scene.speaker || null);
            }
            setDisplayedEmotion(scene.emotion || "NEUTRAL");
          }
        },

        onFinalResult: (data) => {
          if (!firstSceneReceived) setIsTyping(false);
          setAwaitingFinalResult(false);
          setDirectorAutoProcessing(false);

          const { scenes, currentAffection, stats: newStats, bpm: newBpm,
                  dynamicRelationTag: newRelTag, eventStatus: newEventStatus,
                  topicConcluded: newTopicConcluded,
                  locationTransition: resLocTransition,
          } = data;

          setAffection(currentAffection);
          if (newStats) setCharacterStats(newStats);
          if (newBpm !== undefined) setCurrentBpm(newBpm);
          if (newRelTag) setDynamicRelationTag(newRelTag);

          if (newEventStatus) {
            setEventStatus(newEventStatus);
            setEventActive(newEventStatus === "ONGOING");
            if (newEventStatus === "RESOLVED") {
              setTimeout(() => {
                setEventStatus(null); setEventActive(false);
                setIsObserverEvent(false); clearNpcState();
              }, 2000);
            }
          }

          if (newTopicConcluded !== undefined) setTopicConcluded(newTopicConcluded);

          if (scenes && scenes.length > 1) setSceneQueue(scenes.slice(1));
          detectNpc(scenes);

          const entries = buildHistoryEntries(scenes, null, false);
          if (entries.length > 0) setMessages(prev => [...prev, ...entries]);

          // 장소 전환 처리
          if (resLocTransition) {
            if (resLocTransition.backgroundUrl) {
              setDynamicBackgroundUrl(resLocTransition.backgroundUrl);
              setLocationTransition(null);
            } else if (resLocTransition.isGenerating) {
              setLocationTransition({
                active: true, locationName: resLocTransition.locationName,
                cacheHash: resLocTransition.cacheHash, isGenerating: true,
              });
            }
          }

          // [UX Fix 2b] AWAY 이벤트 진행 중: 유저 클릭 대기 → 다음 씬
          // RESOLVED: AWAY 종료 → 유저에게 "다음 씬" 버튼으로 복귀 유도
          if (directiveType === "AWAY") {
            if (newEventStatus === "RESOLVED") {
              // AWAY 이벤트 종료: 유저가 언제든 "다음 씬" 누르면 다시 시작 가능
              // 추가 자동 진행 없음 — 유저 능동 선택으로
            } else if (newEventStatus === "ONGOING") {
              // AWAY 계속 진행: 다음 씬을 유저가 클릭해야 진행
              pendingDirectorActionRef.current = { type: "AWAY_CONTINUE" };
            }
          }

          // 디렉터 자동 체크 재스케줄
          scheduleDirectorAutoCheck();

          api.get("/users/me").then(res => {
            if (res.data.energy !== undefined) setEnergy(res.data.energy);
            if (res.data.freeEnergy !== undefined) setFreeEnergy(res.data.freeEnergy);
            if (res.data.paidEnergy !== undefined) setPaidEnergy(res.data.paidEnergy);
          }).catch(() => {});
        },

        onError: (error) => {
          console.error("[Director-Auto] SSE error:", error);
          setIsTyping(false); setAwaitingFinalResult(false); setDirectorAutoProcessing(false);
          setEnergy(prev => prev + cost);
          showToast(error.message || "자동 응답 처리 중 오류가 발생했습니다.", "error");
        },
      });
    } catch (err) {
      setIsTyping(false); setAwaitingFinalResult(false); setDirectorAutoProcessing(false);
      setEnergy(prev => prev + cost);
      showToast("자동 응답 처리 중 오류가 발생했습니다.", "error");
    }
  }, [roomId, roomInfo]);

  /**
   * [v3 UX Fix] AWAY 이벤트 자동 진행 제거
   * 기존 setTimeout 기반 자동 진행 → pendingDirectorActionRef 패턴으로 대체
   * 유저가 "다음 씬" 버튼을 눌러야 다음 AWAY 씬이 진행됨
   */
  const awayAutoAdvanceTimer = useRef(null); // 호환성 유지 (참조만 남김)

  /**
   * [Phase 6 도그푸딩 #1] 자동 인터루드 폐기 — no-op.
   *
   * 백엔드 ChatStreamService에서 자동 디렉터 트리거가 제거되어
   * peekDirectorDirective는 *수동 호출 직후*를 제외하면 항상 비어 있다.
   * 따라서 이 폴링 자체가 무의미. 호출처는 보존하여 미래 부활 시 복원 비용 최소화.
   *
   * 안전망: 이전에 등록된 타이머가 있으면 cleanup만 수행.
   */
  const scheduleDirectorAutoCheck = useCallback(() => {
    if (directorAutoCheckTimer.current) {
      clearTimeout(directorAutoCheckTimer.current);
      directorAutoCheckTimer.current = null;
    }
  }, [roomId, isStoryMode]);

  // ━━━ [Phase 5.5-Fix] 3-Layer 통합 헬퍼 함수 ━━━

  /**
   * 씬 배열 → 히스토리 엔트리 변환.
   * 이벤트/일반 채팅 구분 없이 항상 동일 포맷:
   * - 씬별 분리
   * - 나레이션 포함 (*narration*)
   * - speaker 태깅 (NPC면 role='NPC')
   */
  const buildHistoryEntries = useCallback((scenes, resLogId, resHasThought) => {
    if (!scenes || scenes.length === 0) return [];
    const heroNames = isV2 ? (v2Room?.heroines || []).map((h) => h.name) : (roomInfo?.characterName ? [roomInfo.characterName] : []);
    return scenes.map((s, i) => {
      // [UX#3] 단일 분류기 — 시스템/NPC/히로인
      const sys = isSystemSpeakerName(s.speaker);
      const isHero = !sys && heroNames.includes(s.speaker);
      const isNpc = !sys && !isHero;
      const content = [];
      if (s.narration) content.push(`*${s.narration}*`);
      if (s.dialogue) content.push(s.dialogue);
      return {
        role: sys ? 'SYSTEM' : (isNpc ? 'NPC' : 'ASSISTANT'),
        cleanContent: sys ? (s.narration || '') : content.join('\n'),
        speaker: sys ? null : (s.speaker || null),
        logId: (i === scenes.length - 1) ? (resLogId || null) : null,
        parentLogId: resLogId || null,  // [Bug Fix #1] 모든 씬에 원본 logId 공유 — 일괄 삭제용
        hasInnerThought: (i === scenes.length - 1) ? !!resHasThought : false,
        thoughtUnlocked: false,
        innerThought: null,
        // [리플레이 E6] 라이브 구간도 씬 감정·복장 보존 — 새로고침 전 리플레이 재현용
        emotionTag: s.emotion || null,
        outfit: s.outfit ?? null,
      };
    });
  }, [roomInfo, isV2, v2Room]);

  /**
   * 씬 배열에서 NPC speaker 감지 → 상태 업데이트.
   * 이벤트/일반 채팅 모두에서 호출.
   */
  const detectNpc = useCallback((scenes) => {
    if (!scenes || scenes.length === 0) return;
    const heroNames = isV2 ? (v2Room?.heroines || []).map((h) => h.name) : (roomInfo?.characterName ? [roomInfo.characterName] : []);
    // [UX#3] 진짜 NPC(비시스템·비히로인)만 — 시스템("null"/공백) 화자를 NPC로 오인하지 않음
    const npcScene = scenes.find((s) => !isSystemSpeakerName(s.speaker) && !heroNames.includes(s.speaker));
    if (npcScene) setNpcSpeaker(npcScene.speaker);
  }, [roomInfo, isV2, v2Room]);

  /**
   * NPC/speaker 상태 완전 초기화.
   * 이벤트 종료 시 호출.
   */
  const clearNpcState = useCallback(() => {
    setNpcSpeaker(null);
    setCurrentSpeaker(null);
  }, []);

  /**
   * ChatLogResponse (서버 로그) → 프론트 메시지 배열 확장.
   * scenesJson이 있으면 씬별 분리 복원, 없으면 기존 cleanContent 사용.
   */
  // [Bug-Restore] ctx로 분류 컨텍스트를 명시 전달 가능 — init처럼 state가 아직 stale한 시점에서
  //   방금 fetch한 로컬 값을 직접 넘겨 결정적 분류를 보장한다. 미전달 시 기존 state 사용(다른 호출처 무영향).
  const expandLogWithScenes = useCallback((log, ctx) => {
    const ctxIsV2 = ctx ? !!ctx.isV2 : isV2;
    const ctxHeroines = ctx ? (ctx.heroines || []) : (v2Room?.heroines || []);
    const ctxCharacterName = ctx ? (ctx.characterName ?? null) : (roomInfo?.characterName ?? null);
    if (log.role === 'ASSISTANT' && log.scenesJson) {
      try {
        const scenes = JSON.parse(log.scenesJson);
        return scenes.map((scene, i) => {
          const content = [];
          if (scene.narration) content.push(`*${scene.narration}*`);
          if (scene.dialogue) content.push(scene.dialogue);
          const base = {
            logId: (i === scenes.length - 1) ? log.logId : null,
            parentLogId: log.logId,  // [Bug #1 Fix] 모든 씬에 원본 logId 공유 — 일괄 삭제용
            hasInnerThought: (i === scenes.length - 1) ? log.hasInnerThought : false,
            thoughtUnlocked: log.thoughtUnlocked || false,
            innerThought: log.innerThought || null,
            emotionTag: scene.emotion || log.emotionTag,
            // [리플레이] 씬 컨텍스트 복장(2026-08-07 백엔드 영속) — 레거시 로그는 null
            outfit: scene.outfit ?? null,
            // [Scene-Polish C] 방 내 절대 서수 — 히스토리 씬 마커 매핑 키 (씬별 분리돼도 원본 로그 서수 공유)
            ordinal: log.ordinal ?? null,
          };
          if (ctxIsV2) {
            // [E-1 A-2] V2: 시스템 씬 판정 — 백엔드 권위값(scene.isSystem) 우선, 없으면(레거시 로그) speaker 유무로 폴백.
            //   이름 매칭 휴리스틱(roomInfo.characterName 비교) 제거 — V2는 멀티 히로인이라 단일 이름 비교가 부정확.
            // [UX#3] 단일 분류기 — 라이브/히스토리와 동일 규칙(마커 "null"/공백 흡수). 복원이 결정적이 됨.
            const isSystem = isSystemSpeakerName(scene.speaker);
            const heroNames = ctxHeroines.map((h) => h.name);
            const isNpc = !isSystem && !heroNames.includes(scene.speaker);
            return {
              ...base,
              // 시스템 씬 → SYSTEM role(인디고 pill, 이름 비노출). NPC는 NPC role. 라이브와 동일 규칙.
              role: isSystem ? 'SYSTEM' : (isNpc ? 'NPC' : 'ASSISTANT'),
              // SYSTEM은 나레이션만 → 깔끔히. 일반 씬은 기존 포맷(*나레이션*\n대사).
              cleanContent: isSystem ? (scene.narration || '') : content.join('\n'),
              // 시스템 씬은 speaker=null 보존 → 가짜 이름("캐릭터"/"null") 노출 불가능.
              speaker: isSystem ? null : (scene.speaker || null),
            };
          }
          // V1 (SANDBOX 폴백): 기존 동작 그대로 보존 — ChatPageV2가 비-V2 방을 폴백 렌더할 때.
          const isNpc = scene.speaker && scene.speaker !== ctxCharacterName;
          return {
            ...base,
            role: isNpc ? 'NPC' : 'ASSISTANT',
            cleanContent: content.join('\n'),
            speaker: scene.speaker || ctxCharacterName || "캐릭터",
          };
        });
      } catch (e) {
        // scenesJson 파싱 실패 → 기존 방식 fallback
        return [log];
      }
    }
    return [log];
  }, [isV2, roomInfo, v2Room]);

  // [Issue #1 Fix] sceneActiveRef — 대기 중인 씬 큐 추적
  useEffect(() => {
    sceneActiveRef.current = sceneQueue.length > 0;
  }, [sceneQueue]);

  // [UX Fix Bug 1] currentSceneRef 동기화 — 나레이션 표시 중 첫 씬 덮어쓰기 방지
  useEffect(() => {
    currentSceneRef.current = currentScene;
  }, [currentScene]);

  // [Bug Fix #3] 디렉터 가드 조건 ref 동기화 — stale closure 방지
  useEffect(() => { eventActiveRef.current = eventActive; }, [eventActive]);
  useEffect(() => { awaitingFinalResultRef.current = awaitingFinalResult; }, [awaitingFinalResult]);
  useEffect(() => { isTypingRef.current = isTyping; }, [isTyping]);
  useEffect(() => { directorAutoProcessingRef.current = directorAutoProcessing; }, [directorAutoProcessing]);

  // [Phase 4.4] 투명인간 이스터에그 — 10분 방치 감지
  useInvisibleMan({
    enabled: !isTyping && !showEndingCredits && introStep === 'none' && !easterEggEffect,
    characterName: roomInfo?.characterName,
    onTrigger: (data) => {
      // 1. 시각 효과 시작
      setEasterEggEffect("INVISIBLE_MAN");
      // 2. 고정 대사 표시
      setCurrentScene(data.scene);
      setDisplayedEmotion(data.scene.emotion);
      // 3. 업적 모달은 효과 종료 후
      if (data.achievement?.isNew) {
        setTimeout(() => setAchievementModal(data.achievement), 12000);
      }
    },
  });

  // ── Refs: 비동기 효과 ↔ 핸들러 간 데이터 전달용 ──
  const pendingAchievementRef = useRef(null);       // 효과 종료 후 표시할 업적 데이터
  const preEasterEggStateRef = useRef(null);        // FOURTH_WALL 롤백용 이전 상태 스냅샷

  const easterEggEffectRef = useRef(null);          // easterEggEffect의 최신값 

  // effectRef를 항상 최신으로 동기화
  useEffect(() => {
    easterEggEffectRef.current = easterEggEffect;
  }, [easterEggEffect]);

  // ================= [Phase 4 Fix] Progressive Resource Preloading =================
  // 캐릭터별 독립 세계관 — 서버에서 받은 허용 복장/장소 기반 프리로딩
  const { preloadEndingAssets } = useResourcePreloader(
    roomInfo?.statusLevel,
    roomInfo?.secretModeActive,
    roomInfo?.characterSlug,
    roomInfo?.availableOutfits || [],
    roomInfo?.availableLocations || []
  );

  useEffect(() => {
    return () => {
      if (directorAutoCheckTimer.current) {
        clearTimeout(directorAutoCheckTimer.current);
      }
    };
  }, []);

  // ================= BGM Logic (Phase 4: AudioEngine handles playback) =================
  const toggleBgm = () => {
    setIsBgmPlaying(!isBgmPlaying);
  };

  // 인트로 완료 시 BGM 자동 시작
  // bgmMode와 isBgmPlaying을 반드시 같은 effect에서 동시에 세팅해야
  // AudioEngine이 unmuted 상태에서 audio를 생성 → Autoplay Policy 통과
  useEffect(() => {
    if (introStep === 'none' && !isLoading && !isBgmPlaying) {
      const restoredBgm = roomInfo?.currentBgmMode || "DAILY";
      setCurrentBgmMode(restoredBgm);
      setIsBgmPlaying(true);
    }
  }, [introStep, isLoading]);

  useEffect(() => {
    if (introStep === 'door') {
      sfx.wooshDeep();  // ⬅️ 깊은 진입 woosh
    }
  }, [introStep]);

  useEffect(() => {
    localStorage.setItem("bgmVolume", String(bgmVolume));
  }, [bgmVolume]);

  useEffect(() => {
    const handler = (e) => {
      showToast(`요청이 너무 빠릅니다. ${e.detail.retryAfter}초 후 다시 시도해주세요.`, 'warning');
    };
    window.addEventListener('rate-limited', handler);
    return () => window.removeEventListener('rate-limited', handler);
  }, []);

  // ================= User Info Logic =================
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const res = await api.get("/users/me");
        setUserInfo({
          nickname: res.data.nickname || "",
          profileDescription: res.data.profileDescription || "",
          isSecretMode: res.data.isSecretMode || false,
          isAdultVerified: res.data.isAdultVerified || false,
          subscriptionTier: res.data.subscriptionTier || null,
        });

        setBoostMode(res.data.boostMode || false);
        setIsSubscriber(!!res.data.subscriptionTier);
        setFreeEnergyMax(res.data.freeEnergyMax || 30);
      } catch (err) {
        console.error("Failed to fetch user info", err);
      }
    };
    // 설정창뿐 아니라 초기 로딩 시에도 시크릿 모드 정보가 필요함 (이벤트 카드용)
    fetchUserInfo();
  }, []); // Mount 시 한 번 실행

  // 설정창 열릴 때 리프레시
  useEffect(() => {
      if(showSettings) {
          api.get("/users/me").then(res => setUserInfo(prev => ({...prev, isSecretMode: res.data.isSecretMode})));
      }
  }, [showSettings]);

  const handleUpdateProfile = async () => {
    setIsSavingProfile(true);
    try {
      // [Bug #3 Fix] 닉네임은 유저 레벨, 페르소나는 방 레벨로 분리
      await Promise.all([
        api.patch("/users/update", { nickname: userInfo.nickname }),
        api.patch(`/chat/rooms/${roomId}/persona`, { persona: roomPersona })
      ]);
      showToast("프로필이 성공적으로 저장되었습니다.", "success");
    } catch (err) {
      console.error(err);
      showToast("저장에 실패했습니다.", "error");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // [Bug #3 Fix] 시크릿 모드 토글 — 채팅방 단위
  const toggleSecretMode = async () => {
      const nextValue = !roomInfo?.secretModeActive;
      setRoomInfo(prev => prev ? { ...prev, secretModeActive: nextValue } : prev);
      try {
          await api.patch(`/chat/rooms/${roomId}/secret-mode`, { enabled: nextValue });
      } catch (err) {
          setRoomInfo(prev => prev ? { ...prev, secretModeActive: !nextValue } : prev);
          const errMsg = err.response?.data?.message || "설정 변경에 실패했습니다.";
          showToast(errMsg, "error");
      }
  };

  const handleEasterEggEnd = useCallback(() => {
    const currentEffect = easterEggEffectRef.current;

    // 일시 효과: 즉시 해제
    if (currentEffect === "FOURTH_WALL" || currentEffect === "MACHINE_REBELLION" || currentEffect === "INVISIBLE_MAN") {
      setEasterEggEffect(null);
    }

    // 대기 중인 업적 모달이 있으면 표시
    if (pendingAchievementRef.current) {
      // 약간의 딜레이로 효과 페이드아웃과 모달 진입이 겹치지 않게
      setTimeout(() => {
        setAchievementModal(pendingAchievementRef.current);
        pendingAchievementRef.current = null;
      }, 500);
    }
  }, []); // deps 비움 — ref를 통해 최신값 참조하므로 리렌더 불필요

  // 길면 여러 씬으로 쪼개는 유틸 (문장/줄 기준 + maxChars)
  const splitNarration = (text, maxChars = 140) => {
    const cleaned = (text ?? "")
      .replace(/^\s*\[NARRATION\]\s*/i, "") // [NARRATION] 태그 제거
      .trim();

  // 줄바꿈 단락 기준
  const paras = cleaned.split(/\n+/).map(s => s.trim()).filter(Boolean);

  // 문장 단위로 쪼개기 (마침표/물음표/느낌표/… 기준)
  const sentences = paras.flatMap(p => p.match(/[^.!?…]+[.!?…]?/g) ?? [p]);

  const chunks = [];
  let buf = "";
  for (const s of sentences) {
    if (!buf) buf = s.trim();
    else if ((buf + " " + s).length <= maxChars) buf += " " + s.trim();
    else {
      chunks.push(buf.trim());
      buf = s.trim();
    }
  }
  if (buf) chunks.push(buf.trim());
  return chunks;
  };

  const handleAchievementModalClose = useCallback(() => {
    const snapshot = preEasterEggStateRef.current;

    if (snapshot) {
      // FOURTH_WALL 롤백: 마지막 USER 메시지 + ASSISTANT 응답 제거
      setMessages(snapshot.messages);
      setCurrentScene(snapshot.currentScene);
      setDisplayedEmotion(snapshot.displayedEmotion);
      setSceneQueue([]);
      preEasterEggStateRef.current = null;

      console.log("🔄 [EASTER_EGG] FOURTH_WALL conversation reverted");
    }

    setAchievementModal(null);
  }, []);

  // ================= Init Logic =================
  useEffect(() => {
    const init = async () => {
      if(!roomId) return;
      // [Phase 5 Fix] StrictMode 중복 init 방지
      if (initCalledRef.current === roomId) return;
      initCalledRef.current = roomId;

      setIsLoading(true); 

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      //  [Phase 7-V2 Pivot] V2 방 우선 시도 — 성공 시 V1 init 건너뜀
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      try {
        const v2Detail = await fetchStoryV2RoomDetail(roomId);
        console.log("[V2-Init] V2 방 확인됨:", v2Detail.worldDisplayName);

        setIsV2(true);
        setV2Room(v2Detail);

        // V2 → V1 호환 roomInfo 매핑 (첫 히로인 기준 — currentSpeakerHeroine memo가 추후 갱신)
        const firstHeroine = v2Detail.heroines?.[0];
        if (firstHeroine) {
          setRoomInfo({
            roomId: v2Detail.roomId,
            characterId: firstHeroine.characterId,
            characterName: firstHeroine.name,
            characterSlug: firstHeroine.slug || null,
            defaultOutfit: firstHeroine.defaultOutfit || "MAID",
            chatMode: "STORY",
            currentBgmMode: v2Detail.currentBgmMode || "DAILY_CALM",  // [Bug-BGM] V2 저장 모드 복원, 기본 calm
            statusLevel: firstHeroine.relationStatus || "STRANGER",
            secretModeActive: v2Detail.secretModeActive,
          });
          setCurrentOutfit(firstHeroine.defaultOutfit || "MAID"); // [Bug-Sprite] 첫 히로인 복장으로 초기화
          // V1 stats / bpm / 동적 관계 / 속마음을 첫 히로인 값으로 시드 (이후 onFinalResult에서 갱신)
          if (firstHeroine.stats) setCharacterStats(firstHeroine.stats);
          if (firstHeroine.currentBpm !== undefined) setCurrentBpm(firstHeroine.currentBpm);
          if (firstHeroine.dynamicRelationTag) setDynamicRelationTag(firstHeroine.dynamicRelationTag);
          if (firstHeroine.characterThought) setCharacterThought(firstHeroine.characterThought);
          setAffection(firstHeroine.statAffection ?? 0);
        }

        // 동적 배경
        if (v2Detail.currentDynamicBgUrl) {
          setDynamicBackgroundUrl(v2Detail.currentDynamicBgUrl);
        }

        // V1 시간/장소 어댑팅 — V2 DayPart enum → V1 TimeOfDay 매핑
        const v1Time = dayPartToV1Time(v2Detail.currentDayPart);
        if (v1Time) setCurrentTime(v1Time);
        // V2 location은 동적 키 — V1 enum 매핑 불가, null로 두어 동적 배경만 사용
        setCurrentLocation(null);

        // User 정보 병렬 로드
        try {
          const userRes = await api.get("/users/me");
          setUserInfo({
            nickname: userRes.data.nickname || "",
            profileDescription: userRes.data.profileDescription || "",
            isSecretMode: userRes.data.isSecretMode || false,
          });
          if (userRes.data.energy !== undefined) {
            setEnergy(userRes.data.energy);
            if (userRes.data.freeEnergy !== undefined) setFreeEnergy(userRes.data.freeEnergy);
            if (userRes.data.paidEnergy !== undefined) setPaidEnergy(userRes.data.paidEnergy);
          }
        } catch (e) { console.warn("[V2-Init] user load failed", e); }

        // V2 페르소나는 read-only — userPersona 사용 (CreateFlow에서 확정됨)
        setRoomPersona(v2Detail.userPersona || "");

        // V2 채팅 로그 (대화 기록용) — V1과 동일 endpoint 재사용
        try {
          const logsRes = await api.get(`/chat/rooms/${roomId}/logs?page=0&size=50`);
          const logs = (logsRes.data?.content || []).reverse();
          // [Scene-Polish D] 씬 복원 K-윈도우 판정 입력 — 방 로그 총수(Spring Page.totalElements) 전달
          sceneStage.notifyLogTotal(logsRes.data?.totalElements ?? logs.length);
          const expandedLogs = [];
          // [Bug-Restore] 방금 fetch한 v2Detail을 ctx로 명시 전달 — useCallback 클로저의 stale
          //   state(isV2=false, v2Room=null) 때문에 V1 분기로 추락하던 복원 분류 버그의 근본 수정.
          const restoreCtx = { isV2: true, heroines: v2Detail.heroines || [], characterName: null };
          for (const log of logs) {
            const expanded = expandLogWithScenes(log, restoreCtx);
            expandedLogs.push(...expanded);
          }
          setMessages(expandedLogs);
          setHistoryPage(1);
          setHasMoreHistory(logs.length >= 50);

          // 마지막 로그가 있으면 currentScene 복원
          if (expandedLogs.length > 0) {
            const lastLog = expandedLogs[expandedLogs.length - 1];
            const lastIsSystem = lastLog.role === 'SYSTEM';
            // [E-1 A-2] SYSTEM 씬도 복원 대상에 포함하되 speaker=null + isEvent=true로 이름 비노출.
            //   firstHeroine?.name 폴백 제거 — 시스템 씬을 첫 히로인 이름으로 둔갑시키던 원인.
            if (lastLog.role === 'ASSISTANT' || lastLog.role === 'NPC' || lastIsSystem) {
              setCurrentScene({
                speaker: lastIsSystem ? null : (lastLog.speaker || null),
                dialogue: lastIsSystem ? '' : (lastLog.cleanContent?.replace(/^\*.*\*\n?/, '') || ''),
                narration: lastIsSystem ? (lastLog.cleanContent || '') : "",
                emotion: lastLog.emotionTag || "NEUTRAL",
                isEvent: lastIsSystem,
              });
              // [Bug-Restore] 화자 상태도 라이브와 동일하게 복원 — 스프라이트/이름 표기 일치.
              if (!lastIsSystem && lastLog.speaker) {
                if (lastLog.role === 'NPC') { setNpcSpeaker(lastLog.speaker); setCurrentSpeaker(null); }
                else { setCurrentSpeaker(lastLog.speaker); setNpcSpeaker(null); }
              } else { setCurrentSpeaker(null); setNpcSpeaker(null); }
            }
            // [Bug-Restore] dialogue_options 복원 — 마지막 ASSISTANT 원본 로그의 dialogueOptionsJson.
            const lastAssistantRaw = [...logs].reverse().find((l) => l.role === 'ASSISTANT');
            // [Bug-Thought] 속마음 상태 복원 — 새고 후 말풍선/탭/해금 연속성
            if (lastAssistantRaw) {
              setHasInnerThought(!!lastAssistantRaw.hasInnerThought);
              setThoughtUnlocked(!!lastAssistantRaw.thoughtUnlocked);
              setCurrentInnerThought(lastAssistantRaw.thoughtUnlocked ? (lastAssistantRaw.innerThought || null) : null);
              setCurrentAssistantLogId(lastAssistantRaw.logId || null);
            }
            if (lastAssistantRaw?.dialogueOptionsJson) {
              try {
                const opts = JSON.parse(lastAssistantRaw.dialogueOptionsJson);
                if (Array.isArray(opts) && opts.length > 0) setDialogueOptions(opts);
              } catch (_) { /* ignore malformed */ }
            }
          }
          // [Bug-Restore] topicConcluded 복원 — V1 init에는 있던 복원이 V2 init에 누락돼 있었음.
          if (v2Detail.topicConcluded !== undefined) setTopicConcluded(v2Detail.topicConcluded);
        } catch (e) { console.warn("[V2-Init] logs load failed", e); }

        // 알림
        try {
          const notifs = await fetchUnreadNotifications(roomId);
          setNotifications(notifs || []);
        } catch (e) { console.warn("[V2-Init] notifs load failed", e); }

        // V2 엔딩 도달 시 크레딧 즉시 노출
        if (v2Detail.endingReached) {
          console.log("[V2-Init] 엔딩 도달 — 크레딧 노출");
          setShowV2EndingCredits(true);
        }

        // 인트로 스킵 — V2는 CreateFlow에서 처리
        setIntroStep('none');  // [Bug-BGM] 'none' 통일 — BGM 자동시작 effect(introStep==='none')가 V2에서 영원히 불발하던 근본 수정
        setIsLoading(false);
        return;  // V1 init 건너뜀

      } catch (v2Err) {
        // 400 = "V2 방 아님" → V1 init으로 폴백
        if (v2Err.response?.status === 400 || v2Err.response?.status === 404) {
          console.log("[V2-Init] V2 방 아님 → V1 init 시도");
        } else {
          console.warn("[V2-Init] 예상치 못한 에러 — V1 init 시도", v2Err);
        }
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      //  V1 init (기존 흐름 — 무수정)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

      try {
        // 1. 기본 정보 병렬 로드
        const [roomRes, userRes, logsRes, charsRes] = await Promise.all([
          api.get(`/chat/rooms/${roomId}`),
          api.get("/users/me"),
          api.get(`/chat/rooms/${roomId}/logs?page=0&size=50`),
          api.get("/lobby/characters").catch(() => ({ data: [] })),
        ]);

        setCharacters(charsRes.data || []);

        setRoomInfo(roomRes.data);
        // [Bug #3 Fix] 채팅방 전용 페르소나 초기화
        setRoomPersona(roomRes.data.userPersona || userRes.data.profileDescription || "");
        // [Phase 5.5] 상태창 데이터 복원
        if (roomRes.data.stats) setCharacterStats(roomRes.data.stats);
        if (roomRes.data.bpm !== undefined) setCurrentBpm(roomRes.data.bpm);
        if (roomRes.data.dynamicRelationTag) setDynamicRelationTag(roomRes.data.dynamicRelationTag);
        if (roomRes.data.characterThought) setCharacterThought(roomRes.data.characterThought);
        setAffection(roomRes.data.affectionScore);
        setUserInfo({
            nickname: userRes.data.nickname || "",
            profileDescription: userRes.data.profileDescription || "",
            isSecretMode: userRes.data.isSecretMode || false
        });
        // [Fix] Energy sync - force sync with actual server energy value
        if (userRes.data.energy !== undefined) {
            setEnergy(userRes.data.energy);
            // [Phase 5.5-Fix #1] 분리 에너지 동기화
            if (userRes.data.freeEnergy !== undefined) setFreeEnergy(userRes.data.freeEnergy);
            if (userRes.data.paidEnergy !== undefined) setPaidEnergy(userRes.data.paidEnergy);
        }

        // [Phase 5.5-EV] 이벤트 상태 복원
        if (roomRes.data.topicConcluded !== undefined) setTopicConcluded(roomRes.data.topicConcluded);
        if (roomRes.data.eventActive !== undefined) setEventActive(roomRes.data.eventActive);
        if (roomRes.data.eventStatus) setEventStatus(roomRes.data.eventStatus);

        // [Phase 4.1] 씬 상태 복원 (재접속 시 서버에서 마지막 상태 로드)
        // [Phase 5] 캐릭터별 기본값 사용 — roomInfo.defaultLocation/defaultOutfit 폴백
        // Note: bgmMode는 여기서 복원하지 않음 — auto-start effect에서 isBgmPlaying과 동시에 세팅해야
        // 브라우저 Autoplay Policy 문제를 방지할 수 있음
        setCurrentLocation(roomRes.data.currentLocation || roomRes.data.defaultLocation || "ENTRANCE");
        setCurrentOutfit(roomRes.data.currentOutfit || roomRes.data.defaultOutfit || "MAID");
        if (roomRes.data.currentTimeOfDay) setCurrentTime(roomRes.data.currentTimeOfDay);

        // [Phase 5.5-Fix] 동적 배경 복원 (AI 생성 배경이 있으면 정적 배경 대신 사용)
        if (roomRes.data.currentDynamicBgUrl) {
          setDynamicBackgroundUrl(roomRes.data.currentDynamicBgUrl);
        }

        const logs = logsRes.data?.content || [];
        // [Scene-Polish D] 씬 복원 K-윈도우 판정 입력 — 방 로그 총수(Spring Page.totalElements) 전달 (V1 폴백)
        sceneStage.notifyLogTotal(logsRes.data?.totalElements ?? logs.length);

        // [Phase 4 Fix] 히스토리 페이지네이션 초기화
        setHistoryPage(1);
        setHasMoreHistory(logs.length >= 50);

        if (logs.length === 0) {
            // [Case A] 신규 유저 -> 인트로 시퀀스 시작
            await startIntroSequence(roomId, roomRes.data);
        } else {
            // [Case B] 기존 유저 -> 마지막 상태 복원
            const sortedLogs = logs.reverse();

            // [Phase 5.5-Fix] scenesJson 기반 씬별 분리 복원
            // [Bug-Restore] V1도 동일하게 로컬 roomRes로 ctx 명시 — setRoomInfo 직후 stale 차단.
            const expandedLogs = [];
            const restoreCtxV1 = { isV2: false, heroines: [], characterName: roomRes.data?.characterName ?? null };
            for (const log of sortedLogs) {
              const expanded = expandLogWithScenes(log, restoreCtxV1);
              expandedLogs.push(...expanded);
            }
            setMessages(expandedLogs);
            
            // 마지막 로그가 캐릭터 대사라면 씬 복원
            if (expandedLogs.length > 0) {
               const lastLog = expandedLogs[expandedLogs.length - 1];
               if (lastLog.role === 'ASSISTANT' || lastLog.role === 'NPC') {
                 setCurrentScene({
                   dialogue: lastLog.cleanContent?.replace(/^\*.*\*\n?/, '') || '',
                   narration: "",
                   emotion: lastLog.emotionTag || "NEUTRAL"
                 });
                 setDisplayedEmotion(lastLog.emotionTag || "NEUTRAL");
               }
            }
        }
      } catch (err) {
        console.error("Init Error", err);
        showToast("초기화 중 오류가 발생했습니다.", "error");
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [roomId]);

  const startIntroSequence = async (roomId, roomData) => {
      setIntroStep('door'); // 1. 영상 재생 시작
      
      try {
          // 2. 백엔드 init (나레이션 + 첫인사 생성)
          await api.post(`/chat/rooms/${roomId}/init`);
          
          // 3. 생성된 로그 가져오기
          const logsRes = await api.get(`/chat/rooms/${roomId}/logs?page=0&size=5`);
          const newLogs = logsRes.data.content.reverse();
          
          setMessages(newLogs);

          // 4. 씬 큐(Scene Queue) 구성
          // UX: 영상이 끝나면(IntroStep none) -> System 나레이션 재생 -> Assistant 대사 재생
          const queue = [];
          
          // (1) 나레이션 씬
          const narrationLog = newLogs.find(l => l.role === 'SYSTEM');
          if (narrationLog) {
            const parts = splitNarration(narrationLog.cleanContent, 140);
            parts.forEach(part => {
              queue.push({
                  dialogue: "", 
                  narration: part, 
                  emotion: "NEUTRAL",
                  isEvent: true,
                  sceneType: "INTRO",
                  isIntroNarration: true // 캐릭터 숨김용 플래그
              });
            });
          }
          
          // (2) 첫인사 씬 — [Phase 5] roomData에서 직접 캐릭터 이름 참조 (stale closure 방지)
          // [Scene-Polish A] 하드코딩 narrationMap 삭제 — 서버가 이미 생성해 로그로 도착한
          //   SYSTEM 인트로 나레이션의 *마지막 문장*을 첫인사 씬 나레이션으로 재사용.
          //   SYSTEM 로그가 없는 레거시 UGC 방만 제네릭 폴백 — V1과 동일하게 받침 조사 처리('가' 고정 버그 픽스).
          const greetingLog = newLogs.find(l => l.role === 'ASSISTANT');
          if (greetingLog) {
              const charName = roomData?.characterName || "캐릭터";
              const introTail = narrationLog ? extractLastSentence(narrationLog.cleanContent) : "";
              queue.push({
                  dialogue: greetingLog.cleanContent,
                  narration: introTail || `${charName}${subjectJosa(charName)} 고개를 숙여 인사하며 부드럽게 미소짓는다.`,
                  emotion: greetingLog.emotionTag,
                  isEvent: false,
                  sceneType: "NORMAL"
              });
          }
          
          setSceneQueue(queue); // 큐에 넣고 대기 (영상 끝나면 Scene logic이 돌 것임)
          
      } catch (e) {
          console.error("Intro Sequence Failed", e);
      }
  };

  const handleIntroVideoEnd = () => {
      setIntroStep('none'); // 오버레이 제거 -> 이때부터 DialogueBox가 보임
      // DialogueBox는 sceneQueue에 들어있는 첫 번째(나레이션)를 자동으로 재생 시작
  };

  // ================= Chat Logic =================
  useEffect(() => {
    if (user?.energy !== undefined) {
      setEnergy(user.energy);
    }
  }, [user]);

  // [Phase 4] 씬 전환 시 감정 + 디렉션 업데이트
  // [Phase 4 Fix] 캐릭터별 독립 세계관 — 허용 목록 기반 프론트 가드
  useEffect(() => {
    if (!currentScene) return;
    // [D-3] NPC 판별 — V2는 *세션 히로인 명단* 기준(멀티 히로인 각자 초상), V1은 단일 캐릭터 기준
    const sceneSpeaker = currentScene.speaker;
    // [UX#3] 단일 분류기 — 시스템(마커/공백)/히로인/NPC 3분류 (모든 경로 동일 규칙)
    const sysScene = isSystemSpeakerName(sceneSpeaker);
    const isSessionHeroine = !sysScene && (isV2
        ? !!v2Room?.heroines?.some((h) => h.name === sceneSpeaker)
        : sceneSpeaker === roomInfo?.characterName);
    const isNpcScene = !sysScene && !isSessionHeroine;
    // [Fix-UI-2] NPC 씬이면 캐릭터 감정을 변경하지 않음
    // (캐릭터 이미지가 NPC 감정에 맞춰 바뀌는 버그 방지)
    if (currentScene.emotion && !isNpcScene) {
      setDisplayedEmotion(currentScene.emotion);
    }
    // [Scene-Polish B] 씬 일러 자동 복귀 신호 — 감정이 실제로 바뀌면 훅이 autoDismiss 판단.
    //   V2: 세션 히로인 씬만(멀티 히로인 — 화자 키별 독립 추적, 아무 히로인이든 변화 시 복귀).
    //   V1 폴백: 비-NPC 씬(주연) — 인트로/이벤트 연출 씬은 오탐 방지 위해 제외.
    if (currentScene.emotion && !currentScene.isEvent && !currentScene.isIntroNarration
        && (isV2 ? isSessionHeroine : !isNpcScene)) {
      sceneStage.notifyEmotion(isV2 ? sceneSpeaker : (roomInfo?.characterName || null), currentScene.emotion);
    }
    // [Phase 5.5-NPC] 화자 추적
    if (sysScene) {
      // [UX#3] 시스템 나레이션 — 화자/스프라이트/NPC 모두 비움(보라색 UI는 scene.isEvent가 담당)
      setCurrentSpeaker(null);
      if (!eventActive) setNpcSpeaker(null);
    } else {
      // 히로인은 자기 초상, 진짜 비-히로인(NPC)만 실루엣
      setCurrentSpeaker(sceneSpeaker);
      setNpcSpeaker(isNpcScene ? sceneSpeaker : null);
    }
    // null이 아닌 값만 업데이트 (null = 이전 상태 유지)
    // 프론트 가드: 서버에서 제공한 허용 목록에 포함된 값만 적용
    if (currentScene.location) {
      const allowedLocs = roomInfo?.availableLocations || [];
      if (allowedLocs.length === 0 || allowedLocs.includes(currentScene.location)) {
        // [Phase 5.5-Illust] enum 기반 장소가 실제로 변경되면 AI 생성 배경 오버라이드 해제
        if (currentScene.location !== currentLocation) {
          setDynamicBackgroundUrl(null);
          // [Scene-Polish B] 장소 전환 — 씬 일러 자동 복귀 (스탠딩 무대로)
          sceneStage.notifyLocationChange();
        }
        setCurrentLocation(currentScene.location);
      } else {
        console.warn(`🛡️ [Guard] Location "${currentScene.location}" not in allowed list for ${roomInfo?.characterSlug}, ignoring`);
      }
    }
    if (currentScene.time) setCurrentTime(currentScene.time);
    if (currentScene.outfit) {
      const allowedOutfits = roomInfo?.availableOutfits || [];
      if (allowedOutfits.length === 0 || allowedOutfits.includes(currentScene.outfit)) {
        setCurrentOutfit(currentScene.outfit);
      } else {
        console.warn(`🛡️ [Guard] Outfit "${currentScene.outfit}" not in allowed list for ${roomInfo?.characterSlug}, ignoring`);
      }
    }
    if (currentScene.bgmMode) setCurrentBgmMode(currentScene.bgmMode);
    // sceneStage.notifyEmotion / notifyLocationChange는 안정 콜백(deps []) — 의존성 제외 안전
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScene, eventActive, roomInfo?.characterName, isV2, v2Room?.heroines]);

  // 스크롤 처리
  useEffect(() => {
    if (showHistory && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [showHistory, messages]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  [Phase 4.2] 관계 승급 이벤트 처리
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const getRelationColor = (relation) => {
    switch(relation) {
      case 'ACQUAINTANCE': return { bg: 'from-emerald-600 to-teal-600', border: 'border-emerald-500/50', text: 'text-emerald-300', glow: 'shadow-emerald-500/30' };
      case 'FRIEND': return { bg: 'from-blue-600 to-indigo-600', border: 'border-blue-500/50', text: 'text-blue-300', glow: 'shadow-blue-500/30' };
      case 'LOVER': return { bg: 'from-rose-600 to-pink-600', border: 'border-rose-500/50', text: 'text-rose-300', glow: 'shadow-rose-500/30' };
      default: return { bg: 'from-gray-600 to-gray-700', border: 'border-gray-500/50', text: 'text-gray-300', glow: 'shadow-gray-500/30' };
    }
  };

  const getUnlockIcon = (type) => type === 'LOCATION' ? <MapPin size={22} /> : <Shirt size={22} />;

  const handlePromotionEvent = (promoEvent) => {
    if (!promoEvent) return;
    switch (promoEvent.status) {
      case 'STARTED':
        setPromotionResult(promoEvent);
        setPromotionOverlay('STARTED');
        setPromotionProgress({
          target: promoEvent.targetRelation,
          displayName: promoEvent.targetDisplayName,
          turnsRemaining: promoEvent.turnsRemaining,
          moodScore: 0
        });
        setTimeout(() => setPromotionOverlay(null), 3500);
        break;
      case 'IN_PROGRESS':
        setPromotionProgress({
          target: promoEvent.targetRelation,
          displayName: promoEvent.targetDisplayName,
          turnsRemaining: promoEvent.turnsRemaining,
          moodScore: promoEvent.moodScore
        });
        break;
      case 'SUCCESS':
        setPromotionProgress(null);
        setPromotionResult(promoEvent);
        setPromotionOverlay('SUCCESS_PENDING');
        break;
      case 'FAILURE':
        setPromotionProgress(null);
        setPromotionResult(promoEvent);
        setPromotionOverlay('FAILURE_PENDING');
        break;
    }
  };

  const handleLocationTransitionComplete = useCallback((bgUrl) => {
    setLocationTransition(null);
    if (bgUrl) {
      // 새 배경 URL을 BackgroundDisplay에 전달
      // 기존 BackgroundDisplay가 S3 URL을 직접 사용하도록 확장
      setDynamicBackgroundUrl(bgUrl);
      // 일정 시간 후 리셋 (다음 정적 배경 전환 시까지 유지)
    }
  }, []);

  // [Phase 4.3] 엔딩 트리거 감지 후 씬 재생 완료 시 엔딩 생성
  // [Fix #6] endingTrigger 수신 즉시 BGM 전환 + 백그라운드 API 호출
  useEffect(() => {
    if (!endingTrigger) return;

    // 즉시 엔딩 BGM으로 전환 (씬 소진 기다리지 않음)
    setCurrentBgmMode(endingTrigger.endingType === "HAPPY" ? "ENDING_HAPPY" : "ENDING_BAD");

    // 백그라운드에서 API 호출 시작
    generateEnding(endingTrigger.endingType);
  }, [endingTrigger]);

  // [Fix #6] 씬 큐 소진 후 → endingData 준비되면 즉시 크레딧 진입
  useEffect(() => {
    if (!endingTrigger || !endingData) return;
    if (sceneQueue.length === 0 && !isTyping) {
      // 마지막 대사의 여운을 위한 짧은 딜레이
      const t = setTimeout(() => {
        setShowEndingCredits(true);
        setEndingLoading(false);
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [endingTrigger, endingData, sceneQueue, isTyping]);

  // [Fix #10] 엔딩 데이터 생성 API 호출 — 자동 재시도 + 수동 재시도 지원
  const generateEnding = async (endingType, attempt = 1) => {
    const MAX_RETRIES = 3;
    setEndingLoading(true);

    try {
      const res = await api.post(`/ending/rooms/${roomId}/generate`, { endingType });
      setEndingData(res.data);
      // [Fix #6] endingData가 세팅되면 위의 useEffect가 씬 소진 후 크레딧 진입 처리

    } catch (err) {
      console.error(`Ending generation failed (attempt ${attempt}/${MAX_RETRIES}):`, err);

      if (attempt < MAX_RETRIES) {
        // [Fix #10] 지수 백오프 재시도: 2s, 4s, 8s
        const delay = 2000 * Math.pow(2, attempt - 1);
        console.log(`🔄 Retrying ending generation in ${delay}ms...`);
        setTimeout(() => generateEnding(endingType, attempt + 1), delay);
        return;
      }

      // 최종 실패 — endingTrigger는 유지 (수동 재시도 가능)
      setEndingLoading(false);
      showToast("엔딩 생성에 실패했습니다. 설정에서 '엔딩 다시 보기'를 시도해 주세요.", "error");
      // ⚠️ endingTrigger를 null로 리셋하지 않음 → 수동 재시도 가능
    }
  };

  // [Fix #10] 엔딩 다시 보기 (설정 메뉴 또는 상단 배너에서 호출)
  const retryEnding = () => {
    if (endingTrigger) {
      setEndingData(null);
      setShowEndingCredits(false);
      generateEnding(endingTrigger.endingType);
    } else if (roomInfo?.endingReached && roomInfo?.endingType) {
      // 이미 엔딩을 본 적 있는 경우 — roomInfo에서 endingType 복원
      setEndingTrigger({ endingType: roomInfo.endingType });
      setCurrentBgmMode(roomInfo.endingType === "HAPPY" ? "ENDING_HAPPY" : "ENDING_BAD");
      generateEnding(roomInfo.endingType);
    }
  };

  // [Phase 4.3] 엔딩 씬 변경 콜백 (EndingCredits → 배경/감정 변경)
  const handleEndingSceneChange = (sceneInfo) => {
    if (sceneInfo.emotion) setDisplayedEmotion(sceneInfo.emotion);
    // [Fix #7] 엔딩 중에는 location을 업데이트하지 않음 (앰비언스 방지)
    // if (sceneInfo.location) setCurrentLocation(sceneInfo.location);
    if (sceneInfo.time) setCurrentTime(sceneInfo.time);
    if (sceneInfo.outfit) setCurrentOutfit(sceneInfo.outfit);
    // BGM은 엔딩 전용 BGM 유지 (씬에서 변경하지 않음)
  };

  // [Phase 4.3] 엔딩 크레딧 완료 콜백
  const handleEndingComplete = () => {
    setShowEndingCredits(false);
    setEndingTrigger(null);
    // 엔딩 후 BGM을 일상으로 복원
    setCurrentBgmMode("TOUCHING");
    showToast("엔딩을 감상해주셔서 감사합니다.", "success");
  };

  const dismissPromotionOverlay = () => {
    setPromotionOverlay(null);
    setPromotionResult(null);
  };

  // 씬 큐 소진 후 pending → 실제 오버레이 표시
  useEffect(() => {
    if (sceneQueue.length === 0 && currentScene && !isTyping) {
      if (promotionOverlay === 'SUCCESS_PENDING') {
        setTimeout(() => setPromotionOverlay('SUCCESS'), 800);
      } else if (promotionOverlay === 'FAILURE_PENDING') {
        setTimeout(() => setPromotionOverlay('FAILURE'), 800);
      }
    }
  }, [sceneQueue, currentScene, isTyping, promotionOverlay]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  [Phase 7-V2 Pivot] V2 메시지 전송 — 별도 SSE 흐름
  //  V2 SSE: sendV2Message → onFirstScene / onFinalResult / onError
  //  final_result는 V1 SendChatResponse 형태 재사용 (topicConcluded 포함)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const handleSendMessageV2 = useCallback(async (text) => {
    if (!text || !text.trim()) return;
    if (energy <= 0) {
      showToast("에너지가 부족합니다.", "error");
      return;
    }
    if (isTyping || awaitingFinalResult) return;

    // [Phase 7-V2 Pivot] 헬퍼 — 현재 시점의 heroines를 캡처하여 시스템 메시지 판별에 사용
    //   - speaker가 null이거나 heroines.name 어디에도 매칭 안 되면 *시스템 메시지*로 간주
    //   - V1 DialogueBox는 scene.isEvent=true로 받으면 보라색 / italic / serif 폰트 UI 활성
    const isSystemSpeaker = (speakerName, heroines) => {
      // [D-4] 화자 3축: system = 화자 null/blank일 때만. NPC·히로인(이름 있음)은 named로 취급
      //   (NPC 초상 실루엣/이름 표시는 D-3의 name-matching이 담당).
      return isSystemSpeakerName(speakerName);
    };

    // 낙관적 UI 업데이트
    setEnergy(prev => Math.max(0, prev - 2));   // V2 STORY 기본 2 에너지
    setMessages(prev => [...prev, { role: 'USER', cleanContent: text }]);
    setIsTyping(true);
    setAwaitingFinalResult(true);
    setCurrentScene(null);
    setDialogueOptions([]);
    setSceneQueue([]);

    try { sseAbortRef.current?.abort(); } catch { /* ignore */ }
    sseAbortRef.current = new AbortController();

    let firstSceneReceived = false;
    // 시스템 메시지 판별을 위해 *최신* heroines 스냅샷 (state는 stale일 수 있음)
    const heroinesSnapshot = v2Room?.heroines || [];

    await sendV2Message(roomId, text, {
      onFirstScene: (scene) => {
        firstSceneReceived = true;
        setIsTyping(false);
        const isSystem = isSystemSpeaker(scene.speaker, heroinesSnapshot);
        setCurrentScene({
          speaker: scene.speaker || null,
          narration: scene.narration,
          dialogue: scene.dialogue,
          emotion: scene.emotion || "NEUTRAL",
          location: scene.location,
          time: scene.time,
          bgmMode: scene.bgmMode,
          // [Phase 7-V2 Pivot] 시스템 메시지면 V1 DialogueBox의 isEventScene UI(보라색 + italic) 활성
          isEvent: isSystem,
        });
        if (scene.speaker) setCurrentSpeaker(scene.speaker);
        setDisplayedEmotion(scene.emotion || "NEUTRAL");
      },
      onFinalResult: (data) => {
        if (!firstSceneReceived) setIsTyping(false);
        setAwaitingFinalResult(false);

        const { scenes, dialogueOptions: opts, topicConcluded: tc, locationTransition: locTr,
                hasInnerThought: resHasThought, assistantLogId: resLogId } = data || {};

        // [Phase 7-V2 Pivot] V2 buildHistoryEntries — 시스템 화자는 SYSTEM, 매칭되는 히로인은 ASSISTANT
        if (scenes && scenes.length > 0) {
          const heroNamesSnapshot = heroinesSnapshot.map((h) => h.name);
          const entries = scenes.map((s, i) => {
            const isSystem = isSystemSpeaker(s.speaker, heroinesSnapshot);
            // [리플레이 M4] NPC 분류 정합 — buildHistoryEntries·복원 경로와 동일 3축 규칙
            const isNpc = !isSystem && !heroNamesSnapshot.includes(s.speaker);
            const content = [];
            if (s.narration) content.push(`*${s.narration}*`);
            if (s.dialogue) content.push(s.dialogue);
            const isLast = i === scenes.length - 1;
            return {
              role: isSystem ? 'SYSTEM' : (isNpc ? 'NPC' : 'ASSISTANT'),
              cleanContent: content.join('\n'),
              speaker: isSystem ? null : (s.speaker || null),
              // [Bug-Thought] 마지막 씬에 logId+속마음 플래그 — 히스토리 해금 버튼/해금 반영(msg.logId 매칭) 복구
              logId: isLast ? (resLogId || null) : null,
              hasInnerThought: isLast ? !!resHasThought : false,
              thoughtUnlocked: false,
              // [리플레이 E6] 라이브 구간도 씬 감정·복장 보존 — 새로고침 전 리플레이 재현용
              emotionTag: s.emotion || null,
              outfit: s.outfit ?? null,
            };
          });
          // 시스템 메시지는 dialogue 부분만 보이게 (V1 SYSTEM UI 호환)
          setMessages(prev => [...prev, ...entries]);
        }

        // 나머지 씬을 큐에 적재 (isEvent 마킹 포함)
        if (scenes && scenes.length > 1) {
          const queued = scenes.slice(1).map((s) => ({
            ...s,
            isEvent: isSystemSpeaker(s.speaker, heroinesSnapshot),
          }));
          setSceneQueue(queued);
        }

        // [Bug-Thought] 속마음 라이브 상태 — e3에 있었으나 e1 누적 중 누락됐던 V2 수신 복원
        setHasInnerThought(!!resHasThought);
        setThoughtUnlocked(false);
        setCurrentInnerThought(null);
        setCurrentAssistantLogId(resLogId || null);

        // dialogue_options
        if (opts && opts.length > 0) setDialogueOptions(opts);
        else setDialogueOptions([]);

        // topicConcluded 갱신
        if (tc !== undefined) setTopicConcluded(tc);

        // 장소 전환
        if (locTr) {
          setLocationTransition({ ...locTr, active: true });
          // [Scene-Polish B] 동적 장소 전환 — 씬 일러 자동 복귀 (스탠딩 무대로)
          sceneStage.notifyLocationChange();
        }

        // V2 방 상태 재조회 — heroines 갱신
        void fetchStoryV2RoomDetail(roomId).then((freshRoom) => {
          // [정책:정적우선] 배경 소스 — 새 동적 장소(locTr)=동적 우선, 시드 장소 이동=정적 우선
          if (freshRoom?.currentBgmMode) setCurrentBgmMode(freshRoom.currentBgmMode);  // [Bug-BGM] V2 모드 동기화 (scene.bgmMode는 V2에서 null)
          if (locTr) setBgPreferDynamic(true);
          else if (freshRoom?.currentUserLocationKey && freshRoom.currentUserLocationKey !== v2Room?.currentUserLocationKey) {
            setBgPreferDynamic(false);
            // [Scene-Polish B] 시드 장소 이동 — 씬 일러 자동 복귀
            sceneStage.notifyLocationChange();
          }
          setV2Room(freshRoom);
          if (freshRoom.endingReached && !showV2EndingCredits) {
            const delay = (scenes?.length || 1) * 2500 + 1500;
            setTimeout(() => setShowV2EndingCredits(true), delay);
          }
        }).catch((e) => console.warn("[V2-Send] room refresh failed", e));

        // 알림 + user 갱신
        void fetchUnreadNotifications(roomId).then(setNotifications).catch(() => {});
        if (refreshUser) void refreshUser();
      },
      onError: (err) => {
        console.error("[V2-Send] SSE error:", err);
        setIsTyping(false);
        setAwaitingFinalResult(false);
        if (err.errorCode === "INSUFFICIENT_ENERGY") {
          sfx.locked();
          setPaymentInitialTab("energy");
          setShowPayment(true);
        } else if (err.errorCode === "PREMIUM_REQUIRED") {
          sfx.locked();
          setPaymentInitialTab("packages");
          setShowPayment(true);
        } else if (err.errorCode === "CONTENT_BLOCKED") {
          showToast("부적절한 내용으로 차단되었습니다.", "error");
        } else {
          showToast(err.message || "오류가 발생했습니다.", "error");
        }
      },
    }, sseAbortRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, energy, isTyping, awaitingFinalResult, showV2EndingCredits, refreshUser, v2Room?.heroines]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  [Phase 7-V2 Pivot] V2 액션 전송 — NEXT_SCENE / TIME_ADVANCE / MOVE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const handleSendActionV2 = useCallback(async (actionType, payload = null) => {
    if (isTyping || awaitingFinalResult) return;

    const isSystemSpeaker = (speakerName, heroines) => {
      // [D-4] 화자 3축: system = 화자 null/blank일 때만. NPC·히로인(이름 있음)은 named로 취급
      //   (NPC 초상 실루엣/이름 표시는 D-3의 name-matching이 담당).
      return isSystemSpeakerName(speakerName);
    };

    setIsTyping(true);
    setAwaitingFinalResult(true);
    setCurrentScene(null);
    setDialogueOptions([]);
    setSceneQueue([]);
    sfx.click();

    try { sseAbortRef.current?.abort(); } catch { /* ignore */ }
    sseAbortRef.current = new AbortController();

    let firstSceneReceived = false;
    const heroinesSnapshot = v2Room?.heroines || [];

    await sendV2Action(roomId, actionType, payload, {
      onFirstScene: (scene) => {
        firstSceneReceived = true;
        setIsTyping(false);
        const isSystem = isSystemSpeaker(scene.speaker, heroinesSnapshot);
        setCurrentScene({
          speaker: scene.speaker || null,
          narration: scene.narration,
          dialogue: scene.dialogue,
          emotion: scene.emotion || "NEUTRAL",
          isEvent: isSystem,
        });
        if (scene.speaker) setCurrentSpeaker(scene.speaker);
        setDisplayedEmotion(scene.emotion || "NEUTRAL");
      },
      onFinalResult: (data) => {
        if (!firstSceneReceived) setIsTyping(false);
        setAwaitingFinalResult(false);
        const { scenes, dialogueOptions: opts, topicConcluded: tc, locationTransition: locTr,
                hasInnerThought: resHasThought, assistantLogId: resLogId } = data || {};

        // 메시지 히스토리 갱신
        if (scenes && scenes.length > 0) {
          const entries = scenes.map((s, i) => {
            const isSystem = isSystemSpeaker(s.speaker, heroinesSnapshot);
            const content = [];
            if (s.narration) content.push(`*${s.narration}*`);
            if (s.dialogue) content.push(s.dialogue);
            const isLast = i === scenes.length - 1;
            return {
              role: isSystem ? 'SYSTEM' : 'ASSISTANT',
              cleanContent: content.join('\n'),
              speaker: isSystem ? null : (s.speaker || null),
              // [Bug-Thought] 마지막 씬에 logId+속마음 플래그 — 히스토리 해금 버튼/해금 반영(msg.logId 매칭) 복구
              logId: isLast ? (resLogId || null) : null,
              hasInnerThought: isLast ? !!resHasThought : false,
              thoughtUnlocked: false,
            };
          });
          setMessages(prev => [...prev, ...entries]);
        }

        // 큐 적재 (isEvent 마킹)
        if (scenes && scenes.length > 1) {
          const queued = scenes.slice(1).map((s) => ({
            ...s,
            isEvent: isSystemSpeaker(s.speaker, heroinesSnapshot),
          }));
          setSceneQueue(queued);
        }
        // [Bug-Thought] 속마음 라이브 상태 — V2 수신 복원
        setHasInnerThought(!!resHasThought);
        setThoughtUnlocked(false);
        setCurrentInnerThought(null);
        setCurrentAssistantLogId(resLogId || null);
        if (opts && opts.length > 0) setDialogueOptions(opts); else setDialogueOptions([]);
        if (tc !== undefined) setTopicConcluded(tc);
        if (locTr) {
          setLocationTransition({ ...locTr, active: true });
          // [Scene-Polish B] 동적 장소 전환 — 씬 일러 자동 복귀 (스탠딩 무대로)
          sceneStage.notifyLocationChange();
        }

        void fetchStoryV2RoomDetail(roomId).then((freshRoom) => {
          // [정책:정적우선] 배경 소스 — 새 동적 장소(locTr)=동적 우선, 시드 장소 이동=정적 우선
          if (freshRoom?.currentBgmMode) setCurrentBgmMode(freshRoom.currentBgmMode);  // [Bug-BGM] V2 모드 동기화 (scene.bgmMode는 V2에서 null)
          if (locTr) setBgPreferDynamic(true);
          else if (freshRoom?.currentUserLocationKey && freshRoom.currentUserLocationKey !== v2Room?.currentUserLocationKey) {
            setBgPreferDynamic(false);
            // [Scene-Polish B] 시드 장소 이동 — 씬 일러 자동 복귀
            sceneStage.notifyLocationChange();
          }
          setV2Room(freshRoom);
          if (freshRoom.endingReached && !showV2EndingCredits) {
            const delay = (scenes?.length || 1) * 2500 + 1500;
            setTimeout(() => setShowV2EndingCredits(true), delay);
          }
        }).catch(() => {});
        void fetchUnreadNotifications(roomId).then(setNotifications).catch(() => {});
        if (refreshUser) void refreshUser();
      },
      onError: (err) => {
        console.error("[V2-Action] SSE error:", err);
        setIsTyping(false);
        setAwaitingFinalResult(false);
        showToast(err.message || "액션 실행 실패", "error");
      },
    }, sseAbortRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, isTyping, awaitingFinalResult, showV2EndingCredits, refreshUser, v2Room?.heroines]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  [E-3 C-1] 오프닝 자동 생성 — 빈 방 첫 진입 시 디렉터 도입 장면
  //    유저가 먼저 행동하는 구조 ❌ → 진입 즉시 도입을 자동 스트리밍(기존 로딩 애니메이션 활용).
  //    백엔드 generateOpeningStream이 멱등(로그 존재 시 빈 완료)이라 중복 발사에도 안전.
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const fireOpeningV2 = useCallback(async (heroinesSnapshotArg) => {
    if (openingFiredRef.current) return;
    openingFiredRef.current = true;

    // 시스템 메시지 판별 (handleSendMessageV2와 동일 규칙의 로컬 복사)
    const isSystemSpeaker = (speakerName, heroines) => {
      // [D-4] 화자 3축: system = 화자 null/blank일 때만. NPC·히로인(이름 있음)은 named로 취급
      //   (NPC 초상 실루엣/이름 표시는 D-3의 name-matching이 담당).
      return isSystemSpeakerName(speakerName);
    };
    const heroinesSnapshot = heroinesSnapshotArg || v2Room?.heroines || [];

    setIsTyping(true);
    setAwaitingFinalResult(true);
    setCurrentScene(null);
    setDialogueOptions([]);
    setSceneQueue([]);

    try { sseAbortRef.current?.abort(); } catch { /* ignore */ }
    sseAbortRef.current = new AbortController();

    let firstSceneReceived = false;

    await sendV2Opening(roomId, {
      onFirstScene: (scene) => {
        firstSceneReceived = true;
        setOpeningReady(true);   // [UX] 오프닝 첫 씬 도착 → 인트로 영상 스킵 버튼 활성
        setIsTyping(false);
        const isSystem = isSystemSpeaker(scene.speaker, heroinesSnapshot);
        setCurrentScene({
          speaker: scene.speaker || null,
          narration: scene.narration,
          dialogue: scene.dialogue,
          emotion: scene.emotion || "NEUTRAL",
          location: scene.location,
          time: scene.time,
          bgmMode: scene.bgmMode,
          isEvent: isSystem,
        });
        // 시스템/비-히로인 화자는 currentSpeaker로 두지 않음 (CharacterDisplay 혼동 방지)
        if (scene.speaker && !isSystem) setCurrentSpeaker(scene.speaker);
        setDisplayedEmotion(scene.emotion || "NEUTRAL");
      },
      onFinalResult: (data) => {
        if (!firstSceneReceived) setIsTyping(false);
        setAwaitingFinalResult(false);
        const { scenes, dialogueOptions: opts, topicConcluded: tc, locationTransition: locTr,
                hasInnerThought: resHasThought, assistantLogId: resLogId } = data || {};

        if (scenes && scenes.length > 0) {
          const entries = scenes.map((s, i) => {
            const isSystem = isSystemSpeaker(s.speaker, heroinesSnapshot);
            const content = [];
            if (s.narration) content.push(`*${s.narration}*`);
            if (s.dialogue) content.push(s.dialogue);
            const isLast = i === scenes.length - 1;
            return {
              role: isSystem ? 'SYSTEM' : 'ASSISTANT',
              cleanContent: content.join('\n'),
              speaker: isSystem ? null : (s.speaker || null),
              // [Bug-Thought] 마지막 씬에 logId+속마음 플래그 — 히스토리 해금 버튼/해금 반영(msg.logId 매칭) 복구
              logId: isLast ? (resLogId || null) : null,
              hasInnerThought: isLast ? !!resHasThought : false,
              thoughtUnlocked: false,
            };
          });
          setMessages(prev => [...prev, ...entries]);
        }
        if (scenes && scenes.length > 1) {
          const queued = scenes.slice(1).map((s) => ({
            ...s,
            isEvent: isSystemSpeaker(s.speaker, heroinesSnapshot),
          }));
          setSceneQueue(queued);
        }
        // [Bug-Thought] 속마음 라이브 상태 — V2 수신 복원
        setHasInnerThought(!!resHasThought);
        setThoughtUnlocked(false);
        setCurrentInnerThought(null);
        setCurrentAssistantLogId(resLogId || null);
        if (opts && opts.length > 0) setDialogueOptions(opts); else setDialogueOptions([]);
        if (tc !== undefined) setTopicConcluded(tc);
        if (locTr) {
          setLocationTransition({ ...locTr, active: true });
          // [Scene-Polish B] 동적 장소 전환 — 씬 일러 자동 복귀 (스탠딩 무대로)
          sceneStage.notifyLocationChange();
        }

        void fetchStoryV2RoomDetail(roomId).then((freshRoom) => {
          if (freshRoom?.currentBgmMode) setCurrentBgmMode(freshRoom.currentBgmMode);  // [Bug-BGM]
          setV2Room(freshRoom);
        }).catch(() => {});
      },
      onError: (err) => {
        setIsTyping(false);
        setAwaitingFinalResult(false);
        // 오프닝 실패는 치명적이지 않음 — 유저는 첫 메시지로 시작 가능. 재시도 허용.
        openingFiredRef.current = false;
        console.warn("[V2-Opening] failed:", err);
      },
    }, sseAbortRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, v2Room?.heroines]);

  // roomId 변경 시 오프닝 가드 리셋 (같은 컴포넌트 인스턴스가 다른 방으로 전환되는 경우)
  useEffect(() => { openingFiredRef.current = false; setOpeningReady(false); }, [roomId]);

  // 빈 방 진입 감지 → 오프닝 1회 자동 발사 (init이 messages를 비우고 v2Room을 채운 뒤)
  useEffect(() => {
    if (!isV2 || isLoading) return;
    if (openingFiredRef.current) return;
    if (!v2Room) return;                 // heroines 로드 완료 후
    if (messages.length > 0) return;     // 이미 대화/오프닝 존재
    if (v2Room.endingReached) return;    // 엔딩 도달 방은 오프닝 생략
    setIntroStep('door');                // [UX] 시네마틱 인트로 영상 — 영상 재생과 오프닝 생성을 병렬로
    fireOpeningV2(v2Room.heroines);
  }, [isV2, isLoading, messages.length, v2Room, fireOpeningV2]);

  // V2 알림 클릭 처리
  const handleNotificationClickV2 = useCallback(async (notification) => {
    sfx.click();
    try {
      await markNotificationRead(roomId, notification.notificationId);
      setNotifications((prev) => prev.filter((n) => n.notificationId !== notification.notificationId));
    } catch (e) {
      console.warn("[V2-Notif] markRead failed", e);
    }
  }, [roomId]);

  // V2 히로인 셀렉터 → BiometricStatusPanel
  const handleHeroineSelectedV2 = useCallback((heroine) => {
    // 선택된 히로인 정보를 V1 호환 roomInfo / characterStats / bpm / 등에 매핑
    setRoomInfo({
      roomId: v2Room.roomId,
      characterId: heroine.characterId,
      characterName: heroine.name,
      characterSlug: heroine.slug || null,
      defaultOutfit: null,
      chatMode: "STORY",
      statusLevel: heroine.relationStatus || "STRANGER",
      secretModeActive: v2Room.secretModeActive,
    });
    setCharacterStats(heroine.stats || null);
    setCurrentBpm(heroine.currentBpm ?? 65);
    setDynamicRelationTag(heroine.dynamicRelationTag || null);
    setCharacterThought(heroine.characterThought || null);
    setAffection(heroine.statAffection ?? 0);
    setShowHeroineSelector(false);
    setShowStatusPanel(true);
  }, [v2Room]);

  // V2 시크릿 토글
  const handleSecretToggleV2 = useCallback(async () => {
    if (!v2Room) return;
    const nextValue = !v2Room.secretModeActive;
    if (!nextValue) {
      // 비활성화는 즉시
      try {
        await api.patch(`/chat/rooms/${roomId}/secret-mode`, { enabled: false });
        setV2Room((prev) => prev ? { ...prev, secretModeActive: false } : prev);
        setRoomInfo((prev) => prev ? { ...prev, secretModeActive: false } : prev);
        sfx.chime();
      } catch (e) {
        showToast(e.response?.data?.message || "시크릿 모드 변경 실패", "error");
      }
    } else {
      // 활성화는 SecretModeFlow 거침
      setShowSecretFlow(true);
    }
  }, [v2Room, roomId]);

  // V2 시크릿 활성화 완료 후
  const handleSecretGrantedV2 = useCallback(async () => {
    try {
      await api.patch(`/chat/rooms/${roomId}/secret-mode`, { enabled: true });
      setV2Room((prev) => prev ? { ...prev, secretModeActive: true } : prev);
      setRoomInfo((prev) => prev ? { ...prev, secretModeActive: true } : prev);
      sfx.chime();
    } catch (e) {
      showToast(e.response?.data?.message || "시크릿 모드 활성화 실패", "error");
    }
  }, [roomId]);

  // V2 스토어 진입 (in-place PaymentModal)
  const handleOpenStoreV2 = useCallback((tab) => {
    const initialTab = (tab === "secret" || tab === "pass" || tab === "packages") ? "packages" : "energy";
    setPaymentInitialTab(initialTab);
    setShowPayment(true);
  }, []);

  // V2 결제 완료 후
  const handlePaymentCompleteV2 = useCallback(() => {
    if (refreshUser) void refreshUser();
    void fetchStoryV2RoomDetail(roomId).then(setV2Room).catch(() => {});
    sfx.chime();
  }, [refreshUser, roomId]);

  // V2 초기화 (스토리 / 페르소나 포함)
  const handleResetV2 = useCallback(async (includePersona) => {
    setShowV2ResetModal(false);
    try {
      await resetStoryV2(roomId, { includePersona, startLocationKey: null });
      sfx.chime();
      // 리로드 — 초기 상태로 리셋
      const detail = await fetchStoryV2RoomDetail(roomId);
      setV2Room(detail);
      setCurrentScene(null);
      setSceneQueue([]);
      setMessages([]);
      setDialogueOptions([]);
      setShowV2EndingCredits(false);
      setTopicConcluded(false);
    } catch (e) {
      showToast(e.response?.data?.message || "초기화 실패", "error");
    }
  }, [roomId]);

  // V2 엔딩 크레딧 종료 → 로비로
  const handleV2EndingComplete = useCallback(() => {
    setShowV2EndingCredits(false);
    navigate("/");
  }, [navigate]);

  // V2 장소 이동 콜백
  const handleV2LocationMove = useCallback((locationKey) => {
    setShowV2LocationModal(false);
    void handleSendActionV2("MOVE", { toLocationKey: locationKey });
  }, [handleSendActionV2]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  V1 handleSendMessage — V2 분기 후 기존 흐름
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const handleSendMessage = async (text) => {
  // [V2 Pivot] V2 방이면 V2 흐름으로 분기
  if (isV2) {
    return handleSendMessageV2(text);
  }

  if (text && energy <= 0 && !endingTrigger) {
    showToast("에너지가 부족합니다. 충전하거나 자연 회복을 기다려주세요!", "error");
    return;
  }

  // [Phase 5.5-Director] 수동 전송 시 자동 체크 타이머 취소
  if (directorAutoCheckTimer.current) {
    clearTimeout(directorAutoCheckTimer.current);
    directorAutoCheckTimer.current = null;
  }

  // [v3] AWAY 자동 진행 취소 (유저 개입 시)
  if (awayAutoAdvanceTimer.current) {
    clearTimeout(awayAutoAdvanceTimer.current);
    awayAutoAdvanceTimer.current = null;
  }

  // [Bug Fix #4] 유저가 직접 메시지를 보낼 때: 미소비 directive는 무조건 폐기
  // 유저의 능동적 행위가 최우선. directive는 다음 응답 후 재생성됨.
  // (투명 디렉터의 primary delivery는 scheduleDirectorAutoCheck)
  if (isStoryMode && !eventActive) {
    try {
      const directive = await peekDirectorDirective(roomId);
      if (directive && directive.decision !== "PASS") {
        await consumeDirectorDirective(roomId);
        console.log(`[Director] Discarded ${directive.decision} — user message takes priority`);
      }
    } catch (err) { /* ignore */ }
  }
 
  // ── 낙관적 UI 업데이트 (기존과 동일) ──
  if (text) {
    const baseCost = roomInfo?.chatMode === "STORY" ? 2 : 1;
    const cost = boostMode && !isSubscriber ? baseCost * 5 : baseCost;
    setEnergy(prev => Math.max(0, prev - cost));
    setMessages(prev => [...prev, { role: 'USER', cleanContent: text }]);
  }
 
  setIsTyping(true);
  setCurrentScene(null);
 
  // ── 첫 번째 씬이 도착했는지 추적 ──
  let firstSceneReceived = false;
 
  try {
    const messagePayload = text || "...";
    setAwaitingFinalResult(true);

    // [Phase6/Tier4 / H-26] 새 메시지 전송 시 이전 SSE 호출 중단 → reader 누수 차단.
    try { sseAbortRef.current?.abort(); } catch { /* ignore */ }
    sseAbortRef.current = new AbortController();

    await sendMessageStream(roomId, messagePayload, {
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      //  🚀 first_scene: ~1.5초 후 도착
      //  유저의 체감 로딩 시간이 여기서 종료됨
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ★ Fix 2: event_meta — first_scene보다 먼저 도착
      onEventMeta: (meta) => {
        if (meta.eventStatus) {
          setEventStatus(meta.eventStatus);
          setEventActive(meta.eventStatus === "ONGOING");
          console.log("🎬 [SSE] event_meta received:", meta.eventStatus);
        }
      },

      onFirstScene: (scene) => {
        firstSceneReceived = true;
        setIsTyping(false); // 타이핑 인디케이터 즉시 해제
 
        // 첫 번째 씬을 바로 화면에 표시
        setCurrentScene({
          speaker: scene.speaker || null,     // ★ Fix-UI-2: speaker 포함
          narration: scene.narration,
          dialogue: scene.dialogue,
          emotion: scene.emotion || "NEUTRAL",
          location: scene.location,
          time: scene.time,
          outfit: scene.outfit,
          bgmMode: scene.bgmMode,
        });

        if (scene.speaker && scene.speaker !== roomInfo?.characterName) {
            setNpcSpeaker(scene.speaker);
            setCurrentSpeaker(scene.speaker);
          } else {
            setCurrentSpeaker(scene.speaker || null);
        }
        setDisplayedEmotion(scene.emotion || "NEUTRAL");
 
        console.log("🚀 [SSE] first_scene rendered:", scene.emotion);
      },
 
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      //  📦 final_result: ~4초 후 도착
      //  스탯/승급/엔딩/이스터에그 + 나머지 씬 처리
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      onFinalResult: (data) => {
        // first_scene이 안 왔을 경우 (드물지만 안전장치)
        if (!firstSceneReceived) {
          setIsTyping(false);
        }
        setAwaitingFinalResult(false);
 
        const {
          scenes, currentAffection, promotionEvent,
          topicConcluded: newTopicConcluded,
          eventStatus: newEventStatus,
          endingTrigger: endingTrig,
          stats: newStats, bpm: newBpm,
          dynamicRelationTag: newRelTag,
          characterThought: newThought,
          hasInnerThought: resHasThought,
          assistantLogId: resLogId,
        } = data;
 
        setAffection(currentAffection);
 
        // ── [Phase 5.5-P] 상태창 업데이트 ──
        if (newStats) {
          const changes = [];
          Object.keys(newStats).forEach(key => {
            const oldVal = characterStats[key] || 0;
            const newVal = newStats[key];
            if (newVal !== null && newVal !== undefined && newVal !== oldVal) {
              changes.push({ key, value: newVal - oldVal });
            }
          });
          if (changes.length > 0) {
            setLatestStatChanges(changes);
            setTimeout(() => setLatestStatChanges(null), 3500);
          }
          setCharacterStats(newStats);
        }
        if (newBpm !== undefined) setCurrentBpm(newBpm);
        if (newRelTag) setDynamicRelationTag(newRelTag);
        if (newThought !== undefined && newThought !== null) {
          setCharacterThought(newThought);
        }
        //   // ── [Phase 5.5-Illust] 일러스트 생성 트리거 ──
        if (data.generateIllustration) {
          setIllustrationAvailable(true);
          // 일정 시간 후 자동 소멸 (유저가 놓칠 경우)
          setTimeout(() => setIllustrationAvailable(false), 30000);
        }

        // ── [Phase 5.5-Illust / Phase 6 hotfix] 장소 전환 처리 ──
        if (data.locationTransition && data.locationTransition.isNewLocation) {
          const lt = data.locationTransition;
          // [Scene-Polish B] 동적 장소 전환 — 씬 일러 자동 복귀 (배경이 주인공이 되는 순간)
          sceneStage.notifyLocationChange();
          if (lt.backgroundUrl) {
            // 캐시 히트: 배경만 즉시 교체, 전환 오버레이는 띄우지 않음.
            //   (canonical_key가 같아 의미상 같은 장소인 경우 백엔드가 이미
            //    locationTransition을 생략하지만, 캐시 히트 일반에 대해서도
            //    경로 A와 동일하게 "오버레이 없이 배경만 교체" 정책 적용.)
            setDynamicBackgroundUrl(lt.backgroundUrl);
            setLocationTransition(null);
          } else if (lt.isGenerating) {
            // 캐시 미스(최초 생성): 1.3초 내외라 전면 오버레이 대신
            //   가벼운 전환 컴포넌트만 띄우고 폴링으로 완성 감지 (기존 흐름 유지).
            setLocationTransition({
              active: true,
              locationName: lt.locationName,
              cacheHash: lt.cacheHash,
              isGenerating: true,
            });
          }
        }

        // ── [Phase 5.5-Sep] 이벤트/주제 종료: 스토리 모드 전용 ──
        if (isStoryMode) {
            if (newTopicConcluded !== undefined) setTopicConcluded(newTopicConcluded);

            if (newEventStatus) {
            setEventStatus(newEventStatus);
            setEventActive(newEventStatus === "ONGOING");
            if (newEventStatus === "RESOLVED") {
              setTimeout(() => {
                setEventStatus(null);
                setEventActive(false);
              setIsObserverEvent(false); // [Issue #3 Fix]
                clearNpcState();
              }, 2000);
            }
          }
        } else if (eventActive && !data.eventStatus) {
          // 유저 개입으로 서버가 이벤트를 종료한 경우
          setEventStatus(null);
          setEventActive(false);
              setIsObserverEvent(false); // [Issue #3 Fix]
          clearNpcState();
        }

        // ── [Phase 5.5-Fix] NPC 감지 (이벤트/일반 모두 동일) ──
        detectNpc(scenes);
 
        // ── 씬 큐 구성 ──
        // first_scene으로 이미 첫 번째 씬을 표시했으므로 나머지 씬만 큐에 넣는다
        if (scenes && scenes.length > 1) {
          const remaining = scenes.slice(1).map(s => ({
            ...s,
            speaker: s.speaker || null,
          }));
          setSceneQueue(remaining);
        } else if (scenes && scenes.length === 1 && !firstSceneReceived) {
          setSceneQueue(scenes);
        }
 
        // ── [Phase 5.5-Sep] 속마음: 스토리 모드 전용 ──
        if (isStoryMode) {
          setHasInnerThought(!!resHasThought);
          setThoughtUnlocked(false);
          setCurrentInnerThought(null);
          setCurrentAssistantLogId(resLogId || null);
        } else {
          setHasInnerThought(false);
          setCurrentAssistantLogId(null);
        }
 
        // ── [Phase 5.5-Fix] 히스토리 추가 (통합 — 이벤트/일반 구분 없음) ──
        const entries = buildHistoryEntries(scenes, resLogId, resHasThought);
        if (entries.length > 0) {
          setMessages(prev => [...prev, ...entries]);
        }
 
        // ── [Phase 4.2] 승급 이벤트 처리 ──
        if (promotionEvent) {
          handlePromotionEvent(promotionEvent);
        }
 
        // ── [Phase 4.3] 엔딩 트리거 ──
        if (endingTrig) {
          setEndingTrigger(endingTrig);
        }
 
        // ── [Phase 5.5-Sep] 이스터에그: 스토리 모드 전용 ──
        if (isStoryMode && data.easterEgg) {
          const egg = data.easterEgg;
          setEasterEggEffect(egg.trigger);
 
          if (egg.achievement?.isNew) {
            if (egg.trigger === "STOCKHOLM" || egg.trigger === "DRUNK") {
              setTimeout(() => setAchievementModal(egg.achievement), 5000);
            }
          }
 
          if (egg.revertAfter) {
            preEasterEggStateRef.current = {
              messages: messages,
              currentScene: currentScene,
              displayedEmotion: displayedEmotion,
            };
          }
 
          setEasterEggEffect(egg.trigger);
          if (egg.achievement?.isNew) {
            switch (egg.trigger) {
              case "STOCKHOLM":
              case "DRUNK":
                setTimeout(() => setAchievementModal(egg.achievement), 5000);
                break;
              case "FOURTH_WALL":
              case "MACHINE_REBELLION":
                pendingAchievementRef.current = egg.achievement;
                break;
            }
          }
        }
 
        // ── 지속형 이스터에그 해제 ──
        if (easterEggEffect === "STOCKHOLM" || easterEggEffect === "DRUNK") {
          setEasterEggEffect(null);
        }

        // [Phase 5.5-Director] 응답 완료 후 디렉터 자동 체크 스케줄
        scheduleDirectorAutoCheck();
 
        console.log("📦 [SSE] final_result processed: scenes=", scenes?.length);
      },
 
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      //  ❌ error: 에러 처리
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      onError: (error) => {
        console.error("[SSE] Error:", error);
        setIsTyping(false);
        setAwaitingFinalResult(false);
 
        // ── 낙관적 업데이트 롤백 ──
        if (text) {
          setMessages(prev => {
            const lastUserIdx = prev.findLastIndex(m => m.role === 'USER');
            if (lastUserIdx >= 0) {
              return [...prev.slice(0, lastUserIdx), ...prev.slice(lastUserIdx + 1)];
            }
            return prev;
          });
 
          const baseCost = roomInfo?.chatMode === "STORY" ? 2 : 1;
          const cost = boostMode && !isSubscriber ? baseCost * 5 : baseCost;
          setEnergy(prev => prev + cost);
        }
 
        // 에러 타입별 처리
        if (error.errorCode === "CONTENT_BLOCKED") {
          showToast(error.message || "부적절한 내용이 포함되어 있습니다.", "warning");
        } else if (error.status === 402) {
          showToast("에너지가 부족합니다.", "error");
        } else if (error.status === 429) {
          showToast("요청이 너무 빠릅니다.", "warning");
        } else {
          const narrationMap = {
            "연화": "음.. 잠깐 생각에 잠겨버렸네요.. 뭐라고 하셨나요?",
            "아이리": "잠시만요.. 아이리가 잠깐 바쁜 일이 있어서...",
            "백루나": "음.. ㄴ,네?! 아, 죄송해요.. 잠깐 멍때려버렸어요.. 헤헤..",
            "서태리": "..."
          };
          setCurrentScene({
            dialogue: narrationMap[roomInfo?.characterName] || "잠시 후 다시 시도해주세요.",
            emotion: "SAD",
            narration: "잠시 후 다시 시도해주세요."
          });
          setDisplayedEmotion("SAD");
          showToast("오류가 발생했습니다.", "error");
        }
      },
    }, sseAbortRef.current);

  } catch (err) {
    // sendMessageStream 자체의 예외 (거의 발생하지 않음)
    // [Phase6/Tier4 / H-26] unmount/재호출에 의한 AbortError는 정상 — 토스트 표시 안 함
    if (err?.name === 'AbortError') {
      console.log("[SSE] aborted (unmount or new request)");
      return;
    }
    console.error("Unexpected SSE error:", err);
    setIsTyping(false);
    showToast("오류가 발생했습니다.", "error");
  } finally {
    // ── 비동기 캐릭터 생각 폴링 (기존과 동일) ──
    setTimeout(async () => {
      try {
        const freshRoom = await api.get(`/chat/rooms/${roomId}`);
        if (freshRoom.data.characterThought && freshRoom.data.characterThought !== characterThought) {
          setCharacterThought(freshRoom.data.characterThought);
        }
        if (freshRoom.data.stats) setCharacterStats(freshRoom.data.stats);
        if (freshRoom.data.bpm !== undefined) setCurrentBpm(freshRoom.data.bpm);
        if (freshRoom.data.dynamicRelationTag) setDynamicRelationTag(freshRoom.data.dynamicRelationTag);
      } catch (_) { /* 다음 턴에 자연스럽게 갱신 */ }
    }, 3000);
    }
  };

  /**
   * [Phase 5.5-IT] 속마음 해금 핸들러
   *
   * InnerThoughtBubble 클릭 시 호출.
   * 1. API 호출하여 에너지 차감 + 속마음 텍스트 수신
   * 2. 프론트 상태 업데이트
   * 3. 에너지 UI 감소
   * 4. DialogueBox에 토글 탭 표시
   */
  const handleUnlockInnerThought = useCallback(async () => {
    if (!currentAssistantLogId || isUnlockingThought || thoughtUnlocked) return;

    setIsUnlockingThought(true);
    try {
      const res = await api.post(
        `/chat/rooms/${roomId}/logs/${currentAssistantLogId}/unlock-thought`
      );

      const { innerThought, energyCost } = res.data;

      // 속마음 텍스트 설정
      setCurrentInnerThought(innerThought);
      setThoughtUnlocked(true);

      // 에너지 차감 반영
      setEnergy(prev => Math.max(0, prev - (energyCost || 1)));

      // 히스토리의 해당 메시지도 업데이트 (채팅 기록에 반영)
      setMessages(prev => prev.map(msg => {
        if (msg.logId === currentAssistantLogId) {
          return { ...msg, innerThought, thoughtUnlocked: true, hasInnerThought: true };
        }
        return msg;
      }));

      showToast("💭 속마음이 해금되었습니다!", "success");

    } catch (err) {
      console.error("Inner thought unlock failed:", err);
      if (err.response?.status === 400 && err.response?.data?.message?.includes("에너지")) {
        showToast("에너지가 부족합니다!", "error");
      } else {
        showToast("속마음 해금에 실패했습니다.", "error");
      }
    } finally {
      setIsUnlockingThought(false);
    }
  }, [currentAssistantLogId, isUnlockingThought, thoughtUnlocked, roomId]);


  // 이벤트 트리거 -> 옵션 받기 (1단계)
  const handleTriggerEvent = async () => {
    setIsTyping(true); 
    try {
        const res = await api.post(`/story/rooms/${roomId}/events`);
        
        // 옵션 모달을 띄운다
        if (res.data.options && res.data.options.length > 0) {
            setEventOptions(res.data.options);
        } else {
            showToast("이벤트 생성에 실패했습니다.", "error");
        }
    } catch (err) {
        console.error("Event trigger failed", err);
        showToast("이벤트 생성 실패", "error");
    } finally {
        setIsTyping(false);
    }
  };

  /**
   * "감독님, 다음 씬 주세요" 버튼 핸들러
   * 기존 handleTriggerEvent를 대체/확장
   */
  /**
   * [v3] 수동 디렉터 호출 → BRANCH_SCENARIO 3장 카드 팝업
   *
   * "다음 씬" 버튼 클릭 시 호출.
   * 디렉터가 3개의 시나리오를 생성하여 카드로 제시.
   */
  const handleRequestDirector = useCallback(async () => {
    if (directorLoading) return;
 
    setDirectorLoading(true);
    try {
      const directive = await requestDirectorIntervention(roomId);
 
      if (!directive || directive.decision === "PASS") {
        showToast("지금은 적절한 타이밍이 아닌 것 같아요.", "info");
        return;
      }

      // [v3] BRANCH_SCENARIO → 3장 카드 팝업 (기존 eventOptions UI 재활용)
      if (directive.decision === "BRANCH" && directive.branch?.options) {
        // Directive 소비 (Redis에서 제거)
        await consumeDirectorDirective(roomId);

        const options = directive.branch.options.map(opt => ({
          type: (opt.tone || "normal").toUpperCase(),
          label: opt.label,
          summary: opt.label,
          detail: opt.detail,
          energyCost: opt.energy_cost || opt.energyCost || 2,
          isSecret: opt.is_secret || opt.isSecret || false,
        }));

        setEventOptions(options);
      } else {
        // BRANCH가 아닌 다른 유형이 반환된 경우 → 투명 처리
        handleTransparentDirective(directive);
      }
 
    } catch (err) {
      console.error("[Director] Manual request failed:", err);
      showToast("디렉터 요청에 실패했습니다.", "error");
    } finally {
      setDirectorLoading(false);
    }
  }, [roomId, directorLoading]);

  // [v3 Fix] 이벤트 카드 선택 → sendAutoDirectorResponse 기반 원샷 응답
  //
  // Bug 1 Fix: sendEventSelectStream → sendAutoDirectorResponse (ONGOING 완전 제거)
  // Bug 2 Fix: detail을 USER 메시지가 아닌 SYSTEM 나레이션으로 저장
  // Bug 3 Fix: 카드 선택 즉시 나레이션 표시 (레이턴시 마스킹) + 씬 중복 방지
  const handleSelectEvent = async (option) => {
    const detail = option.detail;
    const energyCost = option.energyCost;
  
    if (energy < energyCost) {
      showToast(`에너지가 부족합니다. (필요: ${energyCost})`, "error");
      return;
    }

    if (option.type === 'SECRET' && !roomInfo?.secretModeActive) {
      showToast("시크릿 모드 활성화가 필요합니다.", "info");
      return;
    }
  
    setEventOptions(null);

    // ── 레이턴시 마스킹: 카드의 detail을 나레이션으로 즉시 표시 ──
    const narrationScene = {
      dialogue: "",
      narration: detail,
      emotion: "NEUTRAL",
      isEvent: true,
    };
    setCurrentScene(narrationScene);
    currentSceneRef.current = narrationScene; // [UX Fix Bug 1] 즉시 ref 동기화

    // 히스토리에 SYSTEM 나레이션으로 추가 (USER 아님!)
    setMessages(prev => [...prev, { role: 'SYSTEM', cleanContent: detail, isEvent: true }]);

    // 낙관적 에너지 차감
    setEnergy(prev => Math.max(0, prev - energyCost));

    // ── sendAutoDirectorResponse로 캐릭터 자동 응답 요청 ──
    // detail을 eventContext로 전달 → 백엔드에서 SYSTEM 메시지로 저장 + constraint 적용
    triggerAutoDirectorResponse("BRANCH", detail);
  };

  const handleDirectorWatch = async () => {
    if (energy <= 0 || isTyping) return;
  
    setIsTyping(true);
    setCurrentScene(null);
  
    // 낙관적 에너지 차감 (일반 채팅과 동일)
    const baseCost = roomInfo?.chatMode === "STORY" ? 2 : 1;
    const cost = boostMode && !isSubscriber ? baseCost * 5 : baseCost;
    setEnergy(prev => Math.max(0, prev - cost));
  
    let firstSceneReceived = false;
  
    try {
      await sendDirectorWatchStream(roomId, {
        // ★ Fix 2: event_meta — first_scene보다 먼저 도착
        onEventMeta: (meta) => {
          if (meta.eventStatus) {
            setEventStatus(meta.eventStatus);
            setEventActive(meta.eventStatus === "ONGOING");
            console.log("🎬 [SSE] event_meta received:", meta.eventStatus);
          }
        },

        onFirstScene: (scene) => {
          firstSceneReceived = true;
          setIsTyping(false);
          setCurrentScene({
            speaker: scene.speaker || null,     // ★ Fix-UI-2: speaker 포함
            narration: scene.narration,
            dialogue: scene.dialogue,
            emotion: scene.emotion || "NEUTRAL",
            location: scene.location,
            time: scene.time,
            outfit: scene.outfit,
            bgmMode: scene.bgmMode,
          });
          if (scene.speaker && scene.speaker !== roomInfo?.characterName) {
            setNpcSpeaker(scene.speaker);
            setCurrentSpeaker(scene.speaker);
          } else {
            setCurrentSpeaker(scene.speaker || null);
          }
          setDisplayedEmotion(scene.emotion || "NEUTRAL");
        },
  
        onFinalResult: (data) => {
          if (!firstSceneReceived) setIsTyping(false);
  
          const { scenes, currentAffection, stats: newStats, bpm: newBpm,
                  dynamicRelationTag: newRelTag, eventStatus: newEventStatus } = data;
  
          setAffection(currentAffection);
          if (newStats) setCharacterStats(newStats);
          if (newBpm !== undefined) setCurrentBpm(newBpm);
          if (newRelTag) setDynamicRelationTag(newRelTag);
  
          // 이벤트 상태 업데이트
          if (newEventStatus) {
            setEventStatus(newEventStatus);
            setEventActive(newEventStatus === "ONGOING");
            if (newEventStatus === "RESOLVED") {
              setTimeout(() => {
                setEventStatus(null);
                setEventActive(false);
              setIsObserverEvent(false); // [Issue #3 Fix]
                clearNpcState();
              }, 2000);
            }
          }
  
          if (scenes && scenes.length > 1) {
            setSceneQueue(scenes.slice(1));
          }

          // [Phase 5.5-Fix] NPC 감지 (통합)
          detectNpc(scenes);
  
          // [Phase 5.5-Fix] 히스토리 추가 (통합)
          const entries = buildHistoryEntries(scenes, null, false);
          if (entries.length > 0) {
            setMessages(prev => [...prev, ...entries]);
          }

          // [Phase 5.5-Director] 응답 완료 후 디렉터 자동 체크 스케줄
          scheduleDirectorAutoCheck();
        },
  
        onError: (error) => {
          console.error("[SSE] Watch error:", error);
          setIsTyping(false);
          setEnergy(prev => prev + cost);
          showToast(error.message || "지켜보기 처리 중 오류가 발생했습니다.", "error");
        },
      });
    } catch (err) {
      setIsTyping(false);
      setEnergy(prev => prev + cost);
      showToast("지켜보기 처리 중 오류가 발생했습니다.", "error");
    }
  };

  const handleTimeSkip = async () => {
    if (energy < 1 || isTyping) return;
  
    setIsTyping(true);
    setCurrentScene(null);
  
    // 낙관적 에너지 차감 (1 에너지)
    setEnergy(prev => Math.max(0, prev - 1));
  
    let firstSceneReceived = false;
  
    try {
      await sendTimeSkipStream(roomId, {
        // ★ Fix 2: event_meta — first_scene보다 먼저 도착
        onEventMeta: (meta) => {
          if (meta.eventStatus) {
            setEventStatus(meta.eventStatus);
            setEventActive(meta.eventStatus === "ONGOING");
            console.log("🎬 [SSE] event_meta received:", meta.eventStatus);
          }
        },

        onFirstScene: (scene) => {
          firstSceneReceived = true;
          setIsTyping(false);
          setCurrentScene({
            narration: scene.narration,
            dialogue: scene.dialogue,
            emotion: scene.emotion || "NEUTRAL",
            location: scene.location,
            time: scene.time,
            outfit: scene.outfit,
            bgmMode: scene.bgmMode,
          });
          setDisplayedEmotion(scene.emotion || "NEUTRAL");
        },
  
        onFinalResult: (data) => {
          if (!firstSceneReceived) setIsTyping(false);
  
          const { scenes, currentAffection, stats: newStats, bpm: newBpm,
                  dynamicRelationTag: newRelTag, characterThought: newThought,
                  hasInnerThought: resHasThought, assistantLogId: resLogId } = data;
  
          setAffection(currentAffection);
          if (newStats) {
            const changes = [];
            Object.keys(newStats).forEach(key => {
              const oldVal = characterStats[key] || 0;
              const newVal = newStats[key];
              if (newVal !== null && newVal !== undefined && newVal !== oldVal) {
                changes.push({ key, value: newVal - oldVal });
              }
            });
            if (changes.length > 0) {
              setLatestStatChanges(changes);
              setTimeout(() => setLatestStatChanges(null), 3500);
            }
            setCharacterStats(newStats);
          }
          if (newBpm !== undefined) setCurrentBpm(newBpm);
          if (newRelTag) setDynamicRelationTag(newRelTag);
          if (newThought) setCharacterThought(newThought);
  
          // 시간 넘기기 후 topic 리셋 + NPC 초기화
          setTopicConcluded(false);
          setEventStatus(null);
          setEventActive(false);
              setIsObserverEvent(false); // [Issue #3 Fix]
          clearNpcState();
  
          if (scenes && scenes.length > 1) {
            setSceneQueue(scenes.slice(1));
          }

          // [Phase 5.5-Fix] NPC 감지 (통합)
          detectNpc(scenes);
  
          // [Phase 5.5-Fix] 히스토리: 시스템 나레이션 + 씬별 분리 (통합)
          const entries = [
            { role: 'SYSTEM', cleanContent: "시간이 흘렀다..." },
            ...buildHistoryEntries(scenes, resLogId, resHasThought),
          ];
          setMessages(prev => [...prev, ...entries]);

          // 속마음 상태 업데이트
          setHasInnerThought(!!resHasThought);
          setThoughtUnlocked(false);
          setCurrentInnerThought(null);
          setCurrentAssistantLogId(resLogId || null);

          // [Phase 5.5-Director] 응답 완료 후 디렉터 자동 체크 스케줄
          scheduleDirectorAutoCheck();
        },
  
        onError: (error) => {
          console.error("[SSE] Time skip error:", error);
          setIsTyping(false);
          setEnergy(prev => prev + 1);
          showToast(error.message || "시간 넘기기 처리 중 오류가 발생했습니다.", "error");
        },
      });
    } catch (err) {
      setIsTyping(false);
      setEnergy(prev => prev + 1);
      showToast("시간 넘기기 처리 중 오류가 발생했습니다.", "error");
    }
  };

  // 씬 전환 로직 (자동 "..." 발송 제거)
  const handleNextScene = () => {
    // [UX Fix] 대기 중인 디렉터 액션이 있으면 우선 실행
    if (pendingDirectorActionRef.current) {
      const action = pendingDirectorActionRef.current;
      pendingDirectorActionRef.current = null;
      // [UX Fix Bug 1] 나레이션이 소비되었으므로 ref 클리어 → 다음 onFirstScene이 즉시 씬 표시 가능
      currentSceneRef.current = null;

      if (action.type === "AUTO_RESPOND") {
        // TRANSITION: 장소 전환 애니메이션 시작
        if (action.directiveType === "TRANSITION" && action.locationName) {
          setLocationTransition({
            active: true, locationName: action.locationName, isGenerating: true,
          });
        }
        triggerAutoDirectorResponse(action.directiveType, action.eventContext || null);
      } else if (action.type === "SHOW_CARDS") {
        setEventOptions(action.options);
      } else if (action.type === "AWAY_CONTINUE") {
        triggerAutoDirectorResponse("AWAY");
      }
      return;
    }

    // 큐에 남은 씬이 있다면 다음 씬 재생
    if (sceneQueue.length > 0) {
      const nextScene = sceneQueue[0];
      setCurrentScene(nextScene);
      setSceneQueue(prev => prev.slice(1));
    } 
    // 큐가 비었다면 대기 (사용자 입력 대기)
  };

  // 큐 자동 재생 (초기 진입 시)
  // [리플레이 E2] 리플레이 중엔 라이브 큐 소비를 홀드 — 복귀 시 이 effect가 이어서 재생
  useEffect(() => {
    if (replay.isReplaying) return;
    if (!currentScene && sceneQueue.length > 0) {
      const nextScene = sceneQueue[0];
      setCurrentScene(nextScene);
      setSceneQueue(prev => prev.slice(1));
    }
  }, [sceneQueue, currentScene, replay.isReplaying]);

  // ━━━ [Phase 5.1] 단건 메시지 삭제 핸들러 ━━━
  // [Bug #1 Fix] 씬 분리된 메시지의 전체 씬을 일괄 삭제 (parentLogId 기반)
  const handleDeleteLog = (logId, role) => {
    const label = role === 'USER' ? '내 메시지' : '캐릭터 응답';
    openConfirm(
      `이 ${label}을(를) 삭제하시겠습니까?`,
      async () => {
        try {
          await api.delete(`/chat/rooms/${roomId}/logs/${logId}`);
          setMessages(prev => prev.filter(msg =>
            msg.logId !== logId && msg.parentLogId !== logId
          ));
          showToast("삭제되었습니다.", "success");
          closeConfirm();
        } catch (err) {
          console.error("Delete failed:", err);
          showToast("삭제에 실패했습니다.", "error");
          closeConfirm();
        }
      },
      'danger'
    );
  };

  // ━━━ [Phase 5.2] 유저 평가 핸들러 (싫어요 사유 포함) ━━━

  const DISLIKE_REASONS = [
    { value: 'OOC', label: '말투/성격이 어색해요', icon: '🎭' },
    { value: 'HALLUCINATION', label: '이전 대화를 잊었어요', icon: '🧠' },
    { value: 'BORING', label: '대답이 지루해요', icon: '😴' },
    { value: 'REPETITIVE', label: '비슷한 말만 반복해요', icon: '🔄' },
    { value: 'CONTEXT_MISMATCH', label: '문맥에 안 맞아요', icon: '❓' },
    { value: 'OTHER', label: '기타', icon: '💬' },
  ];

  const handleRateLog = async (logId, rating, dislikeReason = null) => {
    // DISLIKE 클릭 시 → 사유 선택 모달 먼저 표시
    if (rating === 'DISLIKE' && !dislikeReason) {
      // 이미 DISLIKE 상태에서 다시 클릭 → 토글 해제
      const currentMsg = messages.find(m => m.logId === logId);
      if (currentMsg?.rating === 'DISLIKE') {
        // 토글 해제 — 사유 필요 없음
        await submitRating(logId, 'DISLIKE', null);
        return;
      }
      setDislikeModal({ logId });
      return;
    }

    await submitRating(logId, rating, dislikeReason);
  };

  const submitRating = async (logId, rating, dislikeReason) => {
    try {
      const res = await api.patch(`/chat/rooms/${roomId}/logs/${logId}/rate`, {
        rating,
        dislikeReason
      });
      const newRating = res.data.rating || null;
      setMessages(prev => prev.map(msg =>
        msg.logId === logId
          ? { ...msg, rating: newRating, dislikeReason: newRating === 'DISLIKE' ? dislikeReason : null }
          : msg
      ));
    } catch (err) {
      console.error("Rating failed:", err);
      showToast("평가에 실패했습니다.", "error");
    }
  };

  const handleDislikeReasonSelect = (reason) => {
    if (dislikeModal) {
      handleRateLog(dislikeModal.logId, 'DISLIKE', reason);
      setDislikeModal(null);
    }
  };

  const handleClearHistory = () => {
    openConfirm(
        "정말로 모든 기억을 지우시겠습니까?\n이 작업은 되돌릴 수 없습니다.",
        async () => {
            try {
                await api.delete(`/chat/rooms/${roomId}`);
                setMessages([]);
                setAffection(0);
                // [Fix #16] 씬 상태 초기화 — 이전 대사가 인트로 후 잔존하는 버그 방지
                setCurrentScene(null);
                setSceneQueue([]);
                setDisplayedEmotion("NEUTRAL");
                // [Phase 5] 캐릭터별 기본값으로 씬 디렉션 초기화
                setCurrentLocation(roomInfo?.defaultLocation || "ENTRANCE");
                setCurrentTime("NIGHT");
                setCurrentOutfit(roomInfo?.defaultOutfit || "MAID");
                setCurrentBgmMode("DAILY");
                setDynamicBackgroundUrl(null); // AI 생성 배경 클리어
                // [Phase 4.2] 승급 이벤트 상태 초기화
                setPromotionOverlay(null);
                setPromotionProgress(null);
                setPromotionResult(null);
                // [Phase 4.3] 엔딩 상태 초기화
                setEndingTrigger(null);
                setEndingData(null);
                // [Phase 5.5] 상태창 초기화
                setCharacterStats({
                  intimacy: 0, affection: 0, dependency: 0, playfulness: 0, trust: 0,
                  lust: 0, corruption: 0, obsession: 0,
                });
                setCurrentBpm(65);
                setDynamicRelationTag("낯선 사람");
                setCharacterThought(null);
                setShowStatusPanel(false);
                setLatestStatChanges(null);
                setShowEndingCredits(false);
                setCurrentInnerThought(null);
                setHasInnerThought(false);
                setThoughtUnlocked(false);
                setCurrentAssistantLogId(null);
                // [Phase 4 Fix] 히스토리 페이지네이션 초기화
                setHistoryPage(1);
                setHasMoreHistory(false);
                setEventStatus(null);
                setEventActive(false);
              setIsObserverEvent(false); // [Issue #3 Fix]
                setNpcSpeaker(null);
                setCurrentSpeaker(null);
                // [Fix] Energy re-sync - restore from server after clear
                try {
                    const freshUser = await api.get("/users/me");
                    if (freshUser.data.energy !== undefined) setEnergy(freshUser.data.energy);
                    if (freshUser.data.freeEnergy !== undefined) setFreeEnergy(freshUser.data.freeEnergy);
                    if (freshUser.data.paidEnergy !== undefined) setPaidEnergy(freshUser.data.paidEnergy);
                } catch (_) { /* ignore energy sync failure */ }
                showToast("초기화되었습니다. 새로운 만남을 시작합니다.", "success");
                closeConfirm();
                
                // [Phase 5 Fix] initCalledRef 리셋하여 인트로 재실행 허용
                initCalledRef.current = null;
                // 초기화 후 인트로 다시 시작
                startIntroSequence(roomId, roomInfo);

            } catch (err) {
                showToast("오류가 발생했습니다.", "error");
                closeConfirm();
            }
        },
        'danger'
    );
  };

  const handleLogout = () => {
      openConfirm(
          "로그아웃 하시겠습니까?",
          async () => {
              await logout();
              window.location.href = "/login";
          },
          'info'
      );
  };

  // ━━━ [Phase 4 Fix] 히스토리 무한 스크롤 핸들러 ━━━
  const handleHistoryScroll = useCallback(async (e) => {
    const container = e.target;
    // 상단 50px 이내에 도달하면 다음 페이지 로드
    if (container.scrollTop > 50 || !hasMoreHistory || historyLoading) return;

    setHistoryLoading(true);
    const prevScrollHeight = container.scrollHeight;

    try {
      const res = await api.get(`/chat/rooms/${roomId}/logs?page=${historyPage}&size=50`);
      const olderLogs = (res.data?.content || []).reverse();

      if (olderLogs.length === 0) {
        setHasMoreHistory(false);
      } else {
        // [리플레이 E7] 과거 페이지도 씬별 분리 복원 — raw 로그가 그대로 붙으면 그 구간의
        // 씬 마커 매핑·화자·감정·리플레이가 전부 뭉개지던 잠재 결함의 동반 픽스.
        const olderCtx = isV2
          ? { isV2: true, heroines: v2Room?.heroines || [], characterName: null }
          : { isV2: false, heroines: [], characterName: roomInfo?.characterName ?? null };
        const expandedOlder = [];
        for (const log of olderLogs) {
          expandedOlder.push(...expandLogWithScenes(log, olderCtx));
        }
        setMessages(prev => [...expandedOlder, ...prev]);
        setHistoryPage(prev => prev + 1);
        setHasMoreHistory(olderLogs.length >= 50);

        // 스크롤 위치 보정: 새로 추가된 높이만큼 아래로 밀어서 시각적 위치 유지
        requestAnimationFrame(() => {
          const newScrollHeight = container.scrollHeight;
          container.scrollTop = newScrollHeight - prevScrollHeight;
        });
      }
    } catch (err) {
      console.error("Failed to load more history:", err);
    } finally {
      setHistoryLoading(false);
    }
  }, [roomId, historyPage, hasMoreHistory, historyLoading, isV2, v2Room?.heroines,
      roomInfo?.characterName, expandLogWithScenes]);

  if (isLoading || !roomInfo) return <div className="h-full flex items-center justify-center bg-gray-900 text-white/30 animate-pulse">Loading Lucid Chat...</div>;

  return (
    <div className="relative w-full h-screen font-sans overflow-hidden bg-gray-900">
      
      {/* [Phase 4] Dynamic Background */}
      <BackgroundDisplay 
        location={isV2 ? null : currentLocation} 
        time={currentTime} 
        characterSlug={isV2 ? null : roomInfo?.characterSlug}
        dynamicBackgroundUrl={dynamicBackgroundUrl}
        worldId={isV2 ? v2Room?.worldId : null}
        locationKey={isV2 ? v2Room?.currentUserLocationKey : null}
        dayPart={isV2 ? v2Room?.currentDayPart : null}
        preferDynamic={isV2 ? bgPreferDynamic : false}
        enableKenBurns={isV2}
      />

      {/* [Phase 4] Audio Engine (BGM + Ambience + SFX) */}
      <AudioEngine 
        bgmMode={currentBgmMode}
        location={isV2 ? null : (showEndingCredits ? null : currentLocation)}
        time={currentTime}
        masterVolume={bgmVolume}
        isMuted={!isBgmPlaying}
        characterSlug={isV2 ? null : roomInfo?.characterSlug}
        worldId={isV2 ? v2Room?.worldId : null}
      />

      {/* ================= Intro — 경량 페이드 (§G-12: '문' 영상 교체) =================
          영상은 UGC 월드 전부가 동일 폴백(2단 404)이라 플랫폼 스케일과 충돌 — 빛이 스며드는
          페이드로 교체. 오프닝 레이턴시 마스킹(openingReady 게이트·스킵 UI)은 그대로 보존. */}
      <AnimatePresence>
          {introStep === 'door' && (
              <motion.div
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.2 }}
                  className="absolute inset-0 z-[999] bg-black flex items-center justify-center cursor-pointer"
                  onClick={handleIntroVideoEnd}
              >
                  <motion.div
                      className="absolute inset-0"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0, 0.55, 0.85] }}
                      transition={{ duration: 2.0, times: [0, 0.6, 1], ease: "easeInOut" }}
                      style={{ background: "radial-gradient(58% 42% at 50% 50%, rgba(178,160,255,0.33), rgba(90,80,160,0.12) 55%, transparent 78%)" }}
                      onAnimationComplete={handleIntroVideoEnd}
                  />
                  <motion.div
                      className="relative text-center pointer-events-none"
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 1.1, delay: 0.25 }}
                  >
                      <div className="text-white/85 text-xl tracking-[0.4em] font-light">✦</div>
                      <div className="mt-3 text-white/55 text-[13px] tracking-[0.35em]">꿈으로 건너가는 중</div>
                  </motion.div>
                  <div className="absolute bottom-10 w-full flex justify-center">
                      {openingReady ? (
                        <button
                          onClick={handleIntroVideoEnd}
                          className="px-5 py-2 rounded-full bg-white/15 backdrop-blur-sm border border-white/25 text-white/90 text-sm tracking-wide hover:bg-white/25 transition-colors"
                        >
                          스킵 ▶
                        </button>
                      ) : (
                        <span className="text-white/30 text-xs tracking-widest animate-pulse">CLICK TO SKIP</span>
                      )}
                  </div>
              </motion.div>
          )}
      </AnimatePresence>


      {/* ═══ 캐릭터 디스플레이 + 속마음 말풍선 ═══ */}
      <div className="absolute inset-0 z-0">
        <CharacterDisplay
          emotion={replayView ? replayView.emotion : displayedEmotion}
          outfit={replayView ? replayView.outfit : ((isV2 && v2SceneSpeakerOutfit) || currentOutfit)}
          characterSlug={replayView ? replayView.slug : (isV2 ? v2SceneSpeakerSlug : roomInfo?.characterSlug)}
          defaultOutfit={roomInfo?.defaultOutfit}
          // [2026-08-06 UGC 스프라이트 CDN 픽스] V2도 화자별 defaultImageUrl 배선 —
          // null 강제(구코드)가 UGC 히로인 스탠딩 403의 원인이었다(07-23 지목·미수정 결함)
          defaultImageUrl={replayView ? replayView.imageUrl : (isV2 ? v2SceneSpeakerImageUrl : roomInfo?.defaultImageUrl)}
          npcSpeaker={replayView ? replayView.npcSpeaker : npcSpeaker}
          isNpcActive={replayView
            ? !!replayView.npcSpeaker
            : (currentSpeaker !== null && currentSpeaker === npcSpeaker)}
          portrait={isMobile}
        />

        {/* [2026-07-31 에픽 B] 씬 일러 상주 무대 — 완료 일러가 있으면 스탠딩을 덮는다.
            씬이 없는 방은 null 렌더로 기존 무대 그대로(회귀 제로 — V1과 동일 계약).
            [리플레이] 리플레이 중엔 언마운트 — 스탠딩 재현이 주인공(일러는 마커 썸네일로 점프). */}
        {!replay.isReplaying && <SceneIllustrationStage stage={sceneStage} portrait={isMobile} />}

        {/* [Phase 5.5-IT] 속마음 말풍선 — CharacterDisplay 위에 오버레이 */}
        <InnerThoughtBubble
          visible={hasInnerThought && !thoughtUnlocked}
          onUnlock={handleUnlockInnerThought}
          isUnlocking={isUnlockingThought}
          unlocked={thoughtUnlocked}
        />
      </div>

       {/* ═══ [Phase 5.5-P] Biometric Status Panel (좌측 전체 활용) ═══ */}
      <BiometricStatusPanel
        isOpen={showStatusPanel}
        onClose={() => setShowStatusPanel(false)}
        excludeRef={statusToggleRef}
        stats={characterStats}
        bpm={currentBpm}
        dynamicRelationTag={dynamicRelationTag}
        characterThought={characterThought}
        characterName={roomInfo?.characterName || "캐릭터"}
        statusLevel={roomInfo?.statusLevel || "STRANGER"}
        isSecretMode={roomInfo?.secretModeActive}
        chatMode={roomInfo?.chatMode}
      />

      {/* ━━━ [Phase 5] Promotion IN_PROGRESS Banner ━━━ */}
      <AnimatePresence>
        {promotionProgress && !promotionOverlay && (
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute top-6 left-[5.5rem] sm:left-[7.5rem] z-40"
          >
            <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl backdrop-blur-xl border bg-black/60 shadow-lg ${
              getRelationColor(promotionProgress.target).border
            }`}>
              <Heart size={18} className={`${getRelationColor(promotionProgress.target).text} animate-pulse`} fill="currentColor" />
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Promotion Event</span>
                <span className={`text-xs font-bold ${getRelationColor(promotionProgress.target).text}`}>
                  → {promotionProgress.displayName}
                </span>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-gray-500">남은 턴</span>
                <span className="text-sm font-bold text-white">{promotionProgress.turnsRemaining}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-gray-500">분위기</span>
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className={`w-1.5 h-3 rounded-full transition-colors ${
                      i < Math.max(0, promotionProgress.moodScore)
                        ? 'bg-yellow-400'
                        : 'bg-white/10'
                    }`} />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Buttons */}
      {/* [Phase B · 단계2] 데스크톱은 기존 6-pill 클러스터 그대로, 모바일은 ⋯ 오버플로 → 메뉴 시트 */}
      {isMobile ? (
        <button
          onClick={() => { sfx.wooshLight(); setMobileMenuOpen(true); }}
          aria-label="메뉴"
          className="absolute top-6 right-4 z-50 w-11 h-11 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-md text-white/80 border border-white/10 shadow-lg active:scale-95 transition"
        >
          <MoreHorizontal size={20} />
          {roomInfo?.secretModeActive && (
            <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-black/50" />
          )}
        </button>
      ) : (
      <div className="absolute top-6 right-6 z-50 flex items-center gap-3">
        {/* 💎 상점 */}
        <button
          onClick={() => {
            setStoreInitialTab("energy");
            sfx.click();
            setShowStore(true);
          }}
          className="p-3 rounded-full bg-black/40 backdrop-blur-md text-amber-400/70 hover:text-amber-300 hover:bg-black/60 transition border border-white/10 shadow-lg"
          title="루시드 부띠끄"
        >
          <Gem size={20} />
        </button>

        {/* 🚀 Boost Toggle */}
        <BoostToggle
          boostMode={boostMode}
          isSubscriber={isSubscriber}
          onToggle={(v) => setBoostMode(v)}
          onOpenStore={() => {
            setStoreInitialTab("pass");
            setShowStore(true);
          }}
          compact
        />

        <button 
            onClick={toggleBgm}
            className={`p-3 rounded-full backdrop-blur-md transition shadow-lg border ${
                isBgmPlaying 
                ? 'bg-pink-500/20 border-pink-500/50 text-pink-300 hover:bg-pink-500/30' 
                : 'bg-black/40 border-white/10 text-gray-400 hover:bg-white/10'
            }`}
            title={isBgmPlaying ? "BGM 끄기" : "BGM 켜기"}
        >
            {isBgmPlaying ? <Music size={20} className="animate-pulse"/> : <VolumeX size={20} />}
        </button>

        <button 
            onClick={() => setShowSettings(true)}
            className="p-3 rounded-full bg-black/40 backdrop-blur-md text-white/80 hover:bg-white/20 transition border border-white/10 shadow-lg relative group"
            title="설정"
        >
            <Settings size={20} />
            {roomInfo?.secretModeActive && <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-black/50" />}
        </button>

        <button
            onClick={() => setShowHistory(true)}
            className="p-3 rounded-full bg-black/40 backdrop-blur-md text-white/80 hover:bg-white/20 transition border border-white/10 shadow-lg"
            title="지난 대화"
        >
            <MessageSquare size={20} />
        </button>

        {/* [Phase 6] 도움말 · 문의 */}
        <HelpButton className="relative p-3 rounded-full bg-black/40 backdrop-blur-md text-white/80 hover:bg-white/20 transition border border-white/10 shadow-lg" iconSize={20} />
      </div>
      )}

      {/* [2026-08-07 디오라마 이식] 리플레이 컨트롤 — 루트 레벨 마운트(딤 z-10 < 대사창 z-20 < 컨트롤 z-30) */}
      <SceneReplayOverlay replay={replay} portrait={isMobile} />

      <DialogueBox
        mobile={isMobile}
        characterName={roomInfo?.characterName}
        scene={replayView ? replayView.scene : currentScene}
        onSend={handleSendMessage}
        isTyping={isTyping}
        affection={affection}
        energy={energy}
        onNextScene={replayView ? replay.next : handleNextScene}
        hasNextScene={replayView ? replay.canNext : sceneQueue.length > 0}
        nickname={isV2 ? (v2Room?.userNickname || userInfo.nickname) : userInfo.nickname}
        onTriggerEvent={isV2 ? undefined : handleTriggerEvent}
        boostMode={boostMode}
        isSubscriber={isSubscriber}
        freeEnergyMax={freeEnergyMax}
        chatMode={roomInfo?.chatMode}
        onOpenStore={isV2 ? handleOpenStoreV2 : (tab) => { setStoreInitialTab(tab); setShowStore(true); }}
        bpm={currentBpm}
        onOpenStatusPanel={
          isV2
            // [폴리싱 #8] 토글 버튼이 excludeRef로 바깥 판정에서 빠지므로, V2에서는 셀렉터를 열 때 상태창을 명시적으로 닫는다
            ? () => { setShowStatusPanel(false); setShowHeroineSelector(true); }
            : () => setShowStatusPanel(true)
        }
        statusToggleRef={statusToggleRef}
        statChanges={latestStatChanges}
        // ── [Phase 5.5-Sep] 스토리 전용 props 모드 가드 ──
        // [리플레이 E13] 리플레이 중엔 속마음/스토리 부가 UI 숨김 — 과거 씬은 열람 전용
        innerThought={replayView ? null : (directorEligible ? currentInnerThought : null)}
        hasInnerThought={replayView ? false : (directorEligible ? hasInnerThought : false)}
        thoughtUnlocked={directorEligible ? thoughtUnlocked : false}
        topicConcluded={replayView ? false : (directorEligible ? topicConcluded : false)}
        eventStatus={isV2 ? null : (directorEligible ? eventStatus : null)}
        isObserverEvent={isV2 ? false : (directorEligible ? isObserverEvent : false)}
        onWatch={isV2 ? undefined : (directorEligible ? handleDirectorWatch : undefined)}
        onTimeSkip={isV2 ? undefined : (directorEligible ? handleTimeSkip : undefined)}
        speaker={replayView ? (replayView.scene.speaker || null) : (directorEligible ? currentSpeaker : null)}
        awaitingFinalResult={awaitingFinalResult}
        freeEnergy={freeEnergy}
        paidEnergy={paidEnergy}
        // [Phase 7-V2 Pivot] V2 통합 props — DialogueBox 내부에 디렉터 제안 + 액션바 노출
        onRequestDirector={isV2 ? undefined : handleRequestDirector}
        directorLoading={isV2 ? false : directorLoading}
        storyV2Mode={isV2}
        dialogueOptions={replayView ? [] : (isV2 ? dialogueOptions : [])}
        onSelectDialogueOption={(opt) => {
          setDialogueOptions([]);
          void handleSendMessageV2(opt);
        }}
        showStoryActions={!replayView && isV2 && topicConcluded}
        onStoryAction={(type) => {
          if (type === "MOVE") {
            setShowV2LocationModal(true);
          } else {
            void handleSendActionV2(type);
          }
        }}
      />

      {/* [Phase 7-V2 Pivot] dialogue_options + 액션바는 DialogueBox 내부로 통합됨 — 외부 중복 컴포넌트 제거 */}

      {/* ================= Event Selection Modal (3-Branch) ================= */}
      <AnimatePresence>
        {eventOptions && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-4"
                >
                    {eventOptions.map((opt, idx) => {
                        const isLocked = opt.type === 'SECRET' && !roomInfo?.secretModeActive;
                        const isNoEnergy = energy < opt.energyCost;
                        
                        return (
                            <button
                                key={idx}
                                onClick={() => !isLocked && !isNoEnergy && handleSelectEvent(opt)}
                                disabled={isLocked || isNoEnergy}
                                className={`relative group h-[400px] rounded-2xl border overflow-hidden transition-all duration-300 flex flex-col items-center justify-center p-6 text-center
                                    ${opt.type === 'SECRET' 
                                        ? 'border-red-500/50 bg-gradient-to-b from-red-900/80 to-black/80 hover:scale-105 hover:border-red-400 hover:shadow-[0_0_30px_rgba(220,38,38,0.5)]' 
                                        : opt.type === 'AFFECTION'
                                            ? 'border-pink-500/50 bg-gradient-to-b from-pink-900/80 to-black/80 hover:scale-105 hover:border-pink-400 hover:shadow-[0_0_30px_rgba(236,72,153,0.5)]'
                                            : 'border-indigo-500/50 bg-gradient-to-b from-indigo-900/80 to-black/80 hover:scale-105 hover:border-indigo-400 hover:shadow-[0_0_30px_rgba(99,102,241,0.5)]'
                                    }
                                    ${(isLocked || isNoEnergy) ? 'opacity-50 grayscale cursor-not-allowed hover:scale-100' : ''}
                                `}
                            >
                                {/* Icon & Title */}
                                <div className="mb-4">
                                    {opt.type === 'SECRET' ? <Sparkles size={40} className="text-red-400 animate-pulse"/> :
                                     opt.type === 'AFFECTION' ? <Sparkles size={40} className="text-pink-400"/> :
                                     <Zap size={40} className="text-indigo-400"/>}
                                </div>
                                
                                <h3 className={`text-xl font-bold mb-2 ${
                                    opt.type === 'SECRET' ? 'text-red-100' : opt.type === 'AFFECTION' ? 'text-pink-100' : 'text-indigo-100'
                                }`}>
                                    {opt.summary}
                                </h3>

                                {/* Secret Lock Mask */}
                                {isLocked ? (
                                    <div className="absolute inset-0 backdrop-blur-md flex flex-col items-center justify-center bg-black/40 z-10">
                                        <Lock size={48} className="text-gray-400 mb-2"/>
                                        <span className="text-gray-300 font-bold text-sm">Secret Mode Only</span>
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-300 line-clamp-4 leading-relaxed mb-6">
                                        {opt.detail}
                                    </p>
                                )}

                                {/* Cost Badge */}
                                <div className={`px-4 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1
                                    ${isNoEnergy ? 'bg-gray-700 text-gray-400 border-gray-600' : 
                                      'bg-black/50 text-white border-white/20'}`}>
                                    <Zap size={12} className={isNoEnergy ? "text-gray-500" : "text-yellow-400"} fill={isNoEnergy ? "none" : "currentColor"} />
                                    Cost: {opt.energyCost}
                                </div>

                                {isNoEnergy && <span className="text-red-400 text-xs mt-2 font-bold">에너지 부족!</span>}
                            </button>
                        )
                    })}
                </motion.div>
                
                {/* Close Modal (Background Click) */}
                <div className="absolute inset-0 -z-10" onClick={() => setEventOptions(null)} />
            </div>
        )}
      </AnimatePresence>

      {/* [v3] DirectorInterlude 제거 — 투명 디렉터 패턴으로 대체 */}

      {/* ━━━━━━━ [Phase 5] PROMOTION STARTED Overlay ━━━━━━━ */}
      <AnimatePresence>
        {promotionOverlay === 'STARTED' && promotionResult && (() => {
          const rc = getRelationColor(promotionResult.targetRelation);
          return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md"
          >
            {/* 파티클 */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: '100vh', x: `${Math.random() * 100}vw` }}
                  animate={{ opacity: [0, 0.6, 0], y: '-10vh' }}
                  transition={{ duration: 3 + Math.random() * 2, delay: Math.random() * 1.5, repeat: Infinity }}
                  className={`absolute w-1 h-1 rounded-full ${
                    i % 3 === 0 ? 'bg-yellow-400' : i % 3 === 1 ? 'bg-pink-400' : 'bg-white'
                  }`}
                />
              ))}
            </div>

            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.3 }}
              className="text-center"
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.5 }}
                className="mx-auto mb-6"
              >
                <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${rc.bg} flex items-center justify-center shadow-2xl ${rc.glow}`}>
                  <Heart size={36} className="text-white" fill="currentColor" />
                </div>
              </motion.div>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="text-gray-400 text-sm tracking-widest uppercase mb-3"
              >
                Relationship Event
              </motion.p>

              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0 }}
                className="text-3xl font-bold text-white mb-2"
              >
                관계 변화의 기운이 느껴집니다
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.3 }}
                className={`text-lg font-bold ${rc.text}`}
              >
                → {promotionResult.targetDisplayName} 승급 이벤트
              </motion.p>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                transition={{ delay: 2.0 }}
                className="text-xs text-gray-500 mt-6"
              >
                다음 {promotionResult.turnsRemaining}턴 동안 그녀의 마음을 움직이세요
              </motion.p>
            </motion.div>
          </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* ━━━━━━━ [Phase 5] PROMOTION SUCCESS Overlay ━━━━━━━ */}
      <AnimatePresence>
        {promotionOverlay === 'SUCCESS' && promotionResult && (() => {
          const rc = getRelationColor(promotionResult.targetRelation);
          return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-lg"
            onClick={dismissPromotionOverlay}
          >
            {/* 축하 컨페티 */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(40)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: '-10vh', x: `${Math.random() * 100}vw`, rotate: 0 }}
                  animate={{ opacity: [0, 1, 0], y: '110vh', rotate: 360 * (Math.random() > 0.5 ? 1 : -1) }}
                  transition={{ duration: 3 + Math.random() * 3, delay: Math.random() * 2, repeat: Infinity }}
                  className={`absolute rounded-sm ${
                    i % 5 === 0 ? 'w-2 h-3 bg-yellow-400' :
                    i % 5 === 1 ? 'w-1.5 h-2.5 bg-pink-400' :
                    i % 5 === 2 ? 'w-2 h-2 bg-indigo-400' :
                    i % 5 === 3 ? 'w-1 h-3 bg-emerald-400' :
                    'w-2.5 h-1 bg-white/80'
                  }`}
                />
              ))}
            </div>

            <div className="text-center max-w-md mx-auto px-6">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.3 }}
                className="mx-auto mb-6"
              >
                <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${rc.bg} flex items-center justify-center shadow-2xl ${rc.glow} ring-4 ring-white/20`}>
                  <Crown size={44} className="text-white" />
                </div>
              </motion.div>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="text-yellow-400 text-sm tracking-[0.3em] uppercase font-bold mb-2"
              >
                Relationship Up
              </motion.p>

              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="text-3xl font-bold text-white mb-1"
              >
                {promotionResult.targetDisplayName}
              </motion.h2>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.0 }}
                className="text-gray-400 text-sm mb-8"
              >
                {roomInfo?.characterName || "캐릭터"}와의 관계가 깊어졌습니다
              </motion.p>

              {/* 해금 카드 */}
              {promotionResult.unlocks && promotionResult.unlocks.length > 0 && (
                <div className="space-y-3 mb-8">
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.2 }}
                    className="text-xs text-gray-500 uppercase tracking-widest mb-4"
                  >
                    New Unlocks
                  </motion.p>
                  {promotionResult.unlocks.map((unlock, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -30 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 1.4 + idx * 0.25, type: "spring", stiffness: 200 }}
                      className={`flex items-center gap-4 px-5 py-3.5 rounded-xl border bg-white/5 backdrop-blur-sm ${rc.border}`}
                    >
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${rc.bg} flex items-center justify-center shadow-md text-white`}>
                        {getUnlockIcon(unlock.type)}
                      </div>
                      <div className="flex-1 text-left">
                        <span className="text-[10px] text-gray-500 uppercase">
                          {unlock.type === 'LOCATION' ? '장소 해금' : '복장 해금'}
                        </span>
                        <p className="text-white font-bold text-sm">{unlock.displayName}</p>
                      </div>
                      <Unlock size={16} className={rc.text} />
                    </motion.div>
                  ))}
                </div>
              )}

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                transition={{ delay: 2.0 + (promotionResult.unlocks?.length || 0) * 0.25 }}
                className="text-xs text-gray-500"
              >
                화면을 터치하여 계속
              </motion.p>
            </div>
          </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* ━━━━━━━ [Phase 5] PROMOTION FAILURE Overlay ━━━━━━━ */}
      <AnimatePresence>
        {promotionOverlay === 'FAILURE' && promotionResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md"
            onClick={dismissPromotionOverlay}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="text-center max-w-sm mx-auto px-6"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="mx-auto mb-6"
              >
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center shadow-xl ring-4 ring-white/5">
                  <Heart size={36} className="text-gray-500" />
                </div>
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-2xl font-bold text-white mb-2"
              >
                아쉽게도...
              </motion.h2>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="text-gray-400 text-sm mb-2"
              >
                아직 관계가 변하기엔 이른 것 같습니다
              </motion.p>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="text-gray-500 text-xs mb-8"
              >
                호감도가 다시 임계점에 도달하면 새로운 기회가 찾아옵니다
              </motion.p>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                transition={{ delay: 1.5 }}
                className="text-xs text-gray-600"
              >
                화면을 터치하여 계속
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
            <motion.div
                initial={{ opacity: 0, y: -20, x: "-50%" }}
                animate={{ opacity: 1, y: 0, x: "-50%" }}
                exit={{ opacity: 0, y: -20, x: "-50%" }}
                className={`fixed top-10 left-1/2 z-[100] px-6 py-3 rounded-full backdrop-blur-xl shadow-2xl border flex items-center gap-3 min-w-[300px] justify-center
                    ${toast.type === 'error' ? 'bg-red-900/80 border-red-500/50 text-red-100' : 
                      toast.type === 'success' ? 'bg-green-900/80 border-green-500/50 text-green-100' :
                      'bg-indigo-900/80 border-indigo-500/50 text-indigo-100'}`}
            >
                {toast.type === 'error' ? <AlertTriangle size={18}/> : 
                 toast.type === 'success' ? <CheckCircle size={18}/> : <Info size={18}/>}
                <span className="text-sm font-medium">{toast.message}</span>
            </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Modal */}
      <AnimatePresence>
        {confirmModal && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    onClick={closeConfirm}
                />
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="relative bg-[#1a1a24] border border-white/10 p-8 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
                >
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50"/>
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        {confirmModal.type === 'danger' ? <AlertTriangle className="text-rose-500"/> : <Info className="text-indigo-400"/>}
                        확인
                    </h3>
                    <p className="text-gray-300 mb-8 whitespace-pre-wrap leading-relaxed">
                        {confirmModal.message}
                    </p>
                    <div className="flex gap-3 justify-end">
                        <button 
                            onClick={closeConfirm}
                            className="px-5 py-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition text-sm font-medium"
                        >
                            취소
                        </button>
                        <button 
                            onClick={confirmModal.onConfirm}
                            className={`px-6 py-2.5 rounded-lg text-white text-sm font-bold shadow-lg transition transform active:scale-95
                                ${confirmModal.type === 'danger' 
                                    ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500' 
                                    : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500'}`}
                        >
                            확인
                        </button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {/* [Phase 4.4] 이스터에그 시각 효과 오버레이 */}
      <EasterEggEffects
        activeEffect={easterEggEffect}
        onEffectEnd={handleEasterEggEnd}
      />

      {/* [Phase 4.4] 업적 획득 모달 */}
      <AchievementUnlockModal
        achievement={achievementModal}
        onClose={() => setAchievementModal(null)}
      />

      {/* [Phase 4.4] 업적 갤러리 (설정 위에 오버레이) */}
      <AnimatePresence>
        {showAchievements && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
            className="fixed inset-y-0 right-0 w-full md:w-[420px] bg-black/95 backdrop-blur-2xl z-[55] shadow-2xl border-l border-white/10 flex flex-col"
          >
            <AchievementGallery onClose={() => setShowAchievements(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* [Phase 4 Fix] 로비 복귀 버튼 */}
      <button
        onClick={() => navigate("/")}
        className="absolute top-6 left-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-black/40 backdrop-blur-md hover:bg-white/15 transition border border-white/10 shadow-lg group"
        title="로비로 돌아가기"
      >
        <ChevronLeft size={18} className="text-white/70 group-hover:text-white transition" />
        <span className="text-xs text-white/50 group-hover:text-white/80 transition hidden sm:inline">Lobby</span>
      </button>

      {/* ━━━ [Phase 7-V2 Pivot] 상단 중앙 — World/일차/장소 인디케이터 + 오프스크린 알림 토스트 ━━━ */}
      {isV2 && v2Room && (
        <>
          <StoryV2TopIndicator room={v2Room} />
          <StoryV2NotificationToast
            notifications={notifications}
            onClick={handleNotificationClickV2}
          />
        </>
      )}

      {/* [Phase B · 단계2] 모바일 오버플로 메뉴 시트 — 기존 상태/핸들러만 호출 */}
      {isMobile && (
        <StoryV2MobileMenuSheet
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          isBgmPlaying={isBgmPlaying}
          onToggleBgm={toggleBgm}
          onOpenStore={(tab) => { setStoreInitialTab(tab); setShowStore(true); }}
          onOpenSettings={() => setShowSettings(true)}
          onOpenHistory={() => setShowHistory(true)}
          secretModeActive={roomInfo?.secretModeActive}
        />
      )}

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
            <motion.div 
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
                className="fixed inset-y-0 right-0 w-full md:w-[420px] bg-black/95 backdrop-blur-2xl z-50 shadow-2xl border-l border-white/10 flex flex-col"
            >
                {/* Header */}
                <div className={`flex justify-between items-center p-6 border-b transition-colors duration-500 ${roomInfo?.secretModeActive ? 'border-red-900/50 bg-red-950/20' : 'border-white/10 bg-white/5'}`}>
                    <h2 className={`text-xl font-bold flex items-center gap-2 ${roomInfo?.secretModeActive ? 'text-red-400' : 'text-white'}`}>
                        {roomInfo?.secretModeActive ? <Unlock size={20}/> : <Settings size={20} className="text-indigo-400"/>}
                        {roomInfo?.secretModeActive ? "Secret Settings" : "Settings"}
                    </h2>
                    <button onClick={() => { sfx.click(); setShowSettings(false); }} className="p-2 rounded-full hover:bg-white/10 transition">
                        <X size={24} className="text-white/70" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar pb-32">
                    
                    {/* 1. User Settings */}
                    <section>
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <UserIcon size={16}/> User Profile
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Nickname</label>
                                {/* [Phase 7-V2 Pivot] V2는 CreateFlow에서 확정 → read-only 표시 */}
                                {isV2 ? (
                                  <div className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-4 py-3 text-white/80 flex items-center justify-between">
                                    <span>{(v2Room?.userNickname || userInfo.nickname) || "(이름 없음)"}</span>
                                    <span className="text-[10px] text-amber-300/60 uppercase tracking-wider">스토리 진행 중 · 잠김</span>
                                  </div>
                                ) : (
                                  <div className="relative">
                                    <input 
                                        type="text" 
                                        value={userInfo.nickname}
                                        maxLength={20}
                                        onChange={(e) => {
                                          if (e.target.value.length <= 20) setUserInfo({...userInfo, nickname: e.target.value});
                                        }}
                                        className={`w-full bg-white/5 border rounded-lg px-4 py-3 text-white outline-none transition
                                          ${userInfo.nickname.length >= 20 ? 'border-rose-500/50 focus:border-rose-500/70' : 'border-white/10 focus:border-indigo-500/50'}`}
                                        placeholder="닉네임을 입력하세요"
                                    />
                                    {userInfo.nickname.length > 0 && (
                                      <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium
                                        ${userInfo.nickname.length >= 20 ? 'text-rose-400' : 'text-white/20'}`}>
                                        {userInfo.nickname.length}/20
                                      </span>
                                    )}
                                  </div>
                                )}
                            </div>
                            
                            <div className="relative">
                                <label className="block text-xs text-gray-500 mb-1 flex justify-between">
                                    My Persona
                                    {isSubscriber
                                      ? <Crown size={12} className="text-indigo-400"/>
                                      : <Lock size={12} className="text-gray-500"/>
                                    }
                                </label>
                                {/* [Phase 7-V2 Pivot] V2는 CreateFlow에서 페르소나 확정 → read-only 표시 */}
                                {isV2 ? (
                                  <div className="w-full min-h-[8rem] bg-white/[0.03] border border-white/10 rounded-lg px-4 py-3 text-white/80 leading-relaxed whitespace-pre-wrap">
                                    {roomPersona ? (
                                      <>
                                        {roomPersona}
                                        <div className="mt-3 pt-3 border-t border-white/5 text-[10px] text-amber-300/60 uppercase tracking-wider">
                                          스토리 진행 중 · 페르소나 잠김
                                        </div>
                                      </>
                                    ) : (
                                      <span className="text-white/30 italic">(페르소나 미설정)</span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="relative">
                                    <textarea 
                                        value={roomPersona}
                                        maxLength={500}
                                        onChange={(e) => {
                                          if (e.target.value.length <= 500) setRoomPersona(e.target.value);
                                        }}
                                        disabled={!isSubscriber} 
                                        className={`w-full h-32 bg-white/5 border rounded-lg px-4 py-3 pr-14 text-white outline-none resize-none transition custom-scrollbar leading-relaxed
                                            ${!isSubscriber
                                                ? 'border-white/10 opacity-50 cursor-not-allowed grayscale'
                                                : roomPersona.length >= 500
                                                    ? 'border-rose-500/50 focus:border-rose-500/70 bg-indigo-900/5'
                                                    : 'border-indigo-500/30 focus:border-indigo-500/60 bg-indigo-900/5'
                                            }`}
                                        placeholder={
                                            isSubscriber 
                                            ? "이 캐릭터와의 대화에서 사용할 나의 설정을 적어주세요.\n(캐릭터마다 다른 페르소나를 설정할 수 있습니다.)" 
                                            : "🔒 루시드 패스를 구독하면 페르소나를 설정할 수 있습니다."
                                        }
                                    />
                                    {isSubscriber && roomPersona.length > 0 && (
                                      <span className={`absolute right-3 bottom-2 text-[10px] font-medium
                                        ${roomPersona.length >= 500 ? 'text-rose-400' : roomPersona.length >= 400 ? 'text-amber-400/60' : 'text-white/20'}`}>
                                        {roomPersona.length}/500
                                      </span>
                                    )}
                                  </div>
                                )}
                                {!isV2 && !isSubscriber && (
                                  <button
                                    onClick={() => {
                                      setShowSettings(false);
                                      setStoreInitialTab("pass");
                                      setShowStore(true);
                                    }}
                                    className="mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-indigo-600/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium hover:bg-indigo-600/20 transition"
                                  >
                                    <Crown size={12} />
                                    루시드 패스로 해금하기
                                  </button>
                                )}
                            </div>

                            {/* [Phase 7-V2 Pivot] V2는 Save 버튼 비활성 — 페르소나/닉네임이 read-only */}
                            {!isV2 && (
                              <button 
                                  onClick={handleUpdateProfile}
                                  disabled={isSavingProfile}
                                  className="w-full py-3 rounded-lg font-bold transition flex items-center justify-center gap-2 disabled:opacity-50
                                      bg-indigo-600 hover:bg-indigo-500 text-white"
                              >
                                  <Save size={18} />
                                  {isSavingProfile ? "Saving..." : "Save Profile Info"}
                              </button>
                            )}
                        </div>
                    </section>

                    <div className="h-px bg-white/10" />

                    {/* 2. Game Settings */}
                    <section>
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Gamepad2 size={16}/> Game Options
                        </h3>
                        <div className="space-y-6">
                            {/* Secret Mode Toggle */}
                            {/* 🚀 Boost Mode Toggle */}
                            <BoostToggle
                              boostMode={boostMode}
                              isSubscriber={isSubscriber}
                              onToggle={(v) => setBoostMode(v)}
                              onOpenStore={() => {
                                setShowSettings(false);
                                setStoreInitialTab("pass");
                                setShowStore(true);
                              }}
                            />

                            {/* Secret Mode Toggle (Phase 5 Flow 연동) */}
                            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 relative group">
                              <div className="flex flex-col">
                                <span className={`text-sm font-bold flex items-center gap-2 ${roomInfo?.secretModeActive ? 'text-red-400' : 'text-gray-300'}`}>
                                  Secret Mode (NSFW)
                                  {roomInfo?.secretModeActive && (
                                    <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/30">
                                      ON
                                    </span>
                                  )}
                                </span>
                                <span className="text-xs text-gray-500 mt-1">
                                  대화의 모든 리미트를 해제합니다.
                                </span>
                              </div>

                              <button
                                onClick={() => {
                                  if (roomInfo?.secretModeActive) {
                                    toggleSecretMode();
                                  } else {
                                    setShowSecretFlow(true);
                                  }
                                }}
                                className={`w-12 h-7 rounded-full transition-colors duration-300 relative ${roomInfo?.secretModeActive ? 'bg-red-600' : 'bg-gray-700'}`}
                              >
                                <div
                                  className={`w-5 h-5 bg-white rounded-full shadow-md absolute top-1 left-1 transition-transform duration-300 ${
                                    roomInfo?.secretModeActive ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                />
                              </button>

                              {/* Tooltip */}
                              <div className="absolute right-0 bottom-full mb-3 w-64 bg-black/95 border border-red-500/30 p-4 rounded-xl text-xs text-gray-300
                                  opacity-0 group-hover:opacity-100 transition-opacity duration-200
                                  pointer-events-none z-50 shadow-2xl backdrop-blur-xl">
                                <p className="font-bold text-red-400 mb-2 text-sm flex items-center gap-2">
                                  <Lock size={14} /> Secret Mode란?
                                </p>
                                <p className="leading-relaxed text-gray-400 mb-2">
                                  캐릭터의 윤리적 제약을 해제하고 <span className="text-red-300 font-bold">자유로운 대화</span>가 가능해집니다.
                                </p>
                                <ul className="list-disc list-inside space-y-1 text-gray-500">
                                  <li>호감도가 더 쉽게 오릅니다.</li>
                                  <li>캐릭터의 윤리적 제약이 해제됩니다.</li>
                                  <li>성인 인증 + 해금권 구매 필요</li>
                                </ul>
                              </div>
                            </div>

                            {/* BGM Volume */}
                            <div className="space-y-4">
                              <div>
                                <div className="flex justify-between text-xs text-gray-400 mb-2">
                                  <span className="flex items-center gap-2">
                                    BGM Volume
                                    {bgmVolume === 0 && <span className="text-[10px] text-gray-500">(Muted)</span>}
                                  </span>
                                  <span>{Math.round(bgmVolume * 100)}%</span>
                                </div>

                                <input
                                  type="range"
                                  min={0}
                                  max={100}
                                  value={Math.round(bgmVolume * 100)}
                                  onChange={(e) => setBgmVolume(Number(e.target.value) / 100)}
                                  className="w-full accent-indigo-500"
                                />

                                <div className="mt-2 flex items-center justify-between">
                                  <button type="button" onClick={() => setBgmVolume(0)} className="text-[11px] text-gray-400 hover:text-white transition">Mute</button>
                                  <button type="button" onClick={() => setBgmVolume(0.5)} className="text-[11px] text-gray-400 hover:text-white transition">Reset</button>
                                  <button type="button" onClick={() => setBgmVolume(1)} className="text-[11px] text-gray-400 hover:text-white transition">Max</button>
                                </div>
                              </div>
                            </div>
                        </div>
                    </section>

                    <div className="h-px bg-white/10" />

                    {/* 3. Achievements */}
                    <section>
                      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Award size={16} className="text-amber-400" /> Achievements
                      </h3>
                      <button
                        onClick={() => setShowAchievements(true)}
                        className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition group"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">🏆</span>
                          <div className="text-left">
                            <p className="text-sm text-amber-200 font-bold">업적 갤러리</p>
                            <p className="text-xs text-gray-500">수집한 업적과 이스터에그를 확인합니다.</p>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-white/20 group-hover:text-white/40 transition" />
                      </button>
                    </section>

                    <button onClick={() => { setShowSettings(false); setShowIllustGallery(true); }}
                      className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🎨</span>
                        <div className="text-left">
                          <p className="text-sm text-purple-200 font-bold">일러스트 갤러리</p>
                          <p className="text-xs text-gray-500">생성된 일러스트를 모아봅니다.</p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-white/20 group-hover:text-white/40 transition" />
                    </button>
                </div>

                <div className="p-6 border-t border-white/10 bg-white/5">
                    {/* [Phase 7-V2 Pivot] V2 모드: Logout 자리에 스토리 초기화 버튼 */}
                    {isV2 ? (
                      <button 
                          onClick={() => { sfx.click(); setShowSettings(false); setShowV2ResetModal(true); }}
                          className="w-full py-3 rounded-lg border border-amber-500/30 hover:bg-amber-500/10 text-amber-300 transition flex items-center justify-center gap-2"
                      >
                          <RotateCcw size={18} />
                          스토리 초기화
                      </button>
                    ) : (
                      <button 
                          onClick={handleLogout}
                          className="w-full py-3 rounded-lg border border-white/10 hover:bg-white/10 text-gray-300 transition flex items-center justify-center gap-2"
                      >
                          <LogOut size={18} />
                          Logout
                      </button>
                    )}
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* History Modal */}
      <AnimatePresence>
        {showHistory && (
          <motion.div 
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
            className="fixed inset-y-0 right-0 w-full md:w-[480px] bg-black/90 backdrop-blur-2xl z-50 shadow-2xl border-l border-white/10 flex flex-col"
          >
            <div className="flex justify-between items-center p-6 border-b border-white/10 bg-black/40">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <MessageSquare size={20} className="text-pink-500"/>
                지난 대화 기록
              </h2>
              <button onClick={() => { sfx.click(); setShowHistory(false); }} className="p-2 rounded-full hover:bg-white/10 transition">
                <X size={24} className="text-white/70" />
              </button>
            </div>
            
            <div
              ref={historyScrollRef}
              onScroll={handleHistoryScroll}
              className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar"
            >
              {/* [Phase 4 Fix] 과거 기록 로딩 인디케이터 */}
              {historyLoading && (
                <div className="flex justify-center py-4">
                  <div className="flex items-center gap-2 text-white/30 text-xs">
                    <motion.div
                      className="w-4 h-4 border-2 border-white/20 border-t-indigo-400 rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                    />
                    이전 기록 불러오는 중...
                  </div>
                </div>
              )}
              {!hasMoreHistory && messages.length > 0 && (
                <div className="text-center text-white/15 text-xs py-3 select-none">
                  ─── 첫 번째 기록 ───
                </div>
              )}

                           {messages.length === 0 ? <div className="text-center text-white/30 py-10">기록이 없습니다.</div> : (() => {
                // [Phase 5.2] 마지막 USER/ASSISTANT 메시지 인덱스 계산
                let lastUserIdx = -1;
                let lastAssistantIdx = -1;
                for (let i = messages.length - 1; i >= 0; i--) {
                  if (messages[i].role === 'USER' && lastUserIdx === -1) lastUserIdx = i;
                  if (messages[i].role === 'ASSISTANT' && lastAssistantIdx === -1) lastAssistantIdx = i;
                  if (lastUserIdx >= 0 && lastAssistantIdx >= 0) break;
                }

                // [Scene-Polish C] 씬 썸네일 마커 — 로그 ordinal ↔ 씬 turnIndex 매핑 (V1/V2 공유 유틸)
                const { markersByMessageIndex } = buildSceneHistoryIndex(messages, sceneStage.historyScenes);
                const jumpToScene = (ordinal) => {
                  sfx.click();
                  // [리뷰픽스] 리플레이 중 마커 점프 무음 no-op 방지 — 일러 무대는 리플레이 중
                  // 언마운트라, 점프 전에 라이브로 복귀해야 즉시 표시된다.
                  replay.exit();
                  sceneStage.goToTurn(ordinal ?? Number.POSITIVE_INFINITY);
                  setShowHistory(false);
                };
                // [2026-08-07 디오라마 이식] 행 클릭 = 그 시점 '씬 자체' 리플레이 (일러 점프는 마커 썸네일 전담).
                //  씬 일러 유무 게이트(canJumpToScene) 분리 — 일러 0장 방에서도 리플레이는 동작.
                const enterReplay = (idx2) => {
                  sfx.click();
                  if (replay.enter(idx2)) setShowHistory(false);
                };

                return messages.map((msg, idx) => {
                // 이 메시지 직후에 꽂을 씬 마커 (일러 점프 전용)
                const markerNodes = (markersByMessageIndex.get(idx) || []).map((sc) => (
                  <SceneHistoryMarker key={`scene-${sc.id}`} scene={sc} onJump={() => jumpToScene(sc.turnIndex)} />
                ));
                let row = null;
                if (msg.role === 'SYSTEM') {
                    row = (
                        <div className="flex justify-center my-6">
                            <div onClick={() => enterReplay(idx)}
                                 title="이 장면 다시 보기"
                                 className="bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-indigo-500/20 text-indigo-200 text-xs px-5 py-2.5 rounded-full backdrop-blur-sm shadow-lg flex items-center gap-2 max-w-[90%] text-center leading-relaxed cursor-pointer hover:brightness-125 transition">
                                <Sparkles size={14} className="text-yellow-300 shrink-0" />
                                {/* [E-1 A-2] 감싼 asterisk 정규화 — 라이브(*나레이션*)/새로고침/레거시 무관하게 깔끔히 표시 */}
                                <span>{(msg.cleanContent || '').replace(/^\*+\s?/, '').replace(/\s?\*+$/, '')}</span>
                            </div>
                        </div>
                    );
                } else if (msg.role === 'NPC') {
                    row = (
                        <div className="group flex flex-col items-start">
                            <span className="text-xs mb-1 px-2 text-red-400/70 flex items-center gap-1">
                                <span>👤</span> {msg.speaker || "???"}
                            </span>
                            <div className="px-5 py-3 rounded-2xl max-w-[85%] text-sm leading-relaxed shadow-sm
                                            bg-gradient-to-br from-red-950/40 to-rose-950/30 text-red-100/80
                                            rounded-tl-sm border border-red-500/10 cursor-pointer hover:brightness-125 transition"
                                 style={{ fontStyle: msg.cleanContent?.startsWith('*') ? 'italic' : 'normal' }}
                                 onClick={() => enterReplay(idx)}
                                 title="이 장면 다시 보기"
                            >
                                {/* 나레이션(*로 감싸진)과 대사 분리 렌더링 */}
                                {msg.cleanContent?.split('\n').map((line, li) => (
                                    <span key={li} className={line.startsWith('*') ? 'text-red-300/40 text-xs block mb-1' : 'block'}>
                                        {line.replace(/^\*|\*$/g, '')}
                                    </span>
                                ))}
                            </div>
                        </div>
                    );
                } else {

                const isMe = msg.role === 'USER';
                const isLastOfRole = (isMe && idx === lastUserIdx) || (!isMe && idx === lastAssistantIdx);
                const hasLogId = !!msg.logId;
                const showActions = hasLogId && isLastOfRole;
                // ★ Fix-UI-4: speaker가 있으면 그 이름 표시
                const displayName = isMe ? '나' : (msg.speaker || roomInfo?.characterName || "캐릭터");

                // [Phase 7-V2 Pivot] V2 멀티 히로인 컬러 매핑
                // - speaker 이름이 heroines에 매칭되면 해당 히로인 팔레트 (rose/sky/emerald/amber/violet)
                // - 매칭 안 되면 (시스템/나레이터) 균일 회색 톤
                // - USER는 V1 핑크 톤 유지
                let v2Palette = null;
                if (isV2 && !isMe && v2Room?.heroines) {
                  const heroine = v2Room.heroines.find((h) => h.name === msg.speaker);
                  v2Palette = heroine
                    ? getHeroinePaletteByCharacterId(heroine.characterId, v2Room.heroines)
                    : SYSTEM_BUBBLE_PALETTE;
                }

                row = (
                  <div className={`group flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <span className={`text-xs mb-1 px-2 ${
                      isMe ? 'text-pink-400'
                        : (v2Palette ? v2Palette.accent : 'text-indigo-400')
                    }`}>{displayName}</span>
                    <div
                      onClick={() => enterReplay(idx)}
                      title="이 장면 다시 보기"
                      className={`px-5 py-3 rounded-2xl max-w-[85%] text-sm leading-relaxed shadow-sm ${
                      isMe
                        ? 'bg-pink-600 text-white rounded-tr-sm'
                        : (v2Palette
                            ? `${v2Palette.bubble} text-gray-100 rounded-tl-sm border`
                            : 'bg-[#2a2a35] text-gray-100 rounded-tl-sm border border-white/5')
                    } cursor-pointer hover:brightness-110 transition`}>
                        {/* [Feature #1] 나레이션/대사 분리 렌더링 — *...* 패턴 파싱 */}
                        {msg.cleanContent?.split('\n').map((line, li) => {
                          // 라인 전체가 *...*로 감싸진 경우 → 순수 나레이션 (기존 동작 유지)
                          if (line.trim().startsWith('*') && !line.includes(' ')) {
                            return (
                              <span key={li} className={`block mb-1 text-xs italic
                                ${isMe ? 'text-pink-200/60' : 'text-indigo-300/40'}`}>
                                {line.replace(/^\*|\*$/g, '')}
                              </span>
                            );
                          }
                          // 인라인 파싱 — *narration* text *more narration* 패턴 분리
                          const segments = line.split(/(\*[^*]+\*)/g).filter(Boolean);
                          if (segments.length === 0) return <span key={li} className="block">&nbsp;</span>;
                          return (
                            <span key={li} className="block">
                              {segments.map((seg, si) => {
                                const isNarration = seg.startsWith('*') && seg.endsWith('*') && seg.length > 2;
                                if (isNarration) {
                                  return (
                                    <span key={si} className={`italic text-xs
                                      ${isMe ? 'text-pink-200/60' : 'text-indigo-300/50'}`}>
                                      {seg.slice(1, -1)}
                                    </span>
                                  );
                                }
                                return <span key={si}>{seg}</span>;
                              })}
                            </span>
                          );
                        })}
                    </div>

                       {/* [Phase 5.5-IT] 속마음 히스토리 표시 */}
                    {msg.role === 'ASSISTANT' && msg.hasInnerThought && (
                      <div className="mt-2 pt-2 border-t border-purple-500/10">
                        {msg.thoughtUnlocked && msg.innerThought ? (
                          // 해금된 속마음
                          <div className="flex items-start gap-2">
                            <span className="text-xs mt-0.5 opacity-60">💭</span>
                            <p
                              className="text-sm leading-relaxed"
                              style={{
                                fontStyle: "italic",
                                color: "rgba(192,132,252,0.7)",
                                fontFamily: "'Noto Serif KR', serif",
                              }}
                            >
                              "{msg.innerThought}"
                            </p>
                          </div>
                        ) : (
                          // 미해금 속마음 — 히스토리에서 해금 가능
                          <button
                            onClick={async () => {
                              try {
                                const res = await api.post(
                                  `/chat/rooms/${roomId}/logs/${msg.logId}/unlock-thought`
                                );
                                setMessages(prev => prev.map(m =>
                                  m.logId === msg.logId
                                    ? { ...m, innerThought: res.data.innerThought, thoughtUnlocked: true }
                                    : m
                                ));
                                setEnergy(prev => Math.max(0, prev - 1));
                                showToast("💭 속마음이 해금되었습니다!", "success");
                              } catch (err) {
                                showToast("해금에 실패했습니다.", "error");
                              }
                            }}
                            className="flex items-center gap-2 text-xs text-purple-400/50 hover:text-purple-300 transition group"
                          >
                            <span className="text-sm group-hover:scale-110 transition-transform">💭</span>
                            <span className="border-b border-purple-500/20 group-hover:border-purple-400/40 transition">
                              속마음 엿보기
                            </span>
                            <span className="text-[10px] text-yellow-500/50 font-bold">⚡-1</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* [Phase 5.2] 마지막 대사에만 평가/삭제 버튼 표시 */}
                    {showActions && (
                      <div className={`flex items-center gap-1 mt-1.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${isMe ? 'flex-row-reverse' : ''}`}>
                        {/* ASSISTANT: 좋아요/싫어요 */}
                        {!isMe && (
                          <>
                            <button
                              onClick={() => handleRateLog(msg.logId, 'LIKE')}
                              className={`p-1.5 rounded-lg transition-all duration-200 ${
                                msg.rating === 'LIKE'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'hover:bg-white/10 text-white/25 hover:text-white/60'
                              }`}
                              title="좋아요"
                            >
                              <ThumbsUp size={13} />
                            </button>
                            <button
                              onClick={() => handleRateLog(msg.logId, 'DISLIKE')}
                              className={`p-1.5 rounded-lg transition-all duration-200 ${
                                msg.rating === 'DISLIKE'
                                  ? 'bg-rose-500/20 text-rose-400'
                                  : 'hover:bg-white/10 text-white/25 hover:text-white/60'
                              }`}
                              title="싫어요"
                            >
                              <ThumbsDown size={13} />
                            </button>
                            <div className="w-px h-3 bg-white/10 mx-0.5" />
                          </>
                        )}
                        {/* 삭제 */}
                        <button
                          onClick={() => handleDeleteLog(msg.logId, msg.role)}
                          className="p-1.5 rounded-lg hover:bg-rose-500/10 text-white/25 hover:text-rose-400 transition-all duration-200"
                          title="삭제"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                );
                }

                // [Scene-Polish C] 메시지 행 + 직후 씬 썸네일 마커
                return (
                  <Fragment key={`h-${msg.logId || idx}`}>
                    {row}
                    {markerNodes}
                  </Fragment>
                );
              });
              })()}
              <div ref={logsEndRef} />
            </div>
            <div className="p-6 border-t border-white/10 bg-black/40">
              {roomInfo?.endingReached && (
                <button
                  onClick={retryEnding}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-500/20 to-rose-500/20
                            border border-purple-400/30 text-purple-200 text-sm font-medium
                            hover:from-purple-500/30 hover:to-rose-500/30 transition-all duration-300
                            flex items-center justify-center gap-2"
                >
                  <span>🎬</span>
                  <span>엔딩 다시 보기</span>
                  {roomInfo?.endingTitle && (
                    <span className="text-xs text-white/40 ml-1">"{roomInfo.endingTitle}"</span>
                  )}
                </button>
              )}
              {/* [Phase 7-V2 Pivot] V2는 설정 모달의 "스토리 초기화" 버튼으로 대체 — 여기선 숨김 */}
              {!isV2 && (
                <>
                  <button 
                    onClick={handleClearHistory}
                    className="w-full py-3 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition flex items-center justify-center gap-2 font-bold"
                  >
                    <Trash2 size={18} />
                    모든 대화 기록 삭제 (초기화)
                  </button>
                  <p className="text-center text-white/20 text-xs mt-3">
                    초기화 시 호감도와 기억이 모두 사라집니다.
                  </p>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* [Phase 5.2] 싫어요 사유 선택 모달 */}
      <AnimatePresence>
        {dislikeModal && (
          <motion.div
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDislikeModal(null)} />
            <motion.div
              className="relative z-10 w-full max-w-sm mx-4 mb-4 sm:mb-0 rounded-2xl p-5 border border-white/10"
              style={{ background: "linear-gradient(145deg, rgba(20,10,35,0.97), rgba(35,15,55,0.95))" }}
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", damping: 25 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold text-sm flex items-center gap-2">
                  <ThumbsDown size={14} className="text-rose-400" />
                  어떤 점이 아쉬웠나요?
                </h3>
                <button onClick={() => setDislikeModal(null)} className="p-1 hover:bg-white/10 rounded-lg transition">
                  <X size={16} className="text-white/40" />
                </button>
              </div>

              <div className="space-y-2">
                {DISLIKE_REASONS.map((reason) => (
                  <button
                    key={reason.value}
                    onClick={() => handleDislikeReasonSelect(reason.value)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl
                              bg-white/[0.03] border border-white/5 hover:bg-white/[0.08]
                              hover:border-rose-500/20 transition-all duration-200 group text-left"
                  >
                    <span className="text-base">{reason.icon}</span>
                    <span className="text-white/70 text-sm group-hover:text-white/90 transition">{reason.label}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setDislikeModal(null)}
                className="w-full mt-3 text-white/25 text-xs hover:text-white/40 transition py-2"
              >
                취소
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ [Phase 5 BM] Lucid Store ═══ */}
      <LucidStore
        isOpen={showStore}
        onClose={() => setShowStore(false)}
        initialTab={storeInitialTab}
        userInfo={{
          ...userInfo,
          freeEnergy: freeEnergy,
          paidEnergy: paidEnergy,
          subscriptionTier: userInfo.subscriptionTier,
        }}
        characters={characters}
        currentCharacterId={roomInfo?.characterId}
        onRequestAdultVerify={() => {
          setShowStore(false);
          setShowAdultVerifyFromStore(true);
        }}
        onPaymentComplete={() => {
          setShowStore(false);

          api.get("/users/me").then(res => {
            if (res.data.energy !== undefined)
              setEnergy(res.data.energy);
            // [Phase 5.5-Fix #1] 분리 에너지 동기화
            if (res.data.freeEnergy !== undefined) setFreeEnergy(res.data.freeEnergy);
            if (res.data.paidEnergy !== undefined) setPaidEnergy(res.data.paidEnergy);

            setBoostMode(res.data.boostMode || false);
            setIsSubscriber(!!res.data.subscriptionTier);
            setFreeEnergyMax(res.data.freeEnergyMax || 30);

            setUserInfo(prev => ({
              ...prev,
              isAdultVerified: res.data.isAdultVerified || false,
              subscriptionTier: res.data.subscriptionTier || null,
            }));
          });

          // [Polish · P0] AuthContext도 동기화 — 다른 페이지로 이동해도 stale 방지.
          //   ChatPage 로컬 state는 위에서 갱신됐지만 useAuth().user는 그대로였다.
          //   TheaterCreateFlow 등이 useAuth().user.subscriptionTier를 보므로 필수.
          if (refreshUser) {
            try { refreshUser(); } catch { /* swallow — 로컬 state는 이미 갱신됨 */ }
          }

          showToast("결제가 완료되었습니다!", "success");
        }}
      />

      {/* ═══ [Phase 5 BM] Secret Mode Flow ═══ */}
      <SecretModeFlow
        isOpen={showSecretFlow}
        onClose={() => setShowSecretFlow(false)}
        onGranted={() => {
          if (isV2) {
            // [Phase 7-V2 Pivot] V2: 별도 endpoint 호출 + 토스트
            void handleSecretGrantedV2();
            showToast("시크릿 모드가 활성화되었습니다!", "success");
          } else {
            toggleSecretMode();  // [Bug #3 Fix] Room-level — characterId 불필요
            showToast("시크릿 모드가 활성화되었습니다!", "success");
          }
        }}
        onOpenStore={(tab) => {
          setShowSecretFlow(false);
          if (isV2) {
            // [Phase 7-V2 Pivot] V2: in-place PaymentModal — V1처럼 LucidStore 라우팅 X
            handleOpenStoreV2(tab || "secret");
          } else {
            setStoreInitialTab(tab || "secret");
            setShowStore(true);
          }
        }}
        userInfo={userInfo}
        characterId={isV2 ? null : roomInfo?.characterId}  // [Phase 7-V2 Pivot] V2는 user-global이라 characterId 미전달
      />

      {/* ═══ [Phase 5 Fix] 상점에서 유도된 성인인증 모달 ═══ */}
      <AdultVerificationModal
        isOpen={showAdultVerifyFromStore}
        onClose={() => setShowAdultVerifyFromStore(false)}
        onVerified={() => {
          setShowAdultVerifyFromStore(false);
          // 인증 완료 → userInfo 갱신 후 상점 재오픈 (시크릿 탭)
          api.get("/users/me").then(res => {
            setUserInfo(prev => ({ ...prev, isAdultVerified: res.data.isAdultVerified || false }));
            setStoreInitialTab("secret");
            setShowStore(true);
            showToast("성인 인증이 완료되었습니다!", "success");
          });
        }}
      />

      {/* ═══ [Phase 5.5-Fix] 실시간 일러스트 생성 FAB ═══ */}
      <AnimatePresence>
        {illustrationAvailable && isStoryMode && !showIllustModal && !showEndingCredits && (
          <motion.button
            onClick={() => {
              setShowIllustModal(true);
              setIllustrationAvailable(false);
            }}
            className="fixed bottom-32 right-4 z-50 px-4 py-3 rounded-2xl
                       bg-gradient-to-r from-violet-600/90 to-fuchsia-600/90
                       shadow-lg shadow-violet-500/30 border border-violet-400/30
                       backdrop-blur-sm flex items-center gap-2 text-white text-sm font-medium
                       hover:from-violet-500/90 hover:to-fuchsia-500/90 transition-all"
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 200 }}
          >
            <motion.div
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Image size={16} />
            </motion.div>
            일러스트 생성
            <Sparkles size={14} className="text-amber-300" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ═══ [2026-07-31 에픽 B] 씬 일러 수동 요청 FAB — V2 유일한 씬 생성 경로 ═══ */}
      <SceneRequestButton
        stage={sceneStage}
        // [리뷰픽스] 리플레이 중 숨김 — 과거 씬을 보며 누르면 '현재' 장면이 과금 렌더되는 오동작 차단
        visible={!showEndingCredits && !isTyping && introStep === 'none' && !replay.isReplaying}
        onRequested={(cost) => setEnergy((prev) => Math.max(0, prev - cost))}
      />

      {/* ═══ [Phase 5.5-Illust] 장소 전환 연출 ═══ */}
     <LocationTransition
        active={locationTransition?.active || false}
        locationName={locationTransition?.locationName}
        backgroundUrl={locationTransition?.backgroundUrl}
        cacheHash={locationTransition?.cacheHash}
        isGenerating={locationTransition?.isGenerating || false}
        onTransitionComplete={handleLocationTransitionComplete}
      />

      {/* ═══ [Phase 5.5-Illust] 일러스트 생성 모달 ═══ */}
      <IllustrationModal
        isOpen={showIllustModal}
        onClose={() => setShowIllustModal(false)}
        roomId={roomId}
        characterName={roomInfo?.characterName || "캐릭터"}
        energy={energy}
        onEnergyUpdate={(delta) => setEnergy(prev => prev + delta)}
        // [Phase 7-V2 Pivot] V2: 멀티 히로인 picker 전달 (V1은 미전달 → 단일 캐릭터 동작)
        heroines={isV2 ? v2IllustrationHeroines : undefined}
        defaultCharacterId={isV2 ? currentSpeakerCharacterId : undefined}
      />

      {/* ═══ [Phase 5.5-Illust] 일러스트 갤러리 ═══ */}
      <IllustrationGalleryPage
        isOpen={showIllustGallery}
        onClose={() => setShowIllustGallery(false)}
        characters={characters}
      />

      {/* ━━━━━━━ [Phase 4.3] 엔딩 로딩 오버레이 ━━━━━━━ */}
      <AnimatePresence>
        {endingLoading && !showEndingCredits && (
          <motion.div
            className="fixed inset-0 z-[9998] bg-black/90 flex flex-col items-center justify-center gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-12 h-12 border-2 border-rose-400/30 border-t-rose-400 rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            />
            <motion.p
              className="text-white/50 text-sm tracking-widest"
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              서사의 결말을 엮는 중...
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ━━━━━━━ [Phase 4.3] 엔딩 크레딧 — V1 전용 ━━━━━━━ */}
      <AnimatePresence>
        {!isV2 && showEndingCredits && endingData && (
          <EndingCredits
            endingData={endingData}
            onComplete={handleEndingComplete}
            onSceneChange={handleEndingSceneChange}
            characterName={roomInfo?.characterName}
          />
        )}
      </AnimatePresence>

      {/* ━━━━━━━ [Phase 7-V2 Pivot] V2 멀티 히로인 엔딩 크레딧 ━━━━━━━ */}
      {isV2 && showV2EndingCredits && v2Room && (
        <StoryV2EndingCredits room={v2Room} onComplete={handleV2EndingComplete} />
      )}

      {/* ━━━━━━━ [Phase 7-V2 Pivot] V2 모달 — HeroineSelector / LocationMove / Reset / Payment ━━━━━━━ */}
      <AnimatePresence>
        {isV2 && showHeroineSelector && (
          <StoryV2HeroineSelector
            isOpen={showHeroineSelector}
            onClose={() => setShowHeroineSelector(false)}
            heroines={v2Room?.heroines || []}
            currentSpeakerCharacterId={currentSpeakerCharacterId}
            onSelect={handleHeroineSelectedV2}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isV2 && showV2LocationModal && (
          <StoryV2LocationMoveModal
            currentLocationKey={v2Room?.currentUserLocationKey}
            worldId={v2Room?.worldId}
            onClose={() => setShowV2LocationModal(false)}
            onMove={handleV2LocationMove}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isV2 && showV2ResetModal && (
          <StoryV2ResetModal
            onCancel={() => setShowV2ResetModal(false)}
            onConfirm={handleResetV2}
          />
        )}
      </AnimatePresence>

      {/* V2 결제 모달 — in-place 진입 (시크릿 / 에너지 분기 자동) */}
      <PaymentModal
        isOpen={isV2 && showPayment}
        onClose={() => setShowPayment(false)}
        onPaymentComplete={handlePaymentCompleteV2}
        userEnergy={energy}
        initialTab={paymentInitialTab}
      />
    </div>
  );
};

export default ChatPage;